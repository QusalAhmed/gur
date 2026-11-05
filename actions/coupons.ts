"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CouponItem {
  id: string;
  code: string;
  description: string;
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: string;
  valueNumeric: number;
  minOrder: string;
  maxDiscount: string;
  usage: string;
  status: "active" | "inactive" | "expired";
  b2bOnly: boolean;
  validUntil: string;
}

export interface RedemptionItem {
  id: string;
  coupon: string;
  orderId: string;
  customer: string;
  discount: string;
  date: string;
}

export async function getAdminCouponsAction(): Promise<{
  success: boolean;
  data: {
    coupons: CouponItem[];
    redemptions: RedemptionItem[];
  };
  error?: string;
}> {
  try {
    const [couponsRes, redemptionsRes] = await Promise.all([
      supabaseAdmin
        .from("coupons")
        .select(
          `
          id,
          code,
          description,
          discount_type,
          value,
          max_discount_amount,
          min_order_amount,
          starts_at,
          ends_at,
          usage_limit_total,
          used_count,
          business_only,
          is_active,
          created_at
        `
        )
        .order("created_at", { ascending: false }),

      supabaseAdmin
        .from("coupon_redemptions")
        .select(
          `
          id,
          coupon_id,
          order_id,
          discount_amount,
          created_at,
          coupons:coupon_id (
            code
          ),
          orders:order_id (
            order_number,
            customer_name
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const rawCoupons = couponsRes.data || [];
    const rawRedemptions = redemptionsRes.data || [];

    const now = new Date();

    const coupons: CouponItem[] = rawCoupons.map((c) => {
      const isExpired = c.ends_at && new Date(c.ends_at) < now;
      let statusVal: CouponItem["status"] = "active";
      if (!c.is_active) statusVal = "inactive";
      else if (isExpired) statusVal = "expired";

      const valNum = Number(c.value || 0);
      let valueStr = `৳ ${valNum.toLocaleString("en-BD")}`;
      if (c.discount_type === "percentage") valueStr = `${valNum}% off`;
      else if (c.discount_type === "free_shipping") valueStr = "Free Shipping";

      const minOrderStr = Number(c.min_order_amount || 0) > 0 ? `৳ ${Number(c.min_order_amount).toLocaleString("en-BD")}` : "No min";
      const maxDiscountStr = c.max_discount_amount ? `৳ ${Number(c.max_discount_amount).toLocaleString("en-BD")}` : "No cap";
      const usageStr = `${c.used_count || 0}${c.usage_limit_total ? ` / ${c.usage_limit_total}` : " uses"}`;

      return {
        id: c.id,
        code: c.code,
        description: c.description || "Promotional Discount",
        type: (c.discount_type as any) || "fixed_amount",
        value: valueStr,
        valueNumeric: valNum,
        minOrder: minOrderStr,
        maxDiscount: maxDiscountStr,
        usage: usageStr,
        status: statusVal,
        b2bOnly: Boolean(c.business_only),
        validUntil: c.ends_at || "Ongoing",
      };
    });

    const redemptions: RedemptionItem[] = rawRedemptions.map((r: any) => {
      const couponInfo = Array.isArray(r.coupons) ? r.coupons[0] : r.coupons;
      const orderInfo = Array.isArray(r.orders) ? r.orders[0] : r.orders;

      return {
        id: String(r.id),
        coupon: couponInfo?.code || "COUPON",
        orderId: orderInfo?.order_number || "ORDER",
        customer: orderInfo?.customer_name || "Customer",
        discount: `৳ ${Number(r.discount_amount || 0).toLocaleString("en-BD")}`,
        date: r.created_at,
      };
    });

    return { success: true, data: { coupons, redemptions } };
  } catch (error: any) {
    console.error("getAdminCouponsAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to load coupons",
      data: { coupons: [], redemptions: [] },
    };
  }
}

export async function createCouponAction(payload: {
  code: string;
  description?: string;
  discountType: "percentage" | "fixed_amount" | "free_shipping";
  value: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimitTotal?: number;
  businessOnly?: boolean;
  endsAt?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("coupons").insert({
      code: payload.code.trim().toUpperCase(),
      description: payload.description?.trim() || null,
      discount_type: payload.discountType,
      value: payload.value,
      min_order_amount: payload.minOrderAmount || 0,
      max_discount_amount: payload.maxDiscountAmount || null,
      usage_limit_total: payload.usageLimitTotal || null,
      business_only: Boolean(payload.businessOnly),
      ends_at: payload.endsAt || null,
      is_active: true,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create coupon" };
  }
}

export async function toggleCouponActiveAction(payload: {
  id: string;
  isActive: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("coupons")
      .update({ is_active: payload.isActive, updated_at: new Date().toISOString() })
      .eq("id", payload.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle coupon" };
  }
}

export async function deleteCouponAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("coupons").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete coupon" };
  }
}

