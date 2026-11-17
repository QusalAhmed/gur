import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";

export interface AdminBrandSettings {
  appName: string;
  shortName: string;
  logoUrl: string;
}

const DEFAULT_ENGLISH_BRAND_NAME = "Gramayon";

function cleanSettingValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/^["']|["']$/g, "").trim();
}

async function fetchCachedAdminBrandSettings(): Promise<AdminBrandSettings> {
  "use cache";
  cacheTag("site-settings");
  cacheLife({
    stale: 300,
    revalidate: 300,
    expire: 3600,
  });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["store.name", "store.logo_url", "store.favicon_url"]);

  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || "Failed to load brand settings");
  }

  const map: Record<string, string> = {};
  for (const row of data) {
    map[row.key] = cleanSettingValue(row.value);
  }

  const appName = map["store.name"] || DEFAULT_ENGLISH_BRAND_NAME;
  const shortName = appName.length <= 16 ? appName : appName.slice(0, 16).trim();
  const rawLogo = map["store.logo_url"] || map["store.favicon_url"] || "";
  const logoUrl = rawLogo ? resolveCdnImageUrl(rawLogo) : "";

  return {
    appName,
    shortName,
    logoUrl,
  };
}

/**
 * Resolves the store's English brand name (`store.name`) and logo URL (`store.logo_url` / `store.favicon_url`)
 * from `site_settings` for Admin PWA metadata, manifest, icons, and Web Push defaults.
 */
export async function getAdminBrandSettings(): Promise<AdminBrandSettings> {
  try {
    return await fetchCachedAdminBrandSettings();
  } catch {
    return {
      appName: DEFAULT_ENGLISH_BRAND_NAME,
      shortName: DEFAULT_ENGLISH_BRAND_NAME,
      logoUrl: "",
    };
  }
}
