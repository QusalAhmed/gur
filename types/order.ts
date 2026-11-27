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
  weight_grams?: number;
  weight_kg?: number;
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
    postal_code?: string;
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
  advance_paid?: number;
  amount_paid: number;
  currency: string;
  date: string;
  delivered_at?: string | null;
  customer_note?: string;
  cancel_reason?: string;
  courier_name?: string;
  courier_consignment_id?: string;
  courier_tracking_code?: string;
  courier_tracking_url?: string;
  courier_invoice?: string;
  courier_delivery_charge?: number | null;
  courier_payload_snapshot?: Record<string, any> | null;
  brand_name?: string;
  brand_logo_url?: string;
  printed_at?: string | null;
  printed_courier_snapshot?: Record<string, any> | null;
  reprint_required?: boolean;
  is_paused?: boolean;
  sending_date?: string | null;
  paused_at?: string | null;
  pause_reason?: string | null;
  is_urgent?: boolean;
  total_weight_kg?: number;
  items: OrderItem[];
  notes: OrderNote[];
  events: OrderEvent[];
  isFromDb?: boolean;
  public_token?: string;
  attribution?: Record<string, any> | null;
  other_orders?: Order[];
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
  shortLabel: string;
  note: string;
  badgeStyle: string;
  dotColor: string;
}

/**
 * Resolves effective order status from DB `status` + `order_events` so partial deliveries
 * (persisted as `delivered` in PostgreSQL enum) remain accurately typed everywhere.
 */
export function resolveEffectiveOrderStatus(
  status: string | null | undefined,
  events?: Array<{ event_type?: string | null; to_value?: string | null; message?: string | null }> | null
): Order["status"] {
  const raw = (status || "pending").toLowerCase().trim();
  if (raw === "delivered" && Array.isArray(events)) {
    const isPartial = events.some((ev) => {
      if (!ev) return false;
      const evType = (ev.event_type || "").toLowerCase();
      const toVal = (ev.to_value || "").toLowerCase();
      const msg = (ev.message || "").toLowerCase();
      return (
        evType === "courier_status_partial_delivered" ||
        toVal === "partially_delivered" ||
        msg.includes("partially delivered") ||
        msg.includes("partial_delivered")
      );
    });
    if (isPartial) return "partially_delivered";
  }
  return (raw || "pending") as Order["status"];
}

export function getOtherOrderInsight(status: string | undefined | null): OtherOrderInsight {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "delivered":
      return {
        statusText: "delivered",
        shortLabel: "Delivered",
        note: "old customer",
        badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
        dotColor: "bg-emerald-500",
      };
    case "partially_delivered":
      return {
        statusText: "partially delivered",
        shortLabel: "Partial Deliv.",
        note: "partially delivered",
        badgeStyle: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800",
        dotColor: "bg-teal-500",
      };
    case "returned":
      return {
        statusText: "returned",
        shortLabel: "Returned",
        note: "returned order",
        badgeStyle: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800 font-semibold",
        dotColor: "bg-orange-500",
      };
    case "cancelled":
      return {
        statusText: "cancelled",
        shortLabel: "Cancelled",
        note: "cancelled order",
        badgeStyle: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
        dotColor: "bg-rose-500",
      };
    case "shipped":
      return {
        statusText: "shipped",
        shortLabel: "Shipped",
        note: "order in transit",
        badgeStyle: "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
        dotColor: "bg-purple-500",
      };
    case "processing":
      return {
        statusText: "processing",
        shortLabel: "Processing",
        note: "processing order",
        badgeStyle: "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
        dotColor: "bg-indigo-500",
      };
    case "confirmed":
      return {
        statusText: "confirmed",
        shortLabel: "Confirmed",
        note: "confirmed order",
        badgeStyle: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
        dotColor: "bg-blue-500",
      };
    case "pending":
      return {
        statusText: "pending",
        shortLabel: "Pending",
        note: "pending order",
        badgeStyle: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
        dotColor: "bg-amber-500",
      };
    case "incomplete_order":
    case "incomplete":
      return {
        statusText: "incomplete",
        shortLabel: "Incomplete",
        note: "incomplete order",
        badgeStyle: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800",
        dotColor: "bg-slate-400",
      };
    default:
      return {
        statusText: s || "previous",
        shortLabel: s ? s.replace(/_/g, " ") : "Previous",
        note: "previous order",
        badgeStyle: "bg-muted text-muted-foreground border-border",
        dotColor: "bg-muted-foreground",
      };
  }
}

export interface OtherOrdersBreakdownItem {
  status: string;
  count: number;
  insight: OtherOrderInsight;
}

export interface OtherOrdersSummary {
  count: number;
  breakdown: OtherOrdersBreakdownItem[];
  primaryInsight: OtherOrderInsight;
  triggerLabel: string;
  fullBreakdownText: string;
}

const OTHER_ORDER_RISK_PRIORITY = [
  "returned",
  "cancelled",
  "partially_delivered",
  "delivered",
  "shipped",
  "processing",
  "confirmed",
  "pending",
  "incomplete_order",
] as const;

