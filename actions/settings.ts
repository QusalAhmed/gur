"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ADMIN_COOKIE_NAME, verifySessionToken, canRoleAccessPath } from "@/lib/admin-auth";

export interface SiteSettingsMap {
  // Store Profile
  "store.name"?: string;
  "store.name_bn"?: string;
  "store.currency"?: string;
  "store.support_phone"?: string;
  "store.whatsapp"?: string;
  "store.email"?: string;
  "store.address"?: string;
  "store.timezone"?: string;
  "store.language"?: string;
  "store.logo_url"?: string;
  "store.favicon_url"?: string;

  // Checkout & Orders
  "checkout.cod_enabled"?: boolean;
  "checkout.guest_checkout_enabled"?: boolean;
  "orders.number_prefix"?: string;
  "orders.unpaid_online_expiry_minutes"?: number;
  "orders.auto_cancel_cod_hours"?: string | number;
  "orders.allow_backorders"?: string;

  // Inventory Thresholds
  "inventory.low_stock_threshold_bulk"?: number;
  "inventory.low_stock_threshold_retail"?: number;

  // SMS & Notifications
  "notifications.sms_gateway"?: string;
  "notifications.sms_sender_id"?: string;
  "notifications.smtp_server"?: string;

  [key: string]: any;
}

export interface GetSettingsResult {
  success: boolean;
  settings: SiteSettingsMap;
  error?: string;
}

export interface SaveSettingsResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Verifies that the caller has admin permissions to view or update site settings.
 */
async function verifyAdminAuth(): Promise<{ authorized: boolean; reason?: string }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (!token) {
      // In development environments without cookies active, allow access if service role is healthy
      if (process.env.NODE_ENV === "development") {
        return { authorized: true };
      }
      return { authorized: false, reason: "Missing authentication session" };
    }

    const user = await verifySessionToken(token);
    if (!user) {
      return { authorized: false, reason: "Invalid or expired session token" };
    }

    if (!canRoleAccessPath(user.role, "/admin/settings")) {
      return { authorized: false, reason: `Role '${user.role}' is not authorized to manage settings` };
    }

    return { authorized: true };
  } catch (err: any) {
    return { authorized: false, reason: err?.message || "Auth verification failure" };
  }
}

/**
 * Loads all site settings from public.site_settings using the Supabase admin client.
 */
export async function getSiteSettingsAction(): Promise<GetSettingsResult> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) {
    return {
      success: false,
      settings: {},
      error: auth.reason || "Unauthorized access to site settings",
    };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("key, value, description, is_public, updated_at");

    if (error) {
      console.error("Error fetching site settings:", error);
      return { success: false, settings: {}, error: error.message };
    }

    const settingsMap: SiteSettingsMap = {};
    if (data) {
      for (const row of data) {
        settingsMap[row.key] = row.value;
      }
    }

    return { success: true, settings: settingsMap };
  } catch (err: any) {
    console.error("Unexpected error fetching site settings:", err);
    return {
      success: false,
      settings: {},
      error: err?.message || "An unexpected error occurred while fetching settings",
    };
  }
}

/**
 * Batch updates or upserts site settings in public.site_settings.
 */
export async function updateSiteSettingsAction(
  settings: Partial<SiteSettingsMap>
): Promise<SaveSettingsResult> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) {
    return {
      success: false,
      error: auth.reason || "Unauthorized to update site settings",
    };
  }

  try {
    const entries = Object.entries(settings);
    if (entries.length === 0) {
      return { success: true, message: "No changes to save" };
    }

    const now = new Date().toISOString();

    // Perform upserts for each setting key
    const updates = entries.map(([key, value]) =>
      supabaseAdmin
        .from("site_settings")
        .upsert(
          {
            key,
            value,
            updated_at: now,
          },
          { onConflict: "key" }
        )
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);

    if (failed && failed.error) {
      console.error("Failed to update site setting:", failed.error);
      return { success: false, error: failed.error.message };
    }

    // Revalidate paths that consume site settings
    revalidatePath("/admin/settings");
    revalidatePath("/");

    return { success: true, message: "Settings saved successfully to database" };
  } catch (err: any) {
    console.error("Error saving site settings:", err);
    return {
      success: false,
      error: err?.message || "Failed to save settings to database",
    };
  }
}

/**
 * Loads public site settings (branding, store details, etc.) without requiring admin authentication.
 * Safe for use in public layouts, store headers, and metadata generation.
 */
export async function getPublicSiteSettings(): Promise<Partial<SiteSettingsMap>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("key, value")
      .eq("is_public", true);

    if (error || !data) {
      return {};
    }

    const map: Partial<SiteSettingsMap> = {};
    for (const row of data) {
      map[row.key as keyof SiteSettingsMap] = row.value;
    }
    return map;
  } catch (err) {
    console.error("Error fetching public site settings:", err);
    return {};
  }
}


