"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { invalidateDeliveryConfigCache } from "@/lib/delivery-charge";

export interface SiteSettingsMap {
  // Store Profile
  "store.name"?: string;
  "store.name_bn"?: string;
  "store.subtitle"?: string;
  "store.currency"?: string;
  "store.support_phone"?: string;
  "store.whatsapp"?: string;
  "store.email"?: string;
  "store.address"?: string;
  "store.timezone"?: string;
  "store.language"?: string;
  "store.logo_url"?: string;
  "store.favicon_url"?: string;

  // SEO & Social Metadata
  "seo.site_url"?: string;
  "seo.default_title"?: string;
  "seo.title_template"?: string;
  "seo.default_description"?: string;
  "seo.keywords"?: string;
  "seo.og_image_url"?: string;
  "seo.twitter_handle"?: string;
  "seo.home_title"?: string;
  "seo.home_description"?: string;
  "seo.products_title"?: string;
  "seo.products_description"?: string;
  "seo.contact_title"?: string;
  "seo.contact_description"?: string;
  "seo.privacy_title"?: string;
  "seo.privacy_description"?: string;
  "seo.business_type"?: string;
  "seo.business_description"?: string;
  "seo.facebook_url"?: string;
  "seo.instagram_url"?: string;
  "seo.youtube_url"?: string;
  "seo.google_verification"?: string;
  "seo.ga4_measurement_id"?: string;
  "seo.allow_indexing"?: boolean;

  // Checkout & Orders
  "checkout.cod_enabled"?: boolean;
  "checkout.guest_checkout_enabled"?: boolean;
  "orders.number_prefix"?: string;
  "orders.unpaid_online_expiry_minutes"?: number;
  "orders.auto_cancel_cod_hours"?: string | number;
  "orders.allow_backorders"?: string;

  // Shipping & Central Delivery Charges
  "shipping.inside_dhaka_fee"?: number;
  "shipping.outside_dhaka_fee"?: number;
  "shipping.free_delivery_enabled"?: boolean;
  "shipping.free_delivery_threshold"?: number;

  // Inventory Thresholds & Production
  "inventory.low_stock_threshold_bulk"?: number;
  "inventory.low_stock_threshold_retail"?: number;
  "inventory.daily_production_kg"?: number;

  // Simulated Stock & Pre-Order Demand (Inngest)
  "inventory.simulated_demand_enabled"?: boolean;
  "inventory.simulated_demand_kg"?: number;
  "inventory.simulated_demand_min_kg"?: number;
  "inventory.simulated_demand_max_kg"?: number;
  "inventory.simulated_demand_max_cap_kg"?: number;
  "inventory.simulated_demand_interval_mins"?: number;
  "inventory.simulated_demand_last_reset_date"?: string;

  // SMS & Notifications
  "notifications.sms_enabled"?: boolean;
  "notifications.sms_gateway"?: string;
  "notifications.sms_sender_id"?: string;
  "notifications.smsbangladesh_user"?: string;
  "notifications.smsbangladesh_password"?: string;
  "notifications.smsbangladesh_from"?: string;
  "notifications.sms_placed_enabled"?: boolean;
  "notifications.sms_confirmed_enabled"?: boolean;
  "notifications.sms_shipped_enabled"?: boolean;
  "notifications.sms_delivered_enabled"?: boolean;
  "notifications.sms_template_placed"?: string;
  "notifications.sms_template_confirmed"?: string;
  "notifications.sms_template_shipped"?: string;
  "notifications.sms_template_delivered"?: string;
  "notifications.smtp_server"?: string;
  "notifications.brevo_enabled"?: boolean;
  "notifications.brevo_notify_incomplete"?: boolean;
  "notifications.brevo_api_key"?: string;
  "notifications.brevo_admin_email"?: string;
  "notifications.brevo_sender_email"?: string;
  "notifications.brevo_sender_name"?: string;

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

const SECRET_SETTING_KEYS = new Set([
  "notifications.brevo_api_key",
  "notifications.smsbangladesh_password",
]);

function isSecretSettingKey(key: string): boolean {
  return (
    SECRET_SETTING_KEYS.has(key) ||
    /(?:api_key|secret|password|token)/i.test(key)
  );
}

function isMaskedSecretPlaceholder(val: unknown): boolean {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  return trimmed === "" || /^[•*]+$/.test(trimmed);
}

const PUBLIC_SETTING_KEYS = new Set([
  "store.name",
  "store.name_bn",
  "store.subtitle",
  "store.currency",
  "store.support_phone",
  "store.whatsapp",
  "store.email",
  "store.address",
  "store.timezone",
  "store.language",
  "store.logo_url",
  "store.favicon_url",
  "seo.site_url",
  "seo.default_title",
  "seo.title_template",
  "seo.default_description",
  "seo.keywords",
  "seo.og_image_url",
  "seo.twitter_handle",
  "seo.home_title",
  "seo.home_description",
  "seo.products_title",
  "seo.products_description",
  "seo.contact_title",
  "seo.contact_description",
  "seo.privacy_title",
  "seo.privacy_description",
  "seo.business_type",
  "seo.business_description",
  "seo.facebook_url",
  "seo.instagram_url",
  "seo.youtube_url",
  "seo.google_verification",
  "seo.ga4_measurement_id",
  "seo.allow_indexing",
  "checkout.cod_enabled",
  "checkout.guest_checkout_enabled",
  "shipping.inside_dhaka_fee",
  "shipping.outside_dhaka_fee",
  "shipping.free_delivery_enabled",
  "shipping.free_delivery_threshold",
  "inventory.daily_production_kg",
  "inventory.simulated_demand_enabled",
  "inventory.simulated_demand_kg",
]);

const ALLOWED_SETTING_KEYS = new Set([
  ...PUBLIC_SETTING_KEYS,
  "orders.number_prefix",
  "orders.unpaid_online_expiry_minutes",
  "orders.auto_cancel_cod_hours",
  "orders.allow_backorders",
  "inventory.low_stock_threshold_bulk",
  "inventory.low_stock_threshold_retail",
  "inventory.simulated_demand_min_kg",
  "inventory.simulated_demand_max_kg",
  "inventory.simulated_demand_max_cap_kg",
  "inventory.simulated_demand_interval_mins",
  "inventory.simulated_demand_last_reset_date",
  "notifications.sms_enabled",
  "notifications.sms_gateway",
  "notifications.sms_sender_id",
  "notifications.smsbangladesh_user",
  "notifications.smsbangladesh_password",
  "notifications.smsbangladesh_from",
  "notifications.sms_placed_enabled",
  "notifications.sms_confirmed_enabled",
  "notifications.sms_shipped_enabled",
  "notifications.sms_delivered_enabled",
  "notifications.sms_template_placed",
  "notifications.sms_template_confirmed",
  "notifications.sms_template_shipped",
  "notifications.sms_template_delivered",
  "notifications.smtp_server",
  "notifications.brevo_enabled",
  "notifications.brevo_notify_incomplete",
  "notifications.brevo_api_key",
  "notifications.brevo_admin_email",
  "notifications.brevo_sender_email",
  "notifications.brevo_sender_name",
]);

/**
 * Verifies that the caller has admin permissions to view or update site settings.
 */
async function verifyAdminAuth(): Promise<{ authorized: boolean; reason?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    return { authorized: true };
  } catch (err: any) {
    return { authorized: false, reason: err?.message || "Unauthorized access to site settings" };
  }
}