const OTHER_ORDER_DISPLAY_ORDER = [
  "delivered",
  "partially_delivered",
  "returned",
  "cancelled",
  "shipped",
  "processing",
  "confirmed",
  "pending",
  "incomplete_order",
] as const;

/**
 * Summarizes sibling/previous orders into status counts, risk-prioritized styling, and compact tag labels.
 */
export function summarizeOtherOrders(otherOrders: Order[]): OtherOrdersSummary {
  const counts = new Map<string, number>();
  for (const ord of otherOrders) {
    const raw = (ord.status || "pending").toLowerCase().trim();
    const norm = raw === "incomplete" ? "incomplete_order" : raw;
    counts.set(norm, (counts.get(norm) || 0) + 1);
  }

  const breakdown: OtherOrdersBreakdownItem[] = [];
  const seen = new Set<string>();
  for (const status of OTHER_ORDER_DISPLAY_ORDER) {
    const c = counts.get(status);
    if (c) {
      seen.add(status);
      breakdown.push({ status, count: c, insight: getOtherOrderInsight(status) });
    }
  }
  for (const [status, c] of counts.entries()) {
    if (!seen.has(status)) {
      breakdown.push({ status, count: c, insight: getOtherOrderInsight(status) });
    }
  }

  let primaryStatus = breakdown[0]?.status || "pending";
  for (const riskStatus of OTHER_ORDER_RISK_PRIORITY) {
    if (counts.has(riskStatus)) {
      primaryStatus = riskStatus;
      break;
    }
  }
  const primaryInsight = getOtherOrderInsight(primaryStatus);
  const count = otherOrders.length;

  let triggerLabel = "Prev";
  if (count === 1) {
    const onlyStatus = breakdown[0]?.status || primaryStatus;
    const onlyInsight = getOtherOrderInsight(onlyStatus);
    triggerLabel =
      onlyStatus === "delivered" || onlyStatus === "partially_delivered"
        ? `Old Customer · ${onlyInsight.shortLabel}`
        : `Prev · ${onlyInsight.shortLabel}`;
  } else if (count > 1) {
    const topParts = breakdown.slice(0, 2).map((b) => `${b.count} ${b.insight.shortLabel}`);
    const restCount = breakdown.slice(2).reduce((acc, b) => acc + b.count, 0);
    triggerLabel = `Prev (${count}) · ${topParts.join(", ")}${restCount > 0 ? `, +${restCount}` : ""}`;
  }

  const fullBreakdownText = breakdown
    .map((b) => `${b.count} ${b.insight.shortLabel}`)
    .join(", ");

  return {
    count,
    breakdown,
    primaryInsight,
    triggerLabel,
    fullBreakdownText,
  };
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

  // 1b. Merge authoritative live DB sibling orders (order.other_orders populated on read)
  if (Array.isArray(order.other_orders)) {
    for (const liveOrder of order.other_orders) {
      if (!liveOrder || typeof liveOrder !== "object") continue;
      const lId = String(liveOrder.id || "").trim();
      const lNum = String(liveOrder.order_number || lId).trim();
      const lUuid = (liveOrder.uuid || liveOrder.db_id || (isOrderUuid(lId) ? lId : "")).trim();

      if (isCurrentOrder(lId, lNum, lUuid)) continue;

      const existingIdx = findExistingIndex(lId, lNum, lUuid);
      if (existingIdx !== -1) {
        const existing = result[existingIdx];
        if (lNum && isOrderUuid(existing.id)) {
          existing.id = lNum;
          existing.order_number = lNum;
        }
        if (lUuid && !existing.uuid) {
          existing.uuid = lUuid;
          existing.db_id = lUuid;
        }
        if (liveOrder.status && !existing.status) {
          existing.status = liveOrder.status;
        }
        if (liveOrder.date && !existing.date) {
          existing.date = liveOrder.date;
        }
        if (liveOrder.grand_total !== undefined && !existing.grand_total) {
          existing.grand_total = Number(liveOrder.grand_total) || 0;
        }
      } else {
        const displayId = lNum || lId;
        if (!displayId) continue;
        result.push({
          ...liveOrder,
          id: displayId,
          order_number: lNum || displayId,
          uuid: lUuid || undefined,
          db_id: lUuid || undefined,
        });
      }
    }
  }

  // 2. Parse attribution historical snapshots (fallback when live DB lookup unavailable)
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

    // Never fall back to current order's UUID when ao.id is missing
    const resolvedUuid: string | undefined = aoIsUuid ? rawAoId : undefined;

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
      if (ao.status && !existing.status) {
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
      if (!displayId) return;
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
      if (item.status && !existing.status) {
        existing.status = item.status;
      }
      if (item.date && !existing.date) {
        existing.date = item.date;
      }
    }
  }

  return finalUnique.sort((a, b) => {
    const tA = a.date ? new Date(a.date).getTime() : 0;
    const tB = b.date ? new Date(b.date).getTime() : 0;
    const msA = Number.isNaN(tA) ? 0 : tA;
    const msB = Number.isNaN(tB) ? 0 : tB;
    if (msA !== msB) return msB - msA;
    return String(b.order_number || b.id || "").localeCompare(String(a.order_number || a.id || ""));
  });
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


