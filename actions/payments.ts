"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

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
    const [paymentsRes, logsRes] = await Promise.all([
      supabaseAdmin
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
        .limit(100),

      supabaseAdmin
        .from("payment_logs")
        .select("id, payment_id, provider, event, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const rawPayments = paymentsRes.data || [];
    const rawLogs = logsRes.data || [];

    const transactions: TransactionItem[] = rawPayments.map((p: any) => {
      const orderInfo = Array.isArray(p.orders) ? p.orders[0] : p.orders;
      const orderNumber = orderInfo?.order_number || p.order_id || "N/A";
      const customer = orderInfo?.customer_name || "Guest Customer";
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

    const logs: PaymentLogItem[] = rawLogs.map((l: any) => ({
      id: `LOG-${l.id}`,
      txnId: l.payment_id ? `TXN-${String(l.payment_id).slice(0, 8)}` : "SYSTEM",
      gateway: l.provider || "gateway",
      event: l.event || "webhook.received",
      status: "completed",
      time: l.created_at,
    }));

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

    rawPayments.forEach((p: any) => {
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
    rawPayments.forEach((p: any) => {
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
    console.error("getAdminPaymentsAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to load payments",
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
    // Find order by order_number
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, grand_total, amount_paid, payment_status")
      .eq("order_number", payload.orderNumber)
      .single();

    if (orderErr || !order) {
      return { success: false, error: "Order not found" };
    }

    const newAmountPaid = Number(order.amount_paid || 0) + payload.amount;
    const isFullyPaid = newAmountPaid >= Number(order.grand_total || 0);
    const newStatus = isFullyPaid ? "paid" : "partially_paid";

    // Insert payment record
    const { error: payErr } = await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      kind: "charge",
      method: payload.method,
      provider: payload.gatewayRef || "manual",
      amount: payload.amount,
      status: "succeeded",
      paid_at: new Date().toISOString(),
      provider_txn_id: payload.gatewayRef || `MANUAL-${Date.now()}`,
    });

    if (payErr) {
      return { success: false, error: payErr.message };
    }

    // Update order payment status
    await supabaseAdmin
      .from("orders")
      .update({
        amount_paid: newAmountPaid,
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record payment" };
  }
}

export async function refundPaymentAction(payload: {
  transactionId: string;
  amount: number;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Locate original transaction
    const { data: orig, error: origErr } = await supabaseAdmin
      .from("payments")
      .select("id, order_id, method, provider")
      .or(`id.eq.${payload.transactionId},provider_txn_id.eq.${payload.transactionId}`)
      .single();

    if (origErr || !orig) {
      return { success: false, error: "Original transaction not found" };
    }

    // Insert refund entry
    const { error: refErr } = await supabaseAdmin.from("payments").insert({
      order_id: orig.order_id,
      kind: "refund",
      method: orig.method,
      provider: orig.provider,
      amount: payload.amount,
      status: "succeeded",
      paid_at: new Date().toISOString(),
      provider_txn_id: `REFUND-${Date.now()}`,
      failure_reason: payload.reason || "Staff initiated refund",
    });

    if (refErr) {
      return { success: false, error: refErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to process refund" };
  }
}

export async function updatePaymentStatusAction(payload: {
  transactionId: string;
  status: "succeeded" | "failed" | "cancelled" | "pending";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const dbStatus = payload.status === "succeeded" ? "succeeded" : payload.status;
    const { error } = await supabaseAdmin
      .from("payments")
      .update({
        status: dbStatus,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${payload.transactionId},provider_txn_id.eq.${payload.transactionId}`);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update payment status" };
  }
}

