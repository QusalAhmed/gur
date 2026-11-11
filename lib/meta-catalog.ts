import bizSdk from "facebook-nodejs-business-sdk";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";

const { FacebookAdsApi, ProductCatalog, ProductItem } = bizSdk;

export interface MetaCatalogItemData {
  id: string; // Retailer ID (matches Pixel/CAPI content_ids)
  title: string; // Product title (max 150 chars)
  description?: string; // Product description (max 5000 chars)
  brand?: string; // Brand name (e.g. store name)
  price: string; // Price in format "350.00 BDT" or "20.00 USD"
  sale_price?: string; // Discounted price in format "300.00 BDT"
  image_link: string; // Full HTTPS primary image URL
  additional_image_link?: string[]; // Official Meta /items_batch specification for all secondary/extra images
  additional_image_urls?: string[]; // Legacy / alias field for extra images
  additional_image_cdn_urls?: string[]; // Extra image CDN URLs
  availability: "in stock" | "out of stock" | "preorder" | "available for order";
  link: string; // Canonical storefront URL for product
  condition?: "new" | "refurbished" | "used";
  item_group_id?: string; // Parent product ID for variants grouping
  category?: string; // Category string
  custom_label_0?: string; // Category or tags
  google_product_category?: string; // Google Product Category for Meta Commerce & Dynamic Ads
  product_type?: string; // Merchant taxonomy breadcrumbs (e.g. Food & Beverage > Pantry > Sweeteners)
  fb_product_category?: string; // Meta Facebook native product category
  inventory?: number; // Stock level
  [key: string]: any;
}

export interface MetaBatchRequest {
  method: "create" | "update" | "delete" | "CREATE" | "UPDATE" | "DELETE";
  data: MetaCatalogItemData | { id: string };
}

export interface MetaBatchResult {
  success: boolean;
  handles: string[];
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  error?: string;
  details?: any;
}

export interface MetaFetchedProduct {
  id: string;
  retailerId?: string;
  name?: string;
  title?: string;
  description?: string;
  price?: string;
  currency?: string;
  availability?: string;
  imageUrl?: string;
  url?: string;
  brand?: string;
  raw?: any;
}

export interface MetaCatalogDetails {
  id: string;
  name: string;
  productCount?: number;
  feedCount?: number;
  vertical?: string;
}

export interface MetaSdkConfig {
  catalogId: string | null;
  accessToken: string | null;
  appId: string | null;
  appSecret: string | null;
  pixelId: string | null;
  siteUrl: string;
  isConfigured: boolean;
  missing: string[];
}

/**
 * Reads and validates Meta Catalog environment configuration.
 * Supports multiple environment variable aliases with graceful fallback.
 */
export function getMetaSdkConfig(): MetaSdkConfig {
  const catalogId =
    process.env.META_CATALOG_ID ||
    process.env.FACEBOOK_CATALOG_ID ||
    null;

  const accessToken =
    process.env.META_ACCESS_TOKEN ||
    process.env.FACEBOOK_ACCESS_TOKEN ||
    process.env.FACEBOOK_CAPI_ACCESS_TOKEN ||
    null;

  const appId =
    process.env.META_APP_ID ||
    process.env.FACEBOOK_APP_ID ||
    process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ||
    null;

  const appSecret =
    process.env.META_APP_SECRET ||
    process.env.FACEBOOK_APP_SECRET ||
    null;

  const pixelId =
    process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID ||
    process.env.FACEBOOK_PIXEL_ID ||
    null;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://gur-shop.com");

  const missing: string[] = [];
  if (!catalogId) missing.push("META_CATALOG_ID");
  if (!accessToken) missing.push("META_ACCESS_TOKEN (or FACEBOOK_CAPI_ACCESS_TOKEN)");

  return {
    catalogId,
    accessToken,
    appId,
    appSecret,
    pixelId,
    siteUrl,
    isConfigured: missing.length === 0,
    missing,
  };
}

/**
 * Initializes the Meta Business SDK and instantiates the ProductCatalog object.
 */
