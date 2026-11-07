"use server";

import { createClient } from "@/lib/supabase/server";
import { assertStaffRole } from "@/lib/admin-guard";

/**
 * Assigns a sequence-backed invoice number to an order if not yet assigned.
 * Idempotent. Returns the invoice number.
 */
export async function assignInvoiceNumberAction(orderId: string) {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("assign_invoice_number", {
      p_order_id: orderId,
    });

    if (error) {
      console.error("Error assigning invoice number:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true, invoiceNumber: data };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to assign invoice number" };
  }
}
