import { SpanStatusCode, trace } from "@opentelemetry/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const tracer = trace.getTracer("gramayon");

export interface PublicLiveStockStatsResult {
  dailyProductionKg: number | null;
  simulatedDemandEnabled: boolean | null;
  simulatedDemandKg: number | null;
  totalActiveOrdersKg: number;
  activeOrderCount: number;
  fetchedAt: number;
}

const SECRET_SETTING_KEYS = new Set([
  "notifications.brevo_api_key",
  "notifications.smsbangladesh_password",
]);

export function isSecretSettingKey(key: string): boolean {
  return (
    SECRET_SETTING_KEYS.has(key) ||
    /(?:api_key|secret|password|token)/i.test(key)
  );
}

export function computeOrderItemWeightKg(item: {
  quantity?: number | string | null;
  net_quantity?: number | string | null;
  net_unit?: string | null;
  variant_name?: string | null;
  product_name?: string | null;
}): number {
  const qty = Number(item.quantity) || 1;

  if (item.net_quantity != null && Number(item.net_quantity) > 0) {
    const net = Number(item.net_quantity);
    const unit = (item.net_unit || "").toLowerCase();
    if (unit === "g" || unit === "gram" || unit === "grams") return (net / 1000) * qty;
    if (unit === "t" || unit === "ton" || unit === "tonne") return net * 1000 * qty;
    return net * qty;
  }

  const name = `${item.variant_name || ""} ${item.product_name || ""}`.toLowerCase();
  if (name.includes("500 g") || name.includes("500g") || name.includes("৫০০ গ্রাম")) {
    return 0.5 * qty;
  }
  if (
    name.includes("1 kg") ||
    name.includes("1kg") ||
    name.includes("১ কেজি") ||
    name.includes("standard pack")
  ) {
    return 1 * qty;
  }
  if (name.includes("2 kg") || name.includes("2kg") || name.includes("২ কেজি")) {
    return 2 * qty;
  }
  if (name.includes("5 kg") || name.includes("5kg") || name.includes("৫ কেজি")) {
    return 5 * qty;
  }
  if (name.includes("20 l") || name.includes("20l") || name.includes("২০ লিটার")) {
    return 20 * qty;
  }
  if (name.includes("200 l") || name.includes("200l") || name.includes("২০০ লিটার")) {
    return 200 * qty;
  }
  if (name.includes("ton") || name.includes("টন")) {
    return 1000 * qty;
  }

  return 1 * qty;
}

/**
 * Queries public site settings (`is_public = true`) while scrubbing secret-shaped keys.
 * When `throwOnError` is true, throws on DB failures so `"use cache"` never caches degraded data.
 */
export async function fetchPublicSiteSettings(
  options?: { throwOnError?: boolean }
): Promise<Record<string, unknown>> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("key, value")
    .eq("is_public", true);

  if (error || !data) {
    if (options?.throwOnError) {
      throw new Error(error?.message || "Failed to fetch public site settings");
    }
    return {};
  }

  const map: Record<string, unknown> = {};
  for (const row of data) {
    if (!isSecretSettingKey(row.key)) {
      map[row.key] = row.value;
    }
  }
  return map;
}

/**
 * Queries aggregated production settings and active order backlog weight without exposing PII.
 * When `throwOnError` is true, throws on DB failures so `"use cache"` never caches degraded data.
 */
export async function fetchPublicLiveStockStats(
  options?: { throwOnError?: boolean }
): Promise<PublicLiveStockStatsResult> {
  return tracer.startActiveSpan("storefront.getLiveStock", async (span) => {
    try {
      const fetchedAt = Date.now();
  const client = getSupabaseAdmin();
  const [settingsRes, ordersRes] = await Promise.all([
    client
      .from("site_settings")
      .select("key, value")
      .eq("is_public", true)
      .in("key", [
        "inventory.daily_production_kg",
        "inventory.simulated_demand_enabled",
        "inventory.simulated_demand_kg",
      ]),
    client
      .from("orders")
      .select(
        `
        id,
        order_items (
          quantity,
          net_quantity,
          net_unit,
          variant_name,
          product_name
        )
      `
      )
      .in("status", ["pending", "confirmed", "processing"]),
  ]);

  if (options?.throwOnError && (settingsRes.error || ordersRes.error)) {
    throw new Error(
      settingsRes.error?.message ||
        ordersRes.error?.message ||
        "Failed to fetch public live stock stats"
    );
  }

  let dailyProductionKg: number | null = null;
  let simulatedDemandEnabled: boolean | null = null;
  let simulatedDemandKg: number | null = null;

  for (const row of settingsRes.data || []) {
    if (row.key === "inventory.daily_production_kg") {
      const prod = Number(row.value);
      if (Number.isFinite(prod) && prod > 0) {
        dailyProductionKg = prod;
      }
    } else if (row.key === "inventory.simulated_demand_enabled") {
      simulatedDemandEnabled =
        row.value === true ||
        row.value === "true" ||
        row.value === 1 ||
        row.value === "1";
    } else if (row.key === "inventory.simulated_demand_kg") {
      const kg = Math.round(Number(row.value) || 0);
      simulatedDemandKg = Math.max(0, kg);
    }
  }

  let totalWeight = 0;
  let activeOrderCount = 0;

  if (!ordersRes.error && Array.isArray(ordersRes.data)) {
    for (const order of ordersRes.data) {
      activeOrderCount++;
      const items = Array.isArray((order as any).order_items)
        ? (order as any).order_items
        : [];
      for (const item of items) {
        totalWeight += computeOrderItemWeightKg(item);
      }
    }
  }

      span.setAttribute("stock.active_order_count", activeOrderCount);
      return {
        dailyProductionKg,
        simulatedDemandEnabled,
        simulatedDemandKg,
        totalActiveOrdersKg: Math.round(totalWeight * 10) / 10,
        activeOrderCount,
        fetchedAt,
      };
    } catch (error) {
      if (error instanceof Error) span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
