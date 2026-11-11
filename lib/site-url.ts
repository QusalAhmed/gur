export const DEFAULT_SITE_URL = "https://khatikhejurgur.shop";

/**
 * Normalizes a candidate site URL to an origin without trailing slashes.
 * Falls back to DEFAULT_SITE_URL when missing or invalid.
 */
export function normalizeSiteUrl(raw?: string | null): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return DEFAULT_SITE_URL;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_SITE_URL;
    }
    return parsed.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/**
 * Returns the canonical public site origin configured via NEXT_PUBLIC_SITE_URL,
 * falling back to DEFAULT_SITE_URL.
 */
export function getSiteUrl(): string {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

/**
 * Escapes XML special characters so URLs with query parameters remain valid inside
 * Next.js sitemap `<loc>` and `<image:loc>` elements.
 */
export function escapeSitemapXmlUrl(url: string): string {
  return url
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
