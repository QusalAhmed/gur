"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";

/**
 * Assigns a sequence-backed invoice number to an order if not yet assigned.
 * Idempotent. Returns the invoice number.
 */
export async function assignInvoiceNumberAction(orderId: string) {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!isValidUuid(orderId)) {
      return { ok: false, error: "Invalid order ID format." };
    }
    const client = getSupabaseAdmin();

    const { data, error } = await client.rpc("assign_invoice_number", {
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
