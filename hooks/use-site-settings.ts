"use client";

import { useQuery } from "@tanstack/react-query";
import { getSiteSettingsAction, SiteSettingsMap } from "@/actions/settings";
import { fetchSiteSettingsFromDb } from "@/lib/supabase/api";

export interface ParsedSiteSettings {
  raw: SiteSettingsMap;
  storeName: string;
  storeNameBn: string;
  currency: string;
  currencySymbol: string;
  supportPhone: string;
  whatsapp: string;
  email: string;
  address: string;
  timezone: string;
  language: string;
  codEnabled: boolean;
  guestCheckoutEnabled: boolean;
  orderPrefix: string;
  unpaidExpiryMinutes: number;
  autoCancelCodHours: string;
  allowBackorders: string;
  lowStockBulk: number;
  lowStockRetail: number;
  smsGateway: string;
  smsSenderId: string;
  smtpServer: string;
  logoUrl: string;
  faviconUrl: string;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<any>;
}

export const SITE_SETTINGS_QUERY_KEY = ["site-settings"] as const;

export const DEFAULT_SITE_SETTINGS: SiteSettingsMap = {
  "store.name": "GUR",
  "store.name_bn": "গুড়",
  "store.currency": "BDT",
  "store.support_phone": "+880 1700-000001",
  "store.whatsapp": "+880 1711-234567",
  "store.email": "billing@molassesstore.com",
  "store.address": "24/B Industrial Area, Tejgaon Industrial Area, Dhaka-1208, Bangladesh",
  "store.timezone": "Asia/Dhaka",
  "store.language": "bn_en",
  "checkout.cod_enabled": true,
  "checkout.guest_checkout_enabled": true,
  "orders.number_prefix": "MOL",
  "orders.unpaid_online_expiry_minutes": 60,
  "orders.auto_cancel_cod_hours": "48",
  "orders.allow_backorders": "no",
  "inventory.low_stock_threshold_bulk": 10,
  "inventory.low_stock_threshold_retail": 20,
  "notifications.sms_gateway": "greenweb",
  "notifications.sms_sender_id": "MOLASSES",
  "notifications.smtp_server": "smtp.sendgrid.net (Port 587)",
  "store.logo_url": "",
  "store.favicon_url": "",
};

export function parseSettingsMap(raw: SiteSettingsMap = {}): Omit<ParsedSiteSettings, "isLoading" | "isError" | "refetch"> {
  const merged: SiteSettingsMap = { ...DEFAULT_SITE_SETTINGS, ...raw };

  const currency = String(merged["store.currency"] || "BDT").toUpperCase();
  const currencySymbol =
    currency === "USD"
      ? "$"
      : currency === "EUR"
      ? "€"
      : currency === "GBP"
      ? "£"
      : "৳";

  return {
    raw: merged,
    storeName: String(merged["store.name"] || DEFAULT_SITE_SETTINGS["store.name"]),
    storeNameBn: String(merged["store.name_bn"] || DEFAULT_SITE_SETTINGS["store.name_bn"]),
    currency,
    currencySymbol,
    supportPhone: String(merged["store.support_phone"] || DEFAULT_SITE_SETTINGS["store.support_phone"]),
    whatsapp: String(merged["store.whatsapp"] || DEFAULT_SITE_SETTINGS["store.whatsapp"]),
    email: String(merged["store.email"] || DEFAULT_SITE_SETTINGS["store.email"]),
    address: String(merged["store.address"] || DEFAULT_SITE_SETTINGS["store.address"]),
    timezone: String(merged["store.timezone"] || DEFAULT_SITE_SETTINGS["store.timezone"]),
    language: String(merged["store.language"] || DEFAULT_SITE_SETTINGS["store.language"]),
    codEnabled: Boolean(merged["checkout.cod_enabled"] ?? true),
    guestCheckoutEnabled: Boolean(merged["checkout.guest_checkout_enabled"] ?? true),
    orderPrefix: String(merged["orders.number_prefix"] || DEFAULT_SITE_SETTINGS["orders.number_prefix"]),
    unpaidExpiryMinutes: Number(merged["orders.unpaid_online_expiry_minutes"] ?? 60),
    autoCancelCodHours: String(
      merged["orders.auto_cancel_cod_hours"] || DEFAULT_SITE_SETTINGS["orders.auto_cancel_cod_hours"]
    ),
    allowBackorders: String(
      merged["orders.allow_backorders"] || DEFAULT_SITE_SETTINGS["orders.allow_backorders"]
    ),
    lowStockBulk: Number(merged["inventory.low_stock_threshold_bulk"] ?? 10),
    lowStockRetail: Number(merged["inventory.low_stock_threshold_retail"] ?? 20),
    smsGateway: String(merged["notifications.sms_gateway"] || DEFAULT_SITE_SETTINGS["notifications.sms_gateway"]),
    smsSenderId: String(merged["notifications.sms_sender_id"] || DEFAULT_SITE_SETTINGS["notifications.sms_sender_id"]),
    smtpServer: String(merged["notifications.smtp_server"] || DEFAULT_SITE_SETTINGS["notifications.smtp_server"]),
    logoUrl: String(merged["store.logo_url"] || ""),
    faviconUrl: String(merged["store.favicon_url"] || ""),
  };
}

/**
 * React hook to retrieve reactive, cached site settings across the application.
 */
export function useSiteSettings(): ParsedSiteSettings {
  const query = useQuery({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await getSiteSettingsAction();
        if (res.success && res.settings && Object.keys(res.settings).length > 0) {
          return res.settings;
        }
      } catch (e) {
        console.warn("Could not get settings via server action, falling back to db:", e);
      }
      return fetchSiteSettingsFromDb();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const parsed = parseSettingsMap(query.data || {});

  return {
    ...parsed,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

