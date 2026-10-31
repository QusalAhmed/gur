import type { Order, OrderItem } from "@/types/order";

/**
 * Normalizes a Bangladeshi phone number into standard 11 digits starting with 01
 * Steadfast accepts 11 digits format: 01XXXXXXXXX
 */
export function normalizePhoneForSteadfast(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("+8801")) {
    return cleaned.slice(3); // e.g. +8801712345678 -> 01712345678
  }
  if (cleaned.startsWith("8801")) {
    return cleaned.slice(2); // e.g. 8801712345678 -> 01712345678
  }
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    return cleaned;
  }
  return cleaned;
}

/**
 * Computes the Cash on Delivery (COD) collection amount in BDT.
 * If order is fully paid, cod_amount is 0.
 * Otherwise, remaining unpaid balance (grand_total - amount_paid).
 */
export function calculateCodAmount(order: Order, overrideAmount?: number): number {
  if (overrideAmount !== undefined && overrideAmount >= 0) {
    return Math.round(overrideAmount);
  }
  if (order.payment === "paid") {
    return 0;
  }
  const grandTotal = Number(order.grand_total) || 0;
  const amountPaid = Number(order.amount_paid) || 0;
  const remaining = grandTotal - amountPaid;
  return Math.max(0, Math.round(remaining));
}

/**
 * Formats order items into a clean, human-readable item description for Steadfast Courier.
 * Steadfast accepts up to 255 characters and strips prohibited characters: { } ; < > $
 * Example: "2x Jhola Gur (1kg), 1x Patali Gur (500g)"
 */
export function formatSteadfastItemDescription(items?: OrderItem[] | null): string {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return "";
  }

  const parts = items
    .map((item) => {
      const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const productName = (item.product_name || item.sku || "Item").trim();
      const variantName = (item.variant_name || "").trim();

      const hasVariant =
        variantName &&
        variantName.toLowerCase() !== "default" &&
        variantName.toLowerCase() !== "default title" &&
        !productName.toLowerCase().includes(variantName.toLowerCase());

      const itemLabel = hasVariant ? `${productName} (${variantName})` : productName;
      return `${qty}x ${itemLabel}`;
    })
    .filter(Boolean);

  if (parts.length === 0) return "";

  // Join items with comma
  let description = parts.join(", ");

  // Strip prohibited characters per Steadfast API specification: { } ; < > $
  description = description
    .replace(/[\{\}\;\<\>\$]/g, " ")
    .replace(/\s*\(\s*/g, " (")
    .replace(/\s*\)\s*/g, ") ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();

  // Enforce max length of 255 characters
  if (description.length > 255) {
    description = description.slice(0, 252).trim() + "...";
  }

  return description;
}

/**
 * Calculates the total lot (number of physical units) in the parcel for Steadfast Courier.
 * Defaults to at least 1.
 */
export function calculateSteadfastTotalLot(items?: OrderItem[] | null): number {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return 1;
  }
  const total = items.reduce(
    (sum, item) => sum + (Number(item.quantity) > 0 ? Number(item.quantity) : 1),
    0
  );
  return Math.max(1, Math.round(total));
}

export interface SteadfastConsignmentResult {
  consignment_id: number;
  invoice: string;
  tracking_code: string;
  tracking_link: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  status: string;
  note?: string;
  item_description?: string;
  total_lot?: number;
}

export interface BookSteadfastResponse {
  success: boolean;
  consignment?: SteadfastConsignmentResult;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  rawResponse?: any;
}

export interface BulkBookingItemResult {
  orderId: string;
  success: boolean;
  consignmentId?: string;
  trackingCode?: string;
  trackingLink?: string;
  itemDescription?: string;
  totalLot?: number;
  error?: string;
}

export interface BulkBookSteadfastResult {
  success: boolean;
  totalRequested: number;
  successfulCount: number;
  failedCount: number;
  results: BulkBookingItemResult[];
  error?: string;
}

export interface SteadfastBalanceResult {
  success: boolean;
  current_balance?: number;
  error?: string;
  updatedAt?: string;
}

export interface UpdateOrderStatusWithSteadfastParams {
  orderId: string;
  newStatus: Order["status"];
  courierName?: string;
  cancelReason?: string;
  eventMsg?: string;
  currentOrder?: Order;
  forceWithoutCourier?: boolean;
  customCodAmount?: number;
}

export interface UpdateOrderStatusWithSteadfastResult {
  success: boolean;
  order?: Order;
  requiresPrompt?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  bookedWithSteadfast?: boolean;
  consignment?: SteadfastConsignmentResult;
}

