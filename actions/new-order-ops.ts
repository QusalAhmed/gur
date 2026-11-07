"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaffRole } from "@/lib/admin-guard";
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

/**
 * Searches customer profiles by Bangladeshi phone number.
 */
export async function searchCustomerByPhoneAction(
  rawPhone: string
): Promise<{ ok: boolean; data?: CustomerLookupResult | null; message?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    const normalized = normalizeBDPhone(rawPhone);
    const cleanDigits = rawPhone.replace(/[^0-9]/g, "");

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
      .or(`phone.eq.${normalized},phone.ilike.%${cleanDigits}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    if (!profile) {
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
    const supabase = await createClient();

    if (!params.items || params.items.length === 0) {
      return { ok: false, message: "An order must contain at least one item." };
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
      p_attribution: undefined,
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
