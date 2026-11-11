"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";

export interface ShippingMethodItem {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  carrier: string;
  baseCost: string;
  perKgCost: string;
  freeAbove: string;
  transitDays: string;
  status: "active" | "inactive";
  type: string;
}

export interface DeliveryZoneItem {
  id: string;
  name: string;
  nameBn: string;
  coverage: string;
  divisions: string;
  districtsCount: number;
  baseRate: string;
  extraPerKg: string;
  transitDays: string;
  codAvailable: boolean;
  status: string;
}

export async function getAdminShippingMethodsAction(): Promise<{
  success: boolean;
  data: ShippingMethodItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabaseAdmin = getSupabaseAdmin();
    const { data: methods, error } = await supabaseAdmin
      .from("shipping_methods")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const { data: rates } = await supabaseAdmin.from("shipping_rates").select("*");
    const rateMap = new Map<string, any>();
    if (rates) {
      for (const r of rates) {
        if (!rateMap.has(r.method_id)) {
          rateMap.set(r.method_id, r);
        }
      }
    }

    const result: ShippingMethodItem[] = (methods || []).map((m: any) => {
      const rate = rateMap.get(m.id);
      return {
        id: m.id,
        code: m.code ? m.code.toUpperCase() : "MTH",
        name: m.name,
        nameBn: m.name_bn || "",
        carrier: m.is_pickup ? "Warehouse Pickup Team" : "Nationwide Courier Logistics",
        baseCost: rate ? `৳ ${rate.base_rate}` : m.is_pickup ? "Free" : "৳ 120",
        perKgCost: rate && rate.per_kg_rate > 0 ? `৳ ${rate.per_kg_rate} / kg` : "Flat rate",
        freeAbove: rate && rate.free_above_amount ? `৳ ${rate.free_above_amount}` : "N/A",
        transitDays: rate ? `${rate.estimated_days_min} – ${rate.estimated_days_max} days` : "1 - 3 days",
        status: m.is_active ? "active" : "inactive",
        type: m.is_pickup ? "Warehouse Pickup" : "Delivery",
      };
    });

    return { success: true, data: result };
  } catch (error: any) {
    console.error("getAdminShippingMethodsAction error:", error);
    return { success: false, error: error.message || "Failed to load shipping methods", data: [] };
  }
}

export async function toggleShippingMethodActiveAction(payload: {
  id: string;
  isActive: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    if (!isValidUuid(payload.id)) {
      return { success: false, error: "Invalid shipping method ID" };
    }
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("shipping_methods")
      .update({ is_active: payload.isActive, updated_at: new Date().toISOString() })
      .eq("id", payload.id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/shipping");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle shipping method" };
  }
}

export async function getAdminDeliveryZonesAction(): Promise<{
  success: boolean;
  data: DeliveryZoneItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabaseAdmin = getSupabaseAdmin();
    const { data: zones, error } = await supabaseAdmin
      .from("delivery_zones")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;

    const { data: districts } = await supabaseAdmin
      .from("geo_districts")
      .select("id, zone_id");

    const districtCountMap = new Map<number, number>();
    (districts || []).forEach((d: any) => {
      if (d.zone_id) {
        districtCountMap.set(d.zone_id, (districtCountMap.get(d.zone_id) || 0) + 1);
      }
    });

    const result: DeliveryZoneItem[] = (zones || []).map((z: any) => ({
      id: `ZN-${String(z.id).padStart(3, "0")}`,
      name: `${z.name} Division Zone`,
      nameBn: z.name_bn ? `${z.name_bn} অঞ্চল` : "",
      coverage: `All districts under ${z.name} division`,
      divisions: z.name,
      districtsCount: districtCountMap.get(z.id) || 8,
      baseRate: z.name === "Dhaka" ? "৳ 80" : "৳ 130",
      extraPerKg: z.name === "Dhaka" ? "৳ 15" : "৳ 25",
      transitDays: z.name === "Dhaka" ? "1 day" : "2 – 3 days",
      codAvailable: true,
      status: z.is_active ? "active" : "inactive",
    }));

    return { success: true, data: result };
  } catch (error: any) {
    console.error("getAdminDeliveryZonesAction error:", error);
    return { success: false, error: error.message || "Failed to load delivery zones", data: [] };
  }
}

