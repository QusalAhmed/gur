import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_SITE_URL,
  escapeSitemapXmlUrl,
  getSiteUrl,
  normalizeSiteUrl,
} from "@/lib/site-url";

const mockCacheLife = vi.fn();
const mockCacheTag = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

vi.mock("next/cache", () => ({
  cacheLife: (...args: unknown[]) => mockCacheLife(...args),
  cacheTag: (...args: unknown[]) => mockCacheTag(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

describe("site-url helpers", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    }
  });

  it("normalizes trailing slashes and missing protocols", () => {
    expect(normalizeSiteUrl("https://khatikhejurgur.shop/")).toBe("https://khatikhejurgur.shop");
    expect(normalizeSiteUrl("khatikhejurgur.shop/")).toBe("https://khatikhejurgur.shop");
    expect(normalizeSiteUrl("https://khatikhejurgur.shop/products")).toBe("https://khatikhejurgur.shop");
    expect(normalizeSiteUrl("")).toBe(DEFAULT_SITE_URL);
    expect(normalizeSiteUrl("javascript:alert(1)")).toBe(DEFAULT_SITE_URL);
  });

  it("returns normalized NEXT_PUBLIC_SITE_URL or default", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://khatikhejurgur.shop/";
    expect(getSiteUrl()).toBe("https://khatikhejurgur.shop");

    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe("https://khatikhejurgur.shop");
  });

  it("escapes XML characters in URLs", () => {
    expect(escapeSitemapXmlUrl("https://ik.imagekit.io/qusal/a.jpg?w=800&q=80")).toBe(
      "https://ik.imagekit.io/qusal/a.jpg?w=800&amp;q=80"
    );
  });
});

