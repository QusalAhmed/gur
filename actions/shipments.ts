"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ShipmentItem {
  id: string;
  orderId: string;
  recipient: string;
  district: string;
  carrier: string;
  tracking: string;
  weight: string;
  packages: number;
  status: "preparing" | "in_transit" | "delivered" | "failed" | "returned";
  dispatchedAt: string;
  eta: string;
}

export interface AdminShipmentsData {
  shipments: ShipmentItem[];
  kpis: {
    total: number;
    preparing: number;
    inTransit: number;
    delivered: number;
    failedOrReturned: number;
  };
  carrierVolume: Array<{
    carrier: string;
    shipments: number;
  }>;
}

export async function getAdminShipmentsAction(): Promise<{
  success: boolean;
  data: AdminShipmentsData;
  error?: string;
}> {
  try {
    const { data: rawShipments, error } = await supabaseAdmin
      .from("shipments")
      .select(
        `
        id,
        order_id,
        carrier,
        tracking_number,
        tracking_url,
        status,
        vehicle_no,
        driver_name,
        driver_phone,
        shipped_at,
        delivered_at,
        created_at,
        orders:order_id (
          order_number,
          customer_name,
          total_weight_kg,
          shipping_address
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const carrierCountMap = new Map<string, number>();

    const shipments: ShipmentItem[] = (rawShipments || []).map((s: any) => {
      const orderInfo = Array.isArray(s.orders) ? s.orders[0] : s.orders;
      const orderNumber = orderInfo?.order_number || s.order_id?.slice(0, 8) || "ORD";
      const recipient = orderInfo?.customer_name || "Customer";
      const weightVal = Number(orderInfo?.total_weight_kg || 1);
      const district = orderInfo?.shipping_address?.district || orderInfo?.shipping_address?.city || "Dhaka";
      const carrier = s.carrier || "Courier delivery";

      carrierCountMap.set(carrier, (carrierCountMap.get(carrier) || 0) + 1);

      return {
        id: s.id,
        orderId: orderNumber,
        recipient,
        district,
        carrier,
        tracking: s.tracking_number || "PENDING",
        weight: `${weightVal} kg`,
        packages: 1,
        status: (s.status as ShipmentItem["status"]) || "preparing",
        dispatchedAt: s.shipped_at ? new Date(s.shipped_at).toLocaleDateString("en-GB") : "–",
        eta: s.delivered_at
          ? `Delivered ${new Date(s.delivered_at).toLocaleDateString("en-GB")}`
          : "Estimated 2-3 Days",
      };
    });

    const carrierVolume = Array.from(carrierCountMap.entries()).map(([carrier, count]) => ({
      carrier,
      shipments: count,
    }));

    const kpis = {
      total: shipments.length,
      preparing: shipments.filter((s) => s.status === "preparing").length,
      inTransit: shipments.filter((s) => s.status === "in_transit").length,
      delivered: shipments.filter((s) => s.status === "delivered").length,
      failedOrReturned: shipments.filter((s) => s.status === "failed" || s.status === "returned").length,
    };

    return {
      success: true,
      data: {
        shipments,
        kpis,
        carrierVolume,
      },
    };
  } catch (error: any) {
    console.error("getAdminShipmentsAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to load shipments",
      data: {
        shipments: [],
        kpis: {
          total: 0,
          preparing: 0,
          inTransit: 0,
          delivered: 0,
          failedOrReturned: 0,
        },
        carrierVolume: [],
      },
    };
  }
}

export async function updateShipmentStatusAction(payload: {
  id: string;
  status: "preparing" | "in_transit" | "delivered" | "failed" | "returned";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {
      status: payload.status,
      updated_at: new Date().toISOString(),
    };
    if (payload.status === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    }
    if (payload.status === "in_transit") {
      updateData.shipped_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("shipments")
      .update(updateData)
      .eq("id", payload.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update shipment status" };
  }
}

export async function bulkUpdateShipmentStatusAction(payload: {
  ids: string[];
  status: "preparing" | "in_transit" | "delivered" | "failed" | "returned";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {
      status: payload.status,
      updated_at: new Date().toISOString(),
    };
    if (payload.status === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    }
    if (payload.status === "in_transit") {
      updateData.shipped_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("shipments")
      .update(updateData)
      .in("id", payload.ids);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update shipments" };
  }
}
