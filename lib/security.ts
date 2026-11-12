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

const META_PIXEL_OPENBRIDGE_ORIGINS: Record<string, readonly string[]> = {
  // Exact primary + fallback OpenBridge (CAPIG MPC) origins configured by Meta Signals Config for Pixel 1234708877758735.
  // Never broaden to *.a.run.app or *.on.aws wildcards.
  "1234708877758735": [
    "https://mpc-prod-27-s6uit34pua-uk.a.run.app",
    "https://0l-a08c0393bf534f3994bcafe6e0dc91b4.ecs.us-west-2.on.aws",
  ],
};

function parseHostname(rawUrl?: string | null): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.hostname || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parses a comma- or whitespace-separated list of strict HTTPS origins for CSP allowlists.
 * Rejects non-HTTPS schemes, embedded credentials, and wildcard hostnames to preserve least privilege.
 */
export function parseStrictHttpsOrigins(raw?: string | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  const origins = new Set<string>();

  for (const token of raw.split(/[\s,]+/)) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") continue;
      if (!parsed.hostname || parsed.hostname.includes("*")) continue;
      if (parsed.username || parsed.password) continue;
      origins.add(parsed.origin);
    } catch {
      // Ignore malformed origin entries
    }
  }

  return Array.from(origins);
}

export interface BuildCspHeaderOptions {
  nodeEnv?: string;
  imagekitUrlEndpoint?: string | null;
  supabaseUrl?: string | null;
  facebookPixelId?: string | null;
  metaPixelConnectOrigins?: string | null;
}

/**
 * Builds the application's Content-Security-Policy header value with strict least-privilege allowlists.
 */
export function buildCspHeader(options: BuildCspHeaderOptions = {}): string {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const isDev = nodeEnv === "development";
  const isProd = nodeEnv === "production";

  const imagekitHost = parseHostname(options.imagekitUrlEndpoint);
  const supabaseHost = parseHostname(options.supabaseUrl);

  const rawPixelId = (options.facebookPixelId ?? "1234708877758735").trim();
  const safePixelId = /^\d{5,32}$/.test(rawPixelId) ? rawPixelId : null;

  const metaConnectOrigins = safePixelId
    ? Array.from(
        new Set([
          "https://www.facebook.com",
          "https://connect.facebook.net",
          ...(META_PIXEL_OPENBRIDGE_ORIGINS[safePixelId] ?? []),
          ...parseStrictHttpsOrigins(options.metaPixelConnectOrigins),
        ])
      )
    : [];

  const imgSources = Array.from(
    new Set([
      "'self'",
      "data:",
      "blob:",
      "https://images.unsplash.com",
      "https://ik.imagekit.io",
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://www.googletagmanager.com",
      ...(safePixelId ? ["https://www.facebook.com"] : []),
      "https://*.supabase.co",
      ...(imagekitHost && imagekitHost !== "ik.imagekit.io"
        ? [`https://${imagekitHost}`]
        : []),
      ...(supabaseHost ? [`https://${supabaseHost}`] : []),
    ])
  );

  const connectSources = Array.from(
    new Set([
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://upload.imagekit.io",
      "https://ik.imagekit.io",
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://analytics.google.com",
      "https://*.analytics.googletagmanager.com",
      "https://www.googletagmanager.com",
      ...metaConnectOrigins,
      ...(imagekitHost && imagekitHost !== "ik.imagekit.io"
        ? [`https://${imagekitHost}`]
        : []),
      ...(supabaseHost ? [`https://${supabaseHost}`, `wss://${supabaseHost}`] : []),
      ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : []),
    ])
  );

  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://www.googletagmanager.com",
    ...(safePixelId ? ["https://connect.facebook.net"] : []),
  ];

  const frameSources = [
    "'self'",
    ...(safePixelId ? ["https://www.facebook.com"] : []),
  ];

  const formActionSources = [
    "'self'",
    ...(safePixelId ? ["https://www.facebook.com"] : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src ${imgSources.join(" ")}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    `frame-src ${frameSources.join(" ")}`,
    `form-action ${formActionSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
