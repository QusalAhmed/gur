/**
 * lib/imo.ts
 * Helpers for the configurable IMO deep-link URL feature.
 * Mirrors the pattern in lib/messenger.ts.
 */

export const DEFAULT_IMO_URL = "https://s.imoim.net/H1lfS1";

const DISALLOWED_SCHEMES_REGEX = /^(?:javascript|data|vbscript|file|about|blob):/i;

const BARE_IMO_DOMAINS = new Set([
  "s.imoim.net",
  "www.s.imoim.net",
  "imo.im",
  "www.imo.im",
  "imoim.net",
  "www.imoim.net",
]);

export interface NormalizedImoUrlResult {
  normalized: string;
  isValid: boolean;
}

/**
 * Normalizes and validates an IMO URL.
 * - Empty input returns `{ normalized: "", isValid: true }` (empty disables storefront buttons).
 * - Protocol-less links starting with a known IMO domain (e.g. `s.imoim.net/H1lfS1`)
 *   are normalized to `https://s.imoim.net/H1lfS1`.
 * - Full `http://`/`https://` URLs are accepted; unsafe schemes and credential URLs are rejected.
 */
export function normalizeImoUrl(raw: unknown): NormalizedImoUrlResult {
  if (raw === null || raw === undefined) {
    return { normalized: "", isValid: true };
  }

  const trimmed = String(raw).replace(/^[\"']|[\"']$/g, "").trim();
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

    // Upgrade plain http on known IMO domains to https
    if (parsed.protocol === "http:" && BARE_IMO_DOMAINS.has(hostname)) {
      parsed.protocol = "https:";
    }

    return { normalized: parsed.toString(), isValid: true };
  } catch {
    return { normalized: "", isValid: false };
  }
}

/**
 * Returns a safe, normalized IMO URL or `""` when empty or invalid.
 */
export function sanitizeImoUrl(raw: unknown): string {
  const { normalized, isValid } = normalizeImoUrl(raw);
  return isValid ? normalized : "";
}

/**
 * Resolves the storefront IMO base URL from a DB/prop value:
 * - When `configuredUrl` is explicitly provided as `""`, returns `""` (button hidden).
 * - When `configuredUrl` is `undefined`/`null` (not yet configured), falls back to
 *   `NEXT_PUBLIC_IMO_URL` env var or `DEFAULT_IMO_URL`.
 */
export function resolveStorefrontImoUrl(configuredUrl?: string | null): string {
  if (configuredUrl !== undefined && configuredUrl !== null) {
    return sanitizeImoUrl(configuredUrl);
  }
  return (
    sanitizeImoUrl(process.env.NEXT_PUBLIC_IMO_URL) || DEFAULT_IMO_URL
  );
}
