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
    const { default: robots } = await import("@/app/robots");
    const result = robots();

    expect(result.sitemap).toBe("https://khatikhejurgur.shop/sitemap.xml");
    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/order-confirmed/"],
    });
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

  it("keeps static routes when Supabase query fails", async () => {
    mockGetSupabaseAdmin.mockImplementation(() => {
      throw new Error("DB offline");
    });

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();

    expect(entries.map((e) => e.url)).toEqual([
      "https://khatikhejurgur.shop",
      "https://khatikhejurgur.shop/products",
      "https://khatikhejurgur.shop/contact",
      "https://khatikhejurgur.shop/privacy-policy",
    ]);
  });
});
