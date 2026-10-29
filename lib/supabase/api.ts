import { supabase } from "./client";
import {
  DbCategory,
  DbProduct,
  DbProductVariant,
  DbProductCard,
  DbFaq,
  DbPost,
  DbSiteSetting,
  DbShippingMethod,
  DbShippingRate,
  DbDeliveryZone,
  DbOrder,
  DbGeoDivision,
  DbGeoDistrict,
} from "./types";
import type { Order, OrderItem, CatalogProduct, OrderEvent, OrderNote, OrderNoteType } from "@/types/order";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  parseDatabaseError,
  DatabaseOperationError,
  validateOrderStatusTransition,
  STATUS_WORKFLOW_FLOW,
  type ParsedDatabaseError,
  type TransitionValidationResult,
} from "./error-handler";

export { parseDatabaseError, DatabaseOperationError, validateOrderStatusTransition, STATUS_WORKFLOW_FLOW };
export type { ParsedDatabaseError, TransitionValidationResult };

export interface BulkStatusUpdateResult {
  success: boolean;
  totalRequested: number;
  updatedCount: number;
  skippedCount: number;
  updatedOrderNumbers: string[];
  skippedOrders: { id: string; reason: string }[];
}

export interface SupabaseHealthStatus {
  connected: boolean;
  latencyMs: number;
  url: string;
  tables: Record<string, number>;
  error?: string;
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcfuqyidcxsqyjzmwxiw.supabase.co";
  const start = Date.now();
  const tableCounts: Record<string, number> = {};

