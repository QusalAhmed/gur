import type { CatalogProduct, CatalogStockStatus, OrderItem } from "@/types/order";

export type CatalogPackageFilter = "all" | "jar" | "foil" | "bottle" | "box" | "other";

export type PickerPackageType = NonNullable<OrderItem["package_type"]>;

export interface StockBadgeInfo {
  status: CatalogStockStatus;
  label: string;
  shortLabel: string;
  tone: "emerald" | "amber" | "rose";
  isOutOfStock: boolean;
  availableQty: number | null;
}

export interface CatalogProductGroup {
  key: string;
  productId?: string;
  productName: string;
  productNameBn?: string | null;
  category: string;
  image: string;
  variants: CatalogProduct[];
}

export interface PickerCartEntry {
  key: string;
  sku: string;
  variant_id?: string;
  product_id?: string;
  product_name: string;
  product_name_bn?: string | null;
  variant_name: string;
  variant_name_bn?: string | null;
  category?: string;
  image?: string;
  pack_type?: string;
  package_type?: OrderItem["package_type"];
  catalog_unit_price: number | null;
  unit_price: number;
  quantity: number;
  is_combo?: boolean;
  combo_components?: OrderItem["combo_components"];
  weight_grams?: number | null;
  weight_kg?: number | null;
  existing_item_id?: string;
  stock_status?: CatalogProduct["stock_status"];
  available_qty?: number | null;
  stock?: string;
  in_catalog: boolean;
}

const KNOWN_STANDARD_PACKS = new Set(["jar", "foil", "bottle", "box"]);

/**
 * Resolves semantic stock state and display copy from structured fields
 * (`stock_status`, `available_qty`) with graceful fallback to legacy `stock` strings.
 */
export function getCatalogStockInfo(product: Pick<CatalogProduct, "stock_status" | "available_qty" | "stock">): StockBadgeInfo {
  const rawStatus = (product.stock_status || "").toString().toLowerCase().trim();
  const avail =
    typeof product.available_qty === "number" && Number.isFinite(product.available_qty)
      ? Math.max(0, Math.floor(product.available_qty))
      : null;
  const legacyText = (product.stock || "").trim();
  const legacyLower = legacyText.toLowerCase();

  let status: CatalogStockStatus = "in_stock";

  if (rawStatus === "backorder" || legacyLower.includes("backorder")) {
    status = "backorder";
  } else if (
    rawStatus === "out_of_stock" ||
    legacyLower.includes("out of stock") ||
    (avail !== null && avail <= 0)
  ) {
    status = "out_of_stock";
  } else if (
    rawStatus === "low_stock" ||
    legacyLower.includes("low stock") ||
    (avail !== null && avail > 0 && avail <= 5)
  ) {
    status = "low_stock";
  }

  if (status === "out_of_stock") {
    return {
      status,
      label: avail !== null ? `Out of stock · ${avail}` : "Out of stock",
      shortLabel: "Out of stock",
      tone: "rose",
      isOutOfStock: true,
      availableQty: avail,
    };
  }

  if (status === "backorder") {
    return {
      status,
      label: avail !== null ? `Backorder · ${avail}` : "Backorder",
      shortLabel: "Backorder",
      tone: "amber",
      isOutOfStock: avail === 0,
      availableQty: avail,
    };
  }

  if (status === "low_stock") {
    return {
      status,
      label: avail !== null ? `Low stock · ${avail}` : "Low stock",
      shortLabel: avail !== null ? `${avail} left` : "Low stock",
      tone: "amber",
      isOutOfStock: false,
      availableQty: avail,
    };
  }

  return {
    status: "in_stock",
    label: avail !== null ? `${avail} in stock` : legacyText || "In stock",
    shortLabel: avail !== null ? `${avail} avail.` : "In stock",
    tone: "emerald",
    isOutOfStock: false,
    availableQty: avail,
  };
}

/**
 * Formats package type string cleanly for badges and pills.
 */
