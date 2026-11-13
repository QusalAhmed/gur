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

export interface ManualOrderItem {
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  negotiatedPrice?: number | null; // If price overridden
}

export interface CreateManualOrderParams {
  channel: "phone" | "whatsapp" | "facebook" | "walk_in" | "admin";
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  userId?: string | null;
  businessId?: string | null;
  quoteRequestId?: string | null;
  refCode?: string | null;
  shippingAddress: {
    recipientName: string;
    phone: string;
    districtId: number;
    upazila?: string | null;
    addressLine: string;
    postalCode?: string | null;
  };
  shippingMethodId: string;
  paymentMethod: "cod" | "cash" | "credit_terms" | "bank_transfer" | "bkash" | "nagad" | "sslcommerz";
  couponCode?: string | null;
  customerNote?: string | null;
  items: {
    variantId: string;
    quantity: number;
    priceOverride?: number | null;
  }[];
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

/**
 * Creates an order directly for a caller / walk-in customer via RPC place_order.
 */
export async function createManualOrderAction(params: CreateManualOrderParams): Promise<{
  ok: boolean;
  orderId?: string;
  orderNumber?: string;
  message?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = getSupabaseAdmin();

    if (!params.items || params.items.length === 0) {
      return { ok: false, message: "An order must contain at least one item." };
    }
    if (!isValidUuid(params.shippingMethodId)) {
      return { ok: false, message: "Invalid shipping method ID." };
    }
    if (params.userId && !isValidUuid(params.userId)) {
      return { ok: false, message: "Invalid user ID." };
    }
    if (params.businessId && !isValidUuid(params.businessId)) {
      return { ok: false, message: "Invalid business ID." };
    }
    if (params.quoteRequestId && !isValidUuid(params.quoteRequestId)) {
      return { ok: false, message: "Invalid quote request ID." };
    }
    if (params.items.some((i) => !isValidUuid(i.variantId))) {
      return { ok: false, message: "Invalid item variant ID." };
    }

    if (!params.shippingAddress.districtId) {
      return { ok: false, message: "Delivery district is required." };
    }

    // Build price overrides map if any
    const priceOverrides: Record<string, number> = {};
    params.items.forEach((item) => {
      if (item.priceOverride !== undefined && item.priceOverride !== null && item.priceOverride > 0) {
        priceOverrides[item.variantId] = Number(item.priceOverride);
      }
    });

    const itemsPayload = params.items.map((i) => ({
      variant_id: i.variantId,
      quantity: Number(i.quantity),
    }));

    const customerPayload = {
      name: params.customerName.trim(),
      phone: normalizeBDPhone(params.customerPhone),
      email: params.customerEmail?.trim() || null,
    };

    const addressPayload = {
      recipient_name: params.shippingAddress.recipientName.trim() || params.customerName.trim(),
      phone: normalizeBDPhone(params.shippingAddress.phone || params.customerPhone),
      district_id: params.shippingAddress.districtId,
      upazila: params.shippingAddress.upazila?.trim() || null,
      address_line: params.shippingAddress.addressLine.trim(),
      postal_code: params.shippingAddress.postalCode?.trim() || null,
    };

    // Query recent storefront order or draft for this phone to auto-inherit web meta_tracking
    let inheritedAttribution: Record<string, any> | undefined = undefined;
    let matchedInquiryId: string | null = null;

    if (customerPayload.phone) {
      try {
        const { data: previousOrder } = await supabase
          .from("orders")
          .select("id, attribution, status")
          .eq("customer_phone", customerPayload.phone)
          .not("attribution", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (previousOrder?.attribution && typeof previousOrder.attribution === "object") {
          const prevAttr = previousOrder.attribution as Record<string, any>;
          const prevMeta = prevAttr.meta_tracking || {};
          const {
            purchase_event_sent_at,
            purchase_event_id,
            purchase_event_error,
            purchase_dispatched_at,
            event_id,
            last_link_opened_at,
            ...inheritedMeta
          } = prevMeta;
          const { sms_sent, ...restAttr } = prevAttr;
          inheritedAttribution = {
            ...restAttr,
            fbp: prevMeta.fbp || prevAttr.fbp || null,
            fbc: prevMeta.fbc || prevAttr.fbc || null,
            meta_tracking: {
              ...inheritedMeta,
              inherited_from_order_id: previousOrder.id,
              inherited_at: new Date().toISOString(),
            },
          };
        }
      } catch (prevErr) {
        console.warn("[createManualOrderAction] Could not lookup previous order attribution:", prevErr);
      }
    }

    // Lookup touchpoint inquiry by Reference Code (e.g. #W-7391) or customer phone
    if (params.refCode) {
      const cleanRef = params.refCode.replace(/^#/, "").trim();
      if (cleanRef && !cleanRef.includes("*") && /^[A-Za-z0-9_-]+$/.test(cleanRef)) {
        try {
          const escapedRef = cleanRef.replace(/[%_*?\\]/g, "\\$&");
          const { data: inquiry } = await supabase
            .from("storefront_inquiries")
            .select("id, ref_code, channel, customer_phone, fbp, fbc, client_ip, user_agent, event_source_url, meta_tracking")
            .ilike("ref_code", escapedRef)
            .limit(1)
            .maybeSingle();

          if (inquiry) {
            matchedInquiryId = inquiry.id;
            const meta = (inquiry.meta_tracking && typeof inquiry.meta_tracking === "object" && !Array.isArray(inquiry.meta_tracking))
              ? (inquiry.meta_tracking as Record<string, any>)
              : {};
            inheritedAttribution = {
              ...(inheritedAttribution || {}),
              channel_source: params.channel,
              inquiry_ref_code: inquiry.ref_code,
              fbp: inquiry.fbp || meta.fbp || inheritedAttribution?.fbp || null,
              fbc: inquiry.fbc || meta.fbc || inheritedAttribution?.fbc || null,
              client_ip: inquiry.client_ip || meta.client_ip_address || inheritedAttribution?.client_ip || null,
              user_agent: inquiry.user_agent || meta.client_user_agent || inheritedAttribution?.user_agent || null,
              event_source_url: inquiry.event_source_url || meta.event_source_url || null,
              meta_tracking: {
                ...meta,
                ...(inheritedAttribution?.meta_tracking || {}),
                fbp: inquiry.fbp || meta.fbp || inheritedAttribution?.fbp || null,
                fbc: inquiry.fbc || meta.fbc || inheritedAttribution?.fbc || null,
                client_ip_address: inquiry.client_ip || meta.client_ip_address || null,
                client_user_agent: inquiry.user_agent || meta.client_user_agent || null,
                event_source_url: inquiry.event_source_url || meta.event_source_url || null,
                matched_inquiry_id: inquiry.id,
                matched_ref_code: inquiry.ref_code,
                matched_at: new Date().toISOString(),
              },
            };
          }
        } catch (inqErr) {
          console.warn("[createManualOrderAction] Could not lookup inquiry by refCode:", inqErr);
        }
      }
    }

    // Secondary fallback: Match recent storefront inquiry by phone if no refCode provided
    if (!matchedInquiryId && customerPayload.phone) {
      try {
        const { data: phoneInquiry } = await supabase
          .from("storefront_inquiries")
          .select("id, ref_code, channel, customer_phone, fbp, fbc, client_ip, user_agent, event_source_url, meta_tracking")
          .eq("customer_phone", customerPayload.phone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (phoneInquiry) {
          matchedInquiryId = phoneInquiry.id;
          const meta = (phoneInquiry.meta_tracking && typeof phoneInquiry.meta_tracking === "object" && !Array.isArray(phoneInquiry.meta_tracking))
            ? (phoneInquiry.meta_tracking as Record<string, any>)
            : {};
          inheritedAttribution = {
            ...(inheritedAttribution || {}),
            channel_source: params.channel,
            inquiry_ref_code: phoneInquiry.ref_code,
            fbp: phoneInquiry.fbp || meta.fbp || inheritedAttribution?.fbp || null,
            fbc: phoneInquiry.fbc || meta.fbc || inheritedAttribution?.fbc || null,
            client_ip: phoneInquiry.client_ip || meta.client_ip_address || inheritedAttribution?.client_ip || null,
            user_agent: phoneInquiry.user_agent || meta.client_user_agent || inheritedAttribution?.user_agent || null,
            event_source_url: phoneInquiry.event_source_url || meta.event_source_url || null,
            meta_tracking: {
              ...meta,
              ...(inheritedAttribution?.meta_tracking || {}),
              fbp: phoneInquiry.fbp || meta.fbp || inheritedAttribution?.fbp || null,
              fbc: phoneInquiry.fbc || meta.fbc || inheritedAttribution?.fbc || null,
              client_ip_address: phoneInquiry.client_ip || meta.client_ip_address || null,
              client_user_agent: phoneInquiry.user_agent || meta.client_user_agent || null,
              event_source_url: phoneInquiry.event_source_url || meta.event_source_url || null,
              matched_inquiry_id: phoneInquiry.id,
              matched_ref_code: phoneInquiry.ref_code,
              matched_at: new Date().toISOString(),
            },
          };
        }
      } catch (phoneInqErr) {
        console.warn("[createManualOrderAction] Could not lookup inquiry by phone:", phoneInqErr);
      }
    }

    // Execute place_order RPC with staff permissions
    const { data, error } = await supabase.rpc("place_order", {
      p_items: itemsPayload as any,
      p_customer: customerPayload as any,
      p_shipping_address: addressPayload as any,
      p_shipping_method_id: params.shippingMethodId,
      p_payment_method: params.paymentMethod as any,
      p_coupon_code: params.couponCode?.trim() || undefined,
      p_customer_note: params.customerNote?.trim() || undefined,
      p_business_id: params.businessId || undefined,
      p_billing_address: undefined,
      p_attribution: inheritedAttribution ? (inheritedAttribution as any) : undefined,
      p_channel: params.channel,
      p_for_user: params.userId || undefined,
      p_quote_request_id: params.quoteRequestId || undefined,
      p_price_overrides: Object.keys(priceOverrides).length > 0 ? (priceOverrides as any) : undefined,
    });

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    const orderId = (data as any)?.order_id || (data as any)?.id;
    const orderNumber = (data as any)?.order_number;

    // Persist full meta_tracking into order's attribution column if inherited
    if (orderId && inheritedAttribution?.meta_tracking) {
      try {
        await supabase
          .from("orders")
          .update({
            attribution: {
              ...inheritedAttribution,
              channel_source: params.channel,
            },
          })
          .eq("id", orderId);
      } catch (attrSaveErr) {
        console.warn("[createManualOrderAction] Failed to persist full inherited meta_tracking:", attrSaveErr);
      }
    }

    // Mark matched storefront inquiry as converted
    if (orderId && matchedInquiryId) {
      try {
        await supabase
          .from("storefront_inquiries")
          .update({
            status: "converted",
            converted_order_id: orderId,
            customer_phone: customerPayload.phone || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchedInquiryId);
      } catch (inqUpdateErr) {
        console.warn("[createManualOrderAction] Failed to mark inquiry as converted:", inqUpdateErr);
      }
    }

    revalidatePath("/admin/orders");
    revalidatePath("/admin/overview");

    return {
      ok: true,
      orderId,
      orderNumber,
    };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}
