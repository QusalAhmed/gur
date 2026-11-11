const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

/**
 * Escapes HTML special characters for safe interpolation inside HTML documents and emails.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes a phone number before embedding in a `tel:` URI attribute.
 */
export function sanitizeTelHref(phone: unknown): string {
  if (typeof phone !== "string") return "";
  const cleaned = phone.trim().replace(/[^+\d]/g, "");
  return /^\+?\d{6,20}$/.test(cleaned) ? cleaned : "";
}

/**
 * Strips characters that can break or inject additional clauses into PostgREST `.or(...)` filter strings.
 */
export function sanitizePostgrestFilterTerm(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1f\x7f,()\\"'*%;]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Neutralizes spreadsheet formula injection (OWASP CSV injection) by prefixing dangerous leading triggers.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = (typeof value === "object" ? JSON.stringify(value) : String(value)).replace(/\0/g, "");
  if (/^[=+\-@\t\r]/.test(str) || /^[ \t\r\n]+[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Clamps an integer parameter safely within `[min, max]`.
 */
export function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

/**
 * Validates and normalizes an ImageKit folder path.
 * Returns null if the folder string contains path traversal or invalid characters.
 */
export function sanitizeImageKitFolder(folder: unknown): string | null {
  if (folder === null || folder === undefined || folder === "" || folder === "all") {
    return "/";
  }
  if (typeof folder !== "string") return null;
  const trimmed = folder.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed === "/") return "/";
  if (trimmed.includes("..") || trimmed.includes("//")) return null;
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!/^\/[a-zA-Z0-9/_-]{1,120}$/.test(withLeadingSlash)) {
    return null;
  }
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

/**
 * Scrubs raw internal/database error details before returning messages to unauthenticated clients.
 */
export function safePublicErrorMessage(fallback = "Request failed"): string {
  return fallback;
}
