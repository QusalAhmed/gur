"use server";

import {
  getMetaSdkConfig,
  getCatalogDetails,
  fetchCatalogProducts,
  syncProductsToMetaCatalog,
  deleteProductFromCatalog,
  type MetaCatalogDetails,
  type MetaFetchedProduct,
} from "@/lib/meta-catalog";

export interface SafeMetaConfig {
  isConfigured: boolean;
  catalogId: string | null;
  appId: string | null;
  pixelId: string | null;
  maskedToken: string | null;
  siteUrl: string;
  missing: string[];
}

/**
 * Returns the current configuration status of the Meta Business SDK & Catalog integration.
 * Masks the sensitive access token for safe client consumption.
 */
export async function getMetaCatalogConfigAction(): Promise<{
  success: boolean;
  config: SafeMetaConfig;
}> {
  try {
    const raw = getMetaSdkConfig();

    let maskedToken: string | null = null;
    if (raw.accessToken) {
      const len = raw.accessToken.length;
      if (len > 12) {
        maskedToken = `${raw.accessToken.substring(0, 6)}...${raw.accessToken.substring(len - 6)}`;
      } else {
        maskedToken = "******";
      }
    }

    return {
      success: true,
      config: {
        isConfigured: raw.isConfigured,
        catalogId: raw.catalogId,
        appId: raw.appId,
        pixelId: raw.pixelId,
        maskedToken,
        siteUrl: raw.siteUrl,
        missing: raw.missing,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      config: {
        isConfigured: false,
        catalogId: null,
        appId: null,
        pixelId: null,
        maskedToken: null,
        siteUrl: "",
        missing: ["Failed to load configuration"],
      },
    };
  }
}

/**
 * Tests connection to Meta Graph API and retrieves catalog details.
 */
export async function testMetaCatalogConnectionAction(payload?: {
  catalogId?: string;
  accessToken?: string;
}): Promise<{
  success: boolean;
  details?: MetaCatalogDetails;
  error?: string;
}> {
  try {
    return await getCatalogDetails(payload);
  } catch (err: any) {
    console.error("[Meta Catalog Action] testMetaCatalogConnectionAction error:", err);
    return {
      success: false,
      error: err?.message || "Connection test failed",
    };
  }
}

/**
 * Fetches products from Meta Catalog using Meta Business SDK.
 */
export async function fetchMetaCatalogProductsAction(payload?: {
  catalogId?: string;
  accessToken?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  products: MetaFetchedProduct[];
  totalFetched: number;
  error?: string;
}> {
  try {
    return await fetchCatalogProducts({
      catalogId: payload?.catalogId,
      accessToken: payload?.accessToken,
      limit: payload?.limit || 25,
      fetchAllPages: false,
    });
  } catch (err: any) {
    console.error("[Meta Catalog Action] fetchMetaCatalogProductsAction error:", err);
    return {
      success: false,
      products: [],
      totalFetched: 0,
      error: err?.message || "Failed to fetch catalog products",
    };
  }
}

/**
 * Synchronizes all active products and variants from Supabase to Meta Catalog.
 */
export async function syncAllProductsToMetaCatalogAction(payload?: {
  catalogId?: string;
  accessToken?: string;
  mode?: "auto" | "create" | "update";
}): Promise<{
  success: boolean;
  syncedCount: number;
  handles: string[];
  createdCount: number;
  updatedCount: number;
  error?: string;
  items: Array<{ id: string; title: string; price: string; method: string }>;
}> {
  try {
    return await syncProductsToMetaCatalog(payload);
  } catch (err: any) {
    console.error("[Meta Catalog Action] syncAllProductsToMetaCatalogAction error:", err);
    return {
      success: false,
      syncedCount: 0,
      handles: [],
      createdCount: 0,
      updatedCount: 0,
      error: err?.message || "Catalog synchronization failed",
      items: [],
    };
  }
}

/**
 * Synchronizes a single product and its variants to Meta Catalog.
 */
export async function syncSingleProductToMetaCatalogAction(
  productId: string,
  payload?: { catalogId?: string; accessToken?: string; mode?: "auto" | "create" | "update" }
): Promise<{
  success: boolean;
  syncedCount: number;
  handles: string[];
  createdCount: number;
  updatedCount: number;
  error?: string;
  items: Array<{ id: string; title: string; price: string; method: string }>;
}> {
  try {
    return await syncProductsToMetaCatalog({
      ...payload,
      productId,
    });
  } catch (err: any) {
    console.error(`[Meta Catalog Action] syncSingleProductToMetaCatalogAction error for ${productId}:`, err);
    return {
      success: false,
      syncedCount: 0,
      handles: [],
      createdCount: 0,
      updatedCount: 0,
      error: err?.message || `Failed to sync product ${productId}`,
      items: [],
    };
  }
}

/**
 * Deletes a product or variant item from Meta Catalog by retailer ID.
 */
export async function deleteProductFromMetaCatalogAction(
  retailerId: string,
  payload?: { catalogId?: string; accessToken?: string }
): Promise<{
  success: boolean;
  handles: string[];
  error?: string;
}> {
  try {
    const res = await deleteProductFromCatalog(retailerId, payload);
    return {
      success: res.success,
      handles: res.handles,
      error: res.error,
    };
  } catch (err: any) {
    console.error(`[Meta Catalog Action] deleteProductFromMetaCatalogAction error for ${retailerId}:`, err);
    return {
      success: false,
      handles: [],
      error: err?.message || `Failed to delete product ${retailerId} from Meta Catalog`,
    };
  }
}

