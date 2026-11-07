"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole, getStaffSession } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";

export interface TransactionItem {
  id: string;
  orderId: string;
  customer: string;
  method: "bkash" | "nagad" | "bank_transfer" | "card" | "cod";
  kind: "charge" | "refund";
  amount: string;
  amountNumeric: number;
  gatewayRef: string;
  status: "succeeded" | "pending" | "failed" | "cancelled";
  date: string;
}

export interface PaymentLogItem {
  id: string;
  txnId: string;
  gateway: string;
  event: string;
  status: string;
  time: string;
}

export interface PaymentVolumeItem {
  day: string;
  amount: number;
}

export interface MethodShareItem {
  name: string;
  value: number;
  color: string;
}

export interface AdminPaymentsData {
  transactions: TransactionItem[];
  logs: PaymentLogItem[];
  volumeData: PaymentVolumeItem[];
  methodShareData: MethodShareItem[];
}

const METHOD_COLORS: Record<string, string> = {
  bkash: "#e11d48",
  bank_transfer: "#0ea5e9",
  cod: "#64748b",
  nagad: "#f97316",
  card: "#8b5cf6",
};

export async function getAdminPaymentsAction(): Promise<{
  success: boolean;
  data: AdminPaymentsData;
  error?: string;
}> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    // Query payments using staff session (RLS applies)
    const { data: rawPayments, error: payError } = await supabase
      .from("payments")
      .select(
        `
        id,
        order_id,
        kind,
        method,
        provider,
        status,
        amount,
        currency,
        provider_payment_id,
        provider_txn_id,
        paid_at,
        created_at,
        orders:order_id (
          order_number,
          customer_name
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (payError) throw payError;

    // payment_logs: secret key allowed ONLY for admin and owner after explicit role check
    let logs: PaymentLogItem[] = [];
    if (session.role === "owner" || session.role === "admin") {
      const { data: rawLogs } = await supabaseAdmin
        .from("payment_logs")
        .select("id, payment_id, provider, event, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      logs = (rawLogs || []).map((l: any) => ({
        id: `LOG-${l.id}`,
        txnId: l.payment_id ? `TXN-${String(l.payment_id).slice(0, 8)}` : "SYSTEM",
        gateway: l.provider || "gateway",
        event: l.event || "webhook.received",
        status: "completed",
        time: l.created_at,
      }));
    }

    const transactions: TransactionItem[] = (rawPayments || []).map((p: any) => {
      const orderInfo = Array.isArray(p.orders) ? p.orders[0] : p.orders;
      const orderNumber = orderInfo?.order_number || p.order_id || "N/A";
      const customer = orderInfo?.customer_name || "Customer";
      const numAmount = Number(p.amount || 0);

      let statusVal: TransactionItem["status"] = "pending";
      if (p.status === "succeeded" || p.status === "paid") statusVal = "succeeded";
      else if (p.status === "failed") statusVal = "failed";
      else if (p.status === "cancelled") statusVal = "cancelled";

      return {
        id: p.provider_txn_id || `TXN-${p.id.slice(0, 8)}`,
        orderId: orderNumber,
        customer,
        method: (p.method as any) || "cod",
        kind: p.kind === "refund" ? "refund" : "charge",
        amount: `৳ ${numAmount.toLocaleString("en-BD")}`,
        amountNumeric: numAmount,
        gatewayRef: p.provider_payment_id || p.provider_txn_id || p.provider || "Manual",
        status: statusVal,
        date: p.paid_at || p.created_at,
      };
    });

    // Volume by day for current week
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const volumeMap = new Map<string, number>([
      ["Mon", 0],
      ["Tue", 0],
      ["Wed", 0],
      ["Thu", 0],
      ["Fri", 0],
      ["Sat", 0],
      ["Sun", 0],
    ]);

    (rawPayments || []).forEach((p: any) => {
      const pDate = new Date(p.created_at);
      if (pDate >= startOfWeek) {
        const dName = dayNames[pDate.getDay()];
        if (volumeMap.has(dName)) {
          volumeMap.set(dName, (volumeMap.get(dName) || 0) + Number(p.amount || 0));
        }
      }
    });

    const volumeData: PaymentVolumeItem[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
      day: d,
      amount: volumeMap.get(d) || 0,
    }));

    // Method share
    const methodCountMap: Record<string, number> = {};
    (rawPayments || []).forEach((p: any) => {
      const m = p.method || "cod";
      methodCountMap[m] = (methodCountMap[m] || 0) + 1;
    });

    const totalMethodTxns = Object.values(methodCountMap).reduce((a, b) => a + b, 0);
    const methodShareData: MethodShareItem[] = Object.entries(methodCountMap).map(([m, count]) => {
      const pct = totalMethodTxns > 0 ? Math.round((count / totalMethodTxns) * 100) : 0;
      let label = m.toUpperCase();
      if (m === "cod") label = "Cash on Delivery";
      else if (m === "bkash") label = "bKash";
      else if (m === "bank_transfer") label = "Bank Transfer";
      else if (m === "nagad") label = "Nagad";

      return {
        name: label,
        value: pct,
        color: METHOD_COLORS[m] || "#64748b",
      };
    });

    return {
      success: true,
      data: {
        transactions,
        logs,
        volumeData,
        methodShareData,
      },
    };
  } catch (error: any) {
    const friendly = mapDatabaseError(error);
    return {
      success: false,
      error: friendly.message,
      data: {
        transactions: [],
        logs: [],
        volumeData: [],
        methodShareData: [],
      },
    };
  }
}

export async function recordManualPaymentAction(payload: {
  orderNumber: string;
  method: "bkash" | "nagad" | "bank_transfer" | "card" | "cod";
  amount: number;
  gatewayRef?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    // Find order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, grand_total, amount_paid, payment_status")
      .or(`order_number.eq.${payload.orderNumber},id.eq.${payload.orderNumber}`)
      .single();

    if (orderErr || !order) {
      return { success: false, error: "Order not found" };
    }

    // Insert payment record (Trigger trg_payments_sync automatically updates orders.amount_paid & payment_status)
    const { error: payErr } = await supabase.from("payments").insert({
      order_id: order.id,
      kind: "charge",
      method: payload.method,
      provider: "manual",
      amount: payload.amount,
      status: "succeeded",
      paid_at: new Date().toISOString(),
      provider_txn_id: payload.gatewayRef || `MANUAL-${Date.now()}`,
    });

    if (payErr) {
      const friendly = mapDatabaseError(payErr);
      return { success: false, error: friendly.message };
    }

    if (payload.notes?.trim()) {
      await supabase.from("staff_notes").insert({
        entity_type: "order",
        entity_id: order.id,
        author_id: session.user.id,
        body: `[Payment Recorded] ৳${payload.amount} via ${payload.method}: ${payload.notes.trim()}`,
      });
    }

    revalidatePath("/admin/payments");
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${order.id}`);
    return { success: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}

