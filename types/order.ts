export interface OrderItem {
  id: string;
  sku: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  variant_id?: string | null;
  product_id?: string | null;
  image?: string | null;
  package_type?: string | null;
  product_name_bn?: string | null;
  variant_name_bn?: string | null;
  is_combo?: boolean;
  combo_components?: Array<{
    component_variant_id: string;
    product_id?: string;
    sku?: string;
    product_name?: string;
    product_name_bn?: string;
    variant_name?: string;
    variant_name_bn?: string;
    quantity: number;
    unit_price?: number;
    weight_grams?: number;
    pack_type?: string;
  }>;
}

export type OrderNoteType =
  | "internal"
  | "customer"
  | "delivery"
  | "packaging"
  | "system"
  | "internal_staff_note"
  | "delivery_note"
  | "packaging_note"
  | "system_note";

export interface OrderNote {
  id: string;
  author: string;
  text: string;
  type: OrderNoteType;
  created_at: string;
  order_id?: string;
  order_number?: string;
  updated_at?: string;
}

export interface OrderEvent {
  id: string;
  event_type: string;
  from_value?: string;
  to_value?: string;
  message: string;
  actor: string;
  created_at: string;
}

export interface Order {
  id: string;
  uuid?: string;
  db_id?: string;
  order_number?: string;
  customer: string;
  phone: string;
  alternative_phone?: string;
  shipping_phone?: string;
  recipient_name?: string;
  email: string;
  address: {
    division: string;
    district: string;
    address_line: string;
    recipient_name?: string;
    phone?: string;
  };
  status:
    | "incomplete_order"
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "partially_delivered"
    | "cancelled"
    | "returned";
  payment: "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded";
  fulfillment: "unfulfilled" | "partial" | "fulfilled";
  method: "cod" | "bkash" | "nagad" | "rocket" | "card" | "bank_transfer" | "credit_terms" | "cash";
  channel: "web" | "phone" | "whatsapp" | "admin" | "facebook" | "walk_in";
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  grand_total: number;
  amount_paid: number;
  currency: string;
  date: string;
  customer_note?: string;
  cancel_reason?: string;
  courier_name?: string;
  courier_consignment_id?: string;
  courier_tracking_code?: string;
  courier_tracking_url?: string;
  courier_invoice?: string;
  courier_delivery_charge?: number | null;
  courier_payload_snapshot?: Record<string, any> | null;
  printed_at?: string | null;
  printed_courier_snapshot?: Record<string, any> | null;
  items: OrderItem[];
  notes: OrderNote[];
  events: OrderEvent[];
  isFromDb?: boolean;
  public_token?: string;
  attribution?: Record<string, any> | null;
}

export interface CatalogProduct {
  variant_id?: string;
  product_id?: string;
  sku: string;
  product_name: string;
  variant_name: string;
  category: string;
  unit_price: number;
  stock: string;
  image: string;
  pack_type?: string;
}

export interface OtherOrderInsight {
  statusText: string;
  note: string;
  badgeStyle: string;
  dotColor: string;
}

export function getOtherOrderInsight(status: string | undefined | null): OtherOrderInsight {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "delivered":
      return {
        statusText: "delivered",
        note: "old customer",
        badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
        dotColor: "bg-emerald-500",
      };
    case "returned":
      return {
        statusText: "returned",
        note: "returned order",
        badgeStyle: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-semibold",
        dotColor: "bg-rose-500",
      };
    case "cancelled":
      return {
        statusText: "cancelled",
        note: "cancelled order",
        badgeStyle: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900/50 dark:text-stone-300 dark:border-stone-800",
        dotColor: "bg-stone-400",
      };
    case "shipped":
      return {
        statusText: "shipped",
        note: "order in transit",
        badgeStyle: "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
        dotColor: "bg-sky-500",
      };
    case "processing":
      return {
        statusText: "processing",
        note: "processing order",
        badgeStyle: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
        dotColor: "bg-blue-500",
      };
    case "confirmed":
      return {
        statusText: "confirmed",
        note: "confirmed order",
        badgeStyle: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800",
        dotColor: "bg-teal-500",
      };
    case "pending":
      return {
        statusText: "pending",
        note: "pending order",
        badgeStyle: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
        dotColor: "bg-amber-500",
      };
    case "incomplete_order":
    case "incomplete":
      return {
        statusText: "incomplete",
        note: "incomplete order",
        badgeStyle: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800",
        dotColor: "bg-slate-400",
      };
    default:
      return {
        statusText: s || "previous",
        note: "previous order",
        badgeStyle: "bg-muted text-muted-foreground border-border",
        dotColor: "bg-muted-foreground",
      };
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOrderUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val.trim());
}

/**
 * Deduplicates and resolves all other orders associated with a customer phone.
 * Reconciles in-memory loaded orders, attribution.other_orders (which may contain UUIDs or order numbers),
 * and attribution.other_order_numbers (which contain human-friendly order IDs).
 *
 * Guarantees:
 * 1. Current order is never shown as its own "other order".
 * 2. An order is never shown twice (e.g. once with UUID and once with order_number).
 * 3. Human-readable order numbers (e.g. MOL-2611-01008) are prioritized over raw UUIDs.
 * 4. Insight statuses, grand totals, and notes are preserved.
 */
