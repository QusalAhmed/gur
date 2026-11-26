import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MESSENGER_URL,
  buildInquiryGreetingText,
  buildMessengerChatUrl,
  normalizeMessengerUrl,
  resolveStorefrontMessengerBaseUrl,
  sanitizeMessengerUrl,
} from "@/lib/messenger";
import { extractRefToken } from "@/lib/utils";
import { parseSettingsMap } from "@/hooks/use-site-settings";

const { mockUpsert, mockAssertStaffRole, mockGetSupabaseAdmin, mockState } = vi.hoisted(() => {
  const mockState = {
    siteSettingsRows: [] as Array<{ key: string; value: unknown }>,
  };
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockAssertStaffRole = vi.fn().mockResolvedValue({ userId: "admin-1", role: "owner" });

  const createQueryBuilder = (table: string) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      upsert: (payload: unknown, options?: unknown) => mockUpsert(payload, options),
      then: (resolve: (val: any) => void) => {
        if (table === "site_settings") {
          resolve({ data: mockState.siteSettingsRows, error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return builder;
  };

  const mockGetSupabaseAdmin = vi.fn(() => ({
    from: (table: string) => createQueryBuilder(table),
  }));

  return { mockUpsert, mockAssertStaffRole, mockGetSupabaseAdmin, mockState };
});

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

vi.mock("@/lib/admin-guard", () => ({
  assertStaffRole: (...args: unknown[]) => mockAssertStaffRole(...args),
}));

vi.mock("@/lib/delivery-charge", () => ({
  DEFAULT_DELIVERY_CONFIG: {
    insideDhakaFee: 70,
    outsideDhakaFee: 130,
    freeDeliveryEnabled: false,
    freeDeliveryThreshold: 0,
  },
  invalidateDeliveryConfigCache: vi.fn(),
}));

import { updateSiteSettingsAction } from "@/actions/settings";
import { getStorefrontProductsAction } from "@/actions/storefront-products";

describe("Messenger URL normalization and prefill helpers", () => {
  const originalEnvUrl = process.env.NEXT_PUBLIC_MESSENGER_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.siteSettingsRows = [];
    delete process.env.NEXT_PUBLIC_MESSENGER_URL;
  });

  afterEach(() => {
    if (originalEnvUrl === undefined) {
      delete process.env.NEXT_PUBLIC_MESSENGER_URL;
    } else {
      process.env.NEXT_PUBLIC_MESSENGER_URL = originalEnvUrl;
    }
  });

  it("normalizes full URLs, protocol-less m.me paths, and bare Page IDs or usernames", () => {
    expect(normalizeMessengerUrl("https://m.me/1469306489588846")).toEqual({
      normalized: "https://m.me/1469306489588846",
      isValid: true,
    });
    expect(normalizeMessengerUrl("m.me/1469306489588846")).toEqual({
      normalized: "https://m.me/1469306489588846",
      isValid: true,
    });
    expect(normalizeMessengerUrl("http://m.me/1469306489588846/")).toEqual({
      normalized: "https://m.me/1469306489588846",
      isValid: true,
    });
    expect(normalizeMessengerUrl("1469306489588846")).toEqual({
      normalized: "https://m.me/1469306489588846",
      isValid: true,
    });
    expect(normalizeMessengerUrl("@khati.gur.shop")).toEqual({
      normalized: "https://m.me/khati.gur.shop",
      isValid: true,
    });
    expect(normalizeMessengerUrl("https://www.messenger.com/t/1469306489588846")).toEqual({
      normalized: "https://www.messenger.com/t/1469306489588846",
      isValid: true,
    });
    expect(normalizeMessengerUrl("m.me/1469306489588846?ref=website")).toEqual({
      normalized: "https://m.me/1469306489588846?ref=website",
      isValid: true,
    });
  });

  it("treats empty values as valid disabled state and rejects unsafe or incomplete URLs", () => {
    expect(normalizeMessengerUrl("")).toEqual({ normalized: "", isValid: true });
    expect(normalizeMessengerUrl("   ")).toEqual({ normalized: "", isValid: true });
    expect(normalizeMessengerUrl(null)).toEqual({ normalized: "", isValid: true });

    expect(normalizeMessengerUrl("javascript:alert(1)").isValid).toBe(false);
    expect(normalizeMessengerUrl("data:text/html,hi").isValid).toBe(false);
    expect(normalizeMessengerUrl("//evil.example/m.me").isValid).toBe(false);
    expect(normalizeMessengerUrl("https://m.me/").isValid).toBe(false);
    expect(normalizeMessengerUrl("m.me").isValid).toBe(false);
    expect(normalizeMessengerUrl("https://user:pass@m.me/123").isValid).toBe(false);
    expect(normalizeMessengerUrl("https://m.me/foo bar").isValid).toBe(false);
    expect(sanitizeMessengerUrl("javascript:alert(1)")).toBe("");
  });

  it("hides Messenger when explicitly cleared and falls back when undefined", () => {
    expect(resolveStorefrontMessengerBaseUrl("")).toBe("");
    expect(resolveStorefrontMessengerBaseUrl("m.me/1469306489588846")).toBe(
      DEFAULT_MESSENGER_URL
    );
    expect(resolveStorefrontMessengerBaseUrl(undefined)).toBe(DEFAULT_MESSENGER_URL);

    process.env.NEXT_PUBLIC_MESSENGER_URL = "m.me/custompage";
    expect(resolveStorefrontMessengerBaseUrl(undefined)).toBe("https://m.me/custompage");
    expect(resolveStorefrontMessengerBaseUrl("")).toBe("");
  });

  it("prefills Messenger URLs with reference code compatible with extractRefToken", () => {
    const url = buildMessengerChatUrl("m.me/1469306489588846?ref=hero", {
      lang: "bn",
      refCode: "#W-7K9P2Q",
    });

    expect(url).toContain("https://m.me/1469306489588846?ref=hero&text=");
    expect(url).not.toContain("+");

    const parsed = new URL(url);
    const decodedText = parsed.searchParams.get("text") || "";
    expect(decodedText).toBe(buildInquiryGreetingText("bn", "#W-7K9P2Q"));
    expect(decodedText).toContain("[Ref: #W-7K9P2Q]");
    expect(extractRefToken(decodedText)).toBe("#W-7K9P2Q");

    expect(buildMessengerChatUrl("", { lang: "bn", refCode: "#W-7K9P2Q" })).toBe("");
  });

  it("preserves explicit empty store.messenger_url in parseSettingsMap", () => {
    expect(parseSettingsMap({}).messengerUrl).toBe(DEFAULT_MESSENGER_URL);
    expect(parseSettingsMap({ "store.messenger_url": "" }).messengerUrl).toBe("");
    expect(
      parseSettingsMap({ "store.messenger_url": "m.me/1469306489588846" }).messengerUrl
    ).toBe(DEFAULT_MESSENGER_URL);
  });

  it("validates and normalizes store.messenger_url in updateSiteSettingsAction", async () => {
    const validRes = await updateSiteSettingsAction({
      "store.messenger_url": "m.me/1469306489588846",
    });
    expect(validRes.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "store.messenger_url",
        value: "https://m.me/1469306489588846",
        is_public: true,
      }),
      { onConflict: "key" }
    );

    vi.clearAllMocks();
    const emptyRes = await updateSiteSettingsAction({ "store.messenger_url": "   " });
    expect(emptyRes.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "store.messenger_url",
        value: "",
        is_public: true,
      }),
      { onConflict: "key" }
    );

    vi.clearAllMocks();
    const badRes = await updateSiteSettingsAction({
      "store.messenger_url": "javascript:alert(1)",
    });
    expect(badRes.success).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns configured or cleared messengerUrl from getStorefrontProductsAction", async () => {
    mockState.siteSettingsRows = [
      { key: "store.messenger_url", value: "https://m.me/1469306489588846" },
    ];
    const configured = await getStorefrontProductsAction();
    expect(configured.messengerUrl).toBe("https://m.me/1469306489588846");

    mockState.siteSettingsRows = [{ key: "store.messenger_url", value: "" }];
    const hidden = await getStorefrontProductsAction();
    expect(hidden.messengerUrl).toBe("");
  });
});
