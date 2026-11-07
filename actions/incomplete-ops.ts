"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";

export interface IncompleteOrderRecord {
  id: string;
  orderNumber: string | null;
  publicToken: string | null;
  status: string;
  createdAt: string;
  ageHours: number;
  customerName: string | null;
  customerPhone: string | null;
  districtName: string | null;
  divisionName: string | null;
  totalAmount: number;
  itemCount: number;
  itemsSummary: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

/**
 * Loads all incomplete / abandoned checkouts from the admin_incomplete_orders view.
 */
export async function getIncompleteOrdersAction(): Promise<{
  ok: boolean;
  data: IncompleteOrderRecord[];
  message?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("admin_incomplete_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, data: [], message: friendly.message };
    }

    const records: IncompleteOrderRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      orderNumber: row.order_number,
      publicToken: row.public_token,
      status: row.status,
      createdAt: row.created_at,
      ageHours: Math.round(Number(row.age_hours || 0)),
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      districtName: row.district_name,
      divisionName: row.division_name,
      totalAmount: Number(row.total_amount || 0),
      itemCount: Number(row.item_count || 0),
      itemsSummary: row.items_summary,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
    }));

    return { ok: true, data: records };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, data: [], message: friendly.message };
  }
}

/**
 * Converts an incomplete checkout draft into a live pending order.
 * Updates order status to 'pending' and logs a timeline event.
 */
export async function convertIncompleteToPendingAction(orderId: string): Promise<{
  ok: boolean;
  data?: any;
  message?: string;
}> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    // Verify order has at least 1 item
    const { count } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId);

    if (!count || count === 0) {
      return {
        ok: false,
        message: "Cannot convert draft order with no items. Please add items first.",
      };
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        status: "pending",
        placed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "incomplete_order")
      .select()
      .single();

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    // Add note and order event
    await Promise.all([
      supabase.from("order_events").insert({
        order_id: orderId,
        event_type: "converted_from_incomplete",
        message: `Converted from abandoned checkout to active order by ${session.user.name}`,
        actor_id: session.user.id,
      }),
      supabase.from("staff_notes").insert({
        entity_type: "order",
        entity_id: orderId,
        author_id: session.user.id,
        body: `Converted incomplete checkout into pending order by ${session.user.name}`,
      }),
    ]);

    revalidatePath("/admin/incomplete");
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, data };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}

/**
 * Adds a staff internal note to an incomplete order.
 */
export async function addIncompleteOrderNoteAction(
  orderId: string,
  noteText: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    if (!noteText.trim()) {
      return { ok: false, message: "Note text cannot be empty." };
    }

    const { error } = await supabase.from("staff_notes").insert({
      entity_type: "order",
      entity_id: orderId,
      author_id: session.user.id,
      body: noteText.trim(),
    });

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    revalidatePath("/admin/incomplete");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}

/**
 * Discards / deletes an abandoned checkout.
 */
export async function deleteIncompleteOrderAction(
  orderId: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("status", "incomplete_order");

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    revalidatePath("/admin/incomplete");
    return { ok: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}