export function resolveOtherOrdersForDisplay(
  order: Partial<Order> | null | undefined,
  ordersList?: Order[] | null
): Order[] {
  if (!order) return [];

  // Normalize target order identity
  const currentId = order.id ? String(order.id).trim() : "";
  const currentNum = order.order_number ? String(order.order_number).trim() : "";
  const currentUuid =
    (order.uuid && String(order.uuid).trim()) ||
    (order.db_id && String(order.db_id).trim()) ||
    (isOrderUuid(currentId) ? currentId : "");

  // Current phone normalization (last 10 digits)
  const rawPhone = (order.phone || order.shipping_phone || order.address?.phone || "").replace(/\D/g, "");
  const currentPhoneKey = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;

  const result: Order[] = [];

  const isCurrentOrder = (
    candidateId?: string | null,
    candidateNum?: string | null,
    candidateUuid?: string | null
  ) => {
    const cId = candidateId ? String(candidateId).trim() : "";
    const cNum = candidateNum ? String(candidateNum).trim() : "";
    const cUuid = candidateUuid ? String(candidateUuid).trim() : "";

    if (currentId && (cId === currentId || cNum === currentId || cUuid === currentId)) return true;
    if (currentNum && (cId === currentNum || cNum === currentNum || cUuid === currentNum)) return true;
    if (currentUuid && (cId === currentUuid || cNum === currentUuid || cUuid === currentUuid)) return true;
    return false;
  };

  const findExistingIndex = (
    cId?: string | null,
    cNum?: string | null,
    cUuid?: string | null
  ): number => {
    const cIdStr = cId ? String(cId).trim() : "";
    const cNumStr = cNum ? String(cNum).trim() : "";
    const cUuidStr = cUuid ? String(cUuid).trim() : "";

    return result.findIndex((item) => {
      const itemId = item.id ? String(item.id).trim() : "";
      const itemNum = item.order_number ? String(item.order_number).trim() : "";
      const itemUuid = (item.uuid || item.db_id || (isOrderUuid(itemId) ? itemId : "")).trim();

      if (cIdStr && (itemId === cIdStr || itemNum === cIdStr || itemUuid === cIdStr)) return true;
      if (cNumStr && (itemId === cNumStr || itemNum === cNumStr || itemUuid === cNumStr)) return true;
      if (cUuidStr && (itemId === cUuidStr || itemNum === cUuidStr || itemUuid === cUuidStr)) return true;
      return false;
    });
  };

  // 1. Gather other orders matching the same customer phone in loadedOrders
  if (currentPhoneKey && ordersList && Array.isArray(ordersList)) {
    for (const o of ordersList) {
      const oId = String(o.id || "").trim();
      const oNum = String(o.order_number || oId).trim();
      const oUuid = (o.uuid || o.db_id || (isOrderUuid(oId) ? oId : "")).trim();

      if (isCurrentOrder(oId, oNum, oUuid)) continue;

      const oRawPhone = (o.phone || o.shipping_phone || o.address?.phone || "").replace(/\D/g, "");
      const oPhoneKey = oRawPhone.length >= 10 ? oRawPhone.slice(-10) : oRawPhone;

      if (oPhoneKey && oPhoneKey === currentPhoneKey) {
        if (findExistingIndex(oId, oNum, oUuid) === -1) {
          result.push({
            ...o,
            id: oNum || oId,
            order_number: oNum || oId,
            uuid: oUuid || undefined,
            db_id: oUuid || undefined,
          });
        }
      }
    }
  }

  // 2. Parse attribution historical snapshots
  const attrOrders: any[] = Array.isArray(order.attribution?.other_orders)
    ? order.attribution.other_orders
    : [];
  const attrNumbers: string[] = Array.isArray(order.attribution?.other_order_numbers)
    ? order.attribution.other_order_numbers
    : [];

  // 3. Process each historical order in attrOrders
  attrOrders.forEach((ao: any, idx: number) => {
    if (!ao || typeof ao !== "object") return;

    const rawAoId = String(ao.id || "").trim();
    const rawAoNum = String(ao.order_number || "").trim();
    const aoIsUuid = isOrderUuid(rawAoId);

    // Correlate human-readable order number:
    // a) ao.order_number if explicitly present
    // b) match against loaded orders by UUID
    // c) match by array index with attrNumbers (constructed in lockstep query)
    // d) fallback to ao.id if not a UUID
    let resolvedOrderNumber: string | undefined = rawAoNum || undefined;

    if (!resolvedOrderNumber && aoIsUuid && ordersList && Array.isArray(ordersList)) {
      const found = ordersList.find(
        (o) => (o.uuid && o.uuid === rawAoId) || (o.db_id && o.db_id === rawAoId) || o.id === rawAoId
      );
      if (found) {
        resolvedOrderNumber = found.order_number || found.id;
      }
    }

    if (!resolvedOrderNumber && attrNumbers[idx] && !isOrderUuid(attrNumbers[idx])) {
      resolvedOrderNumber = String(attrNumbers[idx]).trim();
    }

    if (!resolvedOrderNumber && !aoIsUuid && rawAoId) {
      resolvedOrderNumber = rawAoId;
    }

    const resolvedUuid: string | undefined =
      aoIsUuid ? rawAoId : (order.uuid || order.db_id || undefined);

    if (isCurrentOrder(rawAoId, resolvedOrderNumber, resolvedUuid)) return;

    const existingIdx = findExistingIndex(rawAoId, resolvedOrderNumber, resolvedUuid);

    if (existingIdx !== -1) {
      const existing = result[existingIdx];
      if (resolvedOrderNumber && isOrderUuid(existing.id)) {
        existing.id = resolvedOrderNumber;
        existing.order_number = resolvedOrderNumber;
      }
      if (resolvedUuid && !existing.uuid) {
        existing.uuid = resolvedUuid;
        existing.db_id = resolvedUuid;
      }
      if (ao.status && (!existing.status || existing.status === "pending")) {
        existing.status = ao.status;
      }
      if (ao.placed_at || ao.created_at) {
        existing.date = existing.date || ao.placed_at || ao.created_at;
      }
      if (ao.grand_total !== undefined && !existing.grand_total) {
        existing.grand_total = Number(ao.grand_total);
      }
    } else {
      const displayId = resolvedOrderNumber || rawAoId;
      result.push({
        id: displayId,
        order_number: resolvedOrderNumber || displayId,
        uuid: resolvedUuid,
        db_id: resolvedUuid,
        status: ao.status || "pending",
        date: ao.placed_at || ao.created_at || "",
        customer: order.customer || "",
        phone: order.phone || "",
        grand_total: Number(ao.grand_total) || 0,
      } as Order);
    }
  });

  // 4. Process attrNumbers to catch any order numbers not in attrOrders
  attrNumbers.forEach((rawNum: string, idx: number) => {
    const num = String(rawNum || "").trim();
    if (!num) return;

    if (isCurrentOrder(num, num)) return;

    const existingIdx = findExistingIndex(num, num);
    if (existingIdx !== -1) {
      const existing = result[existingIdx];
      if (isOrderUuid(existing.id) && !isOrderUuid(num)) {
        existing.id = num;
        existing.order_number = num;
      }
      return;
    }

    // Check if an existing entry was created from attrOrders[idx] where order_number was missing
    if (attrOrders[idx] && isOrderUuid(attrOrders[idx].id)) {
      const uuidIdx = findExistingIndex(attrOrders[idx].id);
      if (uuidIdx !== -1) {
        const existing = result[uuidIdx];
        existing.id = num;
        existing.order_number = num;
        return;
      }
    }

    result.push({
      id: num,
      order_number: num,
      status: "pending",
      date: "",
      customer: order.customer || "",
      phone: order.phone || "",
    } as Order);
  });

  // 5. Final deduplication pass to ensure absolute uniqueness
  const finalUnique: Order[] = [];
  for (const item of result) {
    const itemId = String(item.id || "").trim();
    const itemNum = String(item.order_number || itemId).trim();
    const itemUuid = (item.uuid || item.db_id || (isOrderUuid(itemId) ? itemId : "")).trim();

    const dupIdx = finalUnique.findIndex((existing) => {
      const exId = String(existing.id || "").trim();
      const exNum = String(existing.order_number || exId).trim();
      const exUuid = (existing.uuid || existing.db_id || (isOrderUuid(exId) ? exId : "")).trim();

      if (itemId && (exId === itemId || exNum === itemId || exUuid === itemId)) return true;
      if (itemNum && (exId === itemNum || exNum === itemNum || exUuid === itemNum)) return true;
      if (itemUuid && (exId === itemUuid || exNum === itemUuid || exUuid === itemUuid)) return true;
      return false;
    });

    if (dupIdx === -1) {
      finalUnique.push(item);
    } else {
      const existing = finalUnique[dupIdx];
      if (isOrderUuid(existing.id) && !isOrderUuid(itemId)) {
        existing.id = itemId;
        existing.order_number = itemNum || itemId;
      }
      if (itemUuid && !existing.uuid) {
        existing.uuid = itemUuid;
        existing.db_id = itemUuid;
      }
      if (item.status && (!existing.status || existing.status === "pending")) {
        existing.status = item.status;
      }
      if (item.date && !existing.date) {
        existing.date = item.date;
      }
    }
  }

  return finalUnique;
}

export const ORDER_CANCELLATION_REASONS = [
  "Customer Changed Mind",
  "Duplicate / Test Order",
  "Customer Unreachable",
  "Out of Stock",
  "Customer Refused COD / Price",
  "Other (Custom)",
] as const;

export type OrderCancellationReason = (typeof ORDER_CANCELLATION_REASONS)[number];