describe("robots and sitemap generation", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NEXT_PUBLIC_SITE_URL = "https://khatikhejurgur.shop/";
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("generates robots.txt disallowing private routes and linking sitemap.xml", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    });
    const { default: robots } = await import("@/app/robots");
    const result = await robots();

    expect(result.sitemap).toBe("https://khatikhejurgur.shop/sitemap.xml");
    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/order-confirmed/"],
    });
  });

  it("keeps public HTML pages crawlable in robots.txt when seo.allow_indexing is false so noindex can be read", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                { key: "seo.allow_indexing", value: false },
                { key: "seo.site_url", value: "https://custom-gur.example" },
              ],
              error: null,
            }),
        }),
      }),
    });

    const { default: robots } = await import("@/app/robots");
    const result = await robots();

    expect(result.sitemap).toBe("https://custom-gur.example/sitemap.xml");
    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/order-confirmed/"],
    });
  });

  it("prefers configured store.name_bn, then store.name, before defaults and preserves last-known settings on query failure", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                { key: "store.name", value: "Artisan Gur Co." },
                { key: "seo.allow_indexing", value: false },
                { key: "seo.site_url", value: "https://custom-gur.example" },
                { key: "seo.google_verification", value: "verify-123" },
              ],
              error: null,
            }),
        }),
      }),
    });

    const { getCachedSeoSettings } = await import("@/lib/seo-settings");
    const first = await getCachedSeoSettings();
    expect(first.storeName).toBe("Artisan Gur Co.");
    expect(first.allowIndexing).toBe(false);
    expect(first.siteUrl).toBe("https://custom-gur.example");
    expect(first.googleVerification).toBe("verify-123");

    // Subsequent DB failure should reuse last-known settings rather than permissive defaults
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: null,
              error: { message: "connection timeout" },
            }),
        }),
      }),
    });

    const fallback = await getCachedSeoSettings();
    expect(fallback.allowIndexing).toBe(false);
    expect(fallback.siteUrl).toBe("https://custom-gur.example");
    expect(fallback.googleVerification).toBe("verify-123");
  });

  it("returns a safe non-indexable fallback on cold-start query failure without poisoning later loads", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: null,
              error: { message: "db error" },
            }),
        }),
      }),
    });

    const { getCachedSeoSettings } = await import("@/lib/seo-settings");
    const coldFallback = await getCachedSeoSettings();
    expect(coldFallback.allowIndexing).toBe(false);
    expect(coldFallback.isFallback).toBe(true);
    expect(coldFallback.googleVerification).toBe("");
    expect(coldFallback.ga4MeasurementId).toBe("");

    // Once DB recovers, subsequent call must load real settings instead of sticking on cold fallback
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                { key: "seo.site_url", value: "https://recovered-gur.example" },
                { key: "seo.allow_indexing", value: true },
              ],
              error: null,
            }),
        }),
      }),
    });

    const recovered = await getCachedSeoSettings();
    expect(recovered.allowIndexing).toBe(true);
    expect(recovered.isFallback).toBe(false);
    expect(recovered.siteUrl).toBe("https://recovered-gur.example");
  });

  it("includes only active products with valid variants and deduplicated images in sitemap", async () => {
    const prodRows = [
      {
        id: "prod-1",
        slug: "patali-gur",
        updated_at: "2026-11-10T10:00:00.000Z",
        created_at: "2026-10-01T10:00:00.000Z",
        sort_order: 1,
      },
      {
        id: "prod-no-variants",
        slug: "empty-product",
        updated_at: "2026-11-10T10:00:00.000Z",
        created_at: "2026-10-01T10:00:00.000Z",
        sort_order: 2,
      },
      {
        id: "prod-broken-combo",
        slug: "broken-combo",
        updated_at: "2026-11-10T10:00:00.000Z",
        created_at: "2026-10-01T10:00:00.000Z",
        sort_order: 3,
      },
    ];

    const varRows = [
      {
        id: "var-1",
        product_id: "prod-1",
        is_active: true,
        is_combo: false,
        updated_at: "2026-11-11T12:00:00.000Z",
      },
      {
        id: "var-broken-combo",
        product_id: "prod-broken-combo",
        is_active: true,
        is_combo: true,
        updated_at: "2026-11-11T12:00:00.000Z",
      },
    ];

    const imgRows = [
      {
        product_id: "prod-1",
        storage_path: "/images/products/date-palm-patali.jpg",
        is_primary: true,
        sort_order: 0,
      },
      {
        product_id: "prod-1",
        storage_path: "https://ik.imagekit.io/qusal/patali.jpg?w=800&q=80",
        is_primary: false,
        sort_order: 1,
      },
    ];

    mockGetSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        const makeChain = (data: unknown[]) => ({
          select: () => makeChain(data),
          eq: () => makeChain(data),
          in: () => Promise.resolve({ data, error: null }),
          order: () => makeChain(data),
          then: (resolve: (val: { data: unknown[]; error: null }) => void) =>
            resolve({ data, error: null }),
        });

        if (table === "products") return makeChain(prodRows);
        if (table === "product_variants") return makeChain(varRows);
        if (table === "product_images") return makeChain(imgRows);
        if (table === "combo_items") return makeChain([]);
        return makeChain([]);
      },
    });

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();

    expect(mockCacheTag).toHaveBeenCalledWith("storefront-products");

    const urls = entries.map((e) => e.url);
    expect(urls).toEqual([
      "https://khatikhejurgur.shop",
      "https://khatikhejurgur.shop/products",
      "https://khatikhejurgur.shop/contact",
      "https://khatikhejurgur.shop/privacy-policy",
      "https://khatikhejurgur.shop/products/patali-gur",
    ]);

    const productEntry = entries.find((e) => e.url.endsWith("/products/patali-gur"));
    expect(productEntry?.lastModified).toBe("2026-11-11T12:00:00.000Z");
    expect(productEntry?.images).toEqual([
      "https://khatikhejurgur.shop/images/products/date-palm-patali.jpg",
      "https://ik.imagekit.io/qusal/patali.jpg?w=800&amp;q=80",
    ]);

    const homeEntry = entries.find((e) => e.url === "https://khatikhejurgur.shop");
    expect(homeEntry?.lastModified).toBe("2026-11-11T12:00:00.000Z");
  });

  it("withholds sitemap when SEO settings fail on cold start", async () => {
    mockGetSupabaseAdmin.mockImplementation(() => {
      throw new Error("DB offline");
    });

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();

    expect(entries).toEqual([]);
  });

  it("keeps static routes on canonical origin when product query fails after SEO settings succeed", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === "site_settings") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ key: "seo.site_url", value: "https://custom-gur.example" }],
                  error: null,
                }),
            }),
          };
        }
        throw new Error("Products table offline");
      },
    });

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();

    expect(entries.map((e) => e.url)).toEqual([
      "https://custom-gur.example",
      "https://custom-gur.example/products",
      "https://custom-gur.example/contact",
      "https://custom-gur.example/privacy-policy",
    ]);
  });
});