export interface SteadfastPayloadSnapshot {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  alternative_phone?: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  item_description?: string;
  total_lot?: number;
}

export interface SteadfastDiffItem {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface SteadfastDiffResult {
  hasDiff: boolean;
  diffItems: SteadfastDiffItem[];
  summary: string;
}

/**
 * Builds a standardized payload snapshot of the delivery and parcel parameters.
 * Used for storing in DB and comparing against previous bookings.
 */
export function buildSteadfastPayloadSnapshot(
  order: Order,
  customCod?: number,
  overrideInvoice?: string
): SteadfastPayloadSnapshot {
  const effectiveRecipientName = (
    order.address?.recipient_name ||
    order.recipient_name ||
    order.customer ||
    "Valued Customer"
  ).trim();

  const effectiveRecipientPhone = normalizePhoneForSteadfast(
    order.address?.phone || order.shipping_phone || order.phone
  );

  const customerPhoneClean = normalizePhoneForSteadfast(order.phone);
  const rawAltPhone = order.alternative_phone
    ? normalizePhoneForSteadfast(order.alternative_phone)
    : effectiveRecipientPhone !== customerPhoneClean && /^01[3-9]\d{8}$/.test(customerPhoneClean)
    ? customerPhoneClean
    : "";

  const recipientAltPhone =
    rawAltPhone && /^01[3-9]\d{8}$/.test(rawAltPhone) ? rawAltPhone : undefined;

  const recipientAddress = [
    order.address?.address_line,
    order.address?.district,
    order.address?.division,
  ]
    .filter(Boolean)
    .join(", ")
    .trim();
  const codAmount = calculateCodAmount(order, customCod);
  const itemDescription = formatSteadfastItemDescription(order.items);
  const totalLot = calculateSteadfastTotalLot(order.items);
  const invoice = (overrideInvoice || order.courier_invoice || order.id || "").trim();

  return {
    invoice,
    recipient_name: effectiveRecipientName,
    recipient_phone: effectiveRecipientPhone,
    alternative_phone: recipientAltPhone,
    recipient_address: recipientAddress.slice(0, 490),
    cod_amount: codAmount,
    note: (order.customer_note || "").slice(0, 480) || undefined,
    item_description: itemDescription || undefined,
    total_lot: totalLot,
  };
}

/**
 * Detects whether any delivery-critical fields differ between the current order state
 * and the previously booked courier payload snapshot.
 */
export function detectSteadfastPayloadDiff(
  current: SteadfastPayloadSnapshot,
  previous: SteadfastPayloadSnapshot | null | undefined
): SteadfastDiffResult {
  if (!previous) {
    return { hasDiff: false, diffItems: [], summary: "" };
  }

  const diffItems: SteadfastDiffItem[] = [];

  if (current.recipient_name !== previous.recipient_name) {
    diffItems.push({
      field: "Recipient Name",
      oldValue: previous.recipient_name || "(Empty)",
      newValue: current.recipient_name || "(Empty)",
    });
  }

  if (current.recipient_phone !== previous.recipient_phone) {
    diffItems.push({
      field: "Phone Number",
      oldValue: previous.recipient_phone || "(Empty)",
      newValue: current.recipient_phone || "(Empty)",
    });
  }

  if ((current.alternative_phone || "") !== (previous.alternative_phone || "")) {
    diffItems.push({
      field: "Alternative Phone",
      oldValue: previous.alternative_phone || "(None)",
      newValue: current.alternative_phone || "(None)",
    });
  }

  if (current.recipient_address !== previous.recipient_address) {
    diffItems.push({
      field: "Delivery Address",
      oldValue: previous.recipient_address || "(Empty)",
      newValue: current.recipient_address || "(Empty)",
    });
  }

  if (current.cod_amount !== previous.cod_amount) {
    diffItems.push({
      field: "COD Amount",
      oldValue: `৳${previous.cod_amount.toLocaleString()}`,
      newValue: `৳${current.cod_amount.toLocaleString()}`,
    });
  }

  if ((current.item_description || "") !== (previous.item_description || "")) {
    diffItems.push({
      field: "Parcel Items",
      oldValue: previous.item_description || "(None)",
      newValue: current.item_description || "(None)",
    });
  }

  if (current.total_lot !== previous.total_lot) {
    diffItems.push({
      field: "Total Item Units",
      oldValue: `${previous.total_lot ?? 1} units`,
      newValue: `${current.total_lot ?? 1} units`,
    });
  }

  if ((current.note || "") !== (previous.note || "")) {
    diffItems.push({
      field: "Delivery Instructions",
      oldValue: previous.note || "(None)",
      newValue: current.note || "(None)",
    });
  }

  const hasDiff = diffItems.length > 0;
  const summary = diffItems.map((d) => `${d.field}: ${d.oldValue} → ${d.newValue}`).join("; ");

  return { hasDiff, diffItems, summary };
}

/**
 * Computes the next revision invoice suffix for Steadfast Courier.
 * Steadfast rejects duplicate invoices, so recreated orders are suffixed with -R1, -R2, etc.
 * Example: 'MOL-2610-01001' -> 'MOL-2610-01001-R1' -> 'MOL-2610-01001-R2'
 */
export function computeNextSteadfastInvoice(
  baseOrderNumber: string,
  currentCourierInvoice?: string | null
): string {
  const trimmedBase = (baseOrderNumber || "").trim();
  const current = (currentCourierInvoice || "").trim();

  if (!current || current === trimmedBase) {
    return `${trimmedBase}-R1`;
  }

  const match = current.match(/-R(\d+)$/i);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return current.replace(/-R(\d+)$/i, `-R${nextNum}`);
  }

