"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid, sanitizePostgrestFilterTerm } from "@/lib/security";
import { mapDatabaseError } from "@/lib/admin-errors";
import { normalizeBDPhone } from "@/lib/admin-format";

export interface CustomerLookupResult {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  businessId?: string | null;
  businessName?: string | null;
  address?: {
    districtId: number | null;
    upazila: string | null;
    addressLine: string;
    postalCode: string | null;
  } | null;
}


export interface InquiryLookupResult {
  refCode: string;
  channel: string;
  customerPhone?: string | null;
  hasMetaTracking: boolean;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  createdAt: string;
  metaTracking?: Record<string, any>;
}

/**
 * Searches storefront inquiry / lead touchpoint by reference code (e.g. #W-7391 or W-7391).
 */
export async function searchInquiryByRefCodeAction(
  rawRef: string
): Promise<{ ok: boolean; data?: InquiryLookupResult | null; message?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const cleanRef = rawRef.replace(/^#/, "").trim();
    if (!cleanRef) {
      return { ok: false, message: "Please provide a reference code." };
    }
    if (cleanRef.includes("*") || !/^[A-Za-z0-9_-]+$/.test(cleanRef)) {
      return { ok: false, message: "Invalid reference code format." };
    }
    const escapedRef = cleanRef.replace(/[%_*?\\]/g, "\\$&");

    const supabase = getSupabaseAdmin();
    const { data: inquiry, error } = await supabase
      .from("storefront_inquiries")
      .select("ref_code, channel, customer_phone, fbp, fbc, client_ip, meta_tracking, created_at")
      .ilike("ref_code", escapedRef)
      .limit(1)
      .maybeSingle();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    if (!inquiry) {
      return { ok: true, data: null };
    }

    const meta = (inquiry.meta_tracking && typeof inquiry.meta_tracking === "object" && !Array.isArray(inquiry.meta_tracking))
      ? (inquiry.meta_tracking as Record<string, any>)
      : {};
    const fbp = inquiry.fbp || meta.fbp || null;
    const fbc = inquiry.fbc || meta.fbc || null;
    const clientIp = inquiry.client_ip || meta.client_ip_address || null;

    return {
      ok: true,
      data: {
        refCode: inquiry.ref_code,
        channel: inquiry.channel,
        customerPhone: inquiry.customer_phone,
        hasMetaTracking: Boolean(fbp || fbc || clientIp),
        fbp,
        fbc,
        clientIp,
        createdAt: inquiry.created_at,
        metaTracking: meta,
      },
    };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}

/**
 * Searches customer profiles by Bangladeshi phone number.
 */
export async function searchCustomerByPhoneAction(
  rawPhone: string
): Promise<{ ok: boolean; data?: CustomerLookupResult | null; message?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = getSupabaseAdmin();

    const normalized = sanitizePostgrestFilterTerm(normalizeBDPhone(rawPhone));
    const cleanDigits = sanitizePostgrestFilterTerm(rawPhone.replace(/[^0-9]/g, ""));
    if (!normalized && !cleanDigits) {
      return { ok: true, data: null };
    }

    const orClauses = [
      ...(normalized ? [`phone.eq.${normalized}`] : []),
      ...(cleanDigits ? [`phone.ilike.%${cleanDigits}%`] : []),
    ];

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        phone,
        business_members (
          business_id,
          business_accounts (
            id,
            company_name,
            status
          )
        )
      `
      )
      .or(orClauses.join(","))
      .limit(1)
      .maybeSingle();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    if (!profile) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, full_name, phone, email, default_address")
        .or(orClauses.join(","))
        .limit(1)
        .maybeSingle();

      if (customer) {
        const addr = (customer.default_address as Record<string, any>) || {};
        return {
          ok: true,
          data: {
            id: customer.id,
            name: customer.full_name || "",
            phone: customer.phone || "",
            email: customer.email || null,
            businessId: null,
            businessName: null,
            address: addr.address_line
              ? {
                  districtId: null,
                  upazila: null,
                  addressLine: addr.address_line,
                  postalCode: null,
                }
              : null,
          },
        };
      }

      return { ok: true, data: null };
    }

    // Try to get default address
    const { data: address } = await supabase
      .from("addresses")
      .select("district_id, upazila, address_line, postal_code")
      .eq("user_id", profile.id)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();

    const bizMembers = Array.isArray(profile.business_members)
      ? profile.business_members[0]
      : profile.business_members;
    const bizAccount = Array.isArray(bizMembers?.business_accounts)
      ? bizMembers?.business_accounts[0]
      : bizMembers?.business_accounts;

    return {
      ok: true,
      data: {
        id: profile.id,
        name: profile.full_name || "",
        phone: profile.phone || "",
        email: null,
        businessId: bizAccount?.id || null,
        businessName: bizAccount?.company_name || null,
        address: address
          ? {
              districtId: address.district_id,
              upazila: address.upazila,
              addressLine: address.address_line,
              postalCode: address.postal_code,
            }
          : null,
      },
    };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}