/**
 * Loads all site settings from public.site_settings using the Supabase admin client.
 * Masks secret credentials before returning to the client UI.
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
    const supabaseAdmin = getSupabaseAdmin();
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
        if (isSecretSettingKey(row.key)) {
          settingsMap[row.key] = row.value ? "********" : "";
        } else {
          settingsMap[row.key] = row.value;
        }
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
    const entries = Object.entries(settings || {}).filter(([key]) =>
      ALLOWED_SETTING_KEYS.has(key)
    );
    if (entries.length === 0) {
      return { success: true, message: "No changes to save" };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const updates = entries
      .filter(([key, value]) => {
        if (isSecretSettingKey(key) && isMaskedSecretPlaceholder(value)) {
          return false;
        }
        return value !== undefined;
      })
      .map(([key, value]) =>
        supabaseAdmin
          .from("site_settings")
          .upsert(
            {
              key,
              value,
              updated_at: now,
              ...(PUBLIC_SETTING_KEYS.has(key) ? { is_public: true } : {}),
            },
            { onConflict: "key" }
          )
      );

    if (updates.length === 0) {
      return { success: true, message: "No changes to save" };
    }

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);

    if (failed && failed.error) {
      console.error("Failed to update site setting:", failed.error);
      return { success: false, error: failed.error.message };
    }

    // Revalidate paths and caches that consume site settings
    invalidateDeliveryConfigCache();
    revalidateTag("site-settings", "max");
    revalidateTag("storefront-products", "max");
    revalidatePath("/admin/settings");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/contact");
    revalidatePath("/privacy-policy");
    revalidatePath("/robots.txt");
    revalidatePath("/sitemap.xml");

    // If simulated demand settings were updated, notify Inngest to dynamically adapt immediately
    const hasSimulatedDemandChange = entries.some(([key]) =>
      key.startsWith("inventory.simulated_demand")
    );
    if (hasSimulatedDemandChange) {
      try {
        const { inngest } = await import("@/lib/inngest/client");
        await inngest.send({
          name: "simulated/stock.tick",
          data: { source: "admin_settings_update" },
        });
      } catch (inngestErr) {
        console.warn("[updateSiteSettingsAction] Failed to trigger Inngest simulated stock tick:", inngestErr);
      }
    }

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
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("key, value")
      .eq("is_public", true);

    if (error || !data) {
      return {};
    }

    const map: Partial<SiteSettingsMap> = {};
    for (const row of data) {
      if (!isSecretSettingKey(row.key)) {
        map[row.key as keyof SiteSettingsMap] = row.value;
      }
    }
    return map;
  } catch (err) {
    console.error("Error fetching public site settings:", err);
    return {};
  }
}

export async function getPublicSiteSettingsAction(): Promise<Partial<SiteSettingsMap>> {
  return getPublicSiteSettings();
}

/**
 * Resets simulated stock pre-order backlog to 0 KG immediately.
 */
export async function resetSimulatedStockAction(): Promise<SaveSettingsResult> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) {
    return {
      success: false,
      error: auth.reason || "Unauthorized to reset simulated stock",
    };
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({
        value: 0,
        updated_at: now,
      })
      .eq("key", "inventory.simulated_demand_kg");

    if (error) {
      console.error("Failed to reset simulated stock:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/settings");
    revalidatePath("/");

    // Notify Inngest to realign the loop with 0 KG
    try {
      const { inngest } = await import("@/lib/inngest/client");
      await inngest.send({
        name: "simulated/stock.tick",
        data: { source: "admin_stock_reset" },
      });
    } catch (inngestErr) {
      console.warn("[resetSimulatedStockDemandAction] Failed to trigger Inngest simulated stock tick:", inngestErr);
    }

    return {
      success: true,
      message: "Simulated stock backlog reset to 0 KG successfully",
    };
  } catch (err: any) {
    console.error("Error resetting simulated stock:", err);
    return {
      success: false,
      error: err?.message || "Failed to reset simulated stock",
    };
  }
}



