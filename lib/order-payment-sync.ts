import { isOrderDeliveredStatus } from "@/lib/order-payment-utils";

interface ReconcileOrderPaymentsParams {
  client: any;
  orderUuid: string;
  status: string;
  deliveredAt?: string | null;
  paymentMethod?: string | null;
  provider?: string;
  targetAdvancePaid: number;
  targetAmountPaid: number;
  transactionRef?: string | null;
  paidAtIso?: string;
}

const VALID_PAYMENT_METHODS = new Set([
  "cod",
  "bkash",
  "nagad",
  "rocket",
  "card",
  "bank_transfer",
  "cash",
  "credit_terms",
]);

function normalizePaymentMethod(method?: string | null): string {
  const m = (method || "cod").toLowerCase().trim();
  return VALID_PAYMENT_METHODS.has(m) ? m : "cod";
}

function roundMoney(value: number): number {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
}

/**
 * Keeps `public.payments` ledger synchronized with direct order payment updates
 * (`advance_paid` pre-delivery charges and post-delivery `amount_paid` charges)
 * so `/admin/payments`, `admin_kpis`, and `trg_payments_sync` remain consistent.
 */
export async function reconcileOrderPaymentsInLedger({
  client,
  orderUuid,
  status,
  deliveredAt,
  paymentMethod,
  provider = "manual",
  targetAdvancePaid,
  targetAmountPaid,
  transactionRef,
  paidAtIso,
}: ReconcileOrderPaymentsParams): Promise<void> {
  if (!orderUuid) return;

  const isDelivered = isOrderDeliveredStatus(status, deliveredAt);
  const cleanAdvance = roundMoney(targetAdvancePaid);
  const cleanAmountPaid = isDelivered ? roundMoney(targetAmountPaid) : 0;
  const method = normalizePaymentMethod(paymentMethod);
  const nowIso = paidAtIso || new Date().toISOString();
  const cleanRef = transactionRef?.trim() || null;

  const { data: existingRows, error: fetchErr } = await client
    .from("payments")
    .select("id, kind, status, amount, is_advance, provider, provider_txn_id")
    .eq("order_id", orderUuid)
    .eq("status", "succeeded");

  if (fetchErr || !Array.isArray(existingRows)) {
    return;
  }

  let advSum = 0;
  let postSum = 0;
  let refundSum = 0;
  const advRowIds: string[] = [];
  const postRowIds: string[] = [];

  for (const row of existingRows) {
    const amt = Number(row.amount) || 0;
    if (row.kind === "refund") {
      refundSum += amt;
    } else if (row.kind === "charge") {
      if (row.is_advance) {
        advSum += amt;
        advRowIds.push(row.id);
      } else {
        postSum += amt;
        postRowIds.push(row.id);
      }
    }
  }

  advSum = roundMoney(advSum);
  postSum = roundMoney(postSum);
  refundSum = roundMoney(refundSum);

  // 1. Reconcile pre-delivery advance charges
  if (cleanAdvance > advSum + 0.005) {
    const delta = roundMoney(cleanAdvance - advSum);
    await client.from("payments").insert({
      order_id: orderUuid,
      kind: "charge",
      method,
      provider,
      status: "succeeded",
      amount: delta,
      is_advance: true,
      provider_txn_id: cleanRef,
      paid_at: nowIso,
    });
  } else if (cleanAdvance + 0.005 < advSum && advRowIds.length > 0) {
    await client
      .from("payments")
      .update({ status: "cancelled", updated_at: nowIso })
      .in("id", advRowIds);

    if (cleanAdvance > 0) {
      await client.from("payments").insert({
        order_id: orderUuid,
        kind: "charge",
        method,
        provider,
        status: "succeeded",
        amount: cleanAdvance,
        is_advance: true,
        provider_txn_id: cleanRef,
        paid_at: nowIso,
      });
    }
  }

  // 2. Reconcile post-delivery collection charges (only when delivered)
  if (isDelivered) {
    const targetPost = roundMoney(Math.max(0, cleanAmountPaid + refundSum - cleanAdvance));
    if (targetPost > postSum + 0.005) {
      const delta = roundMoney(targetPost - postSum);
      await client.from("payments").insert({
        order_id: orderUuid,
        kind: "charge",
        method,
        provider,
        status: "succeeded",
        amount: delta,
        is_advance: false,
        provider_txn_id: cleanRef,
        paid_at: nowIso,
      });
    } else if (targetPost + 0.005 < postSum && postRowIds.length > 0) {
      await client
        .from("payments")
        .update({ status: "cancelled", updated_at: nowIso })
        .in("id", postRowIds);

      if (targetPost > 0) {
        await client.from("payments").insert({
          order_id: orderUuid,
          kind: "charge",
          method,
          provider,
          status: "succeeded",
          amount: targetPost,
          is_advance: false,
          provider_txn_id: cleanRef,
          paid_at: nowIso,
        });
      }
    }
  }
}
