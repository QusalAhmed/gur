"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { mapDatabaseError } from "@/lib/admin-errors";
import { fallbackDistricts, fallbackDivisions } from "@/lib/supabase/api";
import {
  buildCustomerLookupResult,
  getBdPhoneQueryVariants,
  type CustomerLookupResult,
} from "@/lib/customer-autofill";
import { resolveEffectiveOrderStatus } from "@/types/order";

export type { CustomerLookupResult };


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
 * Searches customer history and profile records by Bangladeshi phone number.
 * Merges orders (preferring active/delivered over cancelled/incomplete), customers,
 * and profiles/addresses, returning deduplicated address options and stats.
 */
export async function searchCustomerByPhoneAction(
  rawPhone: string
): Promise<{ ok: boolean; data?: CustomerLookupResult | null; message?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const phoneQuery = getBdPhoneQueryVariants(rawPhone);
    if (!phoneQuery) {
      return { ok: true, data: null };
    }

    const supabase = getSupabaseAdmin();

    const [customerRes, profileRes, ordersRes, divisionsRes, districtsRes] = await Promise.all([
      Promise.resolve(
        supabase
          .from("customers")
          .select("id, user_id, phone, full_name, email, default_address, total_orders, total_spent, last_order_at")
          .in("phone", phoneQuery.variants)
          .limit(1)
          .maybeSingle()
      ).catch((err) => ({ data: null, error: err })),
      Promise.resolve(
        supabase
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
                name,
                status
              )
            )
          `
          )
          .in("phone", phoneQuery.variants)
          .limit(1)
          .maybeSingle()
      ).catch((err) => ({ data: null, error: err })),
      Promise.resolve(
        supabase
          .from("orders")
          .select(
            "id, order_number, status, grand_total, placed_at, created_at, customer_name, customer_phone, customer_alternative_phone, shipping_phone, customer_email, shipping_address, order_events(event_type, to_value, message)"
          )
          .in("customer_phone", phoneQuery.variants)
          .order("placed_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50)
      ).catch((err) => ({ data: null, error: err })),
      Promise.resolve(
        supabase.from("geo_divisions").select("id, name, name_bn").order("name", { ascending: true })
      ).catch(() => ({ data: null, error: null })),
      Promise.resolve(
        supabase.from("geo_districts").select("id, division_id, zone_id, name, name_bn").order("name", { ascending: true })
      ).catch(() => ({ data: null, error: null })),
    ]);

    if (ordersRes.error && customerRes.error && profileRes.error) {
      const friendly = mapDatabaseError(ordersRes.error);
      return { ok: false, message: friendly.message };
    }

    const customerData = customerRes.data || null;
    let profileData = profileRes.data || null;

    if (!profileData && customerData?.user_id && isValidUuid(customerData.user_id)) {
      try {
        const { data: linkedProfile } = await supabase
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
                name,
                status
              )
            )
          `
          )
          .eq("id", customerData.user_id)
          .maybeSingle();
        if (linkedProfile) {
          profileData = linkedProfile;
        }
      } catch {
        // Optional profile lookup failure shouldn't block customer autofill
      }
    }

    const linkedUserId = profileData?.id || customerData?.user_id || null;
    let profileAddresses: any[] = [];
    if (linkedUserId && isValidUuid(linkedUserId)) {
      try {
        const { data: addrRows } = await supabase
          .from("addresses")
          .select("id, label, recipient_name, phone, address_line, district_id, upazila, postal_code, is_default")
          .eq("user_id", linkedUserId)
          .order("is_default", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(10);
        profileAddresses = addrRows || [];
      } catch {
        // Optional addresses lookup failure shouldn't block customer autofill
      }
    }

    const geoDivisions =
      divisionsRes.data && divisionsRes.data.length > 0 ? divisionsRes.data : fallbackDivisions;
    const geoDistricts =
      districtsRes.data && districtsRes.data.length > 0 ? districtsRes.data : fallbackDistricts;

    const result = buildCustomerLookupResult({
      phone: rawPhone,
      customer: customerData
        ? {
            ...customerData,
            default_address:
              customerData.default_address &&
              typeof customerData.default_address === "object" &&
              !Array.isArray(customerData.default_address)
                ? (customerData.default_address as Record<string, any>)
                : null,
          }
        : null,
      profile: profileData,
      profileAddresses,
      orders: (ordersRes.data || []).map((o: any) => ({
        ...o,
        status: resolveEffectiveOrderStatus(o.status, o.order_events),
        shipping_address:
          o.shipping_address &&
          typeof o.shipping_address === "object" &&
          !Array.isArray(o.shipping_address)
            ? (o.shipping_address as Record<string, any>)
            : null,
      })),
      geoDivisions,
      geoDistricts,
    });

    return { ok: true, data: result };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}
