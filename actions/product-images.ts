"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { getImageKitServer, isImageKitConfigured } from "@/lib/imagekit/server";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";

export interface ProductImageItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  alt_text_bn: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  product: {
    id: string;
    name: string;
    name_bn: string | null;
    slug: string;
    category_id: string | null;
  } | null;
}

export interface ProductOption {
  id: string;
  name: string;
  name_bn: string | null;
  slug: string;
}

/**
 * Fetches all product images from PostgreSQL joined with their parent products,
 * resolving public CDN URLs for both ImageKit and legacy Supabase assets.
 */
export async function fetchProductImagesAction(): Promise<{
  success: boolean;
  images: ProductImageItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("product_images")
      .select(`
        id,
        product_id,
        variant_id,
        storage_path,
        alt_text,
        alt_text_bn,
        sort_order,
        is_primary,
        created_at,
        product:products(id, name, name_bn, slug, category_id)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchProductImagesAction query error:", error);
      return { success: false, images: [], error: error.message };
    }

    const images: ProductImageItem[] = (data || []).map((img: any) => {
      const pubUrl = resolveCdnImageUrl(img.storage_path);

      return {
        id: img.id,
        product_id: img.product_id,
        variant_id: img.variant_id,
        storage_path: img.storage_path,
        public_url: pubUrl,
        alt_text: img.alt_text,
        alt_text_bn: img.alt_text_bn,
        sort_order: img.sort_order ?? 0,
        is_primary: Boolean(img.is_primary),
        created_at: img.created_at,
        product: img.product || null,
      };
    });

    return { success: true, images };
  } catch (err: any) {
    console.error("fetchProductImagesAction exception:", err);
    return { success: false, images: [], error: err?.message || "Failed to load product images" };
  }
}

/**
 * Fetches simplified product list for the image assignment dropdown.
 */
export async function fetchProductsForImageAssignmentAction(): Promise<ProductOption[]> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, name, name_bn, slug")
      .order("name", { ascending: true });

    if (error) {
      console.warn("fetchProductsForImageAssignmentAction error:", error);
      return [];
    }

    return (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      name_bn: p.name_bn,
      slug: p.slug,
    }));
  } catch (err) {
    console.warn("fetchProductsForImageAssignmentAction exception:", err);
    return [];
  }
}

/**
 * Sets an image as the primary cover for its product.
 * Enforces the unique partial index by clearing is_primary on previous images first.
 */
export async function setPrimaryProductImageAction(payload: {
  imageId: string;
  productId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const { imageId, productId } = payload;
    if (!isValidUuid(imageId) || !isValidUuid(productId)) {
      return { success: false, error: "Invalid imageId or productId" };
    }
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Clear previous primary flag for this product
    const { error: resetError } = await supabaseAdmin
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);

    if (resetError) {
      console.error("Failed to reset primary image status:", resetError);
      return { success: false, error: resetError.message };
    }

    // 2. Set the target image as primary
    const { error: updateError } = await supabaseAdmin
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", imageId);

    if (updateError) {
      console.error("Failed to set primary image:", updateError);
      return { success: false, error: updateError.message };
    }

    revalidatePath("/admin/products/images");
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("setPrimaryProductImageAction exception:", err);
    return { success: false, error: err?.message || "Failed to set primary image" };
  }
}

/**
 * Updates alt text (SEO & accessibility) for a product image.
 */
export async function updateProductImageAltTextAction(payload: {
  imageId: string;
  altText?: string;
  altTextBn?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const { imageId, altText, altTextBn } = payload;
    if (!isValidUuid(imageId)) {
      return { success: false, error: "Valid image ID required" };
    }
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from("product_images")
      .update({
        alt_text: altText?.trim() || null,
        alt_text_bn: altTextBn?.trim() || null,
      })
      .eq("id", imageId);

    if (error) {
      console.error("Failed to update alt text:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/products/images");
    return { success: true };
  } catch (err: any) {
    console.error("updateProductImageAltTextAction exception:", err);
    return { success: false, error: err?.message || "Failed to update alt text" };
  }
}

/**
 * Removes an image from public.product_images.
 * If the deleted image was primary, automatically promotes the next image to primary.
 */
export async function deleteProductImageAction(payload: {
  imageId: string;
  productId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const { imageId, productId } = payload;
    if (!isValidUuid(imageId) || (productId && !isValidUuid(productId))) {
      return { success: false, error: "Valid image ID required" };
    }
    const supabaseAdmin = getSupabaseAdmin();

    // Check if this image was primary
    const { data: targetImg } = await supabaseAdmin
      .from("product_images")
      .select("is_primary")
      .eq("id", imageId)
      .single();

    const wasPrimary = Boolean(targetImg?.is_primary);

    // Delete image row
    const { error: delError } = await supabaseAdmin
      .from("product_images")
      .delete()
      .eq("id", imageId);

    if (delError) {
      console.error("Failed to delete product image:", delError);
      return { success: false, error: delError.message };
    }

    // If was primary, promote remaining image if any
    if (wasPrimary && productId) {
      const { data: remaining } = await supabaseAdmin
        .from("product_images")
        .select("id")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true })
        .limit(1);

      if (remaining && remaining.length > 0) {
        await supabaseAdmin
          .from("product_images")
          .update({ is_primary: true })
          .eq("id", remaining[0].id);
      }
    }

    revalidatePath("/admin/products/images");
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("deleteProductImageAction exception:", err);
    return { success: false, error: err?.message || "Failed to delete product image" };
  }
}

/**
 * Inserts one or more newly uploaded images into public.product_images for a given product.
 */
export async function assignNewProductImagesAction(payload: {
  productId: string;
  images: Array<{
    storagePath: string;
    altText?: string;
    altTextBn?: string;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const { productId, images } = payload;
    if (!isValidUuid(productId) || !images || images.length === 0) {
      return { success: false, count: 0, error: "Valid Product ID and at least one image are required." };
    }
    const supabaseAdmin = getSupabaseAdmin();

    // Check if the product already has any images or an existing primary image
    const { data: existingImages } = await supabaseAdmin
      .from("product_images")
      .select("id, is_primary, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: false });

    const hasExistingPrimary = (existingImages || []).some((img) => img.is_primary);
    const maxSortOrder = (existingImages || []).reduce((max, img) => Math.max(max, img.sort_order ?? 0), 0);

    const hasNewPrimary = images.some((img) => img.isPrimary);

    // If a new image is requested as primary, clear existing primary
    if (hasNewPrimary && hasExistingPrimary) {
      await supabaseAdmin
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId);
    }

    const rowsToInsert = images.map((img, idx) => {
      // If product has no primary image at all, mark the first uploaded image as primary
      const shouldBePrimary = img.isPrimary || (!hasExistingPrimary && idx === 0 && !hasNewPrimary);

      return {
        product_id: productId,
        storage_path: img.storagePath,
        alt_text: img.altText?.trim() || null,
        alt_text_bn: img.altTextBn?.trim() || null,
        sort_order: (img.sortOrder ?? maxSortOrder + idx + 1),
        is_primary: shouldBePrimary,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from("product_images")
      .insert(rowsToInsert);

    if (insertError) {
      console.error("Failed to insert product images:", insertError);
      return { success: false, count: 0, error: insertError.message };
    }

    revalidatePath("/admin/products/images");
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { success: true, count: rowsToInsert.length };
  } catch (err: any) {
    console.error("assignNewProductImagesAction exception:", err);
    return { success: false, count: 0, error: err?.message || "Failed to assign images to product" };
  }
}

export interface ImageKitMediaItem {
  fileId: string;
  name: string;
  filePath: string;
  url: string;
  thumbnailUrl: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: string;
  assignedProduct?: {
    id: string;
    name: string;
    slug: string;
    isPrimary: boolean;
  } | null;
}

/**
 * Fetches all media files directly from ImageKit storage library,
 * joining them with any catalog products they are assigned to.
 */
export async function fetchImageKitMediaAction(): Promise<{
  success: boolean;
  files: ImageKitMediaItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    if (!isImageKitConfigured()) {
      return { success: false, files: [], error: "ImageKit credentials are not configured in .env" };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const ik = getImageKitServer();
    const [rawFiles, dbImagesRes] = await Promise.all([
      ik.listFiles({ limit: 100, sort: "DESC_CREATED" } as any),
      supabaseAdmin
        .from("product_images")
        .select("id, product_id, storage_path, is_primary, product:products(id, name, slug)"),
    ]);

    // Build lookup map of storage_path to assigned product
    const assignedMap = new Map<string, { id: string; name: string; slug: string; isPrimary: boolean }>();
    if (dbImagesRes.data) {
      for (const row of dbImagesRes.data) {
        if (row.storage_path && row.product) {
          const prod = row.product as any;
          assignedMap.set(row.storage_path, {
            id: prod.id,
            name: prod.name,
            slug: prod.slug,
            isPrimary: Boolean(row.is_primary),
          });
          const fileName = row.storage_path.split("/").pop();
          if (fileName) {
            assignedMap.set(fileName, {
              id: prod.id,
              name: prod.name,
              slug: prod.slug,
              isPrimary: Boolean(row.is_primary),
            });
          }
        }
      }
    }

    const files: ImageKitMediaItem[] = (Array.isArray(rawFiles) ? rawFiles : []).map((f: any) => {
      const assigned =
        assignedMap.get(f.url) ||
        assignedMap.get(f.filePath) ||
        assignedMap.get(f.name) ||
        null;

      return {
        fileId: f.fileId,
        name: f.name,
        filePath: f.filePath,
        url: f.url,
        thumbnailUrl: f.thumbnail || f.thumbnailUrl || f.url,
        size: f.size || 0,
        width: f.width,
        height: f.height,
        createdAt: f.createdAt,
        assignedProduct: assigned,
      };
    });

    return { success: true, files };
  } catch (err: any) {
    console.error("fetchImageKitMediaAction exception:", err);
    return { success: false, files: [], error: err?.message || "Failed to load ImageKit media files" };
  }
}

/**
 * Deletes a file directly from ImageKit storage library by its fileId.
 */
export async function deleteImageKitFileAction(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    if (!fileId || !fileId.trim()) return { success: false, error: "Missing fileId" };
    const ik = getImageKitServer();
    await ik.deleteFile(fileId.trim());
    revalidatePath("/admin/products/images");
    return { success: true };
  } catch (err: any) {
    console.error("deleteImageKitFileAction exception:", err);
    return { success: false, error: err?.message || "Failed to delete file from ImageKit" };
  }
}

/**
 * Links an existing ImageKit storage file directly to a catalog product.
 */
export async function linkImageKitFileToProductAction(payload: {
  productId: string;
  url: string;
  altText?: string;
  isPrimary?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const { productId, url, altText, isPrimary } = payload;
    if (!isValidUuid(productId) || !url) {
      return { success: false, error: "Valid Product ID and Image URL are required" };
    }
    const supabaseAdmin = getSupabaseAdmin();

    if (isPrimary) {
      await supabaseAdmin
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId);
    }

    const { error } = await supabaseAdmin.from("product_images").insert({
      product_id: productId,
      storage_path: url,
      alt_text: altText?.trim() || null,
      is_primary: Boolean(isPrimary),
      sort_order: 0,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/products/images");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to link ImageKit file to product" };
  }
}