export function getMetaCatalogClient(customToken?: string, customCatalogId?: string) {
  const config = getMetaSdkConfig();
  const token = customToken || config.accessToken;
  const catalogId = customCatalogId || config.catalogId;

  if (!token) {
    throw new Error(
      "Meta Access Token is missing. Please set META_ACCESS_TOKEN (or FACEBOOK_CAPI_ACCESS_TOKEN) in your .env file."
    );
  }

  if (!catalogId) {
    throw new Error(
      "Meta Catalog ID is missing. Please set META_CATALOG_ID in your .env file."
    );
  }

  // Initialize the Meta Ads API with the token
  FacebookAdsApi.init(token);
  const catalog = new ProductCatalog(catalogId);

  return {
    api: FacebookAdsApi,
    catalog,
    ProductCatalog,
    ProductItem,
    catalogId,
    token,
  };
}

/**
 * Formats numeric price into standard Meta currency string (e.g. "350.00 BDT").
 */
export function formatPriceForMeta(price: number | string, currency = "BDT"): string {
  const num = Number(price) || 0;
  return `${num.toFixed(2)} ${currency.trim().toUpperCase()}`;
}

/**
 * Resolves storage paths or relative paths into absolute HTTPS URLs for Meta Catalog.
 */
export function resolvePublicImageUrl(storagePath?: string | null, siteUrl?: string): string {
  const base = (siteUrl || getMetaSdkConfig().siteUrl).replace(/\/$/, "");
  if (!storagePath) {
    return `${base}/images/products/blackstrap-drum.jpg`;
  }

  const resolved = resolveCdnImageUrl(storagePath);
  if (resolved.startsWith("/")) {
    return `${base}${resolved}`;
  }
  return resolved;
}

/**
 * Formats Meta Graph API errors into clear, actionable messages.
 */
export function formatMetaApiError(err: any, catalogId?: string): string {
  const msg = err?.message || err?.error?.message || String(err);
  const subcode = err?.error_subcode || err?.error?.error_subcode;
  const code = err?.code || err?.error?.code;

  if (subcode === 33 || msg.includes("Unsupported get request")) {
    return `Unsupported get request (Error 100, Subcode 33): Your Access Token does not have permission to view Catalog ID "${catalogId || ""}". To fix: In Meta Business Settings > System Users, assign this Catalog asset with "Manage Catalog" full control, and generate a token with the "catalog_management" scope.`;
  }

  if (code === 190) {
    return `Access Token Expired or Invalid (Error 190): Please generate a new System User access token in Meta Business Settings.`;
  }

  if (code === 200 || msg.includes("Missing Permissions")) {
    return `Missing Permissions (Error 200): The access token lacks the "catalog_management" permission required for Catalog API calls.`;
  }

  return msg || "Meta API request failed";
}

export const DEFAULT_GOOGLE_PRODUCT_CATEGORY =
  "Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses";

export const DEFAULT_PRODUCT_TYPE_BASE = "Food & Beverage > Pantry > Sweeteners";

export interface ResolvedTaxonomy {
  googleProductCategory: string;
  productType: string;
  fbProductCategory?: string;
}

/**
 * Resolves precise Google Product Category and hierarchical Product Type
 * for Meta Catalog syncing. Respects database overrides first, then falls back
 * to intelligent pattern matching on slug, name, and category.
 */