  try {
    const [catRes, prodRes, varRes, shipRes, faqRes, postRes, setRes] = await Promise.all([
      supabase.from("categories").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("product_variants").select("*", { count: "exact", head: true }),
      supabase.from("shipping_methods").select("*", { count: "exact", head: true }),
      supabase.from("faqs").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("site_settings").select("*", { count: "exact", head: true }),
    ]);

    tableCounts["categories"] = catRes.count ?? 0;
    tableCounts["products"] = prodRes.count ?? 0;
    tableCounts["product_variants"] = varRes.count ?? 0;
    tableCounts["shipping_methods"] = shipRes.count ?? 0;
    tableCounts["faqs"] = faqRes.count ?? 0;
    tableCounts["posts"] = postRes.count ?? 0;
    tableCounts["site_settings"] = setRes.count ?? 0;

    const latencyMs = Date.now() - start;
    return {
      connected: true,
      latencyMs,
      url,
      tables: tableCounts,
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      url,
      tables: tableCounts,
      error: err?.message || "Failed to connect to Supabase",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS & VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

export interface UiProductItem {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  category: string;
  categoryId?: string | null;
  status: "active" | "draft" | "archived";
  variants: number;
  stock: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  rating: number;
  reviews: number;
  featured: boolean;
  basePrice?: number;
  imageUrl?: string | null;
  grade?: string | null;
  createdAt?: string;
}

export async function fetchProductsFromDb(): Promise<UiProductItem[]> {
  try {
    // 1. Fetch products
    const { data: productsData, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (prodErr || !productsData || productsData.length === 0) {
      if (prodErr) console.warn("Supabase products fetch warning:", prodErr.message);
      return [];
    }

    // 2. Fetch categories map
    const { data: catData } = await supabase.from("categories").select("id, name");
    const categoryMap = new Map<string, string>();
    if (catData) {
      catData.forEach((c) => categoryMap.set(c.id, c.name));
    }

    // 3. Fetch variants
    const { data: variantsData } = await supabase.from("product_variants").select("*");
    const variantCountMap = new Map<string, { count: number; minPrice: number; stock: string }>();

    if (variantsData) {
      for (const v of variantsData) {
        const cur = variantCountMap.get(v.product_id) || {
          count: 0,
          minPrice: Number(v.price) || 0,
          stock: v.stock_status || "in_stock",
        };
        cur.count += 1;
        if (Number(v.price) < cur.minPrice) {
          cur.minPrice = Number(v.price);
        }
        if (v.stock_status === "out_of_stock" && cur.stock === "in_stock") {
          cur.stock = "out_of_stock";
        }
        variantCountMap.set(v.product_id, cur);
      }
    }

    // 4. Fetch primary images
    const { data: imagesData } = await supabase
      .from("product_images")
      .select("id, product_id, storage_path, is_primary, sort_order")
      .order("sort_order", { ascending: true });

    const imageMap = new Map<string, string>();
    if (imagesData) {
      // Prioritize is_primary or first image per product
      for (const img of imagesData) {
        if (!imageMap.has(img.product_id) || img.is_primary) {
          let pubUrl = img.storage_path;
          if (!pubUrl.startsWith("http")) {
            const { data: pubData } = supabase.storage
              .from("catalog-images")
              .getPublicUrl(img.storage_path);
            pubUrl = pubData?.publicUrl || "";
          }
          imageMap.set(img.product_id, pubUrl);
        }
      }
    }

    return productsData.map((p) => {
      const vInfo = variantCountMap.get(p.id) || { count: 0, minPrice: 0, stock: "in_stock" };
      return {
        id: p.id,
        name: p.name,
        nameBn: p.name_bn || "",
        slug: p.slug,
        category: (p.category_id && categoryMap.get(p.category_id)) || "General Molasses",
        categoryId: p.category_id,
        status: p.status as "active" | "draft" | "archived",
        variants: vInfo.count,
        stock: (vInfo.stock as any) || "in_stock",
        rating: Number(p.rating_avg) || 0,
        reviews: p.rating_count || 0,
        featured: Boolean(p.is_featured),
        basePrice: vInfo.minPrice || 0,
        imageUrl: imageMap.get(p.id) || null,
        grade: p.grade || null,
        createdAt: p.created_at,
      };
    });
  } catch (err) {
    console.error("Error fetching products from Supabase:", err);
    return [];
  }
}

export async function fetchProductDetailById(id: string): Promise<DbProduct | null> {
  try {
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("*, category:categories(*)")
      .eq("id", id)
      .single();

    if (prodErr || !product) {
      console.warn("Product not found in Supabase:", prodErr?.message);
      return null;
    }

    // Fetch variants
    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("sort_order", { ascending: true });

    // Fetch images
    const { data: images } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", id)
      .order("sort_order", { ascending: true });

    const mappedImages = (images || []).map((img) => {
      let publicUrl = img.storage_path;
      if (!publicUrl.startsWith("http")) {
        const { data: pubData } = supabase.storage
          .from("catalog-images")
          .getPublicUrl(img.storage_path);
        publicUrl = pubData?.publicUrl || "";
      }
      return {
        ...img,
        public_url: publicUrl,
      };
    });

    return {
      ...product,
      variants: variants || [],
      images: mappedImages,
    };
  } catch (err) {
    console.error("Error fetching product detail:", err);
    return null;
  }
}

function resolveImageContentType(file: File, fileExt: string): string {
  if (file.type && file.type.startsWith("image/")) {
    if (file.type === "image/jpg") return "image/jpeg";
    return file.type;
  }
  const ext = fileExt.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "avif") return "image/avif";
  return "image/jpeg";
}

export async function uploadProductImageToStorage(
  file: File,
  productId?: string
): Promise<{ path: string; publicUrl: string }> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const cleanBaseName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 30);
  const targetId = productId || "temp";
  const filePath = `products/${targetId}/${Date.now()}-${cleanBaseName}.${fileExt}`;
  const contentType = resolveImageContentType(file, fileExt);

  const { data, error } = await supabase.storage
    .from("catalog-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });

  if (error) {
    console.error("Supabase Storage upload error:", error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from("catalog-images")
    .getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}

export async function deleteProductImageFromStorage(storagePath: string): Promise<boolean> {
  if (!storagePath || storagePath.startsWith("http")) return true;
  try {
    const { error } = await supabase.storage
      .from("catalog-images")
      .remove([storagePath]);
    if (error) {
      console.warn("Supabase Storage delete warning:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Storage deletion exception:", err);
    return false;
  }
}

export async function createProductInDb(payload: {
  name: string;
  nameBn?: string;
  slug: string;
  category_id?: string | null;
  status?: "draft" | "active" | "archived";
  summary?: string | null;
  summaryBn?: string | null;
  description?: string | null;
  descriptionBn?: string | null;
  grade?: string | null;
  origin?: string | null;
  ingredients?: string | null;
  storage_instructions?: string | null;
  shelf_life_days?: number | null;
  tax_rate?: number;
  is_featured?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  sort_order?: number;
}): Promise<any> {
  const { data, error } = await supabase
    .from("products")
    .insert([
      {
        name: payload.name,
        name_bn: payload.nameBn || null,
        slug: payload.slug,
        category_id: payload.category_id || null,
        status: payload.status || "draft",
        summary: payload.summary || null,
        summary_bn: payload.summaryBn || null,
        description: payload.description || null,
        description_bn: payload.descriptionBn || null,
        grade: payload.grade || null,
        origin: payload.origin || null,
        ingredients: payload.ingredients || null,
        storage_instructions: payload.storage_instructions || null,
        shelf_life_days: payload.shelf_life_days || null,
        tax_rate: payload.tax_rate ?? 0,
        is_featured: payload.is_featured ?? false,
        seo_title: payload.seo_title || null,
        seo_description: payload.seo_description || null,
        sort_order: payload.sort_order ?? 0,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProductInDb(
  id: string,
  updates: Partial<DbProduct>
): Promise<any> {
  const { data, error } = await supabase
    .from("products")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveProductWithDetails(params: {
  productId?: string;
  product: {
    name: string;
    nameBn?: string;
    slug: string;
    category_id?: string | null;
    status: "draft" | "active" | "archived";
    summary?: string;
    summaryBn?: string;
    description?: string;
    descriptionBn?: string;
    grade?: string;
    origin?: string;
    ingredients?: string;
    storage_instructions?: string;
    shelf_life_days?: number;
    tax_rate?: number;
    is_featured?: boolean;
    seo_title?: string;
    seo_description?: string;
  };
  variants: Array<{
    id?: string;
    sku: string;
    name: string;
    nameBn?: string;
    pack_type: string;
    net_quantity: number;
    net_unit: string;
    price: number;
    compare_at_price?: number | null;
    stock_status: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
    track_inventory?: boolean;
    low_stock_threshold?: number;
    is_default?: boolean;
    is_active?: boolean;
  }>;
  images: Array<{
    id?: string;
    storage_path: string;
    alt_text?: string;
    is_primary: boolean;
    sort_order?: number;
  }>;
  deletedVariantIds?: string[];
  deletedImageIds?: string[];
}): Promise<{ product: any; error?: string }> {
  try {
    let savedProduct: any;

    if (params.productId) {
      // Update existing product
      savedProduct = await updateProductInDb(params.productId, {
        name: params.product.name,
        name_bn: params.product.nameBn || null,
        slug: params.product.slug,
        category_id: params.product.category_id || null,
        status: params.product.status,
        summary: params.product.summary || null,
        summary_bn: params.product.summaryBn || null,
        description: params.product.description || null,
        description_bn: params.product.descriptionBn || null,
        grade: params.product.grade || null,
        origin: params.product.origin || null,
        ingredients: params.product.ingredients || null,
        storage_instructions: params.product.storage_instructions || null,
        shelf_life_days: params.product.shelf_life_days || null,
        tax_rate: params.product.tax_rate ?? 0,
        is_featured: params.product.is_featured ?? false,
        seo_title: params.product.seo_title || null,
        seo_description: params.product.seo_description || null,
      });
    } else {
      // Create new product
      savedProduct = await createProductInDb({
        name: params.product.name,
        nameBn: params.product.nameBn,
        slug: params.product.slug,
        category_id: params.product.category_id,
        status: params.product.status,
        summary: params.product.summary,
        summaryBn: params.product.summaryBn,
        description: params.product.description,
        descriptionBn: params.product.descriptionBn,
        grade: params.product.grade,
        origin: params.product.origin,
        ingredients: params.product.ingredients,
        storage_instructions: params.product.storage_instructions,
        shelf_life_days: params.product.shelf_life_days,
        tax_rate: params.product.tax_rate,
        is_featured: params.product.is_featured,
        seo_title: params.product.seo_title,
        seo_description: params.product.seo_description,
      });
    }

    const productId = savedProduct.id;

    // Delete removed variants
    if (params.deletedVariantIds && params.deletedVariantIds.length > 0) {
      await supabase
        .from("product_variants")
        .delete()
        .in("id", params.deletedVariantIds);
    }

    // Upsert variants
    if (params.variants && params.variants.length > 0) {
      for (let i = 0; i < params.variants.length; i++) {
        const v = params.variants[i];
        const variantPayload = {
          product_id: productId,
          sku: v.sku.trim(),
          name: v.name.trim(),
          name_bn: v.nameBn?.trim() || null,
          pack_type: v.pack_type || "jar",
          net_quantity: Number(v.net_quantity) || 1,
          net_unit: v.net_unit || "kg",
          price: Number(v.price) || 0,
          compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
          stock_status: v.stock_status || "in_stock",
          track_inventory: v.track_inventory ?? true,
          low_stock_threshold: Number(v.low_stock_threshold) || 5,
          is_default: v.is_default ?? (i === 0),
          is_active: v.is_active ?? true,
          sort_order: i,
        };

        if (v.id) {
          await supabase
            .from("product_variants")
            .update(variantPayload)
            .eq("id", v.id);
        } else {
          await supabase
            .from("product_variants")
            .insert([variantPayload]);
        }
      }
    }

    // Delete removed images
    if (params.deletedImageIds && params.deletedImageIds.length > 0) {
      await supabase
        .from("product_images")
        .delete()
        .in("id", params.deletedImageIds);
    }

    // Upsert images
    if (params.images && params.images.length > 0) {
      for (let i = 0; i < params.images.length; i++) {
        const img = params.images[i];
        const imagePayload = {
          product_id: productId,
          storage_path: img.storage_path,
          alt_text: img.alt_text || null,
          is_primary: img.is_primary ?? (i === 0),
          sort_order: img.sort_order ?? i,
        };

        if (img.id) {
          await supabase
            .from("product_images")
            .update(imagePayload)
            .eq("id", img.id);
        } else {
          await supabase
            .from("product_images")
            .insert([imagePayload]);
        }
      }
    }

    return { product: savedProduct };
  } catch (err: any) {
    console.error("Error saving product with details:", err);
    return { product: null, error: err?.message || "Failed to save product" };
  }
}

export async function deleteProductSafe(id: string): Promise<{
  success: boolean;
  archived: boolean;
  message: string;
}> {
  try {
    // 1. Check if batches reference this product
    const { count: batchCount } = await supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);

    // 2. Check if order_items reference variants of this product
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", id);

    let hasOrderItems = false;
    if (variants && variants.length > 0) {
      const varIds = variants.map((v) => v.id);
      const { count: orderItemsCount } = await supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .in("variant_id", varIds);

      hasOrderItems = (orderItemsCount || 0) > 0;
    }

    if ((batchCount || 0) > 0 || hasOrderItems) {
      // Safely archive to maintain integrity
      await updateProductInDb(id, { status: "archived" });
      return {
        success: true,
        archived: true,
        message: "Product is referenced in existing orders or inventory batches, so it has been safely archived.",
      };
    }

    // 3. Delete image files from storage
    const { data: images } = await supabase
      .from("product_images")
      .select("storage_path")
      .eq("product_id", id);

    if (images && images.length > 0) {
      const paths = images.map((img) => img.storage_path).filter((p) => !p.startsWith("http"));
      if (paths.length > 0) {
        await supabase.storage.from("catalog-images").remove(paths);
      }
    }

    // 4. Delete product row (cascades to product_variants and product_images)
    const { error: delErr } = await supabase.from("products").delete().eq("id", id);
    if (delErr) throw delErr;

    return {
      success: true,
      archived: false,
      message: "Product and associated variants deleted successfully.",
    };
  } catch (err: any) {
    console.error("Error deleting product safely:", err);
    throw err;
  }
}

export async function deleteProductInDb(id: string): Promise<boolean> {
  const res = await deleteProductSafe(id);
  return res.success;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

export interface UiCategoryItem {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  parentId?: string | null;
  parent: string;
  description?: string | null;
  descriptionBn?: string | null;
  imagePath?: string | null;
  imageUrl?: string | null;
  productsCount: number;
  displayOrder: number;
  status: "active" | "draft";
  isActive: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchCategoriesFromDb(): Promise<UiCategoryItem[]> {
  try {
    const { data: categories, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !categories) {
      if (error) console.warn("Supabase categories fetch warning:", error.message);
      return [];
    }

    // Get count of products per category
    const { data: products } = await supabase.from("products").select("category_id");
    const countMap = new Map<string, number>();
    if (products) {
      for (const p of products) {
        if (p.category_id) {
          countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1);
        }
      }
    }

    const categoryNameMap = new Map<string, string>();
    categories.forEach((c) => categoryNameMap.set(c.id, c.name));

    return categories.map((c, idx) => {
      let imageUrl: string | null = null;
      if (c.image_path) {
        if (c.image_path.startsWith("http")) {
          imageUrl = c.image_path;
        } else {
          const { data: pubData } = supabase.storage
            .from("catalog-images")
            .getPublicUrl(c.image_path);
          imageUrl = pubData?.publicUrl || null;
        }
      }

      return {
        id: c.id,
        name: c.name,
        nameBn: c.name_bn || "",
        slug: c.slug,
        parentId: c.parent_id,
        parent: c.parent_id ? categoryNameMap.get(c.parent_id) || "Top Level" : "None (Top Level)",
        description: c.description || null,
        descriptionBn: c.description_bn || null,
        imagePath: c.image_path || null,
        imageUrl,
        productsCount: countMap.get(c.id) || 0,
        displayOrder: c.sort_order ?? idx + 1,
        status: c.is_active ? "active" : "draft",
        isActive: c.is_active ?? true,
        seoTitle: c.seo_title || null,
        seoDescription: c.seo_description || null,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    });
  } catch (err) {
    console.error("Error fetching categories from Supabase:", err);
    return [];
  }
}

export async function fetchCategoryById(id: string): Promise<DbCategory | null> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      console.warn("Category fetch error:", error?.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("fetchCategoryById error:", err);
    return null;
  }
}

export async function uploadCategoryImageToStorage(
  file: File,
  categoryId?: string
): Promise<{ path: string; publicUrl: string }> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const cleanBaseName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 30);
  const targetId = categoryId || "general";
  const filePath = `categories/${targetId}/${Date.now()}-${cleanBaseName}.${fileExt}`;
  const contentType = resolveImageContentType(file, fileExt);

  const { data, error } = await supabase.storage
    .from("catalog-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });

  if (error) {
    console.error("Supabase Storage category upload error:", error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from("catalog-images")
    .getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}

export async function deleteCategoryImageFromStorage(imagePath: string): Promise<boolean> {
  if (!imagePath || imagePath.startsWith("http")) return true;
  try {
    const { error } = await supabase.storage
      .from("catalog-images")
      .remove([imagePath]);
    if (error) {
      console.warn("Supabase Storage delete warning:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Storage deletion exception:", err);
    return false;
  }
}

export async function fetchCategoriesList(): Promise<
  { id: string; name: string; name_bn?: string | null; slug: string }[]
> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, name_bn, slug")
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("Categories fetch error:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("fetchCategoriesList error:", err);
    return [];
  }
}

export async function createCategoryInDb(payload: {
  name: string;
  nameBn?: string;
  slug: string;
  parent_id?: string | null;
  description?: string | null;
  descriptionBn?: string | null;
  image_path?: string | null;
  sort_order?: number;
  is_active?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}): Promise<any> {
  const { data, error } = await supabase
    .from("categories")
    .insert([
      {
        name: payload.name.trim(),
        name_bn: payload.nameBn?.trim() || null,
        slug: payload.slug.trim(),
        parent_id: payload.parent_id || null,
        description: payload.description?.trim() || null,
        description_bn: payload.descriptionBn?.trim() || null,
        image_path: payload.image_path || null,
        sort_order: payload.sort_order ?? 0,
        is_active: payload.is_active ?? true,
        seo_title: payload.seo_title?.trim() || null,
        seo_description: payload.seo_description?.trim() || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategoryInDb(
  id: string,
  updates: Partial<DbCategory>
): Promise<any> {
  const { data, error } = await supabase
    .from("categories")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategorySafe(id: string): Promise<{
  success: boolean;
  archived: boolean;
  message: string;
}> {
  try {
    // 1. Check if products map to this category
    const { count: productCount } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if ((productCount || 0) > 0) {
      // Safely deactivate instead of deleting to protect product mapping
      await updateCategoryInDb(id, { is_active: false });
      return {
        success: true,
        archived: true,
        message: `Category is assigned to ${productCount} products, so it has been deactivated (draft) instead of deleted to preserve product associations.`,
      };
    }

    // 2. Unlink child subcategories if any
    await supabase
      .from("categories")
      .update({ parent_id: null })
      .eq("parent_id", id);

    // 3. Delete image from storage
    const { data: cat } = await supabase
      .from("categories")
      .select("image_path")
      .eq("id", id)
      .single();

    if (cat?.image_path) {
      await deleteCategoryImageFromStorage(cat.image_path);
    }

    // 4. Delete category row
    const { error: delErr } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);

    if (delErr) throw delErr;

    return {
      success: true,
      archived: false,
      message: "Category deleted successfully.",
    };
  } catch (err: any) {
    console.error("Error deleting category safely:", err);
    throw err;
  }
}

export async function deleteCategoryInDb(id: string): Promise<boolean> {
  const res = await deleteCategorySafe(id);
  return res.success;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQS
// ─────────────────────────────────────────────────────────────────────────────

export interface UiFaqItem {
  id: string;
  category: string;
  question: string;
  questionBn: string;
  answer: string;
  displayOrder: number;
  status: string;
}

export async function fetchFaqsFromDb(): Promise<UiFaqItem[]> {
  try {
    const { data, error } = await supabase
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn("Supabase faqs fetch warning:", error.message);
      return [];
    }

    return data.map((f, i) => ({
      id: f.id,
      category: f.topic ? f.topic.charAt(0).toUpperCase() + f.topic.slice(1) : "General",
      question: f.question,
      questionBn: f.question_bn || "",
      answer: f.answer,
      displayOrder: f.sort_order || i + 1,
      status: f.is_active ? "active" : "draft",
    }));
  } catch (err) {
    console.error("Error fetching faqs:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIPPING METHODS & ZONES
// ─────────────────────────────────────────────────────────────────────────────

export interface UiShippingMethodItem {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  carrier: string;
  baseCost: string;
  perKgCost: string;
  freeAbove: string;
  transitDays: string;
  status: "active" | "inactive";
  type: string;
}

export async function fetchShippingMethodsFromDb(): Promise<UiShippingMethodItem[]> {
  try {
    const { data: methods, error } = await supabase
      .from("shipping_methods")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error || !methods || methods.length === 0) {
      if (error) console.warn("Supabase shipping methods warning:", error.message);
      return [];
    }

    const { data: rates } = await supabase.from("shipping_rates").select("*");
    const rateMap = new Map<string, DbShippingRate>();
    if (rates) {
      for (const r of rates) {
        if (!rateMap.has(r.method_id)) {
          rateMap.set(r.method_id, r);
        }
      }
    }

    return methods.map((m) => {
      const rate = rateMap.get(m.id);
      return {
        id: m.id,
        code: m.code.toUpperCase(),
        name: m.name,
        nameBn: m.name_bn || "",
        carrier: m.is_pickup ? "Self Pickup / Warehouse Team" : "Nationwide Courier Logistics",
        baseCost: rate ? `৳ ${rate.base_rate}` : m.is_pickup ? "Free" : "৳ 120",
        perKgCost: rate && rate.per_kg_rate > 0 ? `৳ ${rate.per_kg_rate} / kg` : "Flat rate",
        freeAbove: rate && rate.free_above_amount ? `৳ ${rate.free_above_amount}` : "N/A",
        transitDays: rate ? `${rate.estimated_days_min} – ${rate.estimated_days_max} days` : "1 - 3 days",
        status: m.is_active ? "active" : "inactive",
        type: m.is_pickup ? "Warehouse Pickup" : "Delivery",
      };
    });
  } catch (err) {
    console.error("Error fetching shipping methods:", err);
    return [];
  }
}

export interface UiDeliveryZoneItem {
  id: string;
  name: string;
  nameBn: string;
  coverage: string;
  divisions: string;
  districtsCount: number;
  baseRate: string;
  extraPerKg: string;
  transitDays: string;
  codAvailable: boolean;
  status: string;
}

export async function fetchDeliveryZonesFromDb(): Promise<UiDeliveryZoneItem[]> {
  try {
    const { data, error } = await supabase
      .from("delivery_zones")
      .select("*")
      .order("id", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn("Supabase delivery zones warning:", error.message);
      return [];
    }

    return data.map((z) => ({
      id: `ZN-${String(z.id).padStart(3, "0")}`,
      name: `${z.name} Division Zone`,
      nameBn: z.name_bn ? `${z.name_bn} অঞ্চল` : "",
      coverage: `All districts under ${z.name} division`,
      divisions: z.name,
      districtsCount: 8,
      baseRate: z.name === "Dhaka" ? "৳ 80" : "৳ 130",
      extraPerKg: z.name === "Dhaka" ? "৳ 15" : "৳ 25",
      transitDays: z.name === "Dhaka" ? "1 day" : "2 – 3 days",
      codAvailable: true,
      status: "active",
    }));
  } catch (err) {
    console.error("Error fetching delivery zones:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────────────────────────────────────

export interface UiPostItem {
  id: string;
  title: string;
  titleBn: string;
  slug: string;
  category: string;
  author: string;
  views: number;
  status: "published" | "draft" | "archived";
  publishedDate: string;
  tags: string[];
}

export async function fetchPostsFromDb(): Promise<UiPostItem[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.warn("Supabase posts fetch warning:", error.message);
      return [];
    }

    return data.map((p) => ({
      id: p.id,
      title: p.title,
      titleBn: p.title_bn || "",
      slug: p.slug,
      category: "Technical Guide",
      author: p.author_name || "Editorial Team",
      views: 1240,
      status: p.status as "published" | "draft" | "archived",
      publishedDate: p.published_at ? formatDate(p.published_at) : "24 Oct 2026",
      tags: p.tags || ["Molasses", "Industry"],
    }));
  } catch (err) {
    console.error("Error fetching posts:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SITE SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSiteSettingsFromDb(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase.from("site_settings").select("*");
    if (error || !data) return {};

    const settingsMap: Record<string, any> = {};
    for (const s of data) {
      settingsMap[s.key] = s.value;
    }
    return settingsMap;
  } catch (err) {
    console.error("Error fetching site settings:", err);
    return {};
  }
}

export async function updateSiteSettingInDb(key: string, value: any): Promise<boolean> {
  const { error } = await supabase
    .from("site_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) throw error;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GEO DIVISIONS & DISTRICTS (BANGLADESH)
// ─────────────────────────────────────────────────────────────────────────────

export const fallbackDivisions: DbGeoDivision[] = [
  { id: 1, name: "Barishal", name_bn: "বরিশাল" },
  { id: 2, name: "Chattogram", name_bn: "চট্টগ্রাম" },
  { id: 3, name: "Dhaka", name_bn: "ঢাকা" },
  { id: 4, name: "Khulna", name_bn: "খুলনা" },
  { id: 5, name: "Mymensingh", name_bn: "ময়মনসিংহ" },
  { id: 6, name: "Rajshahi", name_bn: "রাজশাহী" },
  { id: 7, name: "Rangpur", name_bn: "রংপুর" },
  { id: 8, name: "Sylhet", name_bn: "সিলেট" },
];

export const fallbackDistricts: DbGeoDistrict[] = [
  { id: 40, division_id: 4, zone_id: 4, name: "Bagerhat", name_bn: "বাগেরহাট" },
  { id: 17, division_id: 2, zone_id: 2, name: "Bandarban", name_bn: "বান্দরবান" },
  { id: 6, division_id: 1, zone_id: 1, name: "Barguna", name_bn: "বরগুনা" },
  { id: 5, division_id: 1, zone_id: 1, name: "Barishal", name_bn: "বরিশাল" },
  { id: 4, division_id: 1, zone_id: 1, name: "Bhola", name_bn: "ভোলা" },
  { id: 52, division_id: 6, zone_id: 6, name: "Bogura", name_bn: "বগুড়া" },
  { id: 16, division_id: 2, zone_id: 2, name: "Brahmanbaria", name_bn: "ব্রাহ্মণবাড়িয়া" },
  { id: 15, division_id: 2, zone_id: 2, name: "Chandpur", name_bn: "চাঁদপুর" },
  { id: 51, division_id: 6, zone_id: 6, name: "Chapai Nawabganj", name_bn: "চাঁপাইনবাবগঞ্জ" },
  { id: 14, division_id: 2, zone_id: 2, name: "Chattogram", name_bn: "চট্টগ্রাম" },
  { id: 39, division_id: 4, zone_id: 4, name: "Chuadanga", name_bn: "চুয়াডাঙ্গা" },
  { id: 13, division_id: 2, zone_id: 2, name: "Cox's Bazar", name_bn: "কক্সবাজার" },
  { id: 12, division_id: 2, zone_id: 2, name: "Cumilla", name_bn: "কুমিল্লা" },
  { id: 30, division_id: 3, zone_id: 3, name: "Dhaka", name_bn: "ঢাকা" },
  { id: 60, division_id: 7, zone_id: 7, name: "Dinajpur", name_bn: "দিনাজপুর" },
  { id: 29, division_id: 3, zone_id: 3, name: "Faridpur", name_bn: "ফরিদপুর" },
  { id: 11, division_id: 2, zone_id: 2, name: "Feni", name_bn: "ফেনী" },
  { id: 59, division_id: 7, zone_id: 7, name: "Gaibandha", name_bn: "গাইবান্ধা" },
  { id: 28, division_id: 3, zone_id: 3, name: "Gazipur", name_bn: "গাজীপুর" },
  { id: 27, division_id: 3, zone_id: 3, name: "Gopalganj", name_bn: "গোপালগঞ্জ" },
  { id: 64, division_id: 8, zone_id: 8, name: "Habiganj", name_bn: "হবিগঞ্জ" },
  { id: 44, division_id: 5, zone_id: 5, name: "Jamalpur", name_bn: "জামালপুর" },
  { id: 38, division_id: 4, zone_id: 4, name: "Jashore", name_bn: "যশোর" },
  { id: 3, division_id: 1, zone_id: 1, name: "Jhalokathi", name_bn: "ঝালকাঠি" },
  { id: 37, division_id: 4, zone_id: 4, name: "Jhenaidah", name_bn: "ঝিনাইদহ" },
  { id: 50, division_id: 6, zone_id: 6, name: "Joypurhat", name_bn: "জয়পুরহাট" },
  { id: 10, division_id: 2, zone_id: 2, name: "Khagrachhari", name_bn: "খাগড়াছড়ি" },
  { id: 36, division_id: 4, zone_id: 4, name: "Khulna", name_bn: "খুলনা" },
  { id: 26, division_id: 3, zone_id: 3, name: "Kishoreganj", name_bn: "কিশোরগঞ্জ" },
  { id: 58, division_id: 7, zone_id: 7, name: "Kurigram", name_bn: "কুড়িগ্রাম" },
  { id: 35, division_id: 4, zone_id: 4, name: "Kushtia", name_bn: "কুষ্টিয়া" },
  { id: 9, division_id: 2, zone_id: 2, name: "Lakshmipur", name_bn: "লক্ষ্মীপুর" },
  { id: 57, division_id: 7, zone_id: 7, name: "Lalmonirhat", name_bn: "লালমনিরহাট" },
  { id: 25, division_id: 3, zone_id: 3, name: "Madaripur", name_bn: "মাদারীপুর" },
  { id: 34, division_id: 4, zone_id: 4, name: "Magura", name_bn: "মাগুরা" },
  { id: 24, division_id: 3, zone_id: 3, name: "Manikganj", name_bn: "মানিকগঞ্জ" },
  { id: 33, division_id: 4, zone_id: 4, name: "Meherpur", name_bn: "মেহেরপুর" },
  { id: 63, division_id: 8, zone_id: 8, name: "Moulvibazar", name_bn: "মৌলভীবাজার" },
  { id: 23, division_id: 3, zone_id: 3, name: "Munshiganj", name_bn: "মুন্সীগঞ্জ" },
  { id: 43, division_id: 5, zone_id: 5, name: "Mymensingh", name_bn: "ময়মনসিংহ" },
  { id: 49, division_id: 6, zone_id: 6, name: "Naogaon", name_bn: "নওগাঁ" },
  { id: 32, division_id: 4, zone_id: 4, name: "Narail", name_bn: "নড়াইল" },
  { id: 22, division_id: 3, zone_id: 3, name: "Narayanganj", name_bn: "নারায়ণগঞ্জ" },
  { id: 21, division_id: 3, zone_id: 3, name: "Narsingdi", name_bn: "নরসিংদী" },
  { id: 48, division_id: 6, zone_id: 6, name: "Natore", name_bn: "নাটোর" },
  { id: 42, division_id: 5, zone_id: 5, name: "Netrokona", name_bn: "নেত্রকোণা" },
  { id: 56, division_id: 7, zone_id: 7, name: "Nilphamari", name_bn: "নীলফামারী" },
  { id: 8, division_id: 2, zone_id: 2, name: "Noakhali", name_bn: "নোয়াখালী" },
  { id: 47, division_id: 6, zone_id: 6, name: "Pabna", name_bn: "পাবনা" },
  { id: 55, division_id: 7, zone_id: 7, name: "Panchagarh", name_bn: "পঞ্চগড়" },
  { id: 2, division_id: 1, zone_id: 1, name: "Patuakhali", name_bn: "পটুয়াখালী" },
  { id: 1, division_id: 1, zone_id: 1, name: "Pirojpur", name_bn: "পিরোজপুর" },
  { id: 20, division_id: 3, zone_id: 3, name: "Rajbari", name_bn: "রাজবাড়ী" },
  { id: 46, division_id: 6, zone_id: 6, name: "Rajshahi", name_bn: "রাজশাহী" },
  { id: 7, division_id: 2, zone_id: 2, name: "Rangamati", name_bn: "রাঙ্গামাটি" },
  { id: 54, division_id: 7, zone_id: 7, name: "Rangpur", name_bn: "রংপুর" },
  { id: 31, division_id: 4, zone_id: 4, name: "Satkhira", name_bn: "সাতক্ষীরা" },
  { id: 19, division_id: 3, zone_id: 3, name: "Shariatpur", name_bn: "শরীয়তপুর" },
  { id: 41, division_id: 5, zone_id: 5, name: "Sherpur", name_bn: "শেরপুর" },
  { id: 45, division_id: 6, zone_id: 6, name: "Sirajganj", name_bn: "সিরাজগঞ্জ" },
  { id: 62, division_id: 8, zone_id: 8, name: "Sunamganj", name_bn: "সুনামগঞ্জ" },
  { id: 61, division_id: 8, zone_id: 8, name: "Sylhet", name_bn: "সিলেট" },
  { id: 18, division_id: 3, zone_id: 3, name: "Tangail", name_bn: "টাঙ্গাইল" },
  { id: 53, division_id: 7, zone_id: 7, name: "Thakurgaon", name_bn: "ঠাকুরগাঁও" },
];

export async function fetchGeoDivisionsAndDistricts(): Promise<{
  divisions: DbGeoDivision[];
  districts: DbGeoDistrict[];
}> {
  try {
    const [divRes, distRes] = await Promise.all([
      supabase.from("geo_divisions").select("*").order("name", { ascending: true }),
      supabase.from("geo_districts").select("*").order("name", { ascending: true }),
    ]);

    const divisions = divRes.data && divRes.data.length > 0 ? divRes.data : fallbackDivisions;
    const districts = distRes.data && distRes.data.length > 0 ? distRes.data : fallbackDistricts;

    return {
      divisions,
      districts,
    };
  } catch (err) {
    console.error("Error fetching geo divisions and districts from Supabase:", err);
    return {
      divisions: fallbackDivisions,
      districts: fallbackDistricts,
    };
  }
}

export async function fetchGeoDistricts(divisionId?: number): Promise<DbGeoDistrict[]> {
  try {
    let query = supabase.from("geo_districts").select("*").order("name", { ascending: true });
    if (divisionId) {
      query = query.eq("division_id", divisionId);
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      if (divisionId) {
        return fallbackDistricts.filter((d) => d.division_id === divisionId);
      }
      return fallbackDistricts;
    }
    return data;
  } catch (err) {
    console.error("Error fetching geo_districts from Supabase:", err);
    if (divisionId) {
      return fallbackDistricts.filter((d) => d.division_id === divisionId);
    }
    return fallbackDistricts;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER CREATION & DATABASE SYNC
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeBdPhone(phone: string): string {
  let cleaned = (phone || "").replace(/[\s\-\(\)]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("0")) return "+88" + cleaned;
  return "+880" + cleaned;
}

export async function fetchCatalogProductsFromDb(): Promise<CatalogProduct[]> {
  try {
    const [prodRes, varRes, catRes] = await Promise.all([
      supabase.from("products").select("id, name, slug, category_id").order("sort_order", { ascending: true }),
      supabase.from("product_variants").select("id, product_id, sku, name, price, stock_status").eq("is_active", true),
      supabase.from("categories").select("id, name"),
    ]);

    if (varRes.error || !varRes.data || varRes.data.length === 0) {
      return [];
    }

    const categoryMap = new Map<string, string>();
    if (catRes.data) {
      catRes.data.forEach((c) => categoryMap.set(c.id, c.name));
    }

    const productMap = new Map<string, any>();
    if (prodRes.data) {
      prodRes.data.forEach((p) => productMap.set(p.id, p));
    }

    return varRes.data.map((v) => {
      const prod = productMap.get(v.product_id);
      const catName = prod?.category_id ? (categoryMap.get(prod.category_id) || "Molasses") : "Pure Molasses";
      return {
        variant_id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        product_name: prod ? prod.name : "Pure Cane Molasses",
        variant_name: v.name,
        category: catName,
        unit_price: Number(v.price) || 0,
        stock: v.stock_status === "in_stock" ? "In Stock" : v.stock_status.replace("_", " "),
        image: "/images/products/raw-sugarcane-drum.jpg",
      };
    });
  } catch (err) {
    console.error("Error fetching catalog products from Supabase:", err);
    return [];
  }
}

export async function fetchRawShippingMethodsFromDb(): Promise<
  { id: string; name: string; is_pickup: boolean }[]
> {
  try {
    const { data, error } = await supabase
      .from("shipping_methods")
      .select("id, name, is_pickup")
      .eq("is_active", true);
    if (error || !data || data.length === 0) {
      return [
        { id: "f6e5986b-b545-4023-9b6b-abf7bdb2d5d3", name: "Courier delivery", is_pickup: false },
        { id: "e09c2596-174e-45a8-95b8-81c62744e5e3", name: "Pickup from warehouse", is_pickup: true },
      ];
    }
    return data;
  } catch (err) {
    console.error("Error fetching shipping methods from Supabase:", err);
    return [
      { id: "f6e5986b-b545-4023-9b6b-abf7bdb2d5d3", name: "Courier delivery", is_pickup: false },
    ];
  }
}

export async function createOrderInDb(savedOrder: Order): Promise<Order> {
  const isDraft =
    savedOrder.status === "incomplete_order" || savedOrder.status === "pending";

  if (!isDraft && (!savedOrder.items || savedOrder.items.length === 0)) {
    throw new Error("Cannot place a confirmed or processing order with no items.");
  }

  // 1. Clean Phone Number (never auto-fill a dummy number)
  const normalizedPhone = normalizeBdPhone(savedOrder.phone);
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
  const customerName = (savedOrder.customer || "").trim();

  // If this is a draft (incomplete or pending) order, or if customer name or phone is left blank,
  // insert directly into the orders and order_items tables so no dummy fields are auto-filled.
  const shouldUseDirectInsert = isDraft || !customerName || !normalizedPhone;

  if (shouldUseDirectInsert) {
    const orderNumber =
      savedOrder.id ||
      `MOL-2610-0${1085 + Date.now().toString().slice(-4)}`;

    const subtotal = (savedOrder.items || []).reduce(
      (sum, item) => sum + (Number(item.line_total) || (Number(item.quantity) * Number(item.unit_price)) || 0),
      0
    );
    const shippingTotal = Number(savedOrder.shipping_total) || 0;
    const discountTotal = Number(savedOrder.discount_total) || 0;
    const grandTotal = Math.max(0, subtotal - discountTotal + shippingTotal);

    const createdOrder: Order = {
      id: orderNumber,
      customer: customerName,
      phone: normalizedPhone,
      email: savedOrder.email ? savedOrder.email.trim() : "",
      address: {
        division: savedOrder.address?.division || "",
        district: savedOrder.address?.district || "",
        address_line: savedOrder.address?.address_line || "",
      },
      status: savedOrder.status,
      payment: savedOrder.payment || "unpaid",
      fulfillment: savedOrder.fulfillment || "unfulfilled",
      method: savedOrder.method || "cod",
      channel: savedOrder.channel || "phone",
      subtotal,
      discount_total: discountTotal,
      shipping_total: shippingTotal,
      grand_total: grandTotal,
      amount_paid: Number(savedOrder.amount_paid) || 0,
      currency: "BDT",
      date: formatDate(savedOrder.date) || formatDate(nowStr),
      customer_note: savedOrder.customer_note || "",
      courier_name: savedOrder.courier_name || "",
      cancel_reason: savedOrder.cancel_reason || "",
      items: savedOrder.items || [],
      notes: savedOrder.notes && savedOrder.notes.length > 0
        ? savedOrder.notes
        : [
            {
              id: `note-${Date.now()}`,
              author: "Admin Staff",
              text: `Order recorded via ${savedOrder.channel?.toUpperCase() || "ADMIN"}.`,
              type: "internal",
              created_at: formatDateTime(nowStr),
            },
          ],
      events: savedOrder.events && savedOrder.events.length > 0
        ? savedOrder.events
        : [
            {
              id: `ev-${Date.now()}`,
              event_type: "placed",
              message: `Order created (${savedOrder.status.replace(/_/g, " ")})`,
              actor: "Admin Staff",
              created_at: formatDateTime(nowStr),
            },
          ],
      isFromDb: false,
    };

    // Attempt direct database INSERT via RLS policy
    try {
      const dbInsertPayload: Record<string, any> = {
        order_number: orderNumber,
        status: savedOrder.status,
        channel: savedOrder.channel || "phone",
        payment_status: savedOrder.payment || "unpaid",
        fulfillment_status: savedOrder.fulfillment || "unfulfilled",
        payment_method: savedOrder.method || "cod",
        currency: "BDT",
        customer_name: customerName || null,
        customer_phone: normalizedPhone || null,
        customer_email: savedOrder.email ? savedOrder.email.trim() : null,
        shipping_address: {
          division: savedOrder.address?.division || "",
          district: savedOrder.address?.district || "",
          address_line: savedOrder.address?.address_line || "",
          phone: normalizedPhone || "",
          recipient_name: customerName || "",
        },
        subtotal,
        discount_total: discountTotal,
        shipping_total: shippingTotal,
        tax_total: 0,
        grand_total: grandTotal,
        amount_paid: Number(savedOrder.amount_paid) || 0,
        customer_note: savedOrder.customer_note || null,
        attribution: {},
        cancel_reason: savedOrder.cancel_reason || null,
        shipping_method_name: savedOrder.courier_name || null,
      };

      // 1. Insert into orders table directly
      const { data: dbData, error: dbErr } = await supabase
        .from("orders")
        .insert(dbInsertPayload)
        .select()
        .maybeSingle();

      if (dbErr) {
        // Fallback: If SELECT returning is not permitted, perform standard insert
        const { error: blindErr } = await supabase
          .from("orders")
          .insert(dbInsertPayload);

        if (blindErr) {
          throw new Error(blindErr.message || "Failed to create order in database");
        }
      }

      createdOrder.id = dbData?.order_number || orderNumber;
      createdOrder.isFromDb = true;
      createdOrder.public_token = dbData?.public_token;

      // 2. Insert items into order_items table if any
      let orderDbId = dbData?.id;
      if (!orderDbId) {
        const { data: fetchedOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("order_number", orderNumber)
          .maybeSingle();
        orderDbId = fetchedOrder?.id;
      }

      if (orderDbId && savedOrder.items && savedOrder.items.length > 0) {
        try {
          const itemRows = savedOrder.items.map((it) => {
            const isUuid =
              typeof it.variant_id === "string" &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                it.variant_id
              );
            return {
              order_id: orderDbId,
              variant_id: isUuid ? it.variant_id : null,
              sku: it.sku || "SKU-ITEM",
              product_name: it.product_name || "Molasses Product",
              variant_name: it.variant_name || "Standard",
              quantity: Math.max(1, Number(it.quantity) || 1),
              unit_price: Math.max(0, Number(it.unit_price) || 0),
            };
          });
          const { error: itemInsertErr } = await supabase.from("order_items").insert(itemRows);
          if (itemInsertErr) {
            console.error("Direct order_items insert error:", itemInsertErr);
          }
        } catch (itemErr) {
          console.warn("Could not insert order items directly:", itemErr);
        }
      }

      // 3. Insert rest of notes into order_notes table (customer note stays in orders.customer_note)
      if (orderDbId && savedOrder.notes && savedOrder.notes.length > 0) {
        try {
          const nonCustomerNotes = savedOrder.notes.filter(
            (n) => n && n.text && n.text.trim() && n.type !== "customer"
          );
          if (nonCustomerNotes.length > 0) {
            const noteRows = nonCustomerNotes.map((n) => {
              const dbType =
                n.type === "delivery" || n.type === "delivery_note"
                  ? "delivery"
                  : n.type === "packaging" || n.type === "packaging_note"
                  ? "packaging"
                  : "internal";
              return {
                order_id: orderDbId,
                order_number: orderNumber,
                type: dbType,
                author: n.author || "Admin Staff",
                note: n.text.trim().replace(/^\[(Delivery|Packaging|Internal) Note\]\s*/i, ""),
                created_at: n.created_at || new Date().toISOString(),
              };
            });
            await supabase.from("order_notes").insert(noteRows);
          }
        } catch (noteInsErr) {
          console.warn("Notice inserting notes into order_notes:", noteInsErr);
        }
      }
    } catch (insertErr: any) {
      console.error("Error attempting order insert:", insertErr);
      throw new Error(insertErr?.message || "Failed to save order in database");
    }

    return createdOrder;
  }

  // 2. Resolve District ID
  let districtId = 30; // Default to Dhaka
  try {
    const targetDistrictName = (savedOrder.address?.district || "").trim().toLowerCase();
    const { data: distData } = await supabase
      .from("geo_districts")
      .select("id, name")
      .ilike("name", targetDistrictName);

    if (distData && distData.length > 0) {
      districtId = distData[0].id;
    } else {
      const found = fallbackDistricts.find(
        (d) => d.name.toLowerCase() === targetDistrictName
      );
      if (found) districtId = found.id;
    }
  } catch (e) {
    console.warn("District resolution warning:", e);
  }

  // 3. Resolve Shipping Method
  const shippingMethods = await fetchRawShippingMethodsFromDb();
  const isPickup =
    (savedOrder.address?.address_line || "").toLowerCase().includes("pickup") ||
    Number(savedOrder.shipping_total) === 0;

  const matchedMethod =
    shippingMethods.find((m) => m.is_pickup === isPickup) ||
    shippingMethods.find((m) => !m.is_pickup) ||
    shippingMethods[0];

  const shippingMethodId = matchedMethod.id;

  // 4. Resolve Variant IDs for Items
  const { data: dbVariants } = await supabase
    .from("product_variants")
    .select("id, sku, price")
    .eq("is_active", true);

  const variantSkuMap = new Map<string, string>();
  if (dbVariants) {
    dbVariants.forEach((v) => variantSkuMap.set(v.sku.toLowerCase(), v.id));
  }
  const defaultVariantId = dbVariants && dbVariants.length > 0
    ? dbVariants[0].id
    : "0c696f68-7bc2-4006-befa-0540dd24dc5b";

  const pItems = savedOrder.items.map((it) => {
    let vId = it.variant_id;
    if (!vId || vId.length < 32) {
      vId = variantSkuMap.get(it.sku.toLowerCase()) || defaultVariantId;
    }
    return {
      variant_id: vId,
      quantity: Math.max(1, Number(it.quantity) || 1),
    };
  });

  // 5. Payment method mapping
  const validMethods = ["cod", "bkash", "nagad", "rocket", "card", "bank_transfer", "credit_terms", "cash"];
  let paymentMethod = (savedOrder.method || "cod") as any;
  if (!validMethods.includes(paymentMethod)) {
    paymentMethod = "cod";
  }

  // 6. Call Supabase RPC 'place_order'
  const { data: placeData, error: placeError } = await supabase.rpc("place_order", {
    p_items: pItems,
    p_customer: {
      name: customerName,
      phone: normalizedPhone,
      email: savedOrder.email ? savedOrder.email.trim() : undefined,
    },
    p_shipping_address: {
      recipient_name: customerName,
      phone: normalizedPhone,
      district_id: districtId,
      address_line: savedOrder.address?.address_line?.trim() || "",
    },
    p_shipping_method_id: shippingMethodId,
    p_payment_method: paymentMethod,
    p_customer_note: savedOrder.customer_note?.trim() || undefined,
  });

  if (placeError) {
    console.error("Supabase place_order RPC error:", placeError);
    let msg = placeError.message;
    if (msg.includes("OUT_OF_STOCK")) msg = "Selected molasses product is currently out of stock in warehouse.";
    else if (msg.includes("CUSTOMER_PHONE_INVALID")) msg = "Please enter a valid mobile number (+880...)";
    else if (msg.includes("ADDRESS_REQUIRED")) msg = "Please provide delivery district and street address.";
    else if (msg.includes("FORBIDDEN")) msg = "Access restricted for this channel or customer action.";
    throw new Error(msg);
  }

  // 7. Retrieve full created order details from DB via get_order_by_token
  let orderDetails: any = null;
  if (placeData?.public_token) {
    try {
      const { data: tokenData } = await supabase.rpc("get_order_by_token", {
        p_token: placeData.public_token,
      });
      if (tokenData) {
        orderDetails = tokenData;
      }
    } catch (e) {
      console.warn("Could not immediately fetch order token details:", e);
    }
  }

  const orderNumber = orderDetails?.order_number || placeData?.order_number || `MOL-2610-${Date.now().toString().slice(-5)}`;

  const createdResult: Order = {
    id: orderNumber,
    customer: orderDetails?.customer_name || customerName || "",
    phone: orderDetails?.shipping_address?.phone || normalizedPhone,
    email: savedOrder.email || "",
    address: {
      division: orderDetails?.shipping_address?.division || savedOrder.address?.division || "",
      district: orderDetails?.shipping_address?.district || savedOrder.address?.district || "",
      address_line: orderDetails?.shipping_address?.address_line || savedOrder.address?.address_line || "",
    },
    status: savedOrder.status || (orderDetails?.status as any) || "pending",
    payment: (orderDetails?.payment_status as any) || savedOrder.payment || "unpaid",
    fulfillment: (orderDetails?.fulfillment_status as any) || savedOrder.fulfillment || "unfulfilled",
    method: (orderDetails?.payment_method as any) || paymentMethod,
    channel: savedOrder.channel || "web",
    subtotal: Number(orderDetails?.subtotal) || Number(placeData?.grand_total) || savedOrder.subtotal,
    discount_total: Number(orderDetails?.discount_total) || 0,
    shipping_total: Number(orderDetails?.shipping_total) || savedOrder.shipping_total,
    grand_total: Number(orderDetails?.grand_total) || Number(placeData?.grand_total) || savedOrder.grand_total,
    amount_paid: Number(orderDetails?.amount_paid) || 0,
    currency: orderDetails?.currency || "BDT",
    date: formatDate(orderDetails?.placed_at) || formatDate(nowStr),
    customer_note: savedOrder.customer_note,
    items: orderDetails?.items && orderDetails.items.length > 0
      ? orderDetails.items.map((it: any, idx: number) => ({
          id: `item-db-${idx}-${it.sku}`,
          sku: it.sku,
          product_name: it.product_name,
          variant_name: it.variant_name,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          line_total: Number(it.line_total) || (Number(it.quantity) * Number(it.unit_price)),
          variant_id: savedOrder.items[idx]?.variant_id,
        }))
      : savedOrder.items,
    notes: [
      {
        id: `note-${Date.now()}`,
        author: "System",
        text: `Order created and confirmed.`,
        type: "internal",
        created_at: formatDateTime(nowStr),
      },
    ],
    events: orderDetails?.timeline && orderDetails.timeline.length > 0
      ? orderDetails.timeline.map((ev: any, idx: number) => ({
          id: `ev-db-${idx}`,
          event_type: ev.event || "placed",
          message: ev.message || "Order placed",
          actor: "System Checkout",
          created_at: formatDateTime(ev.at) || formatDateTime(nowStr),
        }))
      : [
          {
            id: `ev-${Date.now()}`,
            event_type: "placed",
            message: "Order placed",
            actor: "System Checkout",
            created_at: formatDateTime(nowStr),
          },
        ],
    isFromDb: true,
    public_token: placeData?.public_token,
  };

  return createdResult;
}

function formatDbOrderRecord(data: any): Order {
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
  const rawItems = data.order_items || data.items || [];
  const items: OrderItem[] = rawItems.map((it: any, idx: number) => ({
    id: it.id || `item-db-${idx}-${it.sku}`,
    sku: it.sku || "",
    product_name: it.product_name || "",
    variant_name: it.variant_name || "",
    quantity: Number(it.quantity) || 1,
    unit_price: Number(it.unit_price) || 0,
    line_total: Number(it.line_total) || (Number(it.quantity) * Number(it.unit_price)),
    variant_id: it.variant_id,
  }));

  const rawEvents = data.order_events || data.timeline || [];
  const events: OrderEvent[] = rawEvents.map((ev: any, idx: number) => ({
    id: String(ev.id || `ev-db-${idx}`),
    event_type: ev.event_type || ev.event || "placed",
    message: ev.message || `Order ${ev.event_type || "updated"}`,
    actor: "Admin Staff",
    created_at: formatDateTime(ev.created_at || ev.at) || formatDateTime(nowStr),
  }));

  return {
    id: data.order_number,
    customer: data.customer_name || "",
    phone: data.shipping_address?.phone || data.customer_phone || "",
    email: data.customer_email || "",
    address: {
      division: data.shipping_address?.division || "",
      district: data.shipping_address?.district || "",
      address_line: data.shipping_address?.address_line || "",
    },
    status: (data.status as any) || "pending",
    payment: (data.payment_status as any) || "unpaid",
    fulfillment: (data.fulfillment_status as any) || "unfulfilled",
    method: (data.payment_method as any) || "cod",
    channel: data.channel || "web",
    subtotal: Number(data.subtotal) || 0,
    discount_total: Number(data.discount_total) || 0,
    shipping_total: Number(data.shipping_total) || 0,
    grand_total: Number(data.grand_total) || 0,
    amount_paid: Number(data.amount_paid) || 0,
    currency: data.currency || "BDT",
    date: formatDate(data.placed_at) || formatDate(nowStr),
    customer_note: data.customer_note || (() => {
      if (Array.isArray(data.order_notes)) {
        const custNote = data.order_notes.find((n: any) => n && n.type === "customer");
        return custNote ? (custNote.note || custNote.text || "").trim() : "";
      }
      return "";
    })(),
    cancel_reason: data.cancel_reason || "",
    courier_name: data.shipping_method_name || "",
    items,
    notes: Array.isArray(data.order_notes)
      ? data.order_notes
          .filter((n: any) => n && (n.note || n.text))
          .map((n: any, idx: number) => {
            const rawText = (n.note || n.text || "").trim();
            let parsedType: OrderNoteType = "internal";
            let parsedText = rawText;

            if (n.type === "customer") {
              parsedType = "customer";
            } else if (n.type === "delivery" || n.type === "delivery_note") {
              parsedType = "delivery";
            } else if (n.type === "packaging" || n.type === "packaging_note") {
              parsedType = "packaging";
            } else {
              parsedType = "internal";
            }

            // Strip any remaining legacy third-bracket prefixes
            if (rawText.startsWith("[Delivery Note] ")) {
              parsedText = rawText.replace("[Delivery Note] ", "").trim();
            } else if (rawText.startsWith("[Packaging Note] ")) {
              parsedText = rawText.replace("[Packaging Note] ", "").trim();
            } else if (rawText.startsWith("[Internal Note] ")) {
              parsedText = rawText.replace("[Internal Note] ", "").trim();
            }

            return {
              id: String(n.id || `note-${idx}`),
              order_id: String(n.order_id || data.id || ""),
              order_number: String(n.order_number || data.order_number || ""),
              author: n.author || "Admin Staff",
              text: parsedText,
              type: parsedType,
              created_at: formatDateTime(n.created_at || nowStr),
            };
          })
          // Keep only non-customer notes in notes table array (customer note lives in customer_note column)
          .filter((n: OrderNote) => n.type !== "customer")
      : [],
    events: events.length > 0 ? events : [
      {
        id: `ev-${data.id || data.order_number}`,
        event_type: "placed",
        message: "Order placed",
        actor: "System Checkout",
        created_at: formatDateTime(data.placed_at) || formatDateTime(nowStr),
      },
    ],
    isFromDb: true,
    public_token: data.public_token,
  };
}

export async function fetchOrdersFromDb(): Promise<Order[]> {
  // Purge any stale legacy local caches from browser
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("gur_created_orders");
      localStorage.removeItem("gur_order_modifications");
      localStorage.removeItem("gur_deleted_orders");
    } catch {
      // Ignore
    }
  }

  // Pure server query directly to Supabase
  let data: any[] | null = null;
  let error: any = null;

  // 1. Attempt query joining order_items, order_events, and order_notes
  const fullRes = await supabase
    .from("orders")
    .select(`
      *,
      order_items (*),
      order_events (*),
      order_notes (*)
    `)
    .order("placed_at", { ascending: false });

  if (fullRes.error) {
    // 2. If order_notes relation is not yet in schema cache, fallback to order_items and order_events
    const withoutOrderNotesRes = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*),
        order_events (*)
      `)
      .order("placed_at", { ascending: false });

    if (withoutOrderNotesRes.error && withoutOrderNotesRes.error.code === "42501") {
      console.warn(
        "Supabase notice: Permission denied for child tables. Falling back to direct orders table query."
      );
      const fallbackRes = await supabase
        .from("orders")
        .select("*")
        .order("placed_at", { ascending: false });

      data = fallbackRes.data;
      error = fallbackRes.error;
    } else {
      data = withoutOrderNotesRes.data;
      error = withoutOrderNotesRes.error;
    }
  } else {
    data = fullRes.data;
    error = fullRes.error;
  }

  if (error) {
    console.error("Failed to fetch orders from database:", error);
    throw new Error(error.message || "Failed to fetch orders from database");
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  return data.map((d) => formatDbOrderRecord(d));
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER UPDATE & PERSISTENCE FUNCTIONS (DIRECT DATABASE ONLY)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateOrderInDb(
  updatedOrder: Order,
  syncItems: boolean = true
): Promise<Order> {
  const orderId = updatedOrder.id;

  const dbStatus =
    updatedOrder.status === "partially_delivered"
      ? "delivered"
      : updatedOrder.status;

  const calculatedSubtotal = (updatedOrder.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );
  const subtotal = updatedOrder.subtotal !== undefined ? Number(updatedOrder.subtotal) : calculatedSubtotal;
  const shippingTotal = Number(updatedOrder.shipping_total) || 0;
  const discountTotal = Number(updatedOrder.discount_total) || 0;
  const grandTotal = updatedOrder.grand_total !== undefined
    ? Number(updatedOrder.grand_total)
    : Math.max(0, subtotal - discountTotal + shippingTotal);

  // Deduplicate notes before updating DB
  const seenSaveKeys = new Set<string>();
  const deduplicatedNotes = (updatedOrder.notes || []).filter((n) => {
    const key = `${n.type || "internal"}:${(n.text || "").trim()}`;
    if (!n.text?.trim() || seenSaveKeys.has(key)) return false;
    seenSaveKeys.add(key);
    return true;
  });
  updatedOrder.notes = deduplicatedNotes;

  const normalizedPhone = updatedOrder.phone ? normalizeBdPhone(updatedOrder.phone) : null;

  const updatePayload: Record<string, any> = {
    customer_name: updatedOrder.customer ? updatedOrder.customer.trim() : null,
    customer_phone: normalizedPhone,
    customer_email: updatedOrder.email ? updatedOrder.email.trim() : null,
    status: dbStatus,
    payment_status: updatedOrder.payment,
    payment_method: updatedOrder.method || "cod",
    channel: updatedOrder.channel || "web",
    fulfillment_status: updatedOrder.fulfillment,
    shipping_total: shippingTotal,
    discount_total: discountTotal,
    subtotal: subtotal,
    grand_total: grandTotal,
    amount_paid: updatedOrder.amount_paid ?? 0,
    customer_note: updatedOrder.customer_note || null,
    attribution: {},
    cancel_reason: updatedOrder.cancel_reason || null,
    shipping_method_name: updatedOrder.courier_name || null,
    shipping_address: updatedOrder.address
      ? {
          division: updatedOrder.address.division || "",
          district: updatedOrder.address.district || "",
          address_line: updatedOrder.address.address_line || "",
          phone: normalizedPhone || updatedOrder.phone || "",
          recipient_name: updatedOrder.customer || "",
        }
      : undefined,
  };

  // Direct update to orders table (single source of truth)
  const { data: updatedDbOrders, error: updateErr } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("order_number", orderId)
    .select("id");

  if (updateErr) {
    console.error("Direct Supabase update error:", updateErr);
    throw new DatabaseOperationError(parseDatabaseError(updateErr));
  }

  if (!updatedDbOrders || updatedDbOrders.length === 0) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderId)
      .maybeSingle();

    if (existingOrder) {
      throw new DatabaseOperationError(
        parseDatabaseError({
          code: "0-ROWS-RLS",
          message: `Database Row-Level Security (RLS) policy prevented modifying order ${orderId}.`,
        })
      );
    }
  }

  let orderUuid = updatedDbOrders?.[0]?.id;
  if (!orderUuid) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderId)
      .maybeSingle();
    orderUuid = existingOrder?.id;
  }

  // 1. Sync line items in public.order_items if requested
  if (syncItems && Array.isArray(updatedOrder.items)) {
    if (orderUuid) {
      // 1. Delete existing items for this order
      const { error: delErr } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderUuid);

      if (delErr) {
        console.warn("Notice deleting existing order_items:", delErr);
      }

      // 2. Insert updated items if any
      if (updatedOrder.items.length > 0) {
        const itemRows = updatedOrder.items.map((it) => {
          const isUuid =
            typeof it.variant_id === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              it.variant_id
            );
          const qty = Math.max(1, Number(it.quantity) || 1);
          const price = Math.max(0, Number(it.unit_price) || 0);
          return {
            order_id: orderUuid,
            variant_id: isUuid ? it.variant_id : null,
            sku: it.sku || "SKU-ITEM",
            product_name: it.product_name || "Molasses Product",
            variant_name: it.variant_name || "Standard",
            quantity: qty,
            unit_price: price,
          };
        });

        const { data: insertedItems, error: insertErr } = await supabase
          .from("order_items")
          .insert(itemRows)
          .select();

        if (insertErr) {
          console.error("Direct Supabase order_items insert error:", insertErr);
          throw new Error(insertErr.message || "Failed to update order items in database");
        }

        if (insertedItems && insertedItems.length > 0) {
          updatedOrder.items = insertedItems.map((it: any, idx: number) => ({
            id: it.id || `item-${idx}`,
            sku: it.sku,
            product_name: it.product_name,
            variant_name: it.variant_name,
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            line_total: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
            variant_id: it.variant_id,
          }));
        }
      } else {
        updatedOrder.items = [];
      }
    }
  }

  // 2. Sync notes in public.order_notes table without destroying existing UUIDs
  if (orderUuid && Array.isArray(updatedOrder.notes)) {
    try {
      const newNotesToInsert = updatedOrder.notes.filter(
        (n) =>
          n &&
          n.text &&
          n.text.trim() &&
          n.type !== "customer" &&
          (!n.id ||
            n.id.startsWith("note-") ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(n.id))
      );

      if (newNotesToInsert.length > 0) {
        for (const n of newNotesToInsert) {
          const rawText = n.text.trim().replace(/^\[(Delivery|Packaging|Internal) Note\]\s*/i, "");
          const dbType =
            n.type === "delivery" || n.type === "delivery_note"
              ? "delivery"
              : n.type === "packaging" || n.type === "packaging_note"
              ? "packaging"
              : "internal";
          const notePayload = {
            order_id: orderUuid,
            order_number: orderId,
            type: dbType,
            author: n.author || "Admin Staff",
            note: rawText,
            created_at: n.created_at || new Date().toISOString(),
          };
          await supabase.from("order_notes").insert(notePayload);
        }
      }

      // Fetch fresh notes from DB to ensure exact UUIDs and domain types
      const { data: dbNotes } = await supabase
        .from("order_notes")
        .select("*")
        .or(`order_id.eq.${orderUuid},order_number.eq.${orderId}`)
        .order("created_at", { ascending: false });

      if (dbNotes) {
        updatedOrder.notes = dbNotes
          .filter((n: any) => n.type !== "customer")
          .map((n: any) => parseDbNoteToDomain(n, orderId));
      }
    } catch (noteErr) {
      console.warn("Notice updating order_notes:", noteErr);
    }
  }

  updatedOrder.subtotal = subtotal;
  updatedOrder.grand_total = grandTotal;
  return updatedOrder;
}

export async function updateOrderStatusInDb(
  orderId: string,
  newStatus: Order["status"],
  cancelReason?: string,
  eventMessage?: string,
  currentOrder?: Order,
  courierName?: string
): Promise<Order> {
  const nowIso = new Date().toISOString();
  const nowStr = nowIso.replace("T", " ").slice(0, 16);
  const detailParts: string[] = [];
  if (cancelReason) detailParts.push(`Reason: ${cancelReason}`);
  if (courierName) detailParts.push(`Courier: ${courierName}`);
  const detailsStr = detailParts.length > 0 ? ` (${detailParts.join(" | ")})` : "";

  const dbStatus = newStatus === "partially_delivered" ? "delivered" : newStatus;

  // Pre-validate transition if currentOrder is available
  if (currentOrder) {
    let val = validateOrderStatusTransition(
      currentOrder.status,
      newStatus,
      currentOrder.customer,
      currentOrder.phone,
      currentOrder.address?.address_line,
      currentOrder.items?.length
    );
    if (!val.valid) {
      // If currentOrder fails validation, it might be stale in client memory.
      // Re-validate against authoritative DB state before rejecting.
      const { data: dbOrder } = await supabase
        .from("orders")
        .select("status, customer_name, customer_phone, shipping_address, order_items(id)")
        .eq("order_number", orderId)
        .maybeSingle();

      if (dbOrder) {
        const liveVal = validateOrderStatusTransition(
          dbOrder.status,
          dbStatus,
          dbOrder.customer_name,
          dbOrder.customer_phone,
          dbOrder.shipping_address?.address_line,
          Array.isArray(dbOrder.order_items) ? dbOrder.order_items.length : 0
        );
        if (liveVal.valid) {
          val = liveVal;
        }
      }
    }
    if (!val.valid) {
      throw new DatabaseOperationError(
        parseDatabaseError({
          code: val.code || "P0001",
          message: `${val.reason} (${orderId})`,
          details: `Order ${orderId}: ${val.reason}`,
        })
      );
    }
  } else {
    // If currentOrder is omitted but transitioning to confirmed or higher, enforce DB checks
    const confirmedPos = STATUS_WORKFLOW_FLOW.indexOf("confirmed");
    const targetPos = STATUS_WORKFLOW_FLOW.indexOf(dbStatus as any);
    if (targetPos >= confirmedPos) {
      const { data: dbOrder } = await supabase
        .from("orders")
        .select("status, customer_name, customer_phone, shipping_address, order_items(id)")
        .eq("order_number", orderId)
        .maybeSingle();

      if (dbOrder) {
        const val = validateOrderStatusTransition(
          dbOrder.status,
          dbStatus,
          dbOrder.customer_name,
          dbOrder.customer_phone,
          dbOrder.shipping_address?.address_line,
          Array.isArray(dbOrder.order_items) ? dbOrder.order_items.length : 0
        );
        if (!val.valid) {
          throw new DatabaseOperationError(
            parseDatabaseError({
              code: val.code || "P0001",
              message: `${val.reason} (${orderId})`,
              details: `Order ${orderId}: ${val.reason}`,
            })
          );
        }
      }
    }
  }

  // 1. Prepare surgical status update payload (never overwrite customer or items with null)
  const statusPayload: Record<string, any> = {
    status: dbStatus,
    updated_at: nowIso,
  };

  if (courierName !== undefined) {
    statusPayload.shipping_method_name = courierName || null;
  }

  if (newStatus === "cancelled") {
    if (cancelReason) statusPayload.cancel_reason = cancelReason;
    statusPayload.cancelled_at = nowIso;
  } else if (newStatus === "confirmed") {
    statusPayload.confirmed_at = nowIso;
  } else if (newStatus === "shipped") {
    statusPayload.shipped_at = nowIso;
  } else if (newStatus === "delivered" || newStatus === "partially_delivered") {
    statusPayload.delivered_at = nowIso;
  }

  // 2. Perform direct targeted UPDATE on orders table
  const { data: updatedRows, error: updateErr } = await supabase
    .from("orders")
    .update(statusPayload)
    .eq("order_number", orderId)
    .select("id, order_number, status, customer_name, customer_phone, shipping_method_name, cancel_reason");

  if (updateErr) {
    console.error("Direct Supabase status update error:", updateErr);
    const parsed = parseDatabaseError(updateErr);
    throw new DatabaseOperationError(parsed);
  }

  // 3. Verify that the row was actually updated (detect silent RLS 0-row rejections)
  if (!updatedRows || updatedRows.length === 0) {
    const { data: existingRow } = await supabase
      .from("orders")
      .select("id, status")
      .eq("order_number", orderId)
      .maybeSingle();

    if (existingRow) {
      const rlsErr = parseDatabaseError({
        code: "0-ROWS-RLS",
        message: `Database Row-Level Security (RLS) policy prevented updating status for order ${orderId}.`,
        details: `Order exists with current status '${existingRow.status}', but RLS UPDATE policy evaluated to FALSE for the current session.`,
        hint: "Apply migration 20261028000001_fix_order_status_rls_and_workflow.sql in your Supabase SQL Editor.",
      });
      throw new DatabaseOperationError(rlsErr);
    } else {
      throw new DatabaseOperationError(
        parseDatabaseError({
          code: "404",
          message: `Order ${orderId} was not found in the database.`,
        })
      );
    }
  }

  const orderUuid = updatedRows[0].id;

  // 4. Record order timeline event in public.order_events
  const newEvent: OrderEvent = {
    id: `ev-${Date.now()}`,
    event_type: "status_changed",
    to_value: newStatus,
    message: eventMessage || `Order status updated to ${newStatus.toUpperCase()}${detailsStr}`,
    actor: "Admin Staff",
    created_at: formatDateTime(nowStr),
  };

  try {
    await supabase.from("order_events").insert({
      order_id: orderUuid,
      event_type: "status_changed",
      to_value: newStatus,
      message: eventMessage || `Order status updated to ${newStatus.toUpperCase()}${detailsStr}`,
    });
  } catch (eventErr) {
    console.warn("Could not insert order event into order_events:", eventErr);
  }

  // 5. Build and return the updated order object
  let baseOrder = currentOrder;
  if (!baseOrder || !baseOrder.customer) {
    try {
      const { data: fullData } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (*),
          order_events (*),
          order_notes (*)
        `)
        .eq("order_number", orderId)
        .maybeSingle();

      if (fullData) {
        baseOrder = formatDbOrderRecord(fullData);
      }
    } catch {
      // Fallback to minimal order
    }
  }

  const finalOrder: Order = {
    ...(baseOrder || ({} as Order)),
    id: orderId,
    status: newStatus,
    cancel_reason: newStatus === "cancelled" ? (cancelReason || baseOrder?.cancel_reason) : baseOrder?.cancel_reason,
    courier_name: courierName !== undefined ? courierName : baseOrder?.courier_name,
    events: [newEvent, ...(baseOrder?.events || [])],
  };

  return finalOrder;
}

function parseDbNoteToDomain(n: any, defaultOrderNumber: string): OrderNote {
  const rawText = (n.note || n.text || "").trim();
  let parsedType: OrderNoteType = "internal";
  let parsedText = rawText;

  if (n.type === "customer") {
    parsedType = "customer";
  } else if (n.type === "delivery" || n.type === "delivery_note") {
    parsedType = "delivery";
  } else if (n.type === "packaging" || n.type === "packaging_note") {
    parsedType = "packaging";
  } else {
    parsedType = "internal";
  }

  // Strip any remaining legacy third-bracket prefixes
  if (rawText.startsWith("[Delivery Note] ")) {
    parsedText = rawText.replace("[Delivery Note] ", "").trim();
  } else if (rawText.startsWith("[Packaging Note] ")) {
    parsedText = rawText.replace("[Packaging Note] ", "").trim();
  } else if (rawText.startsWith("[Internal Note] ")) {
    parsedText = rawText.replace("[Internal Note] ", "").trim();
  }

  return {
    id: String(n.id),
    order_id: String(n.order_id || ""),
    order_number: String(n.order_number || defaultOrderNumber || ""),
    author: n.author || "Admin Staff",
    text: parsedText,
    type: parsedType,
    created_at: formatDateTime(n.created_at || new Date().toISOString()),
  };
}

export async function addOrderNoteInDb(
  orderId: string,
  note: OrderNote,
  currentOrder?: Order
): Promise<Order> {
  const baseOrder =
    currentOrder ||
    (await fetchOrderByIdFromDb(orderId)) ||
    ({
      id: orderId,
      customer: "",
      phone: "",
      email: "",
      address: { division: "", district: "", address_line: "" },
      status: "pending",
      payment: "unpaid",
      fulfillment: "unfulfilled",
      method: "cod",
      channel: "web",
      subtotal: 0,
      discount_total: 0,
      shipping_total: 0,
      grand_total: 0,
      amount_paid: 0,
      currency: "BDT",
      date: formatDate(new Date()),
      items: [],
      notes: [],
      events: [],
    } as Order);

  const trimmedText = note.text.trim();
  const authorName = note.author || "Admin Staff";
  const nowIso = new Date().toISOString();

  // Resolve order UUID
  let orderUuid = (baseOrder as any).uuid || (baseOrder as any).db_id;
  if (!orderUuid) {
    const { data: ordRow } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderId)
      .maybeSingle();
    orderUuid = ordRow?.id;
  }

  // 1. Customer note: store in customer note column in order table
  if (note.type === "customer") {
    await supabase
      .from("orders")
      .update({ customer_note: trimmedText })
      .eq("order_number", orderId);

    // Clean up any customer note in order_notes
    if (orderUuid) {
      await supabase
        .from("order_notes")
        .delete()
        .eq("order_id", orderUuid)
        .eq("type", "customer");
    }
    await supabase
      .from("order_notes")
      .delete()
      .eq("order_number", orderId)
      .eq("type", "customer");

    baseOrder.customer_note = trimmedText;
    baseOrder.notes = (baseOrder.notes || []).filter((n) => n.type !== "customer");
    return baseOrder;
  }

  // 2. Rest of notes (internal, delivery, packaging): store directly in order_notes table
  const dbType =
    note.type === "delivery" || note.type === "delivery_note"
      ? "delivery"
      : note.type === "packaging" || note.type === "packaging_note"
      ? "packaging"
      : "internal";

  const cleanNoteText = trimmedText.replace(/^\[(Delivery|Packaging|Internal) Note\]\s*/i, "");

  const insertPayload = {
    order_id: orderUuid || null,
    order_number: orderId,
    type: dbType,
    author: authorName,
    note: cleanNoteText,
    created_at: nowIso,
  };

  const { data: insData, error: insErr } = await supabase
    .from("order_notes")
    .insert(insertPayload)
    .select();

  if (insErr) {
    console.error("Failed to insert order note into database:", insErr);
    throw new Error(insErr.message || "Failed to add note to database");
  }

  const insertedRow = insData?.[0];

  // Fetch updated notes from DB for this order
  const { data: dbNotes } = await supabase
    .from("order_notes")
    .select("*")
    .or(orderUuid ? `order_id.eq.${orderUuid},order_number.eq.${orderId}` : `order_number.eq.${orderId}`)
    .order("created_at", { ascending: false });

  if (dbNotes && dbNotes.length > 0) {
    baseOrder.notes = dbNotes
      .filter((n: any) => n.type !== "customer")
      .map((n: any) => parseDbNoteToDomain(n, orderId));
  } else if (insertedRow) {
    const parsed = parseDbNoteToDomain(insertedRow, orderId);
    baseOrder.notes = [parsed, ...(baseOrder.notes || []).filter((n) => n.id !== parsed.id)];
  }

  return baseOrder;
}

export async function updateOrderNoteInDb(
  orderId: string,
  noteId: string,
  updatedText: string,
  updatedType?: OrderNoteType,
  currentOrder?: Order
): Promise<Order> {
  const baseOrder =
    currentOrder ||
    (await fetchOrderByIdFromDb(orderId)) ||
    ({ id: orderId, notes: [] } as any as Order);

  const trimmed = updatedText.trim();
  const targetNote = (baseOrder.notes || []).find((n) => n.id === noteId);
  const finalType = updatedType || targetNote?.type || (noteId === "customer_note" ? "customer" : "internal");
  const nowIso = new Date().toISOString();

  let orderUuid = (baseOrder as any).uuid || (baseOrder as any).db_id;
  if (!orderUuid) {
    const { data: ordRow } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderId)
      .maybeSingle();
    orderUuid = ordRow?.id;
  }

  // Case 1: Editing Customer Note (noteId is "customer_note" or target was customer)
  if (noteId === "customer_note" || targetNote?.type === "customer") {
    if (finalType === "customer") {
      // Still customer note: update orders.customer_note
      await supabase
        .from("orders")
        .update({ customer_note: trimmed })
        .eq("order_number", orderId);

      // Clean up order_notes customer rows
      if (orderUuid) {
        await supabase.from("order_notes").delete().eq("order_id", orderUuid).eq("type", "customer");
      }
      await supabase.from("order_notes").delete().eq("order_number", orderId).eq("type", "customer");

      baseOrder.customer_note = trimmed;
      baseOrder.notes = (baseOrder.notes || []).filter((n) => n.id !== noteId && n.type !== "customer");
      return baseOrder;
    } else {
      // Changed from customer note to rest notes: clear customer_note and insert into order_notes
      await supabase
        .from("orders")
        .update({ customer_note: null })
        .eq("order_number", orderId);

      baseOrder.customer_note = "";
      return await addOrderNoteInDb(
        orderId,
        {
          id: `note-${Date.now()}`,
          author: "Admin Staff",
          text: trimmed,
          type: finalType,
          created_at: formatDateTime(nowIso),
        },
        baseOrder
      );
    }
  }

  // Case 2: Target was a non-customer note, but user changed it to Customer Note
  if (finalType === "customer") {
    // Delete the note row from order_notes
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId);
    if (isUuid) {
      await supabase.from("order_notes").delete().eq("id", noteId);
    } else if (targetNote) {
      await supabase
        .from("order_notes")
        .delete()
        .eq("order_number", orderId)
        .ilike("note", `%${targetNote.text.trim()}%`);
    }

    // Set on orders.customer_note
    await supabase
      .from("orders")
      .update({ customer_note: trimmed })
      .eq("order_number", orderId);

    baseOrder.customer_note = trimmed;

    // Refresh notes list from DB
    const { data: dbNotes } = await supabase
      .from("order_notes")
      .select("*")
      .or(orderUuid ? `order_id.eq.${orderUuid},order_number.eq.${orderId}` : `order_number.eq.${orderId}`)
      .order("created_at", { ascending: false });

    if (dbNotes) {
      baseOrder.notes = dbNotes
        .filter((n: any) => n.type !== "customer")
        .map((n: any) => parseDbNoteToDomain(n, orderId));
    } else {
      baseOrder.notes = (baseOrder.notes || []).filter((n) => n.id !== noteId);
    }
    return baseOrder;
  }

  // Case 3: Target is in order_notes table (Internal, Delivery, Packaging)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId);
  const cleanText = trimmed.replace(/^\[(Delivery|Packaging|Internal) Note\]\s*/i, "");
  const dbFinalType =
    finalType === "delivery" || finalType === "delivery_note"
      ? "delivery"
      : finalType === "packaging" || finalType === "packaging_note"
      ? "packaging"
      : "internal";

  if (isUuid) {
    const { error: updErr } = await supabase
      .from("order_notes")
      .update({
        note: cleanText,
        type: dbFinalType,
      })
      .eq("id", noteId);

    if (updErr) {
      console.error("Failed to update order note in DB:", updErr);
      throw new Error(updErr.message || "Failed to update note in database");
    }
  } else {
    // Non-UUID noteId: find matching row by note content or insert
    const { data: existingRows } = await supabase
      .from("order_notes")
      .select("id, note")
      .eq("order_number", orderId);

    const matchingRow = existingRows?.find((r) =>
      targetNote?.text ? r.note.includes(targetNote.text.trim()) : false
    );

    if (matchingRow) {
      await updateOrderNoteInDb(orderId, matchingRow.id, trimmed, finalType, baseOrder);
      return baseOrder;
    } else {
      return await addOrderNoteInDb(
        orderId,
        {
          id: noteId,
          author: targetNote?.author || "Admin Staff",
          text: trimmed,
          type: finalType,
          created_at: formatDateTime(nowIso),
        },
        baseOrder
      );
    }
  }

  // Refresh notes list from DB
  const { data: dbNotes } = await supabase
    .from("order_notes")
    .select("*")
    .or(orderUuid ? `order_id.eq.${orderUuid},order_number.eq.${orderId}` : `order_number.eq.${orderId}`)
    .order("created_at", { ascending: false });

  if (dbNotes && dbNotes.length > 0) {
    baseOrder.notes = dbNotes
      .filter((n: any) => n.type !== "customer")
      .map((n: any) => parseDbNoteToDomain(n, orderId));
  } else {
    baseOrder.notes = (baseOrder.notes || []).map((n) =>
      n.id === noteId ? { ...n, text: trimmed, type: finalType } : n
    );
  }

  return baseOrder;
}

export async function deleteOrderNoteInDb(
  orderId: string,
  noteId: string,
  currentOrder?: Order
): Promise<Order> {
  const baseOrder =
    currentOrder ||
    (await fetchOrderByIdFromDb(orderId)) ||
    ({ id: orderId, notes: [] } as any as Order);

  let orderUuid = (baseOrder as any).uuid || (baseOrder as any).db_id;
  if (!orderUuid) {
    const { data: ordRow } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderId)
      .maybeSingle();
    orderUuid = ordRow?.id;
  }

  const targetNote = (baseOrder.notes || []).find((n) => n.id === noteId);

  // 1. If deleting Customer Note (noteId is "customer_note" or targetNote was customer)
  if (noteId === "customer_note" || targetNote?.type === "customer") {
    await supabase
      .from("orders")
      .update({ customer_note: null })
      .eq("order_number", orderId);

    // Delete any customer note in order_notes table too
    if (orderUuid) {
      await supabase.from("order_notes").delete().eq("order_id", orderUuid).eq("type", "customer");
    }
    await supabase.from("order_notes").delete().eq("order_number", orderId).eq("type", "customer");

    baseOrder.customer_note = "";
    baseOrder.notes = (baseOrder.notes || []).filter((n) => n.id !== noteId && n.type !== "customer");
    return baseOrder;
  }

  // 2. If deleting a note from order_notes table
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId);

  if (isUuid) {
    await supabase.from("order_notes").delete().eq("id", noteId);
  } else if (targetNote) {
    // Fallback: match by note content and order
    await supabase
      .from("order_notes")
      .delete()
      .or(orderUuid ? `order_id.eq.${orderUuid},order_number.eq.${orderId}` : `order_number.eq.${orderId}`)
      .ilike("note", `%${targetNote.text.trim()}%`);
  }

  // Refresh notes list from DB
  const { data: dbNotes } = await supabase
    .from("order_notes")
    .select("*")
    .or(orderUuid ? `order_id.eq.${orderUuid},order_number.eq.${orderId}` : `order_number.eq.${orderId}`)
    .order("created_at", { ascending: false });

  if (dbNotes) {
    baseOrder.notes = dbNotes
      .filter((n: any) => n.type !== "customer")
      .map((n: any) => parseDbNoteToDomain(n, orderId));
  } else {
    baseOrder.notes = (baseOrder.notes || []).filter((n) => n.id !== noteId);
  }

  return baseOrder;
}

export async function updateCustomerNoteInDb(
  orderId: string,
  customerNoteText: string,
  currentOrder?: Order
): Promise<Order> {
  const baseOrder =
    currentOrder ||
    (await fetchOrderByIdFromDb(orderId)) ||
    ({ id: orderId, customer_note: "" } as any as Order);

  const trimmed = customerNoteText.trim();

  await supabase
    .from("orders")
    .update({ customer_note: trimmed || null })
    .eq("order_number", orderId);

  // Clean up any stale customer notes in order_notes
  await supabase
    .from("order_notes")
    .delete()
    .eq("order_number", orderId)
    .eq("type", "customer");

  baseOrder.customer_note = trimmed;
  baseOrder.notes = (baseOrder.notes || []).filter((n) => n.type !== "customer");
  return baseOrder;
}

export async function recordOrderPaymentInDb(
  orderId: string,
  amountPaid: number,
  paymentStatus: Order["payment"],
  paymentMethod?: Order["method"],
  transactionRef?: string,
  noteText?: string,
  currentOrder?: Order
): Promise<Order> {
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
  const paymentEvent: OrderEvent = {
    id: `ev-pay-${Date.now()}`,
    event_type: "payment_recorded",
    to_value: paymentStatus,
    message: `Payment updated: ৳ ${amountPaid.toLocaleString()} (${paymentStatus.replace("_", " ")})${transactionRef ? ` via ${transactionRef}` : ""}`,
    actor: "Admin Staff",
    created_at: formatDateTime(nowStr),
  };

  const newNotes = [...(currentOrder?.notes || [])];
  if (noteText && noteText.trim()) {
    newNotes.unshift({
      id: `note-pay-${Date.now()}`,
      author: "Admin Staff",
      text: `[Payment Record]: ${noteText.trim()}${transactionRef ? ` (Ref: ${transactionRef})` : ""}`,
      type: "internal",
      created_at: formatDateTime(nowStr),
    });
  }

  const baseOrder =
    currentOrder ||
    (await fetchOrderByIdFromDb(orderId)) ||
    ({
      id: orderId,
      customer: "",
      phone: "",
      email: "",
      address: { division: "", district: "", address_line: "" },
      status: "confirmed",
      payment: paymentStatus,
      fulfillment: "unfulfilled",
      method: paymentMethod || "cod",
      channel: "web",
      subtotal: 0,
      discount_total: 0,
      shipping_total: 0,
      grand_total: 0,
      amount_paid: amountPaid,
      currency: "BDT",
      date: nowStr,
      items: [],
      notes: [],
      events: [],
    } as Order);

  const updated: Order = {
    ...baseOrder,
    payment: paymentStatus,
    amount_paid: amountPaid,
    method: paymentMethod || baseOrder.method || "cod",
    notes: newNotes,
    events: [paymentEvent, ...(baseOrder.events || [])],
  };

  // Directly update orders table for payment columns (single source of truth)
  const orderPaymentUpdatePayload: Record<string, any> = {
    payment_status: paymentStatus,
    amount_paid: Number(amountPaid) || 0,
    updated_at: new Date().toISOString(),
  };
  if (paymentMethod) {
    orderPaymentUpdatePayload.payment_method = paymentMethod;
  }

  const { error: directPayErr } = await supabase
    .from("orders")
    .update(orderPaymentUpdatePayload)
    .eq("order_number", orderId);

  if (directPayErr) {
    console.error("Direct payment update error:", directPayErr);
  }

  return await updateOrderInDb(updated, false);
}

export async function deleteOrderInDb(orderId: string): Promise<boolean> {
  // Direct database DELETE
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("order_number", orderId);

  if (error) {
    console.warn("Direct delete failed, marking order as cancelled:", error);
    const { error: cancelError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: "Cancelled by Admin",
      })
      .eq("order_number", orderId);

    if (cancelError) {
      throw new Error(cancelError.message || "Failed to delete or cancel order in database");
    }
  }

  return true;
}

export async function bulkUpdateOrderStatusInDb(
  orderIds: string[],
  newStatus: Order["status"],
  batchNote?: string
): Promise<BulkStatusUpdateResult> {
  if (!orderIds || orderIds.length === 0) {
    return {
      success: true,
      totalRequested: 0,
      updatedCount: 0,
      skippedCount: 0,
      updatedOrderNumbers: [],
      skippedOrders: [],
    };
  }

  const nowIso = new Date().toISOString();
  const dbStatus = newStatus === "partially_delivered" ? "delivered" : newStatus;

  // 1. Fetch current orders from DB to validate workflow eligibility
  const { data: dbOrders, error: fetchErr } = await supabase
    .from("orders")
    .select("id, order_number, status, customer_name, customer_phone, shipping_address, order_items(id)")
    .in("order_number", orderIds);

  if (fetchErr) {
    console.error("Failed to query orders for bulk update:", fetchErr);
    throw new DatabaseOperationError(parseDatabaseError(fetchErr));
  }

  const ordersList = dbOrders || [];
  const eligibleOrders: typeof ordersList = [];
  const skippedOrders: { id: string; reason: string }[] = [];

  // Account for any IDs not found in DB
  const foundOrderNumbers = new Set(ordersList.map((o) => o.order_number));
  for (const id of orderIds) {
    if (!foundOrderNumbers.has(id)) {
      skippedOrders.push({ id, reason: "Order not found in database" });
    }
  }

  // Validate each order against the workflow transition rules
  for (const o of ordersList) {
    const itemCount = Array.isArray(o.order_items) ? o.order_items.length : 0;
    const addressLine = o.shipping_address?.address_line;
    const val = validateOrderStatusTransition(
      o.status,
      dbStatus,
      o.customer_name,
      o.customer_phone,
      addressLine,
      itemCount
    );

    if (val.valid) {
      eligibleOrders.push(o);
    } else {
      skippedOrders.push({
        id: o.order_number,
        reason: val.reason || "Ineligible for status transition",
      });
    }
  }

  // If none of the selected orders are eligible, throw a structured error with exact details
  if (eligibleOrders.length === 0) {
    const reasonSummary = skippedOrders.map((s) => `${s.id}: ${s.reason}`).join("; ");
    const primaryReason = skippedOrders[0]?.reason || "Cannot advance orders";
    const primaryCode = skippedOrders[0]?.reason?.includes("product item")
      ? "ORDER_ITEMS_REQUIRED"
      : skippedOrders[0]?.reason?.includes("Customer name")
      ? "CUSTOMER_NAME_REQUIRED"
      : skippedOrders[0]?.reason?.includes("phone")
      ? "CUSTOMER_PHONE_REQUIRED"
      : skippedOrders[0]?.reason?.includes("address")
      ? "CUSTOMER_ADDRESS_REQUIRED"
      : "INVALID_STATUS_TRANSITION";

    throw new DatabaseOperationError(
      parseDatabaseError({
        code: primaryCode,
        message: `${primaryReason} (Affecting: ${skippedOrders.map((s) => s.id).join(", ")})`,
        details: reasonSummary,
        hint: "Edit the affected orders to add required products, customer details, or verify workflow progression.",
      })
    );
  }

  // 2. Perform targeted update ONLY on the eligible orders
  const eligibleOrderNumbers = eligibleOrders.map((o) => o.order_number);
  const { data: updatedOrders, error: updateErr } = await supabase
    .from("orders")
    .update({
      status: dbStatus,
      updated_at: nowIso,
    })
    .in("order_number", eligibleOrderNumbers)
    .select("id, order_number");

  if (updateErr) {
    console.error("Failed to bulk update orders status in database:", updateErr);
    throw new DatabaseOperationError(parseDatabaseError(updateErr));
  }

  if (!updatedOrders || updatedOrders.length === 0) {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("order_number", eligibleOrderNumbers);

    if (count && count > 0) {
      throw new DatabaseOperationError(
        parseDatabaseError({
          code: "0-ROWS-RLS",
          message: `Database Row-Level Security (RLS) policy prevented bulk updating ${count} order(s).`,
          hint: "Ensure the user role has UPDATE permissions or apply migration 20261028000001_fix_order_status_rls_and_workflow.sql.",
        })
      );
    }
  }

  const actuallyUpdatedNumbers = (updatedOrders || []).map((o) => o.order_number);

  // 3. Insert batch notes if provided
  if (batchNote && batchNote.trim()) {
    const cleanNote = batchNote.trim();
    const noteRows = (updatedOrders || []).map((o) => ({
      order_id: o.id,
      order_number: o.order_number,
      type: "internal",
      author: "Admin Staff",
      note: `[Batch Status Update → ${newStatus.toUpperCase()}]: ${cleanNote}`,
      created_at: nowIso,
    }));

    if (noteRows.length > 0) {
      try {
        await supabase.from("order_notes").insert(noteRows);
      } catch (noteErr) {
        console.warn("Could not record batch note in order_notes:", noteErr);
      }
    }
  }

  // 4. Insert timeline events into public.order_events for each updated order
  if (updatedOrders && updatedOrders.length > 0) {
    try {
      const eventRows = updatedOrders.map((o) => ({
        order_id: o.id,
        event_type: "status_changed",
        to_value: newStatus,
        message: `Order status updated to ${newStatus.toUpperCase()} (Bulk Action)`,
      }));
      await supabase.from("order_events").insert(eventRows);
    } catch (eventErr) {
      console.warn("Could not record timeline events for bulk orders:", eventErr);
    }
  }

  return {
    success: true,
    totalRequested: orderIds.length,
    updatedCount: actuallyUpdatedNumbers.length,
    skippedCount: skippedOrders.length,
    updatedOrderNumbers: actuallyUpdatedNumbers,
    skippedOrders,
  };
}

export async function bulkAssignCourierInDb(
  orderIds: string[],
  courierName: string,
  batchNote?: string
): Promise<boolean> {
  if (!orderIds || orderIds.length === 0) return true;

  const nowIso = new Date().toISOString();

  // 1. Update courier on all orders
  const { data: updatedOrders, error: updateErr } = await supabase
    .from("orders")
    .update({
      shipping_method_name: courierName,
      updated_at: nowIso,
    })
    .in("order_number", orderIds)
    .select("id, order_number");

  if (updateErr) {
    console.error("Failed to bulk assign courier:", updateErr);
    throw new Error(updateErr.message || "Failed to bulk assign courier in database");
  }

  // 2. If batch note provided, insert into public.order_notes
  if (batchNote && batchNote.trim()) {
    const cleanNote = batchNote.trim();
    const ordersMap = updatedOrders || [];

    const noteRows = ordersMap.map((o) => ({
      order_id: o.id,
      order_number: o.order_number,
      type: "internal",
      author: "Admin Staff",
      note: `[Courier Assigned → ${courierName}]: ${cleanNote}`,
      created_at: nowIso,
    }));

    if (noteRows.length > 0) {
      try {
        await supabase.from("order_notes").insert(noteRows);
      } catch (noteErr) {
        console.warn("Could not record batch courier note:", noteErr);
      }
    }
  }

  return true;
}

export async function bulkDeleteOrdersInDb(orderIds: string[]): Promise<boolean> {
  if (!orderIds || orderIds.length === 0) return true;

  const { error } = await supabase
    .from("orders")
    .delete()
    .in("order_number", orderIds);

  if (error) {
    console.warn("Bulk delete failed, falling back to cancel:", error);
    const { error: cancelError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: "Bulk cancelled by Admin",
      })
      .in("order_number", orderIds);

    if (cancelError) {
      throw new Error(cancelError.message || "Failed to bulk delete or cancel orders");
    }
  }

  return true;
}

export async function fetchOrdersByIdsFromDb(orderNumbers: string[]): Promise<Order[]> {
  if (!orderNumbers || orderNumbers.length === 0) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (*),
      order_events (*),
      order_notes (*)
    `)
    .in("order_number", orderNumbers)
    .order("placed_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching orders by ids:", error);
    return [];
  }

  return data.map((d) => formatDbOrderRecord(d));
}

export async function fetchOrderByIdFromDb(orderNumber: string): Promise<Order | null> {
  if (!orderNumber) return null;
  const orders = await fetchOrdersByIdsFromDb([orderNumber]);
  return orders[0] || null;
}
