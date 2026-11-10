"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
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

    // Validate combo variants across params.variants before step 1 writes anything
    for (const v of params.variants) {
      if (v.is_combo) {
        if (!v.combo_items || v.combo_items.length === 0) {
          return {
            success: false,
            error: `Combo variant "${v.name}" must have at least one component.`,
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

/**
 * Server Action: Updates the sort order of products in bulk and syncs storefront cache.
 */
export async function updateProductsSortOrderAction(
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseAdmin || supabase;
  if (!orderedIds || orderedIds.length === 0) {
    return { success: false, error: "No product IDs provided." };
  }

  try {
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
    const { data: rawVariants, error } = await supabaseAdmin
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
        inventory_levels:inventory_levels (quantity_on_hand)
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const variants: AdminVariantItem[] = (rawVariants || []).map((v: any) => {
      const prodName = v.products?.name || "Product";
      const stockLevels = Array.isArray(v.inventory_levels) ? v.inventory_levels : [];
      const totalQty = stockLevels.reduce(
        (acc: number, cur: any) => acc + Number(cur.quantity_on_hand || 0),
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
    const { data: rawTiers, error } = await supabaseAdmin
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


