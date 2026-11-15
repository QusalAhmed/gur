import { describe, it, expect } from "vitest";
import {
  detectInAppBrowser,
  buildAndroidIntentUrl,
  sanitizeRedirectTarget,
} from "@/lib/in-app-browser";

describe("in-app-browser detection and breakout", () => {
  const UA_FB_ANDROID =
    "Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/115.0.5790.166 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/427.0.0.30.67;]";

  const UA_FB_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20F66 [FBAN/FBIOS;FBAV/427.0.0.31.67;FBBV/500123456;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/16.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]";

  const UA_INSTAGRAM_ANDROID =
    "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A.210817.036; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/96.0.4664.104 Mobile Safari/537.36 Instagram 216.1.0.21.137 Android (31/12; 420dpi; 1080x2400; Google/google; Pixel 6; oriole; raven; en_US; 338274151)";

  const UA_INSTAGRAM_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/19E241 Instagram 223.0.0.16.101 (iPhone13,2; iOS 15_4; en_US; en-US; scale=3.00; 1170x2532; 349830578)";

  const UA_TIKTOK_ANDROID =
    "Mozilla/5.0 (Linux; Android 11; SM-A505F Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 musical_ly_2022405040 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/24.5.4 ByteLocale/en";

  const UA_CHROME_ANDROID =
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";

  const UA_SAFARI_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

  describe("detectInAppBrowser", () => {
    it("detects Facebook on Android", () => {
      const res = detectInAppBrowser(UA_FB_ANDROID);
      expect(res.isInApp).toBe(true);
      expect(res.browserType).toBe("facebook");
      expect(res.isAndroid).toBe(true);
      expect(res.isIOS).toBe(false);
    });

    it("detects Facebook on iOS", () => {
      const res = detectInAppBrowser(UA_FB_IOS);
      expect(res.isInApp).toBe(true);
      expect(res.browserType).toBe("facebook");
      expect(res.isAndroid).toBe(false);
      expect(res.isIOS).toBe(true);
    });

    it("detects Instagram on Android", () => {
      const res = detectInAppBrowser(UA_INSTAGRAM_ANDROID);
      expect(res.isInApp).toBe(true);
      expect(res.browserType).toBe("instagram");
      expect(res.isAndroid).toBe(true);
      expect(res.isIOS).toBe(false);
    });

    it("detects Instagram on iOS", () => {
      const res = detectInAppBrowser(UA_INSTAGRAM_IOS);
      expect(res.isInApp).toBe(true);
      expect(res.browserType).toBe("instagram");
      expect(res.isAndroid).toBe(false);
      expect(res.isIOS).toBe(true);
    });

    it("detects TikTok on Android", () => {
      const res = detectInAppBrowser(UA_TIKTOK_ANDROID);
      expect(res.isInApp).toBe(true);
      expect(res.browserType).toBe("tiktok");
      expect(res.isAndroid).toBe(true);
    });

    it("returns false for regular Chrome Android", () => {
      const res = detectInAppBrowser(UA_CHROME_ANDROID);
      expect(res.isInApp).toBe(false);
      expect(res.browserType).toBe(null);
      expect(res.isAndroid).toBe(true);
    });

    it("returns false for regular Safari iOS", () => {
      const res = detectInAppBrowser(UA_SAFARI_IOS);
      expect(res.isInApp).toBe(false);
      expect(res.browserType).toBe(null);
      expect(res.isIOS).toBe(true);
    });
  });

  describe("buildAndroidIntentUrl", () => {
    it("builds Chrome intent URL with package and fallback", () => {
      const url = "https://khatikhejurgur.shop/products/khejurer-patali-gur?ref=fb_ad";
      const intent = buildAndroidIntentUrl(url, { forceChrome: true });

      expect(intent).toContain("intent://khatikhejurgur.shop/products/khejurer-patali-gur?ref=fb_ad#Intent;");
      expect(intent).toContain("scheme=https;");
      expect(intent).toContain("package=com.android.chrome;");
      expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent(url)};`);
      expect(intent.endsWith(";end")).toBe(true);
    });

    it("builds generic browsable intent when forceChrome is false", () => {
      const url = "https://khatikhejurgur.shop/checkout";
      const intent = buildAndroidIntentUrl(url, { forceChrome: false });

      expect(intent).toContain("intent://khatikhejurgur.shop/checkout#Intent;");
      expect(intent).toContain("action=android.intent.action.VIEW;");
      expect(intent).toContain("category=android.intent.category.BROWSABLE;");
      expect(intent).not.toContain("package=com.android.chrome;");
    });

    it("handles relative path correctly", () => {
      const relative = "/product/123?utm=fb";
      const intent = buildAndroidIntentUrl(relative);

      expect(intent).toContain("intent://khatikhejurgur.shop/product/123?utm=fb#Intent;");
      expect(intent).toContain("scheme=https;");
    });
  });

  describe("sanitizeRedirectTarget", () => {
    it("accepts safe relative paths", () => {
      expect(sanitizeRedirectTarget("/products/khejurer-gur")).toBe("/products/khejurer-gur");
      expect(sanitizeRedirectTarget("/?ref=123")).toBe("/?ref=123");
    });

    it("rejects protocol-relative URLs", () => {
      expect(sanitizeRedirectTarget("//evil.com")).toBe("/");
      expect(sanitizeRedirectTarget("///evil.com")).toBe("/");
    });

    it("rejects javascript: and data: URLs", () => {
      expect(sanitizeRedirectTarget("javascript:alert(1)")).toBe("/");
      expect(sanitizeRedirectTarget("data:text/html,<script>alert(1)</script>")).toBe("/");
    });

    it("allows full site URLs matching DEFAULT_SITE_URL", () => {
      expect(sanitizeRedirectTarget("https://khatikhejurgur.shop/products")).toBe("https://khatikhejurgur.shop/products");
    });

    it("strips foreign origin to path if host is not allowed", () => {
      expect(sanitizeRedirectTarget("https://evil-attacker.com/stolen-token?id=1")).toBe("/stolen-token?id=1");
    });

    it("falls back safely for null, undefined, empty", () => {
      expect(sanitizeRedirectTarget(null)).toBe("/");
      expect(sanitizeRedirectTarget(undefined, "/home")).toBe("/home");
      expect(sanitizeRedirectTarget("")).toBe("/");
    });
  });
});
