"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole, getActorUuid } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { mapDatabaseError } from "@/lib/admin-errors";
import { Database } from "@/types/database.types";

type BatchStatus = Database["public"]["Enums"]["batch_status"];

export interface CreateBatchParams {
  lotCode: string;
  productId: string;
  supplierId?: string | null;
  status?: BatchStatus;
  producedOn?: string | null;
  receivedOn?: string | null;
  bestBefore?: string | null;
  brix?: number | null;
  ph?: number | null;
  moisturePct?: number | null;
  densityKgPerL?: number | null;
  ashPct?: number | null;
  totalSugarPct?: number | null;
  testedBy?: string | null;
  notes?: string | null;
}

export interface UpdateBatchStatusParams {
  batchId: string;
  status: BatchStatus;
  reason?: string | null;
}

export interface UpdateBatchLabParams {
  batchId: string;
  brix?: number | null;
  ph?: number | null;
  moisturePct?: number | null;
  densityKgPerL?: number | null;
  ashPct?: number | null;
  totalSugarPct?: number | null;
  testedBy?: string | null;
  notes?: string | null;
}

/**
 * Creates a new molasses lot/batch.
 * Validates lot_code to be uppercase matching `^[A-Z0-9._-]+$`.
 */
export async function createBatchAction(params: CreateBatchParams) {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = getSupabaseAdmin();

    const rawCode = (params.lotCode || "").trim().toUpperCase();
    if (!/^[A-Z0-9._-]+$/.test(rawCode)) {
      return {
        ok: false,
        code: "INVALID_LOT_CODE",
        message: "Lot code must contain only uppercase letters, numbers, dots, underscores, or hyphens (A-Z, 0-9, ., _, -).",
      };
    }

    if (!isValidUuid(params.productId)) {
      return { ok: false, code: "MISSING_PRODUCT", message: "Please select a valid product for this lot." };
    }
    if (params.supplierId && !isValidUuid(params.supplierId)) {
      return { ok: false, code: "INVALID_SUPPLIER", message: "Invalid supplier ID." };
    }

    const { data, error } = await supabase
      .from("batches")
      .insert({
        lot_code: rawCode,
        product_id: params.productId,
        supplier_id: params.supplierId || null,
        status: (params.status || "quarantine") as BatchStatus,
        produced_on: params.producedOn || null,
        received_on: params.receivedOn || null,
        best_before: params.bestBefore || null,
        brix: params.brix !== undefined && params.brix !== null ? Number(params.brix) : null,
        ph: params.ph !== undefined && params.ph !== null ? Number(params.ph) : null,
        moisture_pct: params.moisturePct !== undefined && params.moisturePct !== null ? Number(params.moisturePct) : null,
        density_kg_per_l: params.densityKgPerL !== undefined && params.densityKgPerL !== null ? Number(params.densityKgPerL) : null,
        ash_pct: params.ashPct !== undefined && params.ashPct !== null ? Number(params.ashPct) : null,
        total_sugar_pct: params.totalSugarPct !== undefined && params.totalSugarPct !== null ? Number(params.totalSugarPct) : null,
        tested_by: params.testedBy?.trim() || null,
        notes: params.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    revalidatePath("/admin/batches");
    revalidatePath("/admin/inventory");
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Updates status of a batch (quarantine -> released / blocked / expired).
 */
export async function updateBatchStatusAction(params: UpdateBatchStatusParams) {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    if (!isValidUuid(params.batchId)) {
      return { ok: false, code: "INVALID_BATCH_ID", message: "Invalid batch ID." };
    }
    const supabase = getSupabaseAdmin();

    const updatePayload: {
      status: BatchStatus;
      updated_at: string;
      tested_by?: string | null;
      tested_on?: string | null;
    } = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };

    if (params.status === "released") {
      updatePayload.tested_by = session.user.name;
      updatePayload.tested_on = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("batches")
      .update(updatePayload)
      .eq("id", params.batchId)
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    if (params.reason?.trim()) {
      await supabase.from("staff_notes").insert({
        entity_type: "batch",
        entity_id: params.batchId,
        author_id: getActorUuid(session),
        body: `Status changed to ${params.status}: ${params.reason.trim()}`,
      });
    }

    revalidatePath("/admin/batches");
    revalidatePath(`/admin/batches/${params.batchId}`);
    revalidatePath("/admin/inventory");
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Updates batch lab measurements and quality specifications.
 */
export async function updateBatchLabResultsAction(params: UpdateBatchLabParams) {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    if (!isValidUuid(params.batchId)) {
      return { ok: false, code: "INVALID_BATCH_ID", message: "Invalid batch ID." };
    }
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("batches")
      .update({
        brix: params.brix !== undefined && params.brix !== null ? Number(params.brix) : null,
        ph: params.ph !== undefined && params.ph !== null ? Number(params.ph) : null,
        moisture_pct: params.moisturePct !== undefined && params.moisturePct !== null ? Number(params.moisturePct) : null,
        density_kg_per_l: params.densityKgPerL !== undefined && params.densityKgPerL !== null ? Number(params.densityKgPerL) : null,
        ash_pct: params.ashPct !== undefined && params.ashPct !== null ? Number(params.ashPct) : null,
        total_sugar_pct: params.totalSugarPct !== undefined && params.totalSugarPct !== null ? Number(params.totalSugarPct) : null,
        tested_by: params.testedBy?.trim() || session.user.name,
        tested_on: new Date().toISOString(),
        notes: params.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.batchId)
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    revalidatePath("/admin/batches");
    revalidatePath(`/admin/batches/${params.batchId}`);
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}
