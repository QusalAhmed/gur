export type ClarityEventName =
  | "add_to_cart"
  | "initiate_checkout"
  | "purchase"
  | "contact_click";

export type ClarityTagKey =
  | "lang"
  | "in_app_browser"
  | "delivery_zone"
  | "contact_channel"
  | "order_placed";

export type ClarityUpgradeReason = "initiate_checkout" | "purchase";

type ClarityFunction = ((...args: unknown[]) => void) & {
  q?: unknown[][];
};

declare global {
  interface Window {
    clarity?: ClarityFunction;
  }
}

const CLARITY_ID_REGEX = /^[a-z0-9]{6,24}$/i;
const CLARITY_SCRIPT_ELEMENT_ID = "ms-clarity-tag";

/**
 * Validates and normalizes a Microsoft Clarity Project ID.
 * Returns an empty string if the input is missing or contains invalid characters.
 */
export function sanitizeClarityProjectId(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const cleaned = String(raw).trim().replace(/^["']|["']$/g, "").trim();
  return CLARITY_ID_REGEX.test(cleaned) ? cleaned : "";
}

/**
 * Resolves the effective Clarity Project ID: Admin DB setting first, then env fallback.
 */
export function resolveClarityProjectId(
  dbProjectId?: string | null,
  envProjectId?: string | null
): string {
  const fromDb = sanitizeClarityProjectId(dbProjectId);
  if (fromDb) return fromDb;
  const rawEnv =
    envProjectId !== undefined
      ? envProjectId
      : process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  return sanitizeClarityProjectId(rawEnv);
}

/**
 * Returns true if the given host or pathname belongs to the Admin Panel
 * (including `admin.*` subdomains where `pathname` is rewritten cleanly to `/`, `/orders`, etc.).
 */
export function isClarityAdminHostOrPath(
  hostname: string,
  pathname: string
): boolean {
  const normalizedHost = (hostname || "").trim().toLowerCase().split(":")[0];
  if (normalizedHost === "admin" || normalizedHost.startsWith("admin.")) {
    return true;
  }

  const normalizedPath = (pathname || "").trim().toLowerCase();
  return normalizedPath === "/admin" || normalizedPath.startsWith("/admin/");
}

/**
 * Clarity is active only in production unless explicitly opted-in for development testing.
 */
export function isClarityEnabledEnvironment(
  nodeEnv?: string,
  enableInDev?: string
): boolean {
  const effectiveEnv = nodeEnv ?? process.env.NODE_ENV;
  if (effectiveEnv === "production") return true;
  const effectiveDevOverride =
    enableInDev ?? process.env.NEXT_PUBLIC_CLARITY_ENABLE_DEV;
  return effectiveDevOverride === "true";
}

export interface ShouldLoadClarityOptions {
  projectId?: string | null;
  hostname?: string;
  pathname?: string;
  nodeEnv?: string;
  enableInDev?: string;
}

/**
 * Central storefront-only + production-only gate for Microsoft Clarity.
 */
export function shouldLoadClarity(options: ShouldLoadClarityOptions): boolean {
  const safeId = sanitizeClarityProjectId(options.projectId);
  if (!safeId) return false;

  if (!isClarityEnabledEnvironment(options.nodeEnv, options.enableInDev)) {
    return false;
  }

  const hostname =
    options.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "");
  const pathname =
    options.pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "");

  if (isClarityAdminHostOrPath(hostname, pathname)) {
    return false;
  }

  return true;
}

/**
 * Ensures the global `window.clarity` queue shim exists so early events are never dropped.
 */
export function ensureClarityQueueShim(): void {
  if (typeof window === "undefined") return;
  if (typeof window.clarity !== "function") {
    const queueShim: ClarityFunction = function clarityStub(...args: unknown[]) {
      queueShim.q = queueShim.q || [];
      queueShim.q.push(args);
    };
    queueShim.q = [];
    window.clarity = queueShim;
  }
}

/**
 * Initializes the official Microsoft Clarity tag once on allowed storefront pages.
 * Zero-dependency loader using Clarity's native queue shim.
 * Uses `tag.clarity.ms` with automatic `www.clarity.ms` fallback to resist router/ISP DNS resolution failures.
 */
export function initClarity(projectId: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const safeId = sanitizeClarityProjectId(projectId);
  if (
    !shouldLoadClarity({
      projectId: safeId,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
    })
  ) {
    return false;
  }

  if (document.getElementById(CLARITY_SCRIPT_ELEMENT_ID)) {
    return true;
  }

  ensureClarityQueueShim();

  const script = document.createElement("script");
  script.id = CLARITY_SCRIPT_ELEMENT_ID;
  script.async = true;
  // tag.clarity.ms is Microsoft's direct tag endpoint that resolves reliably without www-prefix DNS suffix collision
  const primarySrc = `https://tag.clarity.ms/tag/${encodeURIComponent(safeId)}`;
  const fallbackSrc = `https://www.clarity.ms/tag/${encodeURIComponent(safeId)}`;
  script.src = primarySrc;

  let retried = false;
  script.onerror = () => {
    if (!retried) {
      retried = true;
      script.src = fallbackSrc;
      return;
    }
    // Ad-blocker or network blocked Clarity tag script; fail gracefully
  };

  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  return true;
}

function canInvokeClarityInBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (
    isClarityAdminHostOrPath(window.location.hostname, window.location.pathname)
  ) {
    return false;
  }
  ensureClarityQueueShim();
  return typeof window.clarity === "function";
}

function sanitizeTagValue(value: string): string {
  return String(value)
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, 64);
}

/**
 * Fires a custom Clarity funnel event (no PII).
 */
export function clarityTrackEvent(eventName: ClarityEventName): void {
  if (!canInvokeClarityInBrowser()) return;
  try {
    window.clarity?.("event", eventName);
  } catch {
    // Safe no-op if blocked by browser privacy tools
  }
}

/**
 * Attaches a non-PII custom session tag in Clarity.
 */
export function claritySetTag(
  key: ClarityTagKey,
  value: string | string[]
): void {
  if (!canInvokeClarityInBrowser()) return;
  try {
    const sanitized = Array.isArray(value)
      ? value.map(sanitizeTagValue).filter(Boolean)
      : sanitizeTagValue(value);
    if (
      (typeof sanitized === "string" && !sanitized) ||
      (Array.isArray(sanitized) && sanitized.length === 0)
    ) {
      return;
    }
    window.clarity?.("set", key, sanitized);
  } catch {
    // Safe no-op
  }
}

/**
 * Upgrades the current session in Clarity so key conversion sessions are prioritized.
 */
export function clarityUpgrade(reason: ClarityUpgradeReason): void {
  if (!canInvokeClarityInBrowser()) return;
  try {
    window.clarity?.("upgrade", reason);
  } catch {
    // Safe no-op
  }
}
