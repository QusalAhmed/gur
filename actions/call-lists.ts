"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole, getActorUuid, getStaffSession } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";
import { isValidUuid } from "@/lib/security";
import { getSmsConfig, sendSmsBangladesh, normalizeBdPhoneNumber } from "@/lib/sms/smsbangladesh";

export type CallListStatus = "active" | "paused" | "completed" | "archived";

export type CallItemStatus =
  | "pending"
  | "no_answer"
  | "call_later"
  | "reached_interested"
  | "reached_not_interested"
  | "reached_ordered"
  | "wrong_number";

export interface CallListSummary {
  id: string;
  title: string;
  description: string | null;
  status: CallListStatus;
  createdBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  totalContacts: number;
  completedContacts: number;
  pendingContacts: number;
  callbackDueCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CallListItemDetail {
  id: string;
  listId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerTotalOrders: number;
  customerTotalSpent: number;
  customerLastOrderAt: string | null;
  customerAddress: any | null;
  customerNotes: string | null;
  status: CallItemStatus;
  callbackAt: string | null;
  attemptCount: number;
  lastCalledAt: string | null;
  lastCalledBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallLogItem {
  id: string;
  callListItemId: string;
  calledBy: { id: string; name: string } | null;
  outcome: CallItemStatus;
  notes: string | null;
  callbackAt: string | null;
  createdAt: string;
}

export interface CustomerFilterOption {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  orders: number;
  spent: number;
  lastOrder: string | null;
}

function extractProfile(raw: any): { id: string; name: string } | null {
  if (!raw) return null;
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || !p.id) return null;
  return { id: p.id, name: p.full_name || "Staff" };
}

/**
 * Fetches all call lists with aggregated progress and callback counts.
 */
export async function getCallListsAction(): Promise<{
  success: boolean;
  data: CallListSummary[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = getSupabaseAdmin();

    const { data: lists, error } = await supabase
      .from("call_lists")
      .select(
        `
        id,
        title,
        description,
        status,
        total_contacts,
        completed_contacts,
        created_at,
        updated_at,
        created_by_profile:created_by (id, full_name),
        assigned_to_profile:assigned_to (id, full_name)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      const friendly = mapDatabaseError(error);
      return { success: false, data: [], error: friendly.message };
    }

    // Also get due callbacks per list
    const { data: dueItems } = await supabase
      .from("call_list_items")
      .select("list_id")
      .eq("status", "call_later")
      .lte("callback_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    const dueCounts: Record<string, number> = {};
    (dueItems || []).forEach((row: any) => {
      dueCounts[row.list_id] = (dueCounts[row.list_id] || 0) + 1;
    });

    const result: CallListSummary[] = (lists || []).map((l: any) => {
      const total = Number(l.total_contacts || 0);
      const completed = Number(l.completed_contacts || 0);
      const pending = Math.max(0, total - completed);

      return {
        id: l.id,
        title: l.title,
        description: l.description || null,
        status: (l.status as CallListStatus) || "active",
        createdBy: extractProfile(l.created_by_profile),
        assignedTo: extractProfile(l.assigned_to_profile),
        totalContacts: total,
        completedContacts: completed,
        pendingContacts: pending,
        callbackDueCount: dueCounts[l.id] || 0,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      };
    });

    return { success: true, data: result };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, data: [], error: friendly.message };
  }
}

/**
 * Fetches a single call list with all customer items and their history logs.
 */
export async function getCallListDetailAction(listId: string): Promise<{
  success: boolean;
  data?: {
    list: CallListSummary;
    items: CallListItemDetail[];
    logs: CallLogItem[];
  };
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!isValidUuid(listId)) {
      return { success: false, error: "Invalid call list ID" };
    }

    const supabase = getSupabaseAdmin();

    const [listRes, itemsRes] = await Promise.all([
      supabase
        .from("call_lists")
        .select(
          `
          id,
          title,
          description,
          status,
          total_contacts,
          completed_contacts,
          created_at,
          updated_at,
          created_by_profile:created_by (id, full_name),
          assigned_to_profile:assigned_to (id, full_name)
        `
        )
        .eq("id", listId)
        .single(),

      supabase
        .from("call_list_items")
        .select(
          `
          id,
          list_id,
          customer_id,
          status,
          callback_at,
          attempt_count,
          last_called_at,
          notes,
          created_at,
          updated_at,
          customers:customer_id (
            id,
            full_name,
            phone,
            email,
            total_orders,
            total_spent,
            last_order_at,
            default_address,
            notes
          ),
          assigned_profile:assigned_to (id, full_name),
          caller_profile:last_called_by (id, full_name)
        `
        )
        .eq("list_id", listId)
        .order("created_at", { ascending: true }),
    ]);

    if (listRes.error || !listRes.data) {
      return { success: false, error: "Call list not found" };
    }

    const l = listRes.data;
    const rawItems = itemsRes.data || [];
    const itemIds = rawItems.map((i: any) => i.id);

    let rawLogs: any[] = [];
    if (itemIds.length > 0) {
      const logsRes = await supabase
        .from("call_logs")
        .select(
          `
          id,
          call_list_item_id,
          outcome,
          notes,
          callback_at,
          created_at,
          caller_profile:called_by (id, full_name)
        `
        )
        .in("call_list_item_id", itemIds)
        .order("created_at", { ascending: false });

      rawLogs = logsRes.data || [];
    }

    const items: CallListItemDetail[] = rawItems.map((i: any) => ({
      id: i.id,
      listId: i.list_id,
      customerId: i.customer_id,
      customerName: i.customers?.full_name || "Customer",
      customerPhone: i.customers?.phone || "N/A",
      customerEmail: i.customers?.email || null,
      customerTotalOrders: Number(i.customers?.total_orders || 0),
      customerTotalSpent: Number(i.customers?.total_spent || 0),
      customerLastOrderAt: i.customers?.last_order_at || null,
      customerAddress: i.customers?.default_address || null,
      customerNotes: i.customers?.notes || null,
      status: (i.status as CallItemStatus) || "pending",
      callbackAt: i.callback_at || null,
      attemptCount: Number(i.attempt_count || 0),
      lastCalledAt: i.last_called_at || null,
      lastCalledBy: extractProfile(i.caller_profile),
      assignedTo: extractProfile(i.assigned_profile),
      notes: i.notes || null,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    }));

    const logs: CallLogItem[] = rawLogs.map((log: any) => ({
      id: log.id,
      callListItemId: log.call_list_item_id,
      calledBy: extractProfile(log.caller_profile),
      outcome: (log.outcome as CallItemStatus) || "pending",
      notes: log.notes || null,
      callbackAt: log.callback_at || null,
      createdAt: log.created_at,
    }));

    const total = Number(l.total_contacts || items.length);
    const completed = Number(l.completed_contacts || 0);

    const listSummary: CallListSummary = {
      id: l.id,
      title: l.title,
      description: l.description || null,
      status: (l.status as CallListStatus) || "active",
      createdBy: extractProfile(l.created_by_profile),
      assignedTo: extractProfile(l.assigned_to_profile),
      totalContacts: total,
      completedContacts: completed,
      pendingContacts: Math.max(0, total - completed),
      callbackDueCount: items.filter(
        (i) => i.status === "call_later" && i.callbackAt && new Date(i.callbackAt) <= new Date()
      ).length,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    };

    return {
      success: true,
      data: {
        list: listSummary,
        items,
        logs,
      },
    };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}

/**
 * Creates a new call list and populates it with selected customers.
 */
export async function createCallListAction(payload: {
  title: string;
  description?: string;
  customerIds: string[];
  assignedTo?: string | null;
}): Promise<{ success: boolean; listId?: string; error?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const actorUuid = getActorUuid(session);
    const supabase = getSupabaseAdmin();

    const title = payload.title?.trim();
    if (!title) {
      return { success: false, error: "List title is required" };
    }

    if (!payload.customerIds || payload.customerIds.length === 0) {
      return { success: false, error: "Please select at least one customer for the list" };
    }

    // 1. Insert Call List
    const { data: newList, error: listError } = await supabase
      .from("call_lists")
      .insert({
        title,
        description: payload.description?.trim() || null,
        created_by: actorUuid,
        assigned_to: payload.assignedTo && isValidUuid(payload.assignedTo) ? payload.assignedTo : null,
        status: "active",
      })
      .select("id")
      .single();

    if (listError || !newList) {
      const friendly = mapDatabaseError(listError);
      return { success: false, error: friendly.message };
    }

    // 2. Bulk insert Call List Items (deduplicating customerIds)
    const uniqueCustomerIds = Array.from(new Set(payload.customerIds)).filter(isValidUuid);
    const itemsToInsert = uniqueCustomerIds.map((custId) => ({
      list_id: newList.id,
      customer_id: custId,
      assigned_to: payload.assignedTo && isValidUuid(payload.assignedTo) ? payload.assignedTo : null,
      status: "pending",
    }));

    const { error: itemsError } = await supabase.from("call_list_items").insert(itemsToInsert);

    if (itemsError) {
      console.error("Error populating call list items:", itemsError);
      // Clean up newly created empty list
      await supabase.from("call_lists").delete().eq("id", newList.id);
      const friendly = mapDatabaseError(itemsError);
      return { success: false, error: friendly.message };
    }

    revalidatePath("/admin/calls");
    return { success: true, listId: newList.id };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}

/**
 * Updates call list status (active, paused, completed, archived).
 */
export async function updateCallListStatusAction(
  listId: string,
  status: CallListStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    if (!isValidUuid(listId)) return { success: false, error: "Invalid list ID" };

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("call_lists")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", listId);

    if (error) {
      const friendly = mapDatabaseError(error);
      return { success: false, error: friendly.message };
    }

    revalidatePath("/admin/calls");
    revalidatePath(`/admin/calls/${listId}`);
    return { success: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}

/**
 * Deletes a call list.
 */
export async function deleteCallListAction(listId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    if (!isValidUuid(listId)) return { success: false, error: "Invalid list ID" };

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("call_lists").delete().eq("id", listId);

    if (error) {
      const friendly = mapDatabaseError(error);
      return { success: false, error: friendly.message };
    }

    revalidatePath("/admin/calls");
    return { success: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}

/**
 * Logs an individual call attempt:
 * - Appends to call_logs timeline
 * - Updates call_list_items status, attempt_count, callback_at, notes, last_called_at/by
 * - If callback_at is set and outcome is call_later, creates a notification reminder.
 */
export async function logCallAttemptAction(payload: {
  callListItemId: string;
  outcome: CallItemStatus;
  notes?: string;
  callbackAt?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const actorUuid = getActorUuid(session);
    const callerName = session.user.name || "Staff";

    if (!isValidUuid(payload.callListItemId)) {
      return { success: false, error: "Invalid call list item ID" };
    }

    const supabase = getSupabaseAdmin();

    // 1. Get current item to check list_id and attempt_count
    const { data: item, error: itemError } = await supabase
      .from("call_list_items")
      .select("id, list_id, attempt_count, customer_id, customers:customer_id (full_name, phone)")
      .eq("id", payload.callListItemId)
      .single();

    if (itemError || !item) {
      return { success: false, error: "Call item not found" };
    }

    const nowIso = new Date().toISOString();
    const callbackIso = payload.callbackAt ? new Date(payload.callbackAt).toISOString() : null;
    const newAttemptCount = Number(item.attempt_count || 0) + 1;

    // 2. Insert into call_logs
    const { error: logError } = await supabase.from("call_logs").insert({
      call_list_item_id: payload.callListItemId,
      called_by: actorUuid,
      outcome: payload.outcome,
      notes: payload.notes?.trim() || null,
      callbackAt: callbackIso,
      created_at: nowIso,
    });

    if (logError) {
      console.error("Error creating call log:", logError);
      const friendly = mapDatabaseError(logError);
      return { success: false, error: friendly.message };
    }

    // 3. Update call_list_items
    const { error: updateError } = await supabase
      .from("call_list_items")
      .update({
        status: payload.outcome,
        callback_at: callbackIso,
        attempt_count: newAttemptCount,
        last_called_at: nowIso,
        last_called_by: actorUuid,
        notes: payload.notes?.trim() || null,
        updated_at: nowIso,
      })
      .eq("id", payload.callListItemId);

    if (updateError) {
      console.error("Error updating call list item:", updateError);
      const friendly = mapDatabaseError(updateError);
      return { success: false, error: friendly.message };
    }

    // 4. If callback scheduled, create in-app notification reminder
    if (payload.outcome === "call_later" && callbackIso) {
      const custName = (item.customers as any)?.full_name || "Customer";
      const custPhone = (item.customers as any)?.phone || "";
      const formattedDate = new Date(callbackIso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      await supabase.from("notifications").insert({
        type: "system_alert",
        title: `📞 Callback scheduled for ${custName}`,
        message: `Callback due on ${formattedDate} (${custPhone}). Note: ${payload.notes?.trim() || "No notes"}`,
        data: {
          callListItemId: payload.callListItemId,
          listId: item.list_id,
          customerId: item.customer_id,
          callbackAt: callbackIso,
          scheduledBy: callerName,
        },
      });
    }

    revalidatePath("/admin/calls");
    revalidatePath(`/admin/calls/${item.list_id}`);
    return { success: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}

/**
 * Searches and filters customers to help build a call list.
 */
export async function getCustomersForListAction(filters: {
  segment?: "all" | "incomplete" | "past_buyers" | "dormant_30d" | "high_value";
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data: CustomerFilterOption[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = getSupabaseAdmin();
    const limit = Math.min(filters.limit || 500, 1000);

    // If date filters are provided, resolve qualifying customer IDs from orders first
    let dateFilteredCustomerIds: string[] | null = null;
    if (filters.startDate || filters.endDate) {
      let orderQuery = supabase
        .from("orders")
        .select("customer_id")
        .in("status", ["delivered", "confirmed", "shipped", "processing"])
        .not("customer_id", "is", null);

      if (filters.startDate) {
        orderQuery = orderQuery.gte(
          "created_at",
          new Date(filters.startDate + "T00:00:00Z").toISOString()
        );
      }
      if (filters.endDate) {
        orderQuery = orderQuery.lte(
          "created_at",
          new Date(filters.endDate + "T23:59:59.999Z").toISOString()
        );
      }

      const { data: matchedOrders, error: orderErr } = await orderQuery.limit(2000);
      if (orderErr) {
        const friendly = mapDatabaseError(orderErr);
        return { success: false, data: [], error: friendly.message };
      }

      const idSet = new Set((matchedOrders || []).map((o: any) => o.customer_id).filter(Boolean));
      dateFilteredCustomerIds = Array.from(idSet);

      if (dateFilteredCustomerIds.length === 0) {
        return { success: true, data: [] };
      }
    }

    let query = supabase
      .from("customers")
      .select("id, full_name, phone, email, total_orders, total_spent, last_order_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (dateFilteredCustomerIds) {
      query = query.in("id", dateFilteredCustomerIds);
    }

    if (filters.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }

    if (filters.segment === "past_buyers") {
      query = query.gte("total_orders", 1);
    } else if (filters.segment === "dormant_30d") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("total_orders", 1).lte("last_order_at", thirtyDaysAgo);
    } else if (filters.segment === "high_value") {
      query = query.gte("total_spent", 2000);
    }

    const { data: customers, error } = await query;

    if (error) {
      const friendly = mapDatabaseError(error);
      return { success: false, data: [], error: friendly.message };
    }

    // If segment is incomplete, we query customers who have incomplete orders
    let result = (customers || []).map((c: any) => ({
      id: c.id,
      name: c.full_name || "Customer",
      phone: c.phone || "N/A",
      email: c.email || null,
      orders: Number(c.total_orders || 0),
      spent: Number(c.total_spent || 0),
      lastOrder: c.last_order_at || null,
    }));

    if (filters.segment === "incomplete") {
      const { data: incompleteOrders } = await supabase
        .from("orders")
        .select("customer_id")
        .eq("status", "incomplete_order")
        .not("customer_id", "is", null)
        .limit(500);

      const incompleteCustIds = new Set((incompleteOrders || []).map((o: any) => o.customer_id));
      result = result.filter((c) => incompleteCustIds.has(c.id));
    }

    return { success: true, data: result };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, data: [], error: friendly.message };
  }
}

/**
 * Returns list of staff members for assignment.
 */
export async function getAssignableStaffAction(): Promise<{
  success: boolean;
  data: { id: string; name: string }[];
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("staff_members")
      .select("user_id, profiles:user_id (id, full_name)")
      .order("created_at", { ascending: true });

    const staff = (data || [])
      .map((row: any) => ({
        id: row.user_id,
        name: row.profiles?.full_name || "Staff Member",
      }))
      .filter((s: any) => !!s.id);

    return { success: true, data: staff };
  } catch {
    return { success: true, data: [] };
  }
}

/**
 * Sends a direct SMS to a customer from the call drawer.
 */
export async function sendCallCustomerSmsAction(payload: {
  customerPhone: string;
  customerName?: string;
  messageText: string;
  callListItemId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = getSupabaseAdmin();
    const config = await getSmsConfig();

    const normalizedPhone = normalizeBdPhoneNumber(payload.customerPhone) || payload.customerPhone;
    const sendRes = await sendSmsBangladesh({
      to: normalizedPhone,
      message: payload.messageText,
      senderId: config.senderId,
    });

    if (supabase) {
      await supabase.from("sms_logs").insert({
        recipient_phone: normalizedPhone,
        status_event: "call_followup",
        message_text: payload.messageText,
        gateway: "smsbangladesh",
        sender_id: config.senderId,
        is_success: sendRes.success,
        response_code: sendRes.responseCode || null,
        campaign_cost: sendRes.campaignCost || 0,
        api_response: sendRes.rawResponse || null,
        error_message: sendRes.error || null,
        created_at: new Date().toISOString(),
      });
    }

    if (payload.callListItemId && isValidUuid(payload.callListItemId)) {
      const actorUuid = getActorUuid(session);
      await supabase.from("call_logs").insert({
        call_list_item_id: payload.callListItemId,
        called_by: actorUuid,
        outcome: "pending",
        notes: `SMS sent: "${payload.messageText.slice(0, 80)}"`,
        created_at: new Date().toISOString(),
      });
    }

    return { success: sendRes.success, error: sendRes.error };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send SMS." };
  }
}

/**
 * Returns overall due callback count across all active lists.
 */
export async function getDueCallbacksCountAction(): Promise<{
  success: boolean;
  count: number;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("call_list_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "call_later")
      .lte("callback_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    if (error) return { success: true, count: 0 };
    return { success: true, count: count || 0 };
  } catch {
    return { success: true, count: 0 };
  }
}

export interface CustomerOrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  weightGrams: number | null;
}

export interface CustomerDeliverySummary {
  totalOrders: number;
  deliveredCount: number;
  shippedCount: number;
  cancelledCount: number;
  returnedCount: number;
  pendingCount: number;
  successRate: number;
}

export interface CustomerOrderHistory {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentStatus: string | null;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  courierName: string | null;
  courierTrackingCode: string | null;
  courierTrackingUrl: string | null;
  courierConsignmentId: string | null;
  courierDeliveryCharge: number | null;
  shippingAddress: any | null;
  deliveredAt: string | null;
  shippedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  items: CustomerOrderItem[];
}

/**
 * Fetches complete order history, delivery details, and items for a customer.
 */
export async function getCustomerOrdersAction(
  customerId: string,
  customerPhone?: string | null
): Promise<{
  success: boolean;
  data: CustomerOrderHistory[];
  deliverySummary?: CustomerDeliverySummary;
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!isValidUuid(customerId)) {
      return { success: false, data: [], error: "Invalid customer ID" };
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        fulfillment_status,
        payment_status,
        payment_method,
        subtotal,
        discount_total,
        shipping_total,
        grand_total,
        courier_tracking_code,
        courier_tracking_url,
        courier_consignment_id,
        courier_delivery_charge,
        shipping_address,
        delivered_at,
        shipped_at,
        cancelled_at,
        cancel_reason,
        created_at,
        order_items (
          id,
          product_name,
          variant_name,
          quantity,
          unit_price,
          line_total,
          weight_grams
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    const cleanPhone = customerPhone ? normalizeBdPhoneNumber(customerPhone) : null;
    if (cleanPhone) {
      const localPhone = "0" + cleanPhone.slice(4);
      query = query.or(
        `customer_id.eq.${customerId},customer_phone.eq.${cleanPhone},customer_phone.eq.${localPhone}`
      );
    } else {
      query = query.eq("customer_id", customerId);
    }

    const { data: rawOrders, error } = await query;

    if (error) {
      const friendly = mapDatabaseError(error);
      return { success: false, data: [], error: friendly.message };
    }

    const orders: CustomerOrderHistory[] = (rawOrders || []).map((o: any) => {
      const addr = o.shipping_address;
      const courierName =
        addr?.courier_name ||
        (o.courier_tracking_code ? "Steadfast Courier" : null);

      const trackingUrl =
        o.courier_tracking_url ||
        (o.courier_tracking_code
          ? `https://steadfast.com.bd/tracking/${o.courier_tracking_code}`
          : null);

      return {
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        fulfillmentStatus: o.fulfillment_status || null,
        paymentStatus: o.payment_status || "pending",
        paymentMethod: o.payment_method || "cod",
        subtotal: Number(o.subtotal || 0),
        discountTotal: Number(o.discount_total || 0),
        shippingTotal: Number(o.shipping_total || 0),
        grandTotal: Number(o.grand_total || 0),
        courierName,
        courierTrackingCode: o.courier_tracking_code || null,
        courierTrackingUrl: trackingUrl,
        courierConsignmentId: o.courier_consignment_id || null,
        courierDeliveryCharge: o.courier_delivery_charge ? Number(o.courier_delivery_charge) : null,
        shippingAddress: o.shipping_address || null,
        deliveredAt: o.delivered_at || null,
        shippedAt: o.shipped_at || null,
        cancelledAt: o.cancelled_at || null,
        cancelReason: o.cancel_reason || null,
        createdAt: o.created_at,
        items: (o.order_items || []).map((item: any) => ({
          id: item.id,
          productName: item.product_name || "Product",
          variantName: item.variant_name || null,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unit_price || 0),
          lineTotal: Number(item.line_total || 0),
          weightGrams: item.weight_grams ? Number(item.weight_grams) : null,
        })),
      };
    });

    const totalOrders = orders.length;
    const deliveredCount = orders.filter((o) => o.status === "delivered").length;
    const shippedCount = orders.filter((o) => o.status === "shipped").length;
    const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
    const returnedCount = orders.filter((o) => o.status === "returned").length;
    const pendingCount = orders.filter((o) =>
      ["pending", "confirmed", "processing"].includes(o.status)
    ).length;

    const resolvedCount = deliveredCount + cancelledCount + returnedCount;
    const successRate =
      resolvedCount > 0
        ? Math.round((deliveredCount / resolvedCount) * 100)
        : deliveredCount > 0
        ? 100
        : 0;

    const deliverySummary: CustomerDeliverySummary = {
      totalOrders,
      deliveredCount,
      shippedCount,
      cancelledCount,
      returnedCount,
      pendingCount,
      successRate,
    };

    return { success: true, data: orders, deliverySummary };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, data: [], error: friendly.message };
  }
}
