import { Order } from "@/types/order";

export interface OrderCourierSnapshot {
  recipient_name: string;
  phone: string;
  alternative_phone: string;
  address_line: string;
  district: string;
  division: string;
  cod_amount: number;
}

export interface OrderReprintDiffItem {
  field: string;
  old: string;
  new: string;
}

/**
 * Builds a standardized courier-relevant fields snapshot from an Order object.
 * Strictly monitors:
 * 1. Recipient Name
 * 2. Contact Phone (customer phone / shipping address phone)
 * 3. Alternative Phone
 * 4. Delivery Address (address line, district, division)
 * 5. COD Amount
 */
export function buildOrderCourierSnapshot(order: Order): OrderCourierSnapshot {
  const recipientName = (order.address?.recipient_name || order.customer || "").trim();
  const phone = (order.address?.phone || order.shipping_phone || order.phone || "").trim();
  const altPhone = (order.alternative_phone || "").trim();
  const addressLine = (order.address?.address_line || "").trim();
  const district = (order.address?.district || "").trim();
  const division = (order.address?.division || "").trim();

  const isPaid = order.payment === "paid";
  const grandTotal = Number(order.grand_total) || 0;
  const amountPaid = Number(order.amount_paid) || 0;
  const codAmount = isPaid ? 0 : Math.max(0, Math.round(grandTotal - amountPaid));

  return {
    recipient_name: recipientName,
    phone,
    alternative_phone: altPhone,
    address_line: addressLine,
    district,
    division,
    cod_amount: codAmount,
  };
}

/**
 * Calculates field-by-field differences between the current order courier state
 * and the snapshot recorded when the order was last printed.
 * Returns an empty array if the order was never printed.
 */
export function getOrderReprintDiff(order: Order): OrderReprintDiffItem[] {
  if (!order.printed_at || !order.printed_courier_snapshot) {
    return [];
  }

  const current = buildOrderCourierSnapshot(order);
  const printed = order.printed_courier_snapshot as Partial<OrderCourierSnapshot>;
  const diffs: OrderReprintDiffItem[] = [];

  const prevName = (printed.recipient_name || "").trim();
  if (current.recipient_name !== prevName) {
    diffs.push({
      field: "Recipient Name",
      old: prevName || "(Empty)",
      new: current.recipient_name || "(Empty)",
    });
  }

  const prevPhone = (printed.phone || "").trim();
  if (current.phone !== prevPhone) {
    diffs.push({
      field: "Contact Phone",
      old: prevPhone || "(Empty)",
      new: current.phone || "(Empty)",
    });
  }

  const prevAltPhone = (printed.alternative_phone || "").trim();
  if (current.alternative_phone !== prevAltPhone) {
    diffs.push({
      field: "Alternative Phone",
      old: prevAltPhone || "(None)",
      new: current.alternative_phone || "(None)",
    });
  }

  const prevAddressLine = (printed.address_line || "").trim();
  const prevDistrict = (printed.district || "").trim();
  const prevDivision = (printed.division || "").trim();

  const addressChanged =
    current.address_line !== prevAddressLine ||
    current.district !== prevDistrict ||
    current.division !== prevDivision;

  if (addressChanged) {
    const oldFull = [prevAddressLine, prevDistrict, prevDivision].filter(Boolean).join(", ");
    const newFull = [current.address_line, current.district, current.division].filter(Boolean).join(", ");
    diffs.push({
      field: "Delivery Address",
      old: oldFull || "(Empty)",
      new: newFull || "(Empty)",
    });
  }

  const prevCod = Number(printed.cod_amount) || 0;
  if (current.cod_amount !== prevCod) {
    diffs.push({
      field: "COD Amount",
      old: `৳${prevCod.toLocaleString()}`,
      new: `৳${current.cod_amount.toLocaleString()}`,
    });
  }

  return diffs;
}

/**
 * Returns true strictly if the order was previously printed AND has courier-related
 * field modifications that have not been reprinted.
 */
export function isOrderReprintRequired(order: Order): boolean {
  return getOrderReprintDiff(order).length > 0;
}

/**
 * Formats diff items into a readable summary string.
 */
export function formatOrderReprintDiffSummary(diffs: OrderReprintDiffItem[]): string {
  if (diffs.length === 0) return "";
  return diffs.map((d) => `${d.field}: ${d.old} → ${d.new}`).join("; ");
}