export function resolveProductCatalogTaxonomy(product: {
  slug?: string | null;
  name?: string | null;
  name_bn?: string | null;
  google_product_category?: string | null;
  product_type?: string | null;
  category?: any;
}): ResolvedTaxonomy {
  const explicitGpc = product.google_product_category?.trim();
  const explicitProductType = product.product_type?.trim();

  const categoryObj = Array.isArray(product.category) ? product.category[0] : product.category;
  const categoryGpc = categoryObj?.google_product_category?.trim();
  const categoryProductType = categoryObj?.product_type?.trim();

  let googleProductCategory = explicitGpc || categoryGpc || DEFAULT_GOOGLE_PRODUCT_CATEGORY;
  let productType = explicitProductType || categoryProductType || "";

  if (!productType) {
    const slug = (product.slug || "").toLowerCase();
    const name = `${product.name || ""} ${product.name_bn || ""}`.toLowerCase();

    if (slug.includes("nut-jaggery") || slug.includes("badam") || name.includes("বাদাম")) {
      productType = `${DEFAULT_PRODUCT_TYPE_BASE} > Specialty Jaggery > Nut Jaggery`;
    } else if (slug.includes("coconut") || name.includes("নারিকেল") || name.includes("নারকেল")) {
      productType = `${DEFAULT_PRODUCT_TYPE_BASE} > Specialty Jaggery > Coconut Jaggery`;
    } else if (slug.includes("grainy") || name.includes("দানাদার")) {
      productType = `${DEFAULT_PRODUCT_TYPE_BASE} > Liquid Jaggery > Granular Jhola Gur`;
    } else if (slug.includes("liquid") || name.includes("পাতলা") || name.includes("ঝোলা")) {
      productType = `${DEFAULT_PRODUCT_TYPE_BASE} > Liquid Jaggery > Thin Jhola Gur`;
    } else if (slug.includes("first-cut") || name.includes("প্রথম কাট")) {
      productType = `${DEFAULT_PRODUCT_TYPE_BASE} > Date Palm Jaggery > First Cut Patali`;
    } else if (
      slug.includes("chocolate") ||
      slug.includes("sandesh") ||
      name.includes("সন্দেশ") ||
      name.includes("চকলেট")
    ) {
      productType = `${DEFAULT_PRODUCT_TYPE_BASE} > Flavored Jaggery > Sandesh Gur`;
    } else if (
      slug.includes("patali") ||
      name.includes("পাটালি") ||
      name.includes("পাঙালি") ||
      name.includes("পাঙ্গালী")
    ) {
      productType = `${DEFAULT_PRODUCT_TYPE_BASE} > Date Palm Jaggery > Patali Gur`;
    } else {
      const catName = categoryObj?.name || "Date Palm Jaggery";
      productType = `${DEFAULT_PRODUCT_TYPE_BASE} > ${catName}`;
    }
  }

  return {
    googleProductCategory,
    productType,
    fbProductCategory: googleProductCategory,
  };
}

/**
 * Fetches catalog details (name, vertical, product count) to verify API connectivity.
 */
export async function getCatalogDetails(options?: {
  catalogId?: string;
  accessToken?: string;
}): Promise<{ success: boolean; details?: MetaCatalogDetails; error?: string }> {
  try {
    const { catalog, catalogId } = getMetaCatalogClient(options?.accessToken, options?.catalogId);

    const fields = [
      ProductCatalog.Fields.id,
      ProductCatalog.Fields.name,
      ProductCatalog.Fields.product_count,
      ProductCatalog.Fields.feed_count,
      ProductCatalog.Fields.vertical,
    ];

    const result: any = await catalog.get(fields);
    const data = result?._data || result || {};

    return {
      success: true,
      details: {
        id: data.id || result.id || catalogId || "",
        name: data.name || result.name || "Default Catalog",
        productCount: Number(data.product_count ?? result.product_count) || 0,
        feedCount: Number(data.feed_count ?? result.feed_count) || 0,
        vertical: data.vertical || result.vertical,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatMetaApiError(err, options?.catalogId || getMetaSdkConfig().catalogId || undefined),
    };
  }
}

/**
 * Uploads products in batch using Meta Business SDK Items Batch API.
 * Handles automatic chunking into batches of up to batchSize (default 100, max 4999).
 */
export async function uploadProductsBatch(
  requests: MetaBatchRequest[],
  options?: {
    catalogId?: string;
    accessToken?: string;
    batchSize?: number;
  }
): Promise<MetaBatchResult> {
  if (!requests || requests.length === 0) {
    return {
      success: true,
      handles: [],
      totalProcessed: 0,
      createdCount: 0,
      updatedCount: 0,
      deletedCount: 0,
    };
  }

  const { catalog } = getMetaCatalogClient(options?.accessToken, options?.catalogId);
  const chunkSize = Math.min(Math.max(Number(options?.batchSize) || 100, 1), 4999);

  const handles: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);

    for (const req of chunk) {
      const m = req.method.toLowerCase();
      if (m === "create") createdCount++;
      else if (m === "update") updatedCount++;
      else if (m === "delete") deletedCount++;
    }

    try {
      const response: any = await catalog.createItemsBatch(
        [],
        {
          item_type: "PRODUCT_ITEM",
          requests: chunk,
        }
      );

      const resHandles = response?.handles || response?._data?.handles;
      if (resHandles && Array.isArray(resHandles)) {
        handles.push(...resHandles);
      } else if (response?.handle || response?._data?.handle) {
        handles.push(response.handle || response._data.handle);
      }
    } catch (err: any) {
      console.error("[Meta Catalog SDK] Error in createItemsBatch:", err);
      return {
        success: false,
        handles,
        totalProcessed: handles.length,
        createdCount,
        updatedCount,
        deletedCount,
        error: formatMetaApiError(err, options?.catalogId || getMetaSdkConfig().catalogId || undefined),
        details: err?.response || err,
      };
    }
  }

  return {
    success: true,
    handles,
    totalProcessed: requests.length,
    createdCount,
    updatedCount,
    deletedCount,
  };
}

