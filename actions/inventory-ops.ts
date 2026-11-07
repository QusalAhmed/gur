"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";
import { Database } from "@/types/database.types";

type StockMovementType = Database["public"]["Enums"]["stock_movement_type"];

export interface ReceiveStockParams {
  variantId: string;
  warehouseId: string;
  batchId?: string | null;
  quantity: number;
  unitCost?: number | null;
  note?: string | null;
}

export interface AdjustStockParams {
  variantId: string;
  warehouseId: string;
  batchId?: string | null;
  quantityDelta: number; // Positive to add, negative to subtract
  reason: string;
}

export interface WriteOffStockParams {
  variantId: string;
  warehouseId: string;
  batchId?: string | null;
  quantity: number; // Positive number, will be recorded as negative delta
  reason: string;
}

export interface UpdateReorderPointParams {
  variantId: string;
  warehouseId: string;
  reorderPoint: number;
}

/**
 * Receives stock into inventory.
 * Inserts an append-only entry into `stock_movements` with movement_type = 'receipt'
 * and positive `quantity_delta`.
 * The database trigger `trg_stock_movements_apply` handles updating `inventory_levels.on_hand`.
 */
export async function receiveStockAction(params: ReceiveStockParams) {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const qty = Number(params.quantity);
    if (!qty || qty <= 0) {
      return { ok: false, code: "INVALID_QUANTITY", message: "Receipt quantity must be greater than zero." };
    }

    const { data, error } = await supabase
      .from("stock_movements")
      .insert({
        variant_id: params.variantId,
        warehouse_id: params.warehouseId,
        batch_id: params.batchId || null,
        movement_type: "receipt" as StockMovementType,
        quantity_delta: qty,
        unit_cost: params.unitCost !== undefined && params.unitCost !== null ? Number(params.unitCost) : null,
        note: params.note?.trim() || `Receipt by ${session.user.name}`,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/batches");
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Adjusts inventory level for stock discrepancies or audit corrections.
 * Inserts an append-only entry into `stock_movements` with movement_type = 'adjustment'.
 */
export async function adjustStockAction(params: AdjustStockParams) {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const delta = Number(params.quantityDelta);
    if (!delta || delta === 0) {
      return { ok: false, code: "INVALID_DELTA", message: "Adjustment quantity delta cannot be zero." };
    }
    if (!params.reason?.trim()) {
      return { ok: false, code: "REASON_REQUIRED", message: "A reason is strictly required for stock adjustment." };
    }

    const { data, error } = await supabase
      .from("stock_movements")
      .insert({
        variant_id: params.variantId,
        warehouse_id: params.warehouseId,
        batch_id: params.batchId || null,
        movement_type: "adjustment" as StockMovementType,
        quantity_delta: delta,
        note: `Adjustment: ${params.reason.trim()} (${session.user.name})`,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/batches");
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Writes off damaged, expired, or spoiled stock.
 * Inserts an append-only entry into `stock_movements` with movement_type = 'write_off'
 * and negative `quantity_delta`.
 */
export async function writeOffStockAction(params: WriteOffStockParams) {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const qty = Math.abs(Number(params.quantity));
    if (!qty || qty <= 0) {
      return { ok: false, code: "INVALID_QUANTITY", message: "Write-off quantity must be greater than zero." };
    }
    if (!params.reason?.trim()) {
      return { ok: false, code: "REASON_REQUIRED", message: "A reason is strictly required to write off stock." };
    }

    const { data, error } = await supabase
      .from("stock_movements")
      .insert({
        variant_id: params.variantId,
        warehouse_id: params.warehouseId,
        batch_id: params.batchId || null,
        movement_type: "write_off" as StockMovementType,
        quantity_delta: -qty, // Must be negative
        note: `Write-off: ${params.reason.trim()} (${session.user.name})`,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/batches");
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Updates reorder point for a variant at a warehouse.
 * Permitted direct update per database contract rule:
 * "Never update inventory_levels except reorder_point"
 */
export async function updateReorderPointAction(params: UpdateReorderPointParams) {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const reorderPoint = Math.max(0, Number(params.reorderPoint) || 0);

    const { data, error } = await supabase
      .from("inventory_levels")
      .update({
        reorder_point: reorderPoint,
        updated_at: new Date().toISOString(),
      })
      .eq("variant_id", params.variantId)
      .eq("warehouse_id", params.warehouseId)
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    revalidatePath("/admin/inventory");
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}
