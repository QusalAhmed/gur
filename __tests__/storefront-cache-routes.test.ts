import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

const { mockState, mockAdminClient } = vi.hoisted(() => {
  const mockState: {
    siteSettingsRows: Array<{ key: string; value: unknown; is_public?: boolean }>;
    siteSettingsError: Error | null;
    ordersRows: Array<{ id: string; status: string; order_items: any[] }>;
    ordersError: Error | null;
    cachedSiteSettingsImpl: (() => Promise<Record<string, unknown>>) | null;
    cachedLiveStockImpl: (() => Promise<any>) | null;
  } = {
    siteSettingsRows: [],
    siteSettingsError: null,
    ordersRows: [],
    ordersError: null,
    cachedSiteSettingsImpl: null,
    cachedLiveStockImpl: null,
  };

  const createBuilder = (table: string) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      then: (resolve: (val: any) => void) => {
        if (table === "site_settings") {
          resolve({
            data: mockState.siteSettingsError ? null : mockState.siteSettingsRows,
            error: mockState.siteSettingsError,
          });
          return;
        }
        if (table === "orders") {
          resolve({
            data: mockState.ordersError ? null : mockState.ordersRows,
            error: mockState.ordersError,
          });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return builder;
  };

  const mockAdminClient = {
    from: (table: string) => createBuilder(table),
  };

  return { mockState, mockAdminClient };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mockAdminClient,
}));

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/storefront-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storefront-cache")>();
  return {
    getCachedPublicSiteSettings: async () => {
      if (mockState.cachedSiteSettingsImpl) {
        return mockState.cachedSiteSettingsImpl();
      }
      return actual.getCachedPublicSiteSettings();
    },
    getCachedPublicLiveStockStats: async () => {
      if (mockState.cachedLiveStockImpl) {
        return mockState.cachedLiveStockImpl();
      }
      return actual.getCachedPublicLiveStockStats();
    },
  };
});

import {
  fetchPublicSiteSettings,
  fetchPublicLiveStockStats,
  isSecretSettingKey,
} from "@/lib/storefront-public-data";
import { GET as getSiteSettingsRoute } from "@/app/api/storefront/site-settings/route";
import { GET as getLiveStockRoute } from "@/app/api/storefront/live-stock/route";

describe("Storefront CDN-Cached Endpoints & Loaders", () => {
  beforeEach(() => {
    mockState.siteSettingsRows = [];
    mockState.siteSettingsError = null;
    mockState.ordersRows = [];
    mockState.ordersError = null;
    mockState.cachedSiteSettingsImpl = null;
    mockState.cachedLiveStockImpl = null;
  });

  it("scrubs secret keys from public site settings and throws when throwOnError is set", async () => {
    expect(isSecretSettingKey("notifications.brevo_api_key")).toBe(true);
    expect(isSecretSettingKey("custom_secret_token")).toBe(true);
    expect(isSecretSettingKey("store.name")).toBe(false);

    mockState.siteSettingsRows = [
      { key: "store.name", value: "Gramayon" },
      { key: "store.favicon_url", value: "https://ik.imagekit.io/demo/icon.png" },
      { key: "notifications.brevo_api_key", value: "xkeysib-secret" },
      { key: "some.api_token", value: "tok-123" },
    ];

    const settings = await fetchPublicSiteSettings({ throwOnError: true });
    expect(settings).toEqual({
      "store.name": "Gramayon",
      "store.favicon_url": "https://ik.imagekit.io/demo/icon.png",
    });

    mockState.siteSettingsError = new Error("DB unreachable");
    await expect(fetchPublicSiteSettings({ throwOnError: true })).rejects.toThrow("DB unreachable");
    await expect(fetchPublicSiteSettings({ throwOnError: false })).resolves.toEqual({});
  });

  it("computes public live stock stats without PII and throws on error when requested", async () => {
    mockState.siteSettingsRows = [
      { key: "inventory.daily_production_kg", value: 60 },
      { key: "inventory.simulated_demand_enabled", value: "true" },
      { key: "inventory.simulated_demand_kg", value: 12 },
    ];
    mockState.ordersRows = [
      {
        id: "ord-1",
        status: "pending",
        order_items: [
          { quantity: 2, net_quantity: 500, net_unit: "g" },
          { quantity: 1, net_quantity: 2, net_unit: "kg" },
        ],
      },
      {
        id: "ord-2",
        status: "confirmed",
        order_items: [{ quantity: 3, variant_name: "1 kg jar" }],
      },
    ];

    const stats = await fetchPublicLiveStockStats({ throwOnError: true });
    expect(stats.dailyProductionKg).toBe(60);
    expect(stats.simulatedDemandEnabled).toBe(true);
    expect(stats.simulatedDemandKg).toBe(12);
    expect(stats.totalActiveOrdersKg).toBe(6);
    expect(stats.activeOrderCount).toBe(2);

    mockState.ordersError = new Error("Timeout");
    await expect(fetchPublicLiveStockStats({ throwOnError: true })).rejects.toThrow("Timeout");
  });

  it("GET /api/storefront/site-settings sets CDN Cache-Control on 200 and no-store on 500", async () => {
    mockState.siteSettingsRows = [{ key: "store.name", value: "Gramayon" }];

    const okRes = await getSiteSettingsRoute();
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
    );
    expect(await okRes.json()).toEqual({ "store.name": "Gramayon" });

    mockState.cachedSiteSettingsImpl = async () => {
      throw new Error("Supabase down");
    };
    const errRes = await getSiteSettingsRoute();
    expect(errRes.status).toBe(500);
    expect(errRes.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /api/storefront/live-stock sets CDN Cache-Control on 200 and no-store on 500", async () => {
    mockState.siteSettingsRows = [{ key: "inventory.daily_production_kg", value: 50 }];
    mockState.ordersRows = [];

    const okRes = await getLiveStockRoute();
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("Cache-Control")).toBe(
      "public, max-age=15, s-maxage=30, stale-while-revalidate=60"
    );
    const body = await okRes.json();
    expect(body.dailyProductionKg).toBe(50);
    expect(body.activeOrderCount).toBe(0);

    mockState.cachedLiveStockImpl = async () => {
      throw new Error("Supabase down");
    };
    const errRes = await getLiveStockRoute();
    expect(errRes.status).toBe(500);
    expect(errRes.headers.get("Cache-Control")).toBe("no-store");
  });

  it("wires public hooks to GET routes and configures Vercel region icn1", () => {
    const siteSettingsHook = fs.readFileSync(
      path.resolve(__dirname, "../hooks/use-site-settings.ts"),
      "utf-8"
    );
    const liveStockHook = fs.readFileSync(
      path.resolve(__dirname, "../hooks/use-live-stock.ts"),
      "utf-8"
    );
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf-8")
    );

    expect(siteSettingsHook).toContain('fetch("/api/storefront/site-settings")');
    expect(liveStockHook).toContain('fetch("/api/storefront/live-stock"');
    expect(vercelConfig.regions).toEqual(["icn1"]);
  });
});