/**
 * Fetches products from Meta Catalog with pagination support.
 */
export async function fetchCatalogProducts(options?: {
  catalogId?: string;
  accessToken?: string;
  limit?: number;
  fields?: string[];
  fetchAllPages?: boolean;
}): Promise<{
  success: boolean;
  products: MetaFetchedProduct[];
  totalFetched: number;
  error?: string;
}> {
  try {
    const { catalog } = getMetaCatalogClient(options?.accessToken, options?.catalogId);

    const defaultFields = [
      ProductItem.Fields.id,
      ProductItem.Fields.retailer_id,
      ProductItem.Fields.name,
      ProductItem.Fields.description,
      ProductItem.Fields.price,
      ProductItem.Fields.currency,
      ProductItem.Fields.availability,
      ProductItem.Fields.image_url,
      ProductItem.Fields.url,
      ProductItem.Fields.brand,
    ];

    const fieldsToFetch = options?.fields || defaultFields;
    const requestedLimit = Math.min(Number(options?.limit) || 50, 100);

    const productsCursor: any = await catalog.getProducts(fieldsToFetch, {
      limit: requestedLimit,
    });

    const items: MetaFetchedProduct[] = [];

    const mapItem = (p: any): MetaFetchedProduct => ({
      id: String(p.id || ""),
      retailerId: p.retailer_id ? String(p.retailer_id) : undefined,
      name: p.name || p.title || "",
      title: p.name || p.title || "",
      description: p.description || "",
      price: p.price ? String(p.price) : undefined,
      currency: p.currency || undefined,
      availability: p.availability || undefined,
      imageUrl: p.image_url || undefined,
      url: p.url || undefined,
      brand: p.brand || undefined,
      raw: p,
    });

    for (const p of productsCursor) {
      items.push(mapItem(p));
    }

    if (options?.fetchAllPages) {
      let pageCursor = productsCursor;
      const MAX_ITEMS = 1000;
      while (pageCursor && typeof pageCursor.hasNext === "function" && pageCursor.hasNext() && items.length < MAX_ITEMS) {
        pageCursor = await pageCursor.next();
        for (const p of pageCursor) {
          items.push(mapItem(p));
        }
      }
    }

    return {
      success: true,
      products: items,
      totalFetched: items.length,
    };
  } catch (err: any) {
    console.error("[Meta Catalog SDK] Error fetching catalog products:", err);
    return {
      success: false,
      products: [],
      totalFetched: 0,
      error: formatMetaApiError(err, options?.catalogId || getMetaSdkConfig().catalogId || undefined),
    };
  }
}

/**
 * Deletes a product or variant from Meta Catalog using its retailer ID.
 */
export async function deleteProductFromCatalog(
  retailerId: string,
  options?: { catalogId?: string; accessToken?: string }
): Promise<MetaBatchResult> {
  if (!retailerId) {
    return {
      success: false,
      handles: [],
      totalProcessed: 0,
      createdCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      error: "retailerId is required for deletion",
    };
  }

  const deleteRequest: MetaBatchRequest = {
    method: "delete",
    data: { id: retailerId },
  };

  return await uploadProductsBatch([deleteRequest], options);
}

/**
 * Synchronizes all active products and variants from Supabase to Meta Catalog.
 * Smartly selects between 'create' and 'update' by inspecting existing items on Meta.
 */
