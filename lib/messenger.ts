export const DEFAULT_MESSENGER_URL = "https://m.me/1469306489588846";

export type StorefrontInquiryLang = "bn" | "en";

const DISALLOWED_SCHEMES_REGEX = /^(?:javascript|data|vbscript|file|about|blob):/i;
const BARE_MESSENGER_DOMAINS = new Set([
  "m.me",
  "www.m.me",
  "messenger.com",
  "www.messenger.com",
  "facebook.com",
  "www.facebook.com",
  "fb.com",
  "www.fb.com",
]);

export interface NormalizedMessengerUrlResult {
  normalized: string;
  isValid: boolean;
}

/**
 * Normalizes and validates a Messenger URL or Page ID/username shorthand.
 * - Empty input returns `{ normalized: "", isValid: true }` (empty disables storefront buttons).
 * - Bare Page IDs/usernames (e.g. `1469306489588846` or `@my.page`) normalize to `https://m.me/<handle>`.
 * - Protocol-less links (e.g. `m.me/1469306489588846`) normalize to `https://m.me/1469306489588846`.
 * - Full `http://`/`https://` URLs are validated; unsafe schemes and incomplete URLs are rejected.
 */
export function normalizeMessengerUrl(raw: unknown): NormalizedMessengerUrlResult {
  if (raw === null || raw === undefined) {
    return { normalized: "", isValid: true };
  }

  const trimmed = String(raw).replace(/^["']|["']$/g, "").trim();
  if (!trimmed) {
    return { normalized: "", isValid: true };
  }

  if (
    /[\r\n\t\0\s]/.test(trimmed) ||
    DISALLOWED_SCHEMES_REGEX.test(trimmed) ||
    trimmed.startsWith("//")
  ) {
    return { normalized: "", isValid: false };
  }

  if (!trimmed.includes("/") && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    const handle = trimmed.replace(/^@+/, "");
    if (
      !handle ||
      BARE_MESSENGER_DOMAINS.has(handle.toLowerCase()) ||
      handle.startsWith(".") ||
      handle.endsWith(".") ||
      handle.includes("..") ||
      !/^[A-Za-z0-9._-]{2,128}$/.test(handle)
    ) {
      return { normalized: "", isValid: false };
    }
    return { normalized: `https://m.me/${handle}`, isValid: true };
  }

  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { normalized: "", isValid: false };
    }
    if (parsed.username || parsed.password) {
      return { normalized: "", isValid: false };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || !hostname.includes(".")) {
      return { normalized: "", isValid: false };
    }

    if (
      (hostname === "m.me" ||
        hostname === "www.m.me" ||
        hostname === "messenger.com" ||
        hostname === "www.messenger.com") &&
      (parsed.pathname === "/" || parsed.pathname === "")
    ) {
      return { normalized: "", isValid: false };
    }

    if (
      parsed.protocol === "http:" &&
      (BARE_MESSENGER_DOMAINS.has(hostname) ||
        hostname.endsWith(".facebook.com") ||
        hostname.endsWith(".messenger.com"))
    ) {
      parsed.protocol = "https:";
    }

    if (
      (hostname === "m.me" || hostname === "www.m.me") &&
      parsed.pathname.length > 1 &&
      parsed.pathname.endsWith("/")
    ) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return { normalized: parsed.toString(), isValid: true };
  } catch {
    return { normalized: "", isValid: false };
  }
}

/**
 * Returns a safe, normalized Messenger URL or `""` when empty or invalid.
 */
export function sanitizeMessengerUrl(raw: unknown): string {
  const { normalized, isValid } = normalizeMessengerUrl(raw);
  return isValid ? normalized : "";
}

/**
 * Resolves the storefront Messenger base URL from a DB/prop value:
 * - When `configuredUrl` is explicitly provided as `""`, returns `""` (button hidden).
 * - When `configuredUrl` is `undefined` (not yet loaded/configured), falls back to
 *   `NEXT_PUBLIC_MESSENGER_URL` or `DEFAULT_MESSENGER_URL`.
 */
export function resolveStorefrontMessengerBaseUrl(configuredUrl?: string | null): string {
  if (configuredUrl !== undefined && configuredUrl !== null) {
    return sanitizeMessengerUrl(configuredUrl);
  }
  return (
    sanitizeMessengerUrl(process.env.NEXT_PUBLIC_MESSENGER_URL) ||
    DEFAULT_MESSENGER_URL
  );
}

/**
 * Builds the pre-filled inquiry greeting shared across WhatsApp and Messenger links,
 * appending the session reference code when available.
 */
export function buildInquiryGreetingText(
  lang: StorefrontInquiryLang = "bn",
  refCode?: string
): string {
  const cleanRef = typeof refCode === "string" ? refCode.trim() : "";
  const baseText =
    lang === "bn"
      ? "আসসালামু আলাইকুম, আমি খাঁটি গুড় কিনতে চাই এবং বিস্তারিত জানতে চাই।"
      : "Hello, I would like to order pure artisanal jaggery / know more.";
  return cleanRef ? `${baseText} [Ref: ${cleanRef}]` : baseText;
}

/**
 * Appends a pre-filled `?text=` parameter (preserving existing query params) to a
 * sanitized Messenger URL with `%20` space encoding for cross-client compatibility.
 */
export function buildMessengerChatUrl(
  rawUrl: unknown,
  options: {
    lang?: StorefrontInquiryLang;
    refCode?: string;
    text?: string;
  } = {}
): string {
  const normalized = sanitizeMessengerUrl(rawUrl);
  if (!normalized) return "";

  const message =
    options.text !== undefined
      ? options.text.trim()
      : buildInquiryGreetingText(options.lang ?? "bn", options.refCode);

  if (!message) return normalized;

  try {
    const parsed = new URL(normalized);
    const queryPairs: string[] = [];

    parsed.searchParams.forEach((value, key) => {
      if (key !== "text") {
        queryPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });

    queryPairs.push(`text=${encodeURIComponent(message)}`);
    const queryString = queryPairs.length > 0 ? `?${queryPairs.join("&")}` : "";

    return `${parsed.origin}${parsed.pathname}${queryString}${parsed.hash}`;
  } catch {
    return normalized;
  }
}
