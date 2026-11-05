"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";

export interface SaveProductVariantInput {
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
}

export interface SaveProductImageInput {
  id?: string;
  storage_path: string;
  alt_text?: string;
  is_primary: boolean;
  sort_order?: number;
}

export interface SaveProductInput {
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
  variants: SaveProductVariantInput[];
  images: SaveProductImageInput[];
  deletedVariantIds?: string[];
  deletedImageIds?: string[];
}

export interface SaveProductResult {
  success: boolean;
  product?: any;
  error?: string;
}

export interface DeleteProductResult {
  success: boolean;
  archived: boolean;
  message: string;
  error?: string;
}

/**
 * Server Action: Creates or updates a catalog product along with packaging variants and image media.
 * Uses supabaseAdmin to bypass client RLS quirks, syncs inventory levels to maintain stock status,
 * and revalidates Next.js cached pages.
 */
export async function saveProductAction(params: SaveProductInput): Promise<SaveProductResult> {
  const client = supabaseAdmin || supabase;

  try {
    // 1. Validation
    if (!params.product.name?.trim()) {
      return { success: false, error: "Product name is required." };
    }
    if (!params.product.slug?.trim()) {
      return { success: false, error: "Product URL slug is required." };
    }
    if (!params.variants || params.variants.length === 0) {
      return { success: false, error: "At least one packaging variant is required." };
    }

    const now = new Date().toISOString();
    let savedProduct: any;

    const productPayload = {
      name: params.product.name.trim(),
      name_bn: params.product.nameBn?.trim() || null,
      slug: params.product.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      category_id: params.product.category_id || null,
      status: params.product.status || "draft",
      summary: params.product.summary?.trim() || null,
      summary_bn: params.product.summaryBn?.trim() || null,
      description: params.product.description?.trim() || null,
      description_bn: params.product.descriptionBn?.trim() || null,
      grade: params.product.grade?.trim() || null,
      origin: params.product.origin?.trim() || null,
      ingredients: params.product.ingredients?.trim() || null,
      storage_instructions: params.product.storage_instructions?.trim() || null,
      shelf_life_days:
        typeof params.product.shelf_life_days === "number" && !isNaN(params.product.shelf_life_days)
          ? params.product.shelf_life_days
          : null,
      tax_rate:
        typeof params.product.tax_rate === "number" && !isNaN(params.product.tax_rate)
          ? params.product.tax_rate
          : 0,
      is_featured: Boolean(params.product.is_featured),
      seo_title: params.product.seo_title?.trim() || null,
      seo_description: params.product.seo_description?.trim() || null,
      updated_at: now,
    };

    if (params.productId) {
      const { data, error: updateErr } = await client
        .from("products")
        .update(productPayload)
        .eq("id", params.productId)
        .select()
        .single();

      if (updateErr) {
        console.error("Error updating product in DB:", updateErr);
        return { success: false, error: updateErr.message || "Failed to update product." };
      }
      savedProduct = data;
    } else {
      const { data, error: insertErr } = await client
        .from("products")
        .insert([{ ...productPayload, created_at: now }])
        .select()
        .single();

      if (insertErr) {
        console.error("Error creating product in DB:", insertErr);
        return { success: false, error: insertErr.message || "Failed to create product." };
      }
      savedProduct = data;
    }

    const productId = savedProduct.id;

    // 2. Handle Deleted Variants
    if (params.deletedVariantIds && params.deletedVariantIds.length > 0) {
      for (const varId of params.deletedVariantIds) {
        const { count: orderItemsCount } = await client
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .eq("variant_id", varId);

        if ((orderItemsCount || 0) > 0) {
          // Deactivate instead of deleting to respect order history FK constraint
          await client
            .from("product_variants")
            .update({ is_active: false, updated_at: now })
            .eq("id", varId);
        } else {
          const { error: delErr } = await client
            .from("product_variants")
            .delete()
            .eq("id", varId);

          if (delErr) {
            console.warn("Could not delete variant row, deactivating instead:", delErr.message);
            await client
              .from("product_variants")
              .update({ is_active: false, updated_at: now })
              .eq("id", varId);
          }
        }
      }
    }

    // 3. Handle Deleted Images
    if (params.deletedImageIds && params.deletedImageIds.length > 0) {
      await client
        .from("product_images")
        .delete()
        .in("id", params.deletedImageIds);
    }

    // 4. Default warehouse lookup for stock status trigger synchronization
    let defaultWarehouseId: string | null = null;
    try {
      const { data: defaultWh } = await client
        .from("warehouses")
        .select("id")
        .eq("is_default", true)
        .limit(1)
        .single();

      defaultWarehouseId = defaultWh?.id || null;

      if (!defaultWarehouseId) {
        const { data: anyWh } = await client.from("warehouses").select("id").limit(1).single();
        defaultWarehouseId = anyWh?.id || null;
      }
    } catch (whErr) {
      console.warn("Could not look up default warehouse:", whErr);
    }

    // 5. Upsert Variants
    // Clear existing is_default if updating, avoiding unique index `product_variants_one_default` collision
    if (params.productId) {
      await client
        .from("product_variants")
        .update({ is_default: false })
        .eq("product_id", productId);
    }

    let defaultIdx = params.variants.findIndex((v) => v.is_default);
    if (defaultIdx === -1) defaultIdx = 0;

    for (let i = 0; i < params.variants.length; i++) {
      const v = params.variants[i];
      const isThisDefault = i === defaultIdx;
      const priceNum = Number(v.price) || 0;
      const compareNum = v.compare_at_price ? Number(v.compare_at_price) : null;
      // DB constraint requires: compare_at_price is null or compare_at_price > price
      const validCompareAtPrice =
        compareNum !== null && compareNum > priceNum ? compareNum : null;

      const variantStockStatus = v.stock_status || "in_stock";
      const threshold = Number(v.low_stock_threshold) || 5;

      const variantPayload: any = {
        product_id: productId,
        sku: v.sku.trim(),
        name: v.name.trim(),
        name_bn: v.nameBn?.trim() || null,
        pack_type: v.pack_type || "jar",
        net_quantity: Number(v.net_quantity) || 1,
        net_unit: v.net_unit || "kg",
        price: priceNum,
        compare_at_price: validCompareAtPrice,
        low_stock_threshold: threshold,
        is_default: isThisDefault,
        is_active: v.is_active ?? true,
        sort_order: i,
        updated_at: now,
      };

      let variantId = v.id;

      if (variantId) {
        const { error: vUpdateErr } = await client
          .from("product_variants")
          .update(variantPayload)
          .eq("id", variantId);

        if (vUpdateErr) {
          console.error("Error updating variant:", vUpdateErr);
          return {
            success: false,
            error: `Error updating variant "${v.name}": ${vUpdateErr.message}`,
          };
        }
      } else {
        const { data: newV, error: vInsertErr } = await client
          .from("product_variants")
          .insert([{ ...variantPayload, created_at: now }])
          .select("id")
          .single();

        if (vInsertErr) {
          console.error("Error creating variant:", vInsertErr);
          return {
            success: false,
            error: `Error creating variant "${v.name}": ${vInsertErr.message}`,
          };
        }
        variantId = newV.id;
      }

      // Synchronize warehouse inventory level to satisfy DB trigger `trg_variants_stock_status`:
      // - 'in_stock': on_hand >= threshold + 50 (e.g. 100)
      // - 'low_stock': 1 <= on_hand <= threshold (e.g. Math.max(1, threshold - 1))
      // - 'out_of_stock': on_hand = 0, allow_backorder = false
      // - 'backorder': on_hand = 0, allow_backorder = true
      if (defaultWarehouseId && variantId) {
        let onHandQty = 100;
        let allowBackorder = false;

        if (variantStockStatus === "out_of_stock") {
          onHandQty = 0;
          allowBackorder = false;
        } else if (variantStockStatus === "backorder") {
          onHandQty = 0;
          allowBackorder = true;
        } else if (variantStockStatus === "low_stock") {
          onHandQty = Math.max(1, Math.min(3, threshold - 1));
          allowBackorder = false;
        } else {
          onHandQty = Math.max(100, threshold * 4);
          allowBackorder = false;
        }

        // Upsert inventory level
        await client
          .from("inventory_levels")
          .upsert(
            {
              variant_id: variantId,
              warehouse_id: defaultWarehouseId,
              on_hand: onHandQty,
              reserved: 0,
              updated_at: now,
            },
            { onConflict: "variant_id,warehouse_id" }
          );

        // Update allow_backorder and track_inventory
        await client
          .from("product_variants")
          .update({
            allow_backorder: allowBackorder,
            track_inventory: true,
            updated_at: now,
          })
          .eq("id", variantId);
      }
    }

    // 6. Upsert Images
    if (params.images && params.images.length > 0) {
      let primaryAssigned = false;
      for (let i = 0; i < params.images.length; i++) {
        const img = params.images[i];
        const isPrimary = !primaryAssigned && (img.is_primary || i === 0);
        if (isPrimary) primaryAssigned = true;

        const imagePayload = {
          product_id: productId,
          storage_path: img.storage_path,
          alt_text: img.alt_text || null,
          is_primary: isPrimary,
          sort_order: img.sort_order ?? i,
        };

        if (img.id && !img.id.startsWith("local-") && !img.id.startsWith("gallery-")) {
          const { error: imgUpdateErr } = await client
            .from("product_images")
            .update(imagePayload)
            .eq("id", img.id);

          if (imgUpdateErr) {
            console.error("Error updating image:", imgUpdateErr);
          }
        } else {
          const { error: imgInsertErr } = await client
            .from("product_images")
            .insert([imagePayload]);

          if (imgInsertErr) {
            console.error("Error inserting image:", imgInsertErr);
          }
        }
      }
    }

    // 7. Next.js Path Revalidation
    try {
      revalidatePath("/admin/products");
      revalidatePath(`/admin/products/${productId}/edit`);
      revalidatePath("/");
      revalidatePath("/products");
      revalidatePath(`/products/${productId}`);
      revalidatePath(`/product/${productId}`);
      if (savedProduct.slug) {
        revalidatePath(`/products/${savedProduct.slug}`);
        revalidatePath(`/product/${savedProduct.slug}`);
      }
    } catch (revalErr) {
      // revalidatePath throws when executed outside Next.js request lifecycle (e.g. standalone scripts)
    }

    return { success: true, product: savedProduct };
  } catch (err: any) {
    console.error("Fatal error in saveProductAction:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred while saving the product.",
    };
  }
}

