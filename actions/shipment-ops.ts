"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertStaffRole } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";
import { isValidUuid } from "@/lib/security";

export interface CreateShipmentLine {
  orderItemId: string;
  batchId: string;
  quantity: number;
}

export interface CreateShipmentParams {
  orderId: string;
  warehouseId?: string;
  carrier: string;
  trackingNumber?: string;
  notes?: string;
  lines: CreateShipmentLine[];
}

/**
 * Creates a shipment and records its shipment lines with lot allocation:
 * Inserts `shipments`, then `shipment_items`.
 * Triggers handle stock movements, lot validity, order progress, and auto-shipping.
 */
export async function createShipmentAction(params: CreateShipmentParams) {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!isValidUuid(params.orderId)) {
      return { ok: false, code: "INVALID_INPUT", message: "Invalid order ID." };
    }
    const supabase = getSupabaseAdmin();

    if (!params.lines || params.lines.length === 0) {
      return { ok: false, code: "NO_LINES", message: "At least one shipment line item is required." };
    }

    // Resolve active warehouse if none specified
    let warehouseId = params.warehouseId;
    if (!warehouseId) {
      const { data: defaultWh } = await supabase
        .from("warehouses")
        .select("id")
        .eq("is_default", true)
        .eq("is_active", true)
        .maybeSingle();

      warehouseId = defaultWh?.id;
    }

    if (!warehouseId) {
      const { data: anyWh } = await supabase
        .from("warehouses")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      warehouseId = anyWh?.id;
    }

    if (!warehouseId) {
      return { ok: false, code: "NO_WAREHOUSE", message: "No active warehouse found. Please configure a warehouse." };
    }

    // 1. Insert shipment record
    const { data: shipment, error: shipErr } = await supabase
      .from("shipments")
      .insert({
        order_id: params.orderId,
        warehouse_id: warehouseId,
        carrier: params.carrier.trim() || "Steadfast Courier",
        tracking_number: params.trackingNumber?.trim() || null,
        status: "preparing",
      })
      .select()
      .single();

    if (shipErr || !shipment) {
      const friendly = mapDatabaseError(shipErr);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    // 2. Insert shipment items (each row triggers stock movement, lot check, and order update)
    for (const line of params.lines) {
      if (line.quantity <= 0) continue;

      const { error: lineErr } = await supabase.from("shipment_items").insert({
        shipment_id: shipment.id,
        order_item_id: line.orderItemId,
        batch_id: line.batchId || null,
        quantity: line.quantity,
      });

      if (lineErr) {
        // Rollback: delete the created shipment
        await supabase.from("shipments").delete().eq("id", shipment.id);
        const friendly = mapDatabaseError(lineErr);
        return { ok: false, code: friendly.code, message: friendly.message };
      }
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${params.orderId}`);
    revalidatePath("/admin/shipments");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/batches");

    return { ok: true, data: shipment };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Updates shipment status (e.g. delivered, in_transit, returned)
 */
export async function updateShipmentStatusAction(
  shipmentId: string,
  newStatus: "preparing" | "in_transit" | "delivered" | "failed" | "returned"
) {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!isValidUuid(shipmentId)) {
      return { ok: false, code: "INVALID_INPUT", message: "Invalid shipment ID." };
    }
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("shipments")
      .update({
        status: newStatus,
        delivered_at: newStatus === "delivered" ? new Date().toISOString() : undefined,
      })
      .eq("id", shipmentId)
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    if (data?.order_id) {
      revalidatePath(`/admin/orders/${data.order_id}`);
    }
    revalidatePath("/admin/orders");
    revalidatePath("/admin/shipments");

    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}
