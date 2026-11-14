import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface DeliveryChargeConfig {
  insideDhakaFee: number;
  outsideDhakaFee: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryThreshold: number;
}

export const DEFAULT_DELIVERY_CONFIG: DeliveryChargeConfig = {
  insideDhakaFee: 70,
  outsideDhakaFee: 130,
  freeDeliveryEnabled: false,
  freeDeliveryThreshold: 0,
};

export interface CalculateDeliveryChargeParams {
  zone?: "inside_dhaka" | "outside_dhaka" | null;
  subtotal: number;
  hasItems: boolean;
  config?: DeliveryChargeConfig;
}

export interface DeliveryChargeResult {
  fee: number;
  isFree: boolean;
  qualifiesForFree: boolean;
  amountNeededForFree: number;
}

/**
 * Authoritative central calculation function for courier delivery charges.
 * Used across storefront UI, Server Actions, and internal verifications.
 */
export function calculateAuthoritativeDeliveryCharge({
  zone,
  subtotal,
  hasItems,
  config = DEFAULT_DELIVERY_CONFIG,
}: CalculateDeliveryChargeParams): DeliveryChargeResult {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);

  // If there are no items in cart or no zone selected yet, delivery charge is 0
  if (!hasItems || !zone) {
    return {
      fee: 0,
      isFree: false,
      qualifiesForFree: false,
      amountNeededForFree: config.freeDeliveryEnabled && config.freeDeliveryThreshold > 0
        ? Math.max(0, config.freeDeliveryThreshold - safeSubtotal)
        : 0,
    };
  }

  // Check if free delivery threshold is enabled and met
  const isFreeDeliveryEligible =
    config.freeDeliveryEnabled &&
    config.freeDeliveryThreshold > 0 &&
    safeSubtotal >= config.freeDeliveryThreshold;

  const amountNeeded =
    config.freeDeliveryEnabled && config.freeDeliveryThreshold > 0 && !isFreeDeliveryEligible
      ? Math.max(0, config.freeDeliveryThreshold - safeSubtotal)
      : 0;

  if (isFreeDeliveryEligible) {
    return {
      fee: 0,
      isFree: true,
      qualifiesForFree: true,
      amountNeededForFree: 0,
    };
  }

  const baseFee =
    zone === "inside_dhaka"
      ? Number(config.insideDhakaFee) || DEFAULT_DELIVERY_CONFIG.insideDhakaFee
      : Number(config.outsideDhakaFee) || DEFAULT_DELIVERY_CONFIG.outsideDhakaFee;

  return {
    fee: Math.max(0, baseFee),
    isFree: false,
    qualifiesForFree: false,
    amountNeededForFree: amountNeeded,
  };
}

// In-memory cache for server-side verification to avoid DB overhead per keystroke/submission
let cachedConfig: DeliveryChargeConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 minute in-memory cache

export async function getCachedDeliveryConfig(): Promise<DeliveryChargeConfig> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: settings, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "shipping.inside_dhaka_fee",
        "shipping.outside_dhaka_fee",
        "shipping.free_delivery_enabled",
        "shipping.free_delivery_threshold",
      ]);

    if (error || !settings) {
      console.warn("[DeliveryCharge] Failed to fetch settings, using defaults:", error?.message);
      return DEFAULT_DELIVERY_CONFIG;
    }

    const config: DeliveryChargeConfig = { ...DEFAULT_DELIVERY_CONFIG };

    for (const row of settings) {
      const val = row.value;
      if (row.key === "shipping.inside_dhaka_fee") {
        const num = typeof val === "number" ? val : parseFloat(String(val).replace(/["']/g, ""));
        if (!isNaN(num) && num >= 0) config.insideDhakaFee = num;
      } else if (row.key === "shipping.outside_dhaka_fee") {
        const num = typeof val === "number" ? val : parseFloat(String(val).replace(/["']/g, ""));
        if (!isNaN(num) && num >= 0) config.outsideDhakaFee = num;
      } else if (row.key === "shipping.free_delivery_enabled") {
        config.freeDeliveryEnabled = val === true || val === "true";
      } else if (row.key === "shipping.free_delivery_threshold") {
        const num = typeof val === "number" ? val : parseFloat(String(val).replace(/["']/g, ""));
        if (!isNaN(num) && num >= 0) config.freeDeliveryThreshold = num;
      }
    }

    cachedConfig = config;
    cacheExpiry = now + CACHE_TTL_MS;
    return config;
  } catch (err: any) {
    console.error("[DeliveryCharge] Exception in getCachedDeliveryConfig:", err);
    return DEFAULT_DELIVERY_CONFIG;
  }
}

export function invalidateDeliveryConfigCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}
