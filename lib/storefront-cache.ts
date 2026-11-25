import { cacheLife, cacheTag } from "next/cache";
import {
  fetchPublicLiveStockStats,
  fetchPublicSiteSettings,
  type PublicLiveStockStatsResult,
} from "@/lib/storefront-public-data";

/**
 * Cached loader for public storefront site settings (`site_settings` where `is_public = true`).
 * Throws on Supabase errors so `"use cache"` never caches degraded empty settings.
 */
export async function getCachedPublicSiteSettings(): Promise<Record<string, unknown>> {
  "use cache";
  cacheTag("site-settings");
  cacheLife({
    stale: 300,
    revalidate: 300,
    expire: 3600,
  });

  return await fetchPublicSiteSettings({ throwOnError: true });
}

/**
 * Cached loader for aggregated storefront live stock and production stats.
 * Throws on Supabase errors so `"use cache"` never caches degraded zeros.
 */
export async function getCachedPublicLiveStockStats(): Promise<PublicLiveStockStatsResult> {
  "use cache";
  cacheTag("live-stock-stats", "site-settings");
  cacheLife({
    stale: 30,
    revalidate: 30,
    expire: 300,
  });

  return await fetchPublicLiveStockStats({ throwOnError: true });
}
