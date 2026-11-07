"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertStaffRole, getStaffSession } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";

export type ActionResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

/**
 * Confirms a pending order:
 * status = 'confirmed' (trigger enforces line items, customer name, phone).
 */
export async function confirmOrderAction(orderId: string): Promise<ActionResult> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    // Insert timeline event
    await supabase.from("order_events").insert({
      order_id: orderId,
      event_type: "status_changed",
      from_value: "pending",
      to_value: "confirmed",
      message: "Order confirmed by staff",
      actor_id: session.user.id,
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Moves an order into processing:
 * status = 'processing'
 */
export async function processOrderAction(orderId: string): Promise<ActionResult> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "processing" })
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    await supabase.from("order_events").insert({
      order_id: orderId,
      event_type: "status_changed",
      from_value: "confirmed",
      to_value: "processing",
      message: "Order moved to processing by staff",
      actor_id: session.user.id,
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Cancels an order with a mandatory reason:
 * Uses cancel_order(p_order_id, p_reason) RPC or direct update.
 */
export async function cancelOrderWithReasonAction(
  orderId: string,
  reason: string
): Promise<ActionResult> {
  if (!reason || !reason.trim()) {
    return {
      ok: false,
      code: "REASON_REQUIRED",
      message: "A cancellation reason is required.",
    };
  }

  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    // Call cancel_order RPC
    const { error: rpcErr } = await supabase.rpc("cancel_order", {
      p_order_id: orderId,
      p_reason: reason.trim(),
    });

    if (rpcErr) {
      const friendly = mapDatabaseError(rpcErr);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    // Insert staff note recording the reason
    await supabase.from("staff_notes").insert({
      entity_type: "order",
      entity_id: orderId,
      body: `Order cancelled. Reason: ${reason.trim()}`,
      author_id: session.user.id,
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, data: { orderId, cancelled: true } };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Adds an internal staff note or order note
 */
export async function addStaffNoteAction(
  orderId: string,
  body: string,
  noteType = "internal"
): Promise<ActionResult> {
  if (!body || !body.trim()) {
    return { ok: false, code: "EMPTY_NOTE", message: "Note body cannot be empty." };
  }

  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabase = await createClient();

    // 1. Insert into staff_notes table
    const { data, error } = await supabase
      .from("staff_notes")
      .insert({
        entity_type: "order",
        entity_id: orderId,
        body: body.trim(),
        author_id: session.user.id,
      })
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    // 2. Also insert into order_notes if order exists
    try {
      const { data: ord } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", orderId)
        .maybeSingle();

      if (ord) {
        await supabase.from("order_notes").insert({
          order_id: orderId,
          order_number: ord.order_number,
          type: noteType as any,
          author: session.user.name,
          note: body.trim(),
        });
      }
    } catch (nErr) {
      console.warn("Could not insert duplicate order_note:", nErr);
    }

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}

/**
 * Modifies items of a pending or incomplete order:
 * Calls RPC set_order_items(p_order_id, p_items, p_price_overrides)
 */
export async function setOrderItemsAction(
  orderId: string,
  items: Array<{ variant_id: string; quantity: number }>,
  priceOverrides?: Record<string, number>
): Promise<ActionResult> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("set_order_items", {
      p_order_id: orderId,
      p_items: items as any,
      p_price_overrides: priceOverrides ? (priceOverrides as any) : null,
    });

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, code: friendly.code, message: friendly.message };
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, code: friendly.code, message: friendly.message };
  }
}
