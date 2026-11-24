export interface OrderPaymentLike {
  status?: string | null;
  payment?: string | null;
  payment_status?: string | null;
  grand_total?: number | null;
  advance_paid?: number | null;
  amount_paid?: number | null;
  delivered_at?: string | null;
}

/**
 * Returns true if the order has reached a delivery state where `amount_paid`
 * represents total collected payment after delivery.
 */
export function isOrderDeliveredStatus(
  status?: string | null,
  deliveredAt?: string | null
): boolean {
  const s = (status || "").toLowerCase().trim();
  if (s === "delivered" || s === "partially_delivered") {
    return true;
  }
  return s === "returned" && Boolean(deliveredAt);
}

/**
 * Safely extracts pre-delivery advance payment amount.
 */
export function getOrderAdvancePaid(order: Pick<OrderPaymentLike, "advance_paid">): number {
  return Math.max(0, Number(order.advance_paid) || 0);
}

/**
 * Safely extracts total paid amount after delivery (`0` while order is pre-delivery).
 */
export function getOrderAmountPaidAfterDelivery(
  order: Pick<OrderPaymentLike, "status" | "amount_paid" | "delivered_at">
): number {
  if (!isOrderDeliveredStatus(order.status, order.delivered_at)) {
    return 0;
  }
  return Math.max(0, Number(order.amount_paid) || 0);
}

/**
 * Returns the effective paid total for the order's current lifecycle stage:
 * - Pre-delivery: `advance_paid`
 * - Delivered: `amount_paid` (which already includes `advance_paid + COD collected`)
 */
export function getOrderEffectivePaid(order: OrderPaymentLike): number {
  if (isOrderDeliveredStatus(order.status, order.delivered_at)) {
    return Math.max(0, Number(order.amount_paid) || 0);
  }
  return Math.max(0, Number(order.advance_paid) || 0);
}

/**
 * Calculates remaining unpaid / COD balance for an order.
 * Returns 0 if `payment` / `payment_status` is `"paid"`.
 */
export function getOrderDueBalance(order: OrderPaymentLike): number {
  const payStatus = (order.payment || order.payment_status || "").toLowerCase().trim();
  if (payStatus === "paid") {
    return 0;
  }
  const grandTotal = Math.max(0, Number(order.grand_total) || 0);
  const effectivePaid = getOrderEffectivePaid(order);
  return Math.max(0, grandTotal - effectivePaid);
}

/**
 * Derives payment_status from grand_total and effective paid total.
 */
export function deriveOrderPaymentStatus(
  grandTotal: number,
  effectivePaid: number,
  currentStatus?: string | null
): "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded" {
  if (currentStatus === "refunded" || currentStatus === "partially_refunded") {
    return currentStatus;
  }
  const total = Math.max(0, Number(grandTotal) || 0);
  const paid = Math.max(0, Number(effectivePaid) || 0);
  if (paid > 0 && paid >= total) {
    return "paid";
  }
  if (paid > 0) {
    return "partially_paid";
  }
  return "unpaid";
}