export function formatPackTypeLabel(packType?: string | null): string {
  const normalized = (packType || "").trim().toLowerCase();
  if (!normalized) return "Standard";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Resolves `OrderItem["package_type"]` from variant metadata.
 */
export function inferPackageType(packType?: string | null, variantName?: string | null): PickerPackageType {
  const text = `${packType || ""} ${variantName || ""}`.toLowerCase();
  if (text.includes("foil") || text.includes("patali") || text.includes("pouch")) return "Foil";
  if (text.includes("bottle") || text.includes("ltr") || text.includes("1l") || text.includes("500ml")) return "Bottle";
  if (text.includes("box") || text.includes("carton") || text.includes("combo")) return "Box";
  return "Jar";
}

/**
 * Formats weight in grams as a compact badge string (e.g. `500g`, `1kg`, `1.5kg`).
 */
export function formatWeightLabel(weightGrams?: number | null): string | null {
  if (typeof weightGrams !== "number" || !Number.isFinite(weightGrams) || weightGrams <= 0) {
    return null;
  }
  if (weightGrams >= 1000) {
    const kg = weightGrams / 1000;
    const formatted = Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/\.?0+$/, "");
    return `${formatted}kg`;
  }
  return `${Math.round(weightGrams)}g`;
}

/**
 * Extracts unique display categories in first-seen catalog order.
 */
export function extractCatalogCategories(products: CatalogProduct[]): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const product of products) {
    const cat = (product.category || "").trim();
    if (!cat || seen.has(cat)) continue;
    seen.add(cat);
    categories.push(cat);
  }
  return categories;
}

/**
 * Checks if a variant matches a normalized packaging filter pill.
 */
export function matchesPackageFilter(product: CatalogProduct, packFilter: string): boolean {
  const target = (packFilter || "all").toLowerCase().trim();
  if (!target || target === "all") return true;

  const rawPack = (product.pack_type || "").toLowerCase().trim();
  const variantLower = (product.variant_name || "").toLowerCase();

  if (target === "other") {
    return !KNOWN_STANDARD_PACKS.has(rawPack) &&
      !Array.from(KNOWN_STANDARD_PACKS).some((std) => variantLower.includes(std));
  }

  return rawPack === target || rawPack.includes(target) || variantLower.includes(target);
}

/**
 * Checks whether a variant satisfies multi-token English/Bengali search queries.
 */
export function matchesCatalogSearch(product: CatalogProduct, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [
    product.product_name,
    product.product_name_bn || "",
    product.variant_name,
    product.variant_name_bn || "",
    product.sku,
    product.category,
    product.pack_type || "",
    product.is_combo ? "combo bundle কম্বো" : "",
  ]
    .join(" ")
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

/**
 * Filters variants by search query, category pill, and packaging pill, then groups by parent product.
 */
export function filterAndGroupCatalogProducts(
  products: CatalogProduct[],
  options: {
    query?: string;
    category?: string;
    packType?: string;
  }
): CatalogProductGroup[] {
  const query = options.query || "";
  const category = (options.category || "all").trim();
  const packType = (options.packType || "all").trim();

  const groupMap = new Map<string, CatalogProductGroup>();

  for (const variant of products) {
    if (category !== "all" && (variant.category || "").trim().toLowerCase() !== category.toLowerCase()) {
      continue;
    }
    if (!matchesPackageFilter(variant, packType)) {
      continue;
    }
    if (!matchesCatalogSearch(variant, query)) {
      continue;
    }

    const groupKey = variant.product_id || variant.product_name.trim().toLowerCase();
    let group = groupMap.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        productId: variant.product_id,
        productName: variant.product_name,
        productNameBn: variant.product_name_bn,
        category: variant.category,
        image: variant.image,
        variants: [],
      };
      groupMap.set(groupKey, group);
    }
    group.variants.push(variant);
  }

  return Array.from(groupMap.values());
}

/**
 * Synchronizes existing order items into modal cart entries, enriching matching
 * catalog metadata while preserving custom unit prices and non-catalog items.
 */