export async function refundPaymentAction(payload: {
  transactionId: string;
  amount: number;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const { data: orig, error: origErr } = await supabase
      .from("payments")
      .select("id, order_id, method, provider")
      .or(`id.eq.${payload.transactionId},provider_txn_id.eq.${payload.transactionId}`)
      .single();

    if (origErr || !orig) {
      return { success: false, error: "Original transaction not found" };
    }

    const { error: refErr } = await supabase.from("payments").insert({
      order_id: orig.order_id,
      kind: "refund",
      method: orig.method,
      provider: orig.provider,
      amount: payload.amount,
      status: "succeeded",
      paid_at: new Date().toISOString(),
      provider_txn_id: `REFUND-${Date.now()}`,
    });

    if (refErr) {
      const friendly = mapDatabaseError(refErr);
      return { success: false, error: friendly.message };
    }

    if (payload.reason?.trim()) {
      await supabase.from("staff_notes").insert({
        entity_type: "order",
        entity_id: orig.order_id,
        author_id: session.user.id,
        body: `[Refund Processed] ৳${payload.amount}: ${payload.reason.trim()}`,
      });
    }

    revalidatePath("/admin/payments");
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orig.order_id}`);
    return { success: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}

export async function updatePaymentStatusAction(payload: {
  transactionId: string;
  status: "succeeded" | "failed" | "cancelled" | "pending";
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = await createClient();

    const { error } = await supabase
      .from("payments")
      .update({
        status: payload.status,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${payload.transactionId},provider_txn_id.eq.${payload.transactionId}`);

    if (error) {
      const friendly = mapDatabaseError(error);
      return { success: false, error: friendly.message };
    }

    revalidatePath("/admin/payments");
    return { success: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}