export async function syncProductsToMetaCatalog(options?: {
  catalogId?: string;
  accessToken?: string;
  mode?: "auto" | "create" | "update";
  productId?: string; // Optional: sync only a specific product
}): Promise<{
  success: boolean;
  syncedCount: number;
  handles: string[];
  createdCount: number;
  updatedCount: number;
  error?: string;
  items: Array<{
    id: string;
    title: string;
    price: string;
    method: string;
    googleProductCategory?: string;
    productType?: string;
  }>;
}> {
  const config = getMetaSdkConfig();
  if (!config.isConfigured && !options?.catalogId && !options?.accessToken) {
    return {
      success: false,
      syncedCount: 0,
      handles: [],
      createdCount: 0,
      updatedCount: 0,
      error: `Meta Catalog is not configured. Missing: ${config.missing.join(", ")}`,
      items: [],
    };
  }

  const client = getSupabaseAdmin();

  // 1. Fetch store settings for Brand Name & Storefront URL
  let brandName = "গ্রামায়ন";
  const siteUrl = config.siteUrl;

  try {
    const { data: settings } = await client
      .from("site_settings")
      .select("key, value")
      .in("key", ["store.name", "store.name_bn"]);

    if (settings && settings.length > 0) {
      const bn = settings.find((s) => s.key === "store.name_bn")?.value;
      const en = settings.find((s) => s.key === "store.name")?.value;
      const val = bn || en;
      if (val) {
        brandName = String(val).replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch {
    // Safe fallback
  }

  // 2. Fetch products, variants, images, and category from Supabase
  let query = client
    .from("products")
    .select(`
      id, slug, name, name_bn, summary, summary_bn, description, description_bn,
      origin, status, category_id, google_product_category, product_type,
      category:categories(id, name, name_bn, google_product_category, product_type),
      variants:product_variants(*),
      images:product_images(*)
    `)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (options?.productId) {
    query = query.eq("id", options.productId);
  }

  const { data: dbProducts, error: dbErr } = await query;

  if (dbErr || !dbProducts || dbProducts.length === 0) {
    return {
      success: false,
      syncedCount: 0,
      handles: [],
      createdCount: 0,
      updatedCount: 0,
      error: dbErr?.message || "No active products found to sync.",
      items: [],
    };
  }

  // 3. Inspect existing catalog items if mode is 'auto' to choose create vs update
  const existingItemIds = new Set<string>();
  const mode = options?.mode || "auto";

  if (mode === "auto") {
    try {
      const existing = await fetchCatalogProducts({
        catalogId: options?.catalogId,
        accessToken: options?.accessToken,
        limit: 100,
        fetchAllPages: true,
      });
      if (existing.success && existing.products) {
        for (const p of existing.products) {
          if (p.retailerId) existingItemIds.add(p.retailerId);
          if (p.id) existingItemIds.add(p.id);
        }
      }
    } catch {
      // If fetching existing fails, fallback to update/create
    }
  }

  // 4. Transform products into Meta Catalog Batch requests
  const requests: MetaBatchRequest[] = [];
  const syncedItemsSummary: Array<{
    id: string;
    title: string;
    price: string;
    method: string;
    googleProductCategory?: string;
    productType?: string;
  }> = [];

  for (const prod of dbProducts) {
    const taxonomy = resolveProductCatalogTaxonomy(prod);
    const rawImages: any[] = Array.isArray(prod.images) ? prod.images : [];
    // Sort images by is_primary first, then sort_order
    rawImages.sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    // Resolve all image URLs to absolute public HTTPS URLs and deduplicate
    const allProductImageUrls = rawImages
      .map((img) => resolvePublicImageUrl(img.storage_path, siteUrl))
      .filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx);

    // Primary image is the first sorted image (or fallback placeholder)
    const primaryImageUrl = allProductImageUrls[0] || resolvePublicImageUrl(null, siteUrl);

    // All additional images (excluding primary image)
    const extraImageUrls = allProductImageUrls.filter((url) => url !== primaryImageUrl);

    const productTitle = prod.name_bn || prod.name || "Traditional Molasses";
    const productDesc =
      prod.summary_bn ||
      prod.summary ||
      prod.description_bn ||
      prod.description ||
      `${productTitle} - 100% Pure & Authentic from village tree-tappers.`;

    const productLink = prod.slug
      ? `${siteUrl.replace(/\/$/, "")}/products/${prod.slug}`
      : `${siteUrl.replace(/\/$/, "")}#${prod.id}`;

    const categoryName = (prod.category as any)?.name || (prod.category as any)?.name_bn || "Molasses";

    const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
    const activeVariants = variants.filter((v) => v.is_active !== false);

    // If product has no variants, create single product entry
    if (activeVariants.length === 0) {
      const retailerId = prod.id;
      const method: "create" | "update" =
        mode === "create"
          ? "create"
          : mode === "update"
          ? "update"
          : existingItemIds.has(retailerId)
          ? "update"
          : "create";

      const priceString = formatPriceForMeta(500, "BDT");

      requests.push({
        method,
        data: {
          id: retailerId,
          title: productTitle,
          description: productDesc,
          brand: brandName,
          price: priceString,
          image_link: primaryImageUrl,
          ...(extraImageUrls.length > 0
            ? {
                additional_image_link: extraImageUrls,
                additional_image_urls: extraImageUrls,
              }
            : {}),
          availability: "in stock",
          link: productLink,
          condition: "new",
          category: categoryName,
          custom_label_0: categoryName,
          google_product_category: taxonomy.googleProductCategory,
          product_type: taxonomy.productType,
          fb_product_category: taxonomy.fbProductCategory,
        },
      });

      syncedItemsSummary.push({
        id: retailerId,
        title: productTitle,
        price: priceString,
        method,
        googleProductCategory: taxonomy.googleProductCategory,
        productType: taxonomy.productType,
      });
      continue;
    }

    // Export each active variant as its own catalog entry with item_group_id = prod.id
    for (const variant of activeVariants) {
      const variantRetailerId = variant.id;
      const rawVarName = (variant.name_bn || variant.name || "").trim();
      const hasDistinctVariantName =
        rawVarName &&
        rawVarName.toLowerCase() !== productTitle.toLowerCase() &&
        rawVarName.toLowerCase() !== (prod.name || "").toLowerCase() &&
        rawVarName.toLowerCase() !== (prod.name_bn || "").toLowerCase();
      const variantTitle = hasDistinctVariantName
        ? `${productTitle} (${rawVarName})`
        : productTitle;

      const variantPrice = Number(variant.price) || 0;
      const variantComparePrice = Number(variant.compare_at_price) || 0;
      const variantAvailability =
        variant.stock_status === "out_of_stock" ? "out of stock" : "in stock";

      const variantMethod: "create" | "update" =
        mode === "create"
          ? "create"
          : mode === "update"
          ? "update"
          : existingItemIds.has(variantRetailerId)
          ? "update"
          : "create";

      const vPriceString = formatPriceForMeta(
        variantComparePrice > variantPrice ? variantComparePrice : variantPrice,
        "BDT"
      );
      const vSalePriceString = formatPriceForMeta(variantPrice, "BDT");

      // Variant-specific image selection:
      const variantImages = rawImages.filter((img) => img.variant_id === variant.id);
      const variantPrimary = variantImages[0]
        ? resolvePublicImageUrl(variantImages[0].storage_path, siteUrl)
        : primaryImageUrl;
      const variantExtras = allProductImageUrls.filter((url) => url !== variantPrimary);

      const variantLink = prod.slug
        ? `${siteUrl.replace(/\/$/, "")}/products/${prod.slug}?variant=${variant.id}`
        : `${siteUrl.replace(/\/$/, "")}/products/${prod.id}?variant=${variant.id}`;

      requests.push({
        method: variantMethod,
        data: {
          id: variantRetailerId,
          item_group_id: prod.id,
          title: variantTitle,
          description: productDesc,
          brand: brandName,
          price: vPriceString,
          ...(variantComparePrice > variantPrice ? { sale_price: vSalePriceString } : {}),
          image_link: variantPrimary,
          ...(variantExtras.length > 0
            ? {
                additional_image_link: variantExtras,
                additional_image_urls: variantExtras,
              }
            : {}),
          availability: variantAvailability,
          link: variantLink,
          condition: "new",
          category: categoryName,
          custom_label_0: categoryName,
          google_product_category: taxonomy.googleProductCategory,
          product_type: taxonomy.productType,
          fb_product_category: taxonomy.fbProductCategory,
        },
      });

      syncedItemsSummary.push({
        id: variantRetailerId,
        title: variantTitle,
        price: variantComparePrice > variantPrice ? vSalePriceString : vPriceString,
        method: variantMethod,
        googleProductCategory: taxonomy.googleProductCategory,
        productType: taxonomy.productType,
      });
    }
  }

  // 5. Dispatch batch requests via Meta Business SDK
  const batchResult = await uploadProductsBatch(requests, {
    catalogId: options?.catalogId,
    accessToken: options?.accessToken,
  });

  return {
    success: batchResult.success,
    syncedCount: batchResult.totalProcessed,
    handles: batchResult.handles,
    createdCount: batchResult.createdCount,
    updatedCount: batchResult.updatedCount,
    error: batchResult.error,
    items: syncedItemsSummary,
  };
}