export function syncOrderItemsToCartEntries(
  currentItems: OrderItem[],
  catalogProducts: CatalogProduct[]
): PickerCartEntry[] {
  const byVariantId = new Map<string, CatalogProduct>();
  const bySku = new Map<string, CatalogProduct>();
  for (const prod of catalogProducts) {
    if (prod.variant_id) byVariantId.set(prod.variant_id, prod);
    if (prod.sku) bySku.set(prod.sku, prod);
  }

  const entries: PickerCartEntry[] = [];
  const keyIndexMap = new Map<string, number>();

  currentItems.forEach((item, index) => {
    const matched =
      (item.variant_id ? byVariantId.get(item.variant_id) : undefined) ||
      (item.sku ? bySku.get(item.sku) : undefined);

    const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
    const unitPrice = Number.isFinite(Number(item.unit_price))
      ? Math.max(0, Number(item.unit_price))
      : matched?.unit_price ?? 0;

    const baseKey = matched?.sku || item.sku || item.id || `custom-${index}`;
    const existingIdx = keyIndexMap.get(baseKey);

    // Merge duplicate lines sharing the same key & price; keep separate key if custom price differs.
    if (existingIdx !== undefined) {
      const existing = entries[existingIdx];
      if (existing.unit_price === unitPrice) {
        existing.quantity += qty;
        return;
      }
    }

    const entryKey = existingIdx !== undefined ? `${baseKey}::${index}` : baseKey;
    if (existingIdx === undefined) {
      keyIndexMap.set(baseKey, entries.length);
    }

    entries.push({
      key: entryKey,
      sku: matched?.sku || item.sku || `ITEM-${index + 1}`,
      variant_id: item.variant_id || matched?.variant_id,
      product_id: item.product_id || matched?.product_id,
      product_name: item.product_name || matched?.product_name || "Product",
      product_name_bn: item.product_name_bn ?? matched?.product_name_bn ?? null,
      variant_name: item.variant_name || matched?.variant_name || "Standard",
      variant_name_bn: item.variant_name_bn ?? matched?.variant_name_bn ?? null,
      category: matched?.category,
      image: item.image || matched?.image,
      pack_type: matched?.pack_type,
      package_type: item.package_type || inferPackageType(matched?.pack_type, item.variant_name || matched?.variant_name),
      catalog_unit_price: matched ? matched.unit_price : null,
      unit_price: unitPrice,
      quantity: qty,
      is_combo: item.is_combo ?? matched?.is_combo,
      combo_components: item.combo_components,
      weight_grams: item.weight_grams ?? matched?.weight_grams ?? null,
      weight_kg: item.weight_kg ?? null,
      existing_item_id: item.id,
      stock_status: matched?.stock_status,
      available_qty: matched?.available_qty,
      stock: matched?.stock,
      in_catalog: Boolean(matched),
    });
  });

  return entries;
}

/**
 * Sets or increments/removes quantity for a catalog variant in the cart while
 * preserving any custom unit price if the SKU is already in the cart.
 */
export function setCatalogProductQuantity(
  entries: PickerCartEntry[],
  product: CatalogProduct,
  nextQty: number
): PickerCartEntry[] {
  const sanitizedQty = Math.max(0, Math.round(Number(nextQty) || 0));
  const targetIdx = entries.findIndex(
    (entry) => entry.key === product.sku || (entry.sku === product.sku && entry.in_catalog)
  );

  if (sanitizedQty <= 0) {
    if (targetIdx === -1) return entries;
    return entries.filter((_, idx) => idx !== targetIdx);
  }

  if (targetIdx !== -1) {
    return entries.map((entry, idx) =>
      idx === targetIdx ? { ...entry, quantity: sanitizedQty } : entry
    );
  }

  const newEntry: PickerCartEntry = {
    key: product.sku,
    sku: product.sku,
    variant_id: product.variant_id,
    product_id: product.product_id,
    product_name: product.product_name,
    product_name_bn: product.product_name_bn ?? null,
    variant_name: product.variant_name,
    variant_name_bn: product.variant_name_bn ?? null,
    category: product.category,
    image: product.image,
    pack_type: product.pack_type,
    package_type: inferPackageType(product.pack_type, product.variant_name),
    catalog_unit_price: product.unit_price,
    unit_price: product.unit_price,
    quantity: sanitizedQty,
    is_combo: product.is_combo,
    weight_grams: product.weight_grams ?? null,
    weight_kg:
      typeof product.weight_grams === "number" && product.weight_grams > 0
        ? product.weight_grams / 1000
        : null,
    stock_status: product.stock_status,
    available_qty: product.available_qty,
    stock: product.stock,
    in_catalog: true,
  };

  return [...entries, newEntry];
}

