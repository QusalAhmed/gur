"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";

export interface ComboComponentDetail {
  id: string;
  componentVariantId: string;
  productId: string;
  productName: string;
  productNameBn?: string;
  variantName: string;
  variantNameBn?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  weightGrams?: number;
  packType?: string;
  physicalStock: number;
  otherCombosCount: number;
  otherCombosNames: string[];
}

export interface ComboItemView {
  id: string; // product id
  variantId: string; // combo variant id
  name: string;
  nameBn?: string;
  slug: string;
  status: "active" | "draft" | "archived";
  sku: string;
  image?: string;
  price: number;
  compareAtPrice?: number | null;
  regularTotal: number;
  savingsAmount: number;
  savingsPct: number;
  virtualStock: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  bottleneckComponent?: {
    productName: string;
    variantName: string;
    availableStock: number;
  };
  components: ComboComponentDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveComboInput {
  comboProductId?: string; // If editing existing
  comboVariantId?: string;
  name: string;
  nameBn?: string;
  slug?: string;
  status: "active" | "draft";
  price: number;
  compareAtPrice?: number | null;
  imagePath?: string;
  components: Array<{
    componentVariantId: string;
    quantity: number;
  }>;
}

/**
 * Server Action: Fetches all combo products along with their full component recipes,
 * physical warehouse stock, and cross-combo usage mappings.
 */
export async function fetchCombosListAction(): Promise<ComboItemView[]> {
  const client = supabaseAdmin || supabase;

  try {
    // 1. Fetch default warehouse id
    const { data: defaultWh } = await client
      .from("warehouses")
      .select("id")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    const warehouseId = defaultWh?.id;

    // 2. Fetch all variants flagged as combo
    const { data: comboVariants, error: cvErr } = await client
      .from("product_variants")
      .select(`
        id,
        product_id,
        sku,
        name,
        name_bn,
        price,
        compare_at_price,
        stock_status,
        created_at,
        updated_at,
        product:products (
          id,
          name,
          name_bn,
          slug,
          status,
          created_at,
          updated_at
        )
      `)
      .eq("is_combo", true)
      .order("created_at", { ascending: false });

    if (cvErr || !comboVariants || comboVariants.length === 0) {
      return [];
    }

    const comboVariantIds = comboVariants.map((v) => v.id);
    const productIds = Array.from(new Set(comboVariants.map((v) => v.product_id)));

    // 3. Fetch primary images for combo products
    const { data: images } = await client
      .from("product_images")
      .select("product_id, storage_path, is_primary")
      .in("product_id", productIds)
      .order("is_primary", { ascending: false });

    const imageMap = new Map<string, string>();
    if (images) {
      for (const img of images) {
        if (!imageMap.has(img.product_id)) {
          imageMap.set(img.product_id, resolveCdnImageUrl(img.storage_path));
        }
      }
    }

    // 4. Fetch all combo_items for these combo variants
    const { data: comboItems, error: ciErr } = await client
      .from("combo_items")
      .select(`
        id,
        combo_variant_id,
        component_variant_id,
        quantity,
        sort_order,
        component:product_variants!combo_items_component_variant_id_fkey (
          id,
          sku,
          name,
          name_bn,
          price,
          weight_grams,
          pack_type,
          product_id,
          product:products (
            id,
            name,
            name_bn
          )
        )
      `)
      .in("combo_variant_id", comboVariantIds)
      .order("sort_order", { ascending: true });

    if (ciErr) {
      console.error("Error fetching combo items:", ciErr.message || ciErr);
    }

    // 5. Gather all component variant IDs to fetch inventory levels
    const allComponentVariantIds = Array.from(
      new Set((comboItems || []).map((ci) => ci.component_variant_id))
    );

    const stockMap = new Map<string, number>();
    if (warehouseId && allComponentVariantIds.length > 0) {
      const { data: invData } = await client
        .from("inventory_levels")
        .select("variant_id, on_hand, reserved")
        .eq("warehouse_id", warehouseId)
        .in("variant_id", allComponentVariantIds);

      if (invData) {
        for (const inv of invData) {
          const available = Math.max(0, (Number(inv.on_hand) || 0) - (Number(inv.reserved) || 0));
          stockMap.set(inv.variant_id, available);
        }
      }
    }

    // 6. Build reverse mapping: component_variant_id -> other combos that use it
    // comboVariantMap: combo_variant_id -> combo product name
    const comboNameMap = new Map<string, string>();
    for (const cv of comboVariants) {
      const p = (cv as any).product;
      comboNameMap.set(cv.id, p?.name || cv.name);
    }

    const componentToCombosMap = new Map<string, Array<{ comboVariantId: string; comboName: string }>>();
    if (comboItems) {
      for (const ci of comboItems) {
        const cName = comboNameMap.get(ci.combo_variant_id) || "Combo";
        const existing = componentToCombosMap.get(ci.component_variant_id) || [];
        existing.push({ comboVariantId: ci.combo_variant_id, comboName: cName });
        componentToCombosMap.set(ci.component_variant_id, existing);
      }
    }

    // 7. Group combo items by combo_variant_id
    const comboItemsByVariant = new Map<string, any[]>();
    if (comboItems) {
      for (const ci of comboItems) {
        const list = comboItemsByVariant.get(ci.combo_variant_id) || [];
        list.push(ci);
        comboItemsByVariant.set(ci.combo_variant_id, list);
      }
    }

    // 8. Assemble result views
    const results: ComboItemView[] = [];

    for (const cv of comboVariants) {
      const prod = (cv as any).product;
      if (!prod) continue;

      const rawItems = comboItemsByVariant.get(cv.id) || [];
      let regularTotal = 0;
      let minAvailablePacks = rawItems.length > 0 ? Infinity : 0;
      let bottleneckComp: { productName: string; variantName: string; availableStock: number } | undefined;

      const components: ComboComponentDetail[] = [];

      for (const ci of rawItems) {
        const compVariant = ci.component;
        const compProduct = compVariant?.product;
        const compPrice = Number(compVariant?.price) || 0;
        const compQty = Number(ci.quantity) || 1;
        const lineTotal = compPrice * compQty;
        regularTotal += lineTotal;

        const currentPhysicalStock = stockMap.get(ci.component_variant_id) ?? 0;
        const possiblePacks = Math.floor(currentPhysicalStock / compQty);

        if (possiblePacks < minAvailablePacks) {
          minAvailablePacks = possiblePacks;
          bottleneckComp = {
            productName: compProduct?.name || "Component",
            variantName: compVariant?.name || "",
            availableStock: currentPhysicalStock,
          };
        }

        // Shared usage in OTHER combos
        const allUsage = componentToCombosMap.get(ci.component_variant_id) || [];
        const otherUsage = allUsage.filter((u) => u.comboVariantId !== cv.id);

        components.push({
          id: ci.id,
          componentVariantId: ci.component_variant_id,
          productId: compVariant?.product_id || "",
          productName: compProduct?.name || "Unknown Product",
          productNameBn: compProduct?.name_bn,
          variantName: compVariant?.name || "Standard",
          variantNameBn: compVariant?.name_bn,
          sku: compVariant?.sku || "",
          quantity: compQty,
          unitPrice: compPrice,
          lineTotal,
          weightGrams: compVariant?.weight_grams ? Number(compVariant.weight_grams) : undefined,
          packType: compVariant?.pack_type || "jar",
          physicalStock: currentPhysicalStock,
          otherCombosCount: otherUsage.length,
          otherCombosNames: otherUsage.map((u) => u.comboName),
        });
      }

      if (minAvailablePacks === Infinity) minAvailablePacks = 0;

      const comboPrice = Number(cv.price) || 0;
      const savingsAmount = Math.max(0, regularTotal - comboPrice);
      const savingsPct = regularTotal > 0 ? Math.round((savingsAmount / regularTotal) * 100) : 0;

      results.push({
        id: prod.id,
        variantId: cv.id,
        name: prod.name,
        nameBn: prod.name_bn,
        slug: prod.slug,
        status: (prod.status as any) || "draft",
        sku: cv.sku,
        image: imageMap.get(prod.id),
        price: comboPrice,
        compareAtPrice: cv.compare_at_price ? Number(cv.compare_at_price) : regularTotal > comboPrice ? regularTotal : null,
        regularTotal,
        savingsAmount,
        savingsPct,
        virtualStock: minAvailablePacks,
        stockStatus: cv.stock_status || (minAvailablePacks > 0 ? "in_stock" : "out_of_stock"),
        bottleneckComponent: bottleneckComp,
        components,
        createdAt: prod.created_at || cv.created_at,
        updatedAt: prod.updated_at || cv.updated_at,
      });
    }

    return results;
  } catch (error) {
    console.error("Error in fetchCombosListAction:", error);
    return [];
  }
}

/**
 * Server Action: Creates or updates a combo and its component recipe.
 */
export async function saveComboAction(input: SaveComboInput): Promise<{
  success: boolean;
  comboId?: string;
  error?: string;
}> {
  const client = supabaseAdmin || supabase;
  const now = new Date().toISOString();

  try {
    if (!input.name.trim()) {
      return { success: false, error: "Combo name is required." };
    }
    if (!input.components || input.components.length === 0) {
      return { success: false, error: "A combo must contain at least one product component." };
    }

    // 1. Get default warehouse
    const { data: defaultWh } = await client
      .from("warehouses")
      .select("id")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    const warehouseId = defaultWh?.id;

    // 2. Generate slug if not provided
    const cleanSlug =
      input.slug?.trim() ||
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");

    let productId = input.comboProductId;
    let variantId = input.comboVariantId;

    if (productId) {
      // Update existing product
      const { error: pErr } = await client
        .from("products")
        .update({
          name: input.name.trim(),
          name_bn: input.nameBn?.trim() || null,
          slug: cleanSlug,
          status: input.status,
          updated_at: now,
        })
        .eq("id", productId);

      if (pErr) throw new Error(pErr.message);
    } else {
      // Insert new product
      const { data: newProd, error: pErr } = await client
        .from("products")
        .insert([
          {
            name: input.name.trim(),
            name_bn: input.nameBn?.trim() || null,
            slug: cleanSlug,
            status: input.status,
            summary: "Special Promotional Combo Offer",
            summary_bn: "স্পেশাল কম্বো অফার প্যাকেজ",
            created_at: now,
            updated_at: now,
          },
        ])
        .select("id")
        .single();

      if (pErr || !newProd) throw new Error(pErr?.message || "Failed to create combo product");
      productId = newProd.id;
    }

    // 3. Upsert combo variant
    const skuCode = `CMB-${cleanSlug.toUpperCase().slice(0, 8)}-${Date.now().toString().slice(-4)}`;

    if (variantId) {
      const { error: vErr } = await client
        .from("product_variants")
        .update({
          name: input.name.trim(),
          name_bn: input.nameBn?.trim() || null,
          price: input.price,
          compare_at_price: input.compareAtPrice && input.compareAtPrice > input.price ? input.compareAtPrice : null,
          is_combo: true,
          is_active: input.status === "active",
          updated_at: now,
        })
        .eq("id", variantId);

      if (vErr) throw new Error(vErr.message);
    } else {
      const { data: newV, error: vErr } = await client
        .from("product_variants")
        .insert([
          {
            product_id: productId,
            sku: skuCode,
            name: input.name.trim(),
            name_bn: input.nameBn?.trim() || null,
            pack_type: "box",
            net_quantity: 1,
            net_unit: "kg",
            price: input.price,
            compare_at_price: input.compareAtPrice && input.compareAtPrice > input.price ? input.compareAtPrice : null,
            is_combo: true,
            is_default: true,
            is_active: input.status === "active",
            track_inventory: true,
            low_stock_threshold: 5,
            created_at: now,
            updated_at: now,
          },
        ])
        .select("id")
        .single();

      if (vErr || !newV) throw new Error(vErr?.message || "Failed to create combo variant");
      variantId = newV.id;
    }

    // 4. Synchronize combo_items (Bill of Materials)
    await client.from("combo_items").delete().eq("combo_variant_id", variantId);

    const comboRows = input.components.map((c, idx) => ({
      combo_variant_id: variantId,
      component_variant_id: c.componentVariantId,
      quantity: Math.max(1, Number(c.quantity) || 1),
      sort_order: idx,
    }));

    const { error: ciInsertErr } = await client.from("combo_items").insert(comboRows);
    if (ciInsertErr) throw new Error(ciInsertErr.message);

    // 5. Calculate and synchronize virtual stock
    const { data: virtStock } = await client.rpc("get_combo_variant_available_stock", {
      p_combo_variant_id: variantId,
    });
    const availableUnits = Number(virtStock) || 0;

    if (warehouseId) {
      await client
        .from("inventory_levels")
        .upsert(
          {
            variant_id: variantId,
            warehouse_id: warehouseId,
            on_hand: availableUnits,
            reserved: 0,
            updated_at: now,
          },
          { onConflict: "variant_id,warehouse_id" }
        );

      await client
        .from("product_variants")
        .update({
          stock_status: availableUnits > 5 ? "in_stock" : availableUnits > 0 ? "low_stock" : "out_of_stock",
          updated_at: now,
        })
        .eq("id", variantId);
    }

    // 6. Handle optional product image
    if (productId && input.imagePath !== undefined) {
      if (input.imagePath) {
        const { data: existingImg } = await client
          .from("product_images")
          .select("id")
          .eq("product_id", productId)
          .maybeSingle();

        if (existingImg) {
          await client
            .from("product_images")
            .update({ storage_path: input.imagePath, is_primary: true })
            .eq("id", existingImg.id);
        } else {
          await client.from("product_images").insert([
            {
              product_id: productId,
              storage_path: input.imagePath,
              is_primary: true,
              sort_order: 0,
            },
          ]);
        }
      } else {
        // Explicitly cleared image
        await client.from("product_images").delete().eq("product_id", productId);
      }
    }

    // Revalidate paths & tags
    revalidatePath("/admin/combos");
    revalidatePath("/admin/products");
    revalidatePath("/");
    revalidateTag("storefront-products", "max");

    return { success: true, comboId: productId };
  } catch (err: any) {
    console.error("saveComboAction error:", err);
    return { success: false, error: err.message || "Failed to save combo offer." };
  }
}

/**
 * Server Action: Quick toggle of combo status between 'active' and 'draft'.
 */
export async function toggleComboStatusAction(
  productId: string,
  newStatus: "active" | "draft"
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseAdmin || supabase;

  try {
    const { error: pErr } = await client
      .from("products")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (pErr) throw new Error(pErr.message);

    // Also update variant active state
    await client
      .from("product_variants")
      .update({
        is_active: newStatus === "active",
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId);

    revalidatePath("/admin/combos");
    revalidatePath("/admin/products");
    revalidatePath("/");
    revalidateTag("storefront-products", "max");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Server Action: Unlinks and deletes/archives a combo product.
 */
export async function deleteComboAction(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseAdmin || supabase;

  try {
    // Delete product cascade removes product_variants and combo_items automatically
    const { error: delErr } = await client.from("products").delete().eq("id", productId);

    if (delErr) {
      // If restricted by foreign keys, archive instead
      await client
        .from("products")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", productId);
    }

    revalidatePath("/admin/combos");
    revalidatePath("/admin/products");
    revalidatePath("/");
    revalidateTag("storefront-products", "max");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
