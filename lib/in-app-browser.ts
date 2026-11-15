import { DEFAULT_SITE_URL, normalizeSiteUrl } from "@/lib/site-url";

export type InAppBrowserType =
  | "facebook"
  | "instagram"
  | "messenger"
  | "tiktok"
  | "twitter"
  | "telegram"
  | "line"
  | "wechat"
  | "generic_webview"
  | null;

export interface InAppBrowserInfo {
  isInApp: boolean;
  browserType: InAppBrowserType;
  browserName: string;
  isAndroid: boolean;
  isIOS: boolean;
  isMobile: boolean;
}

/**
 * Detects whether the given user agent (or current navigator.userAgent) is from an In-App Browser (IAB),
 * and parses relevant platform details.
 */
export function detectInAppBrowser(customUserAgent?: string): InAppBrowserInfo {
  let ua = "";
  if (typeof customUserAgent === "string") {
    ua = customUserAgent;
  } else if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    ua = navigator.userAgent || "";
  }

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = isAndroid || isIOS || /Mobile/i.test(ua);

  let browserType: InAppBrowserType = null;
  let browserName = "Default Browser";

  if (/Instagram/i.test(ua)) {
    browserType = "instagram";
    browserName = "Instagram";
  } else if (/Messenger|FB_IAB|FB4A|FBIOS/i.test(ua) && !/FBAN|FBAV/i.test(ua)) {
    browserType = "messenger";
    browserName = "Facebook Messenger";
  } else if (/FBAN|FBAV/i.test(ua)) {
    browserType = "facebook";
    browserName = "Facebook";
  } else if (/musical_ly|ByteLocale|BytedanceWebview|TikTok/i.test(ua)) {
    browserType = "tiktok";
    browserName = "TikTok";
  } else if (/Twitter|X\//i.test(ua)) {
    browserType = "twitter";
    browserName = "X / Twitter";
  } else if (/Telegram/i.test(ua)) {
    browserType = "telegram";
    browserName = "Telegram";
  } else if (/Line\//i.test(ua)) {
    browserType = "line";
    browserName = "LINE";
  } else if (/MicroMessenger/i.test(ua)) {
    browserType = "wechat";
    browserName = "WeChat";
  } else if (isAndroid && /;\s*wv\)/i.test(ua)) {
    browserType = "generic_webview";
    browserName = "In-App Browser";
  }

  return {
    isInApp: browserType !== null,
    browserType,
    browserName,
    isAndroid,
    isIOS,
    isMobile,
  };
}

/**
 * Validates and sanitizes a target URL to ensure safe redirection.
 * Disallows protocol-relative URLs (`//evil.com`), `javascript:`, `data:`,
 * and external hosts not matching the current site or configured site URL.
 */
export function sanitizeRedirectTarget(
  targetUrl: string | null | undefined,
  fallback = "/"
): string {
  if (!targetUrl || typeof targetUrl !== "string") {
    return fallback;
  }

  const trimmed = targetUrl.trim();

  // Disallow javascript:, data:, vbscript:, etc.
  if (/^(?:javascript|data|vbscript|file):/i.test(trimmed)) {
    return fallback;
  }

  // Handle relative URLs (must start with single / and not //)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallback;
    }

    const allowedOrigins = new Set<string>();

    const defaultOrigin = normalizeSiteUrl(DEFAULT_SITE_URL);
    if (defaultOrigin) {
      try {
        allowedOrigins.add(new URL(defaultOrigin).host.toLowerCase());
      } catch {}
    }

    if (process.env.NEXT_PUBLIC_SITE_URL) {
      try {
        allowedOrigins.add(new URL(normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)).host.toLowerCase());
      } catch {}
    }

    // In browser runtime, allow current window origin
    if (typeof window !== "undefined" && window.location?.host) {
      allowedOrigins.add(window.location.host.toLowerCase());
    }

    // Allow localhost and common dev origins
    allowedOrigins.add("localhost");
    allowedOrigins.add("127.0.0.1");

    const parsedHost = parsed.host.toLowerCase();
    const isAllowed =
      allowedOrigins.has(parsedHost) ||
      Array.from(allowedOrigins).some((origin) =>
        origin ? parsedHost === origin || parsedHost.endsWith(`.${origin}`) : false
      );

    if (isAllowed) {
      return trimmed;
    }

    // If host doesn't match, return path + search + hash to remain safely on-site
    return parsed.pathname + parsed.search + parsed.hash || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Builds an Android Intent URL that directs the Android OS to open the link in Chrome
 * or the default browser, with fallback to the web URL.
 */
export function buildAndroidIntentUrl(
  targetUrl: string,
  options: { forceChrome?: boolean } = {}
): string {
  const { forceChrome = true } = options;

  let absoluteUrl = targetUrl;
  if (targetUrl.startsWith("/")) {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : normalizeSiteUrl(DEFAULT_SITE_URL);
    absoluteUrl = `${origin}${targetUrl}`;
  }

  try {
    const parsed = new URL(absoluteUrl);
    const protocol = parsed.protocol.replace(":", "") || "https";
    // Android intent URL strips the "https://" or "http://" prefix from the intent authority
    const urlWithoutScheme = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (forceChrome) {
      return `intent://${urlWithoutScheme}#Intent;scheme=${protocol};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
        absoluteUrl
      )};end`;
    }

    return `intent://${urlWithoutScheme}#Intent;scheme=${protocol};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(
      absoluteUrl
    )};end`;
  } catch {
    return targetUrl;
  }
}

/**
 * Attempts to escape an Android In-App Browser by navigating to the Chrome Intent scheme.
 * Returns true if the intent navigation was dispatched, or false otherwise.
 */
export function tryEscapeAndroidInAppBrowser(
  targetUrl: string,
  options: { forceChrome?: boolean } = {}
): boolean {
  if (typeof window === "undefined") return false;

  const info = detectInAppBrowser();
  if (!info.isAndroid || !info.isInApp) {
    return false;
  }

  const intentUrl = buildAndroidIntentUrl(targetUrl, options);
  window.location.href = intentUrl;
  return true;
}