/**
 * Adds any filtered catalog products not yet in the cart (default quantity = 1),
 * preserving existing quantities and custom price overrides.
 */
export function addFilteredCatalogProducts(
  entries: PickerCartEntry[],
  filteredVariants: CatalogProduct[]
): PickerCartEntry[] {
  let next = entries;
  for (const variant of filteredVariants) {
    const exists = next.some((e) => e.sku === variant.sku);
    if (!exists) {
      next = setCatalogProductQuantity(next, variant, 1);
    }
  }
  return next;
}

/**
 * Updates quantity for an existing cart entry by `key`, removing it when `<= 0`.
 */
export function setCartEntryQuantity(
  entries: PickerCartEntry[],
  key: string,
  nextQty: number
): PickerCartEntry[] {
  const sanitized = Math.max(0, Math.round(Number(nextQty) || 0));
  if (sanitized <= 0) {
    return entries.filter((entry) => entry.key !== key);
  }
  return entries.map((entry) =>
    entry.key === key ? { ...entry, quantity: sanitized } : entry
  );
}

/**
 * Updates unit price for a specific cart entry (clamped `>= 0`).
 */
export function setCartEntryPrice(
  entries: PickerCartEntry[],
  key: string,
  nextPrice: number
): PickerCartEntry[] {
  const sanitized = Number.isFinite(nextPrice) ? Math.max(0, Math.round(nextPrice)) : 0;
  return entries.map((entry) =>
    entry.key === key ? { ...entry, unit_price: sanitized } : entry
  );
}

/**
 * Resets a cart entry's custom unit price back to its catalog base price.
 */
export function resetCartEntryPrice(
  entries: PickerCartEntry[],
  key: string
): PickerCartEntry[] {
  return entries.map((entry) =>
    entry.key === key && entry.catalog_unit_price !== null
      ? { ...entry, unit_price: entry.catalog_unit_price }
      : entry
  );
}

/**
 * Converts cart entries back to canonical `OrderItem[]` for `OrderFormDialog`.
 */
export function buildOrderItemsFromCartEntries(
  entries: PickerCartEntry[],
  idPrefix = "item"
): OrderItem[] {
  const seed = Date.now();
  return entries
    .filter((entry) => entry.quantity > 0)
    .map((entry, idx) => {
      const quantity = Math.max(1, Math.round(entry.quantity));
      const unitPrice = Math.max(0, Number(entry.unit_price) || 0);
      const item: OrderItem = {
        id: entry.existing_item_id || `${idPrefix}-${seed}-${idx}`,
        sku: entry.sku,
        product_name: entry.product_name,
        variant_name: entry.variant_name,
        quantity,
        unit_price: unitPrice,
        line_total: quantity * unitPrice,
        variant_id: entry.variant_id,
        product_id: entry.product_id,
        image: entry.image,
        package_type: entry.package_type || inferPackageType(entry.pack_type, entry.variant_name),
      };

      if (entry.product_name_bn) item.product_name_bn = entry.product_name_bn;
      if (entry.variant_name_bn) item.variant_name_bn = entry.variant_name_bn;
      if (typeof entry.is_combo === "boolean") item.is_combo = entry.is_combo;
      if (entry.combo_components) item.combo_components = entry.combo_components;
      if (entry.weight_grams != null) item.weight_grams = entry.weight_grams;
      if (entry.weight_kg != null) item.weight_kg = entry.weight_kg;

      return item;
    });
}
