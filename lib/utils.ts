export { cn } from "cn";

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export interface FormatDateOptions {
  includeTime?: boolean;
  padDay?: boolean;
  fallback?: string;
}

/**
 * Formats any date input (ISO string, database timestamp, Date object, or epoch number)
 * into standard display format:
 * `date + month short name + full year`
 * Example: "24 Oct 2026" or "5 Nov 2026" (or "24 Oct 2026, 12:45" if includeTime is true)
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  options?: FormatDateOptions
): string {
  if (!value && value !== 0) return options?.fallback || "";

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return options?.fallback || "";

    // If already in '24 Oct 2026' or '24 Oct 2026, 11:20' format
    if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}(?:,\s*\d{2}:\d{2}(?::\d{2})?)?$/.test(s)) {
      if (options?.includeTime) return s;
      return s.split(",")[0].trim();
    }

    // Handle prefixed dates like 'Delivered 2026-10-24' or 'Delivered 24 Oct 2026'
    const prefixMatch = s.match(/^([A-Za-z\s/:]+?)\s+(\d{4}-\d{2}-\d{2}.*|\d{1,2}\s+[A-Za-z]{3}\s+\d{4}.*)/);
    if (prefixMatch) {
      return `${prefixMatch[1]} ${formatDate(prefixMatch[2], options)}`;
    }

    // Check YYYY-MM-DD or YYYY-MM-DD HH:mm(:ss) format
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      const year = match[1];
      const monthIdx = parseInt(match[2], 10) - 1;
      const dayNum = parseInt(match[3], 10);
      const day = options?.padDay ? String(dayNum).padStart(2, "0") : String(dayNum);
      const month = MONTH_NAMES[monthIdx] || match[2];
      const datePart = `${day} ${month} ${year}`;

      if (options?.includeTime && match[4] && match[5]) {
        const timePart = match[6] ? `${match[4]}:${match[5]}:${match[6]}` : `${match[4]}:${match[5]}`;
        return `${datePart}, ${timePart}`;
      }
      return datePart;
    }

    // Pass through relative dates or status texts unchanged
    if (/^(today|yesterday|tomorrow|active|just now|ready|\d+\s*(m|h|min|mins|hour|hours|day|days)\s*ago)/i.test(s)) {
      return s;
    }
  }

  const d =
    typeof value === "number"
      ? new Date(value)
      : value instanceof Date
      ? value
      : new Date(String(value));

  if (isNaN(d.getTime())) return String(value);

  const dayNum = d.getDate();
  const day = options?.padDay ? String(dayNum).padStart(2, "0") : String(dayNum);
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  const datePart = `${day} ${month} ${year}`;

  if (options?.includeTime) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${datePart}, ${hh}:${mm}`;
  }

  return datePart;
}

/**
 * Formats a date value with time attached:
 * `date + month short name + full year, HH:mm`
 * Example: "24 Oct 2026, 12:45"
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  options?: Omit<FormatDateOptions, "includeTime">
): string {
  return formatDate(value, { ...options, includeTime: true });
}