  return `${trimmedBase}-R1`;
}

export interface RecreateSteadfastParcelParams {
  orderId: string;
  updatedOrder: Order;
  customCodAmount?: number;
  cancelReason?: string;
}

export interface RecreateSteadfastParcelResult {
  success: boolean;
  order?: Order;
  consignment?: SteadfastConsignmentResult;
  cancellationResult?: {
    attempted: boolean;
    success: boolean;
    message?: string;
  };
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export interface SteadfastDeliveryRecord {
  status: number;
  phone: string;
  delivery_ratio: number | null;
  cancellation_ratio: number | null;
  return_ratio?: number | null;
  volume_band: string | null;
  volume_range: string | null;
  delivered_count: number | null;
  cancelled_count: number | null;
  total_reports: number;
  fraud_categories: Record<string, number> | any[];
  scoring_disabled?: boolean;
  doubtful_reports?: boolean;
  fetchedAt?: string;
  stored_at?: string;
  updated_at?: string;
  source?: "db" | "api" | "db_fallback";
}

export interface GetSteadfastDeliveryRecordResponse {
  success: boolean;
  data?: SteadfastDeliveryRecord;
  error?: string;
  isRateLimited?: boolean;
  fromCache?: boolean;
  source?: "db" | "api" | "db_fallback";
  storedAt?: string;
}

export type SteadfastRiskLevel = "safe" | "moderate" | "risk" | "unknown";

export interface SteadfastRiskAssessment {
  level: SteadfastRiskLevel;
  badgeLabel: string;
  badgeClass: string;
  summary: string;
  recommendation: string;
}

/**
 * Calculates risk level and UI styling based on Steadfast delivery ratio and merchant fraud reports.
 */
export function assessSteadfastDeliveryRisk(record?: SteadfastDeliveryRecord | null): SteadfastRiskAssessment {
  if (!record || record.delivery_ratio === null) {
    return {
      level: "unknown",
      badgeLabel: "New Buyer",
      badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-slate-700",
      summary: "No prior completed parcels found in courier records.",
      recommendation: "Standard order processing recommended. Call to confirm delivery address.",
    };
  }

  const { delivery_ratio, cancellation_ratio, total_reports } = record;

  if (total_reports >= 2 || (delivery_ratio !== null && delivery_ratio < 50)) {
    return {
      level: "risk",
      badgeLabel: `${delivery_ratio}% Delivered`,
      badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/60",
      summary: `High cancellation/return rate (${cancellation_ratio ?? (100 - delivery_ratio)}%)${total_reports > 0 ? ` and ${total_reports} merchant fraud report(s)` : ""}.`,
      recommendation: "High return probability! Request advance delivery fee payment before booking courier.",
    };
  }

  if (total_reports === 1 || (delivery_ratio !== null && delivery_ratio < 80)) {
    return {
      level: "moderate",
      badgeLabel: `${delivery_ratio}% Delivered`,
      badgeClass: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/60",
      summary: `Moderate delivery success rate (${delivery_ratio}% delivered)${total_reports > 0 ? `, 1 report filed` : ""}.`,
      recommendation: "Call customer to verify order intent before dispatching parcel.",
    };
  }

  return {
    level: "safe",
    badgeLabel: `${delivery_ratio}% Delivered`,
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60",
    summary: `Reliable customer with ${delivery_ratio}% successful delivery history and 0 dispute reports.`,
    recommendation: "Safe to ship with standard Cash on Delivery.",
  };
}

