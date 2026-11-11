"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import type { DbProduct } from "@/lib/supabase/types";
import type { UiProductItem, UiProductVariantItem } from "@/lib/supabase/api";

export type { UiProductItem, UiProductVariantItem };

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
  initial_stock_status?: string;
  stock_status_changed?: boolean;
  track_inventory?: boolean;
  low_stock_threshold?: number;
  is_default?: boolean;
  is_active?: boolean;
  is_combo?: boolean;
  combo_items?: Array<{
    component_variant_id: string;
    quantity: number;
    sort_order?: number;
  }>;
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
    sort_order?: number;
    seo_title?: string;
    seo_description?: string;
    google_product_category?: string | null;
    product_type?: string | null;
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
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const client = getSupabaseAdmin();

    // 1. Validation
    if (params.productId && !isValidUuid(params.productId)) {
      return { success: false, error: "Invalid product ID." };
    }
    if (params.product.category_id && !isValidUuid(params.product.category_id)) {
      return { success: false, error: "Invalid category ID." };
    }
    if ((params.deletedVariantIds || []).some((id) => !isValidUuid(id))) {
      return { success: false, error: "Invalid deleted variant ID." };
    }
    if ((params.deletedImageIds || []).some((id) => !isValidUuid(id))) {
      return { success: false, error: "Invalid deleted image ID." };
    }
    if (!params.product.name?.trim()) {
      return { success: false, error: "Product name is required." };
    }
    if (!params.product.slug?.trim()) {
      return { success: false, error: "Product URL slug is required." };
    }
    if (!params.variants || params.variants.length === 0) {
      return { success: false, error: "At least one packaging variant is required." };
    }

    // Validate combo variants across params.variants before step 1 writes anything
    for (const v of params.variants) {
      if (v.id && !isValidUuid(v.id)) {
        return { success: false, error: `Invalid variant ID for "${v.name}".` };
      }
      if (v.is_combo) {
        if (!v.combo_items || v.combo_items.length === 0) {
          return {
            success: false,
            error: `Combo variant "${v.name}" must have at least one component.`,
          };
        }
        if (v.combo_items.some((ci) => !isValidUuid(ci.component_variant_id))) {
          return {
            success: false,
            error: `Combo variant "${v.name}" contains an invalid component variant ID.`,
          };
        }
        const compIds = v.combo_items.map((ci) => ci.component_variant_id);
        if (v.id && compIds.some((cid) => cid === v.id)) {
          return {
            success: false,
            error: `Combo variant "${v.name}" cannot include itself as a component.`,
          };
        }
        if (new Set(compIds).size !== compIds.length) {
          return {
            success: false,
            error: `Combo variant "${v.name}" has duplicate component items. Each component must be unique.`,
          };
        }
      }
    }

    const now = new Date().toISOString();
    let savedProduct: any;

    let initialSortOrder = 0;
    if (!params.productId) {
      const { data: maxRow } = await client
        .from("products")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      initialSortOrder = (maxRow?.sort_order ?? 0) + 1;
    }

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
      google_product_category: params.product.google_product_category?.trim() || null,
      product_type: params.product.product_type?.trim() || null,
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
        .insert([{ ...productPayload, sort_order: initialSortOrder, created_at: now }])
        .select()
        .single();

      if (insertErr) {
        console.error("Error creating product in DB:", insertErr);
        return { success: false, error: insertErr.message || "Failed to create product." };
      }
      savedProduct = data;
    }

    const productId = savedProduct.id;

    // Apply explicit sort_order if provided, shifting sibling products atomically
    if (typeof params.product.sort_order === "number" && params.product.sort_order > 0) {
      const targetOrder = Math.max(1, Math.floor(params.product.sort_order));
      const { error: rpcErr } = await client.rpc("set_product_sort_order", {
        p_product_id: productId,
        p_new_order: targetOrder,
      });
      if (rpcErr) {
        console.warn("Could not call set_product_sort_order RPC, direct updating:", rpcErr);
        await client
          .from("products")
          .update({ sort_order: targetOrder, updated_at: now })
          .eq("id", productId);
      }
    }

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
            .eq("id", varId)
            .eq("product_id", productId);
        } else {
          const { error: delErr } = await client
            .from("product_variants")
            .delete()
            .eq("id", varId)
            .eq("product_id", productId);

          if (delErr) {
            console.warn("Could not delete variant row, deactivating instead:", delErr.message);
            await client
              .from("product_variants")
              .update({ is_active: false, updated_at: now })
              .eq("id", varId)
              .eq("product_id", productId);
          }
        }
      }
    }

    // 3. Handle Deleted Images
    if (params.deletedImageIds && params.deletedImageIds.length > 0) {
      await client
        .from("product_images")
        .delete()
        .in("id", params.deletedImageIds)
        .eq("product_id", productId);
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
      const { error: clearDefaultErr } = await client
        .from("product_variants")
        .update({ is_default: false })
        .eq("product_id", productId);
      if (clearDefaultErr) {
        console.warn("Could not reset previous is_default variants:", clearDefaultErr.message);
      }
    }

    let defaultIdx = params.variants.findIndex((v) => Boolean(v.is_default));
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

      const isComboVariant = Boolean(v.is_combo);

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
        is_combo: isComboVariant,
        sort_order: i,
        updated_at: now,
      };

      let variantId = v.id;
      let previousStockStatus: string | null = null;

      if (variantId) {
        const { data: existingVar } = await client
          .from("product_variants")
          .select("stock_status")
          .eq("id", variantId)
          .maybeSingle();
        previousStockStatus = existingVar?.stock_status ?? null;

        const { error: vUpdateErr } = await client
          .from("product_variants")
          .update(variantPayload)
          .eq("id", variantId)
          .eq("product_id", productId);

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

      // Synchronize combo_items if this variant is a combo
      if (isComboVariant && variantId) {
        // Preserve prior recipe rows for safe rollback
        const { data: priorRecipeRows, error: fetchPriorErr } = await client
          .from("combo_items")
          .select("combo_variant_id, component_variant_id, quantity, sort_order")
          .eq("combo_variant_id", variantId);

        if (fetchPriorErr) {
          return {
            success: false,
            error: `Failed to inspect prior combo items: ${fetchPriorErr.message}`,
          };
        }

        // Remove existing items first and check for delete failure
        const { error: ciDelErr } = await client.from("combo_items").delete().eq("combo_variant_id", variantId);
        if (ciDelErr) {
          return {
            success: false,
            error: `Failed to remove prior combo recipe items: ${ciDelErr.message}`,
          };
        }

        if (v.combo_items && v.combo_items.length > 0) {
          const comboRows = v.combo_items.map((ci, idx) => ({
            combo_variant_id: variantId,
            component_variant_id: ci.component_variant_id,
            quantity: Number(ci.quantity) || 1,
            sort_order: ci.sort_order ?? idx,
          }));
          const { error: ciErr } = await client.from("combo_items").insert(comboRows);
          if (ciErr) {
            // Restore prior recipe on failure
            if (priorRecipeRows && priorRecipeRows.length > 0) {
              await client.from("combo_items").insert(priorRecipeRows);
            }
            return {
              success: false,
              error: `Error inserting combo items: ${ciErr.message}`,
            };
          }
        }

        // Calculate dynamic virtual stock for this combo
        const { data: virtStock } = await client.rpc("get_combo_variant_available_stock", {
          p_combo_variant_id: variantId,
        });

        const availableUnits = Number(virtStock) || 0;
        if (defaultWarehouseId) {
          const { data: existingLevel } = await client
            .from("inventory_levels")
            .select("reserved")
            .eq("variant_id", variantId)
            .eq("warehouse_id", defaultWarehouseId)
            .maybeSingle();

          await client
            .from("inventory_levels")
            .upsert(
              {
                variant_id: variantId,
                warehouse_id: defaultWarehouseId,
                on_hand: availableUnits,
                reserved: existingLevel?.reserved ?? 0,
                updated_at: now,
              },
              { onConflict: "variant_id,warehouse_id" }
            );

          await client
            .from("product_variants")
            .update({
              allow_backorder: false,
              track_inventory: true,
              stock_status: availableUnits > threshold ? "in_stock" : availableUnits > 0 ? "low_stock" : "out_of_stock",
              updated_at: now,
            })
            .eq("id", variantId);
        }
      } else if (variantId) {
        // If it was changed from a combo to a regular variant, remove any previous combo_items
        await client.from("combo_items").delete().eq("combo_variant_id", variantId);

        // Standard warehouse inventory level synchronization
        if (defaultWarehouseId) {
          const { data: existingLevel } = await client
            .from("inventory_levels")
            .select("on_hand, reserved")
            .eq("variant_id", variantId)
            .eq("warehouse_id", defaultWarehouseId)
            .maybeSingle();

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

          if (!existingLevel) {
            // Initialize on_hand only for brand new row
            const { error: insLevelErr } = await client.from("inventory_levels").insert({
              variant_id: variantId,
              warehouse_id: defaultWarehouseId,
              on_hand: onHandQty,
              reserved: 0,
              updated_at: now,
            });
            if (insLevelErr) {
              return {
                success: false,
                error: `Failed to initialize inventory level for variant "${v.name}": ${insLevelErr.message}`,
              };
            }
          } else {
            // Apply calculated onHandQty only when stock status selection has changed, preserving reserved value
            const hasStockStatusChanged =
              v.stock_status_changed !== undefined
                ? v.stock_status_changed
                : v.initial_stock_status !== undefined
                ? variantStockStatus !== v.initial_stock_status
                : previousStockStatus !== null && variantStockStatus !== previousStockStatus;

            const updatePayload: Record<string, any> = {
              updated_at: now,
            };

            if (hasStockStatusChanged) {
              updatePayload.on_hand = onHandQty;
            }

            const { error: updLevelErr } = await client
              .from("inventory_levels")
              .update(updatePayload)
              .eq("variant_id", variantId)
              .eq("warehouse_id", defaultWarehouseId);

            if (updLevelErr) {
              return {
                success: false,
                error: `Failed to update inventory level for variant "${v.name}": ${updLevelErr.message}`,
              };
            }
          }

          // Update allow_backorder and track_inventory
          const { error: updVarErr } = await client
            .from("product_variants")
            .update({
              allow_backorder: allowBackorder,
              track_inventory: true,
              updated_at: now,
            })
            .eq("id", variantId);

          if (updVarErr) {
            return {
              success: false,
              error: `Failed to update variant stock settings for "${v.name}": ${updVarErr.message}`,
            };
          }
        }
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

        if (img.id && isValidUuid(img.id)) {
          const { error: imgUpdateErr } = await client
            .from("product_images")
            .update(imagePayload)
            .eq("id", img.id)
            .eq("product_id", productId);

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

    // 7. Next.js Path Revalidation & Cache Update
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
      try {
        updateTag("storefront-products");
        revalidateTag("storefront-products", "max");
      } catch (tagErr) {
        // Tag revalidation may not be applicable outside request lifecycle
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
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    if (!isValidUuid(id)) {
      return { success: false, archived: false, message: "Invalid product ID.", error: "Invalid product ID." };
    }
    const client = getSupabaseAdmin();
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
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    if (!isValidUuid(id)) {
      return { success: false, error: "Invalid product ID." };
    }
    const client = getSupabaseAdmin();
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

/**
 * Server Action: Updates the sort order of products in bulk and syncs storefront cache.
 */
export async function updateProductsSortOrderAction(
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    if (!orderedIds || orderedIds.length === 0) {
      return { success: false, error: "No product IDs provided." };
    }
    if (orderedIds.some((id) => !isValidUuid(id))) {
      return { success: false, error: "Invalid product ID in sort list." };
    }
    const client = getSupabaseAdmin();
    const { error } = await client.rpc("reorder_products", {
      p_ordered_ids: orderedIds,
    });

    if (error) {
      console.warn("RPC reorder_products failed, falling back to batch update:", error);
      for (let i = 0; i < orderedIds.length; i++) {
        await client
          .from("products")
          .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
          .eq("id", orderedIds[i]);
      }
    }

    try {
      revalidatePath("/admin/products");
      revalidatePath("/");
      revalidatePath("/products");
      try {
        updateTag("storefront-products");
        revalidateTag("storefront-products", "max");
      } catch {}
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to reorder products:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update product order.",
    };
  }
}

export interface AdminVariantItem {
  id: string;
  product: string;
  sku: string;
  barcode: string;
  title: string;
  packType: string;
  size: string;
  weight: string;
  costPrice: string;
  retailPrice: string;
  wholesalePrice: string;
  stock: "in_stock" | "low_stock" | "out_of_stock";
  stockQty: number;
  active: boolean;
}

export async function getAdminVariantsAction(): Promise<{
  success: boolean;
  data: AdminVariantItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const client = getSupabaseAdmin();
    const { data: rawVariants, error } = await client
      .from("product_variants")
      .select(
        `
        id,
        sku,
        barcode,
        name,
        pack_type,
        net_quantity,
        net_unit,
        weight_grams,
        price,
        compare_at_price,
        stock_status,
        is_active,
        products:product_id (name),
        inventory_levels:inventory_levels (on_hand)
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const variants: AdminVariantItem[] = (rawVariants || []).map((v: any) => {
      const prodName = v.products?.name || "Product";
      const stockLevels = Array.isArray(v.inventory_levels) ? v.inventory_levels : [];
      const totalQty = stockLevels.reduce(
        (acc: number, cur: any) => acc + Number(cur.on_hand || 0),
        0
      );

      let stockVal: "in_stock" | "low_stock" | "out_of_stock" = "in_stock";
      if (v.stock_status === "out_of_stock" || totalQty <= 0) stockVal = "out_of_stock";
      else if (v.stock_status === "low_stock" || totalQty <= 5) stockVal = "low_stock";

      return {
        id: v.id,
        product: prodName,
        sku: v.sku,
        barcode: v.barcode || "N/A",
        title: v.name,
        packType: v.pack_type || "jar",
        size: `${v.net_quantity} ${v.net_unit}`,
        weight: `${(Number(v.weight_grams || 0) / 1000).toFixed(1)} kg`,
        costPrice: `৳ ${(Number(v.price || 0) * 0.75).toFixed(0)}`,
        retailPrice: `৳ ${Number(v.price || 0).toLocaleString()}`,
        wholesalePrice: `৳ ${(Number(v.compare_at_price || v.price || 0) * 0.9).toFixed(0)}`,
        stock: stockVal,
        stockQty: totalQty,
        active: v.is_active ?? true,
      };
    });

    return { success: true, data: variants };
  } catch (error: any) {
    console.error("getAdminVariantsAction error:", error);
    return { success: false, error: error.message || "Failed to load variants", data: [] };
  }
}

export interface AdminPriceTierItem {
  id: string;
  product: string;
  sku: string;
  tierRange: string;
  minQty: number;
  unitPrice: string;
  discount: string;
  businessType: string;
  status: "active" | "inactive";
}

export async function getAdminPriceTiersAction(): Promise<{
  success: boolean;
  data: AdminPriceTierItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const client = getSupabaseAdmin();
    const { data: rawTiers, error } = await client
      .from("price_tiers")
      .select(
        `
        id,
        min_qty,
        unit_price,
        product_variants:variant_id (
          sku,
          name,
          price,
          products:product_id (name)
        )
      `
      )
      .order("min_qty", { ascending: true });

    if (error) throw error;

    const tiers: AdminPriceTierItem[] = (rawTiers || []).map((t: any) => {
      const v = t.product_variants || {};
      const prodName = v.products?.name || v.name || "Molasses Product";
      const basePrice = Number(v.price || t.unit_price);
      const tierPrice = Number(t.unit_price);
      const discountPct = basePrice > tierPrice ? (((basePrice - tierPrice) / basePrice) * 100).toFixed(1) : 0;

      return {
        id: t.id,
        product: prodName,
        sku: v.sku || "SKU-VAR",
        tierRange: `${t.min_qty}+ units`,
        minQty: Number(t.min_qty),
        unitPrice: `৳ ${tierPrice.toLocaleString()}`,
        discount: Number(discountPct) > 0 ? `${discountPct}% OFF` : "Base Retail Price",
        businessType: Number(t.min_qty) >= 10 ? "Wholesale & Mill Accounts" : "All Accounts",
        status: "active",
      };
    });

    return { success: true, data: tiers };
  } catch (error: any) {
    console.error("getAdminPriceTiersAction error:", error);
    return { success: false, error: error.message || "Failed to load price tiers", data: [] };
  }
}


export async function getAdminProductsAction(): Promise<UiProductItem[]> {
  await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
  const client = getSupabaseAdmin();

  const { data: productsData, error: prodErr } = await client
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (prodErr) {
    throw new Error(prodErr.message || "Failed to fetch products.");
  }
  if (!productsData || productsData.length === 0) {
    return [];
  }

  const { data: catData } = await client.from("categories").select("id, name");
  const categoryMap = new Map<string, string>();
  if (catData) {
    catData.forEach((c) => categoryMap.set(c.id, c.name));
  }

  const { data: variantsData } = await client
    .from("product_variants")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const variantListMap = new Map<string, UiProductVariantItem[]>();
  const variantCountMap = new Map<
    string,
    { count: number; minPrice: number; maxPrice: number; stock: string }
  >();

  if (variantsData) {
    for (const v of variantsData) {
      const item: UiProductVariantItem = {
        id: v.id,
        productId: v.product_id,
        sku: v.sku,
        barcode: v.barcode || null,
        name: v.name,
        nameBn: v.name_bn || null,
        packType: v.pack_type || "jar",
        netQuantity: Number(v.net_quantity) || 0,
        netUnit: v.net_unit || "kg",
        weightGrams: v.weight_grams ? Number(v.weight_grams) : undefined,
        price: Number(v.price) || 0,
        compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : null,
        stockStatus: (v.stock_status as UiProductVariantItem["stockStatus"]) || "in_stock",
        isActive: v.is_active ?? true,
        isDefault: Boolean(v.is_default),
        isCombo: Boolean(v.is_combo),
      };

      const existing = variantListMap.get(v.product_id) || [];
      existing.push(item);
      variantListMap.set(v.product_id, existing);

      const priceNum = Number(v.price) || 0;
      const cur = variantCountMap.get(v.product_id) || {
        count: 0,
        minPrice: priceNum,
        maxPrice: priceNum,
        stock: v.stock_status || "in_stock",
      };
      cur.count += 1;
      if (cur.count === 1) {
        cur.minPrice = priceNum;
        cur.maxPrice = priceNum;
      } else {
        if (priceNum < cur.minPrice) cur.minPrice = priceNum;
        if (priceNum > cur.maxPrice) cur.maxPrice = priceNum;
      }
      if (v.stock_status === "out_of_stock" && cur.stock === "in_stock") {
        cur.stock = "out_of_stock";
      }
      variantCountMap.set(v.product_id, cur);
    }
  }

  const { data: imagesData } = await client
    .from("product_images")
    .select("id, product_id, storage_path, is_primary, sort_order")
    .order("sort_order", { ascending: true });

  const imageMap = new Map<string, string>();
  if (imagesData) {
    for (const img of imagesData) {
      if (!imageMap.has(img.product_id) || img.is_primary) {
        const pubUrl = resolveCdnImageUrl(img.storage_path);
        if (pubUrl) {
          imageMap.set(img.product_id, pubUrl);
        }
      }
    }
  }

  return productsData.map((p) => {
    const vInfo = variantCountMap.get(p.id) || {
      count: 0,
      minPrice: 0,
      maxPrice: 0,
      stock: "in_stock",
    };
    return {
      id: p.id,
      name: p.name,
      nameBn: p.name_bn || "",
      slug: p.slug,
      category: (p.category_id && categoryMap.get(p.category_id)) || "General Molasses",
      categoryId: p.category_id,
      status: p.status as "active" | "draft" | "archived",
      variants: vInfo.count,
      variantList: variantListMap.get(p.id) || [],
      stock: (vInfo.stock as UiProductItem["stock"]) || "in_stock",
      rating: Number(p.rating_avg) || 0,
      reviews: p.rating_count || 0,
      featured: Boolean(p.is_featured),
      sortOrder: typeof p.sort_order === "number" ? p.sort_order : 0,
      basePrice: vInfo.minPrice || 0,
      maxPrice: vInfo.maxPrice || vInfo.minPrice || 0,
      imageUrl: imageMap.get(p.id) || null,
      grade: p.grade || null,
      createdAt: p.created_at,
    };
  });
}

export async function getAdminProductByIdAction(id: string): Promise<DbProduct | null> {
  await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
  if (!isValidUuid(id)) {
    return null;
  }

  const client = getSupabaseAdmin();
  const { data: product, error: prodErr } = await client
    .from("products")
    .select("*, category:categories(*)")
    .eq("id", id)
    .maybeSingle();

  if (prodErr || !product) {
    return null;
  }

  const { data: variants } = await client
    .from("product_variants")
    .select("*")
    .eq("product_id", id)
    .order("sort_order", { ascending: true });

  const variantList = variants || [];
  const comboVariantIds = variantList.filter((v) => v.is_combo).map((v) => v.id);
  const comboMap = new Map<string, any[]>();

  if (comboVariantIds.length > 0) {
    const { data: comboRows, error: comboErr } = await client
      .from("combo_items")
      .select("*, component:product_variants!combo_items_component_variant_id_fkey(*, product:products(name, name_bn))")
      .in("combo_variant_id", comboVariantIds)
      .order("sort_order", { ascending: true });

    if (comboErr) {
      throw new Error(`Failed to fetch combo recipe items: ${comboErr.message}`);
    }

    if (comboRows) {
      for (const row of comboRows as any[]) {
        const list = comboMap.get(row.combo_variant_id) || [];
        list.push({
          id: row.id,
          component_variant_id: row.component_variant_id,
          quantity: Number(row.quantity) || 1,
          sort_order: row.sort_order,
          product_name: row.component?.product?.name,
          product_name_bn: row.component?.product?.name_bn,
          variant_name: row.component?.name,
          variant_name_bn: row.component?.name_bn,
          unit_price: Number(row.component?.price) || 0,
          weight_grams: row.component?.weight_grams ? Number(row.component.weight_grams) : undefined,
          pack_type: row.component?.pack_type,
        });
        comboMap.set(row.combo_variant_id, list);
      }
    }
  }

  const enhancedVariants = variantList.map((v) => ({
    ...v,
    is_combo: Boolean(v.is_combo),
    combo_items: comboMap.get(v.id) || [],
  }));

  const { data: images } = await client
    .from("product_images")
    .select("*")
    .eq("product_id", id)
    .order("sort_order", { ascending: true });

  const mappedImages = (images || []).map((img) => ({
    ...img,
    public_url: resolveCdnImageUrl(img.storage_path),
  }));

  return {
    ...product,
    variants: enhancedVariants,
    images: mappedImages,
  } as unknown as DbProduct;
}

export async function createDraftProductAction(payload: {
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
  await assertStaffRole(["owner", "admin", "manager", "editor"]);
  if (!payload.name?.trim() || !payload.slug?.trim()) {
    throw new Error("Product name and slug are required.");
  }
  if (payload.category_id && !isValidUuid(payload.category_id)) {
    throw new Error("Invalid category ID.");
  }

  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("products")
    .insert([
      {
        name: payload.name.trim(),
        name_bn: payload.nameBn?.trim() || null,
        slug: payload.slug.trim(),
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

  if (error) {
    throw new Error(error.message || "Failed to create product.");
  }

  try {
    revalidatePath("/admin/products");
  } catch {
    // Ignore outside request lifecycle
  }

  return data;
}
