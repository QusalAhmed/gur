import { format as formatZoned, toZonedTime } from "date-fns-tz";
import { DHAKA_TIMEZONE } from "@/lib/admin-format";
import type { Order } from "@/types/order";

export type SendingDateFilterMode = "due_on_or_before" | "exact_date" | "all";

export interface DispatchFilterOptions {
  /** Selected sending date in YYYY-MM-DD (Asia/Dhaka). Defaults to today if mode !== 'all'. */
  targetDate?: string | null;
  /** How targetDate filters orders: due_on_or_before (default), exact_date, or all. */
  mode?: SendingDateFilterMode;
  /** Whether to include paused/future-dated orders (override mode for ?ids=). */
  includeHeld?: boolean;
}

export interface DispatchHoldReason {
  held: boolean;
  reason: "paused_indefinite" | "paused_until_date" | "scheduled_future" | null;
  label: string;
}

/**
 * Returns today's date string (YYYY-MM-DD) in Asia/Dhaka timezone.
 */
export function getDhakaTodayIsoDate(now: Date = new Date()): string {
  const zoned = toZonedTime(now, DHAKA_TIMEZONE);
  return formatZoned(zoned, "yyyy-MM-dd", { timeZone: DHAKA_TIMEZONE });
}

/**
 * Normalizes any date string/timestamp to YYYY-MM-DD in Asia/Dhaka timezone.
 * Pure YYYY-MM-DD strings are returned directly without timezone shifting.
 */
export function toDhakaDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const pureDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (pureDateMatch) return pureDateMatch[1];
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  const zoned = toZonedTime(d, DHAKA_TIMEZONE);
  return formatZoned(zoned, "yyyy-MM-dd", { timeZone: DHAKA_TIMEZONE });
}

/**
 * Normalizes an optional sending date input into YYYY-MM-DD or null.
 */
export function normalizeSendingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : toDhakaDateKey(trimmed);
}

/**
 * Formats a YYYY-MM-DD sending date for human display (e.g. "28 Nov 2026").
 */
export function formatSendingDateDisplay(value: string | null | undefined): string {
  const key = normalizeSendingDate(value);
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const dt = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  return formatZoned(toZonedTime(dt, DHAKA_TIMEZONE), "dd MMM yyyy", {
    timeZone: DHAKA_TIMEZONE,
  });
}

/**
 * Evaluates whether an order is currently held from dispatch relative to a reference date
 * (defaults to today in Asia/Dhaka).
 *
 * Rules:
 * - Indefinitely paused (is_paused = true, no sending_date) => held
 * - Paused with future sending_date (> referenceDate) => held until that date
 * - Unpaused with future sending_date (> referenceDate) => scheduled for future (held until that date)
 * - Paused with sending_date <= referenceDate => due / ready to send
 */
export function getOrderDispatchHoldState(
  order: Pick<Order, "is_paused" | "sending_date" | "status">,
  referenceDate?: string | null
): DispatchHoldReason {
  if (
    order.status === "shipped" ||
    order.status === "delivered" ||
    order.status === "partially_delivered" ||
    order.status === "cancelled" ||
    order.status === "returned"
  ) {
    return { held: false, reason: null, label: "" };
  }

  const refKey = normalizeSendingDate(referenceDate) || getDhakaTodayIsoDate();
  const sendKey = normalizeSendingDate(order.sending_date);
  const isPaused = Boolean(order.is_paused);

  if (isPaused && !sendKey) {
    return {
      held: true,
      reason: "paused_indefinite",
      label: "Paused (waiting for resume)",
    };
  }

  if (sendKey && sendKey > refKey) {
    return {
      held: true,
      reason: isPaused ? "paused_until_date" : "scheduled_future",
      label: `${isPaused ? "Paused until" : "Scheduled for"} ${formatSendingDateDisplay(sendKey)}`,
    };
  }

  return { held: false, reason: null, label: "" };
}

/**
 * Determines whether an order matches the printing page Sending Date filter.
 *
 * - `mode === "all"`: Includes all orders unless held & !includeHeld (still hides indefinitely paused unless includeHeld).
 * - `mode === "due_on_or_before"` (default):
 *     * Indefinitely paused (is_paused && !sending_date): excluded (unless includeHeld).
 *     * Orders with sending_date: included when sending_date <= targetDate.
 *     * Normal orders without sending_date: included when placed_at Dhaka date <= targetDate.
 * - `mode === "exact_date"`:
 *     * Indefinitely paused (is_paused && !sending_date): excluded (unless includeHeld).
 *     * Orders with sending_date: included when sending_date === targetDate.
 *     * Normal orders without sending_date: included when placed_at Dhaka date === targetDate.
 */
export function matchesPrintSendingDateFilter(
  order: Pick<Order, "is_paused" | "sending_date" | "date">,
  options: DispatchFilterOptions = {}
): boolean {
  const mode: SendingDateFilterMode = options.mode || "due_on_or_before";
  const includeHeld = Boolean(options.includeHeld);
  const targetKey = normalizeSendingDate(options.targetDate) || getDhakaTodayIsoDate();

  const isPaused = Boolean(order.is_paused);
  const sendKey = normalizeSendingDate(order.sending_date);
  const placedKey = toDhakaDateKey(order.date);

  if (isPaused && !sendKey) {
    return includeHeld;
  }

  if (mode === "all") {
    if (!includeHeld && sendKey && sendKey > targetKey) {
      return false;
    }
    return true;
  }

  const effectiveDateKey = sendKey || placedKey;

  if (mode === "exact_date") {
    if (includeHeld) {
      return effectiveDateKey === targetKey || isPaused;
    }
    return effectiveDateKey === targetKey;
  }

  // mode === "due_on_or_before"
  if (includeHeld) {
    return true;
  }

  if (sendKey) {
    return sendKey <= targetKey;
  }

  if (!placedKey) return true;
  return placedKey <= targetKey;
}

/**
 * Parses an order timestamp into epoch ms for deterministic sorting.
 */
function getOrderPlacedEpochMs(order: Pick<Order, "date">): number {
  if (!order.date) return Number.MAX_SAFE_INTEGER;
  const t = new Date(order.date).getTime();
  return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/**
 * Sorts orders for printing:
 * 1. Urgent orders (`is_urgent === true`) ALWAYS come first.
 * 2. Within Urgent and within Normal, oldest-first order (`placed_at` / `date` ascending).
 * 3. Deterministic tie-breaker by `order_number` / `id` ascending.
 */
export function sortOrdersForPrint<T extends Pick<Order, "id" | "order_number" | "date" | "is_urgent">>(
  orders: T[]
): T[] {
  return [...orders].sort((a, b) => {
    const aUrgent = a.is_urgent ? 1 : 0;
    const bUrgent = b.is_urgent ? 1 : 0;
    if (aUrgent !== bUrgent) {
      return bUrgent - aUrgent;
    }

    const aTime = getOrderPlacedEpochMs(a);
    const bTime = getOrderPlacedEpochMs(b);
    if (aTime !== bTime) {
      return aTime - bTime;
    }

    const aId = String(a.order_number || a.id || "");
    const bId = String(b.order_number || b.id || "");
    return aId.localeCompare(bId);
  });
}