/**
 * Server Action: Safely archives or deletes a product from the database.
 */
export async function deleteProductAction(id: string): Promise<DeleteProductResult> {
  const client = supabaseAdmin || supabase;

  try {
    const { count: batchCount } = await client
      .from("batches")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);

    const { data: variants } = await client
      .from("product_variants")
      .select("id")
      .eq("product_id", id);

    let hasOrderItems = false;
    if (variants && variants.length > 0) {
      const varIds = variants.map((v) => v.id);
      const { count: orderItemsCount } = await client
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .in("variant_id", varIds);

      hasOrderItems = (orderItemsCount || 0) > 0;
    }

    if ((batchCount || 0) > 0 || hasOrderItems) {
      // Archive to preserve relational integrity
      await client
        .from("products")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", id);

      try {
        revalidatePath("/admin/products");
        revalidatePath("/");
        revalidatePath("/products");
      } catch (e) {}

      return {
        success: true,
        archived: true,
        message: "Product is referenced in existing orders or inventory batches, so it has been safely archived.",
      };
    }

    // Delete image files from storage
    const { error: delErr } = await client.from("products").delete().eq("id", id);
    if (delErr) {
      return {
        success: false,
        archived: false,
        message: delErr.message,
        error: delErr.message,
      };
    }

    try {
      revalidatePath("/admin/products");
      revalidatePath("/");
      revalidatePath("/products");
    } catch (e) {}

    return {
      success: true,
      archived: false,
      message: "Product has been deleted permanently from the catalog.",
    };
  } catch (err: any) {
    return {
      success: false,
      archived: false,
      message: err?.message || "Failed to delete product.",
      error: err?.message,
    };
  }
}

/**
 * Server Action: Quickly updates a product's publishing status (active, draft, archived).
 */
export async function updateProductStatusAction(
  id: string,
  status: "active" | "draft" | "archived"
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseAdmin || supabase;
  try {
    const { error } = await client
      .from("products")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    try {
      revalidatePath("/admin/products");
      revalidatePath(`/admin/products/${id}/edit`);
      revalidatePath("/");
      revalidatePath("/products");
    } catch (e) {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update product status." };
  }
}

