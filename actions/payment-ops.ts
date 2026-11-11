"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertStaffRole, getActorUuid } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { mapDatabaseError } from "@/lib/admin-errors";

export interface RecordPaymentParams {
  orderId: string;
  amount: number;
  method?: "cash" | "bkash" | "nagad" | "rocket" | "card" | "bank_transfer" | "credit_terms";
  transactionId?: string;
  notes?: string;
}

export interface RecordRefundParams {
  orderId: string;
  amount: number;
  reason?: string;
  method?: string;
}

/**
 * Records a manual payment entry:
 * Inserts into `payments` table with kind='charge', provider='manual', status='succeeded'.
 * Trigger `trg_payments_sync` automatically updates order.amount_paid and payment_status.
 */
export async function recordPaymentAction(params: RecordPaymentParams) {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!isValidUuid(params.orderId)) {
      return { ok: false, code: "INVALID_ORDER_ID", message: "Invalid order ID." };
    }
    const supabase = getSupabaseAdmin();

    const amount = Number(params.amount);
    if (!amount || amount <= 0) {
      return { ok: false, code: "INVALID_AMOUNT", message: "Payment amount must be greater than zero." };
    }

    const { data, error } = await supabase
      .from("payments")
      .insert({
        order_id: params.orderId,
        kind: "charge",
        provider: "manual",
        method: (params.method || "cash") as any,
        status: "succeeded",
        amount,
        provider_txn_id: params.transactionId?.trim() || null,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    if (params.notes?.trim()) {
      await supabase.from("staff_notes").insert({
        entity_type: "order",
        entity_id: params.orderId,
        author_id: getActorUuid(session),
        body: `[Payment Recorded] ৳${amount} via ${params.method || "cash"}: ${params.notes.trim()}`,
      });
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${params.orderId}`);
    revalidatePath("/admin/payments");

    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Records a customer refund:
 * Inserts into `payments` table with kind='refund', provider='manual', status='succeeded'.
 * Trigger `trg_payments_sync` automatically updates order.amount_paid and payment_status.
 */
export async function recordRefundAction(params: RecordRefundParams) {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!isValidUuid(params.orderId)) {
      return { ok: false, code: "INVALID_ORDER_ID", message: "Invalid order ID." };
    }
    const supabase = getSupabaseAdmin();

    const amount = Number(params.amount);
    if (!amount || amount <= 0) {
      return { ok: false, code: "INVALID_AMOUNT", message: "Refund amount must be greater than zero." };
    }

    const { data, error } = await supabase
      .from("payments")
      .insert({
        order_id: params.orderId,
        kind: "refund",
        provider: "manual",
        method: (params.method || "cash") as any,
        status: "succeeded",
        amount,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    if (params.reason?.trim()) {
      await supabase.from("staff_notes").insert({
        entity_type: "order",
        entity_id: params.orderId,
        author_id: getActorUuid(session),
        body: `[Refund Recorded] ৳${amount}: ${params.reason.trim()}`,
      });
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${params.orderId}`);
    revalidatePath("/admin/payments");

    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}
