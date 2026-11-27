import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CatalogProduct, OrderItem } from "@/types/order";
import {
  addFilteredCatalogProducts,
  buildOrderItemsFromCartEntries,
  extractCatalogCategories,
  filterAndGroupCatalogProducts,
  formatPackTypeLabel,
  formatWeightLabel,
  getCatalogStockInfo,
  resetCartEntryPrice,
  setCartEntryPrice,
  setCartEntryQuantity,
  setCatalogProductQuantity,
  syncOrderItemsToCartEntries,
} from "@/lib/product-picker";
import { getCatalogProductsAction } from "@/actions/orders";

vi.mock("@/lib/admin-guard", () => ({
  assertStaffRole: vi.fn(async () => ({
    id: "admin-uuid-1",
    role: "admin",
  })),
  getActorUuid: vi.fn(() => "admin-uuid-1"),
}));

const mockDbTables: Record<string, any[]> = {
  products: [],
  product_variants: [],
  categories: [],
  product_images: [],
  inventory_levels: [],
  combo_items: [],
};

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (table: string) => {
      const filters: Array<(row: any) => boolean> = [];
      let sortCol: string | null = null;
      let sortAsc = true;

      const execute = () => {
        const rows = [...(mockDbTables[table] || [])].filter((r) =>
          filters.every((fn) => fn(r))
        );
        if (sortCol) {
          rows.sort((a, b) => {
            const va = a[sortCol!] ?? 0;
            const vb = b[sortCol!] ?? 0;
            if (va === vb) return 0;
            return sortAsc ? (va < vb ? -1 : 1) : va > vb ? -1 : 1;
          });
        }
        return { data: rows, error: null };
      };

      const chain: any = {
        select: () => chain,
        eq: (col: string, val: any) => {
          filters.push((r) => r[col] === val);
          return chain;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          sortCol = col;
          sortAsc = opts?.ascending !== false;
          return chain;
        },
        then: (resolve: (val: any) => any) => Promise.resolve(execute()).then(resolve),
      };
      return chain;
    },
  })),
}));

const SAMPLE_CATALOG: CatalogProduct[] = [
  {
    variant_id: "var-1",
    product_id: "prod-1",
    sku: "GUR-PAT-1KG",
    product_name: "Pure Date Palm Patali",
    product_name_bn: "খাঁটি খেজুর পাটালি",
    variant_name: "1kg Foil Pack",
    variant_name_bn: "১ কেজি ফয়েল",
    category: "Specialty Gur",
    unit_price: 620,
    stock: "42 in stock",
    stock_status: "in_stock",
    available_qty: 42,
    weight_grams: 1000,
    is_combo: false,
    image: "/images/patali.jpg",
    pack_type: "foil",
  },
  {
    variant_id: "var-2",
    product_id: "prod-1",
    sku: "GUR-PAT-500G",
    product_name: "Pure Date Palm Patali",
    product_name_bn: "খাঁটি খেজুর পাটালি",
    variant_name: "500g Box",
    variant_name_bn: "৫০০ গ্রাম বক্স",
    category: "Specialty Gur",
    unit_price: 340,
    stock: "Low Stock (3)",
    stock_status: "low_stock",
    available_qty: 3,
    weight_grams: 500,
    is_combo: false,
    image: "/images/patali.jpg",
    pack_type: "box",
  },
  {
    variant_id: "var-3",
    product_id: "prod-2",
    sku: "GUR-LIQ-1L",
    product_name: "Liquid Nolen Gur",
    product_name_bn: "নলেন গুড়",
    variant_name: "1L Bottle",
    variant_name_bn: "১ লিটার বোতল",
    category: "Liquid Gur",
    unit_price: 450,
    stock: "Out of Stock",
    stock_status: "out_of_stock",
    available_qty: 0,
    weight_grams: 1300,
    is_combo: false,
    image: "/images/liquid.jpg",
    pack_type: "bottle",
  },
  {
    variant_id: "var-4",
    product_id: "prod-3",
    sku: "COMBO-WINTER",
    product_name: "Winter Gur Combo",
    product_name_bn: "শীতের কম্বো",
    variant_name: "Patali + Nolen Jar",
    variant_name_bn: "পাটালি + নলেন",
    category: "Combo Packs",
    unit_price: 980,
    stock: "6 in stock",
    stock_status: "in_stock",
    available_qty: 6,
    weight_grams: 1500,
    is_combo: true,
    image: "/images/combo.jpg",
    pack_type: "jar",
  },
];

describe("lib/product-picker", () => {
  it("resolves semantic stock tone across in_stock, low_stock, out_of_stock, and legacy strings", () => {
    expect(getCatalogStockInfo(SAMPLE_CATALOG[0])).toMatchObject({
      status: "in_stock",
      tone: "emerald",
      isOutOfStock: false,
      label: "42 in stock",
    });
    expect(getCatalogStockInfo(SAMPLE_CATALOG[1])).toMatchObject({
      status: "low_stock",
      tone: "amber",
      isOutOfStock: false,
      label: "Low stock · 3",
    });
    expect(getCatalogStockInfo(SAMPLE_CATALOG[2])).toMatchObject({
      status: "out_of_stock",
      tone: "rose",
      isOutOfStock: true,
      label: "Out of stock · 0",
    });
    expect(
      getCatalogStockInfo({ stock: "Out of stock", stock_status: undefined, available_qty: undefined })
    ).toMatchObject({
      status: "out_of_stock",
      tone: "rose",
      isOutOfStock: true,
    });
  });

  it("formats pack labels and gram/kilogram weights cleanly", () => {
    expect(formatPackTypeLabel("foil")).toBe("Foil");
    expect(formatPackTypeLabel(undefined)).toBe("Standard");
    expect(formatWeightLabel(500)).toBe("500g");
    expect(formatWeightLabel(1000)).toBe("1kg");
    expect(formatWeightLabel(1500)).toBe("1.5kg");
    expect(formatWeightLabel(0)).toBeNull();
  });

  it("supports Bengali names, multi-token queries, category pills, and pack pills", () => {
    expect(extractCatalogCategories(SAMPLE_CATALOG)).toEqual([
      "Specialty Gur",
      "Liquid Gur",
      "Combo Packs",
    ]);

    const bnMatches = filterAndGroupCatalogProducts(SAMPLE_CATALOG, {
      query: "খেজুর",
      category: "all",
      packType: "all",
    });
    expect(bnMatches).toHaveLength(1);
    expect(bnMatches[0].variants.map((v) => v.sku)).toEqual(["GUR-PAT-1KG", "GUR-PAT-500G"]);

    const comboMatches = filterAndGroupCatalogProducts(SAMPLE_CATALOG, {
      query: "combo",
      category: "all",
      packType: "jar",
    });
    expect(comboMatches).toHaveLength(1);
    expect(comboMatches[0].variants[0].sku).toBe("COMBO-WINTER");

    const foilCategoryMatches = filterAndGroupCatalogProducts(SAMPLE_CATALOG, {
      query: "",
      category: "Specialty Gur",
      packType: "foil",
    });
    expect(foilCategoryMatches).toHaveLength(1);
    expect(foilCategoryMatches[0].variants.map((v) => v.sku)).toEqual(["GUR-PAT-1KG"]);
  });

  it("syncs existing order items into cart while preserving custom unit prices and legacy non-catalog items", () => {
    const existingItems: OrderItem[] = [
      {
        id: "existing-line-1",
        sku: "GUR-PAT-1KG",
        variant_id: "var-1",
        product_id: "prod-1",
        product_name: "Pure Date Palm Patali",
        variant_name: "1kg Foil Pack",
        quantity: 2,
        unit_price: 580, // custom discounted price
        line_total: 1160,
        package_type: "Foil",
      },
      {
        id: "existing-custom-line",
        sku: "LEGACY-SPECIAL",
        product_name: "Special Gift Box",
        variant_name: "2kg",
        quantity: 1,
        unit_price: 900,
        line_total: 900,
        package_type: "Box",
      },
    ];

    let cart = syncOrderItemsToCartEntries(existingItems, SAMPLE_CATALOG);
    expect(cart).toHaveLength(2);
    expect(cart[0]).toMatchObject({
      sku: "GUR-PAT-1KG",
      quantity: 2,
      unit_price: 580,
      catalog_unit_price: 620,
      in_catalog: true,
      existing_item_id: "existing-line-1",
    });
    expect(cart[1]).toMatchObject({
      sku: "LEGACY-SPECIAL",
      quantity: 1,
      unit_price: 900,
      catalog_unit_price: null,
      in_catalog: false,
      existing_item_id: "existing-custom-line",
    });

    // Incrementing catalog variant keeps its custom 580 price
    cart = setCatalogProductQuantity(cart, SAMPLE_CATALOG[0], 3);
    expect(cart[0].quantity).toBe(3);
    expect(cart[0].unit_price).toBe(580);

    // Out-of-stock variant remains selectable
    cart = setCatalogProductQuantity(cart, SAMPLE_CATALOG[2], 1);
    expect(cart.find((e) => e.sku === "GUR-LIQ-1L")?.quantity).toBe(1);

    // Override & reset unit price
    cart = setCartEntryPrice(cart, "GUR-LIQ-1L", 400);
    expect(cart.find((e) => e.sku === "GUR-LIQ-1L")?.unit_price).toBe(400);
    cart = resetCartEntryPrice(cart, "GUR-LIQ-1L");
    expect(cart.find((e) => e.sku === "GUR-LIQ-1L")?.unit_price).toBe(450);

    // Adding filtered products adds missing items at qty 1 without touching existing qtys/prices
    cart = addFilteredCatalogProducts(cart, SAMPLE_CATALOG);
    expect(cart).toHaveLength(5);
    expect(cart[0].quantity).toBe(3);
    expect(cart[0].unit_price).toBe(580);

    // Removing an entry
    cart = setCartEntryQuantity(cart, "GUR-PAT-500G", 0);
    expect(cart.some((e) => e.sku === "GUR-PAT-500G")).toBe(false);

    const built = buildOrderItemsFromCartEntries(cart);
    expect(built.find((i) => i.sku === "GUR-PAT-1KG")).toMatchObject({
      id: "existing-line-1",
      quantity: 3,
      unit_price: 580,
      line_total: 1740,
      product_name_bn: "খাঁটি খেজুর পাটালি",
      variant_name_bn: "১ কেজি ফয়েল",
    });
    expect(built.find((i) => i.sku === "COMBO-WINTER")).toMatchObject({
      is_combo: true,
      weight_grams: 1500,
      weight_kg: 1.5,
    });
    expect(built.find((i) => i.sku === "LEGACY-SPECIAL")).toMatchObject({
      id: "existing-custom-line",
      line_total: 900,
    });
  });
});

describe("getCatalogProductsAction", () => {
  beforeEach(() => {
    mockDbTables.categories = [{ id: "cat-1", name: "Pure Molasses" }];
    mockDbTables.products = [
      { id: "p-1", name: "Date Palm Gur", name_bn: "খেজুর গুড়", slug: "date-gur", category_id: "cat-1", sort_order: 1 },
      { id: "p-2", name: "Combo Offer", name_bn: "কম্বো অফার", slug: "combo-offer", category_id: "cat-1", sort_order: 2 },
    ];
    mockDbTables.product_variants = [
      {
        id: "v-1",
        product_id: "p-1",
        sku: "PAT-1KG",
        name: "1kg Foil",
        name_bn: "১ কেজি",
        price: 600,
        stock_status: "in_stock",
        pack_type: "foil",
        weight_grams: 1000,
        is_combo: false,
        sort_order: 1,
        low_stock_threshold: 5,
        is_active: true,
      },
      {
        id: "v-2",
        product_id: "p-1",
        sku: "PAT-500G",
        name: "500g Jar",
        name_bn: "৫০০ গ্রাম",
        price: 320,
        stock_status: "in_stock",
        pack_type: "jar",
        weight_grams: 500,
        is_combo: false,
        sort_order: 2,
        low_stock_threshold: 5,
        is_active: true,
      },
      {
        id: "v-combo",
        product_id: "p-2",
        sku: "COMBO-2X",
        name: "Double Combo",
        name_bn: "ডাবল কম্বো",
        price: 1100,
        stock_status: "in_stock",
        pack_type: "box",
        weight_grams: 2000,
        is_combo: true,
        sort_order: 1,
        low_stock_threshold: 2,
        is_active: true,
      },
    ];
    mockDbTables.product_images = [
      { id: "img-1", product_id: "p-1", storage_path: "patali.jpg", is_primary: true, sort_order: 1 },
    ];
    mockDbTables.inventory_levels = [
      { variant_id: "v-1", on_hand: 10, reserved: 2, available: 8 },
      { variant_id: "v-1", on_hand: 5, reserved: 0, available: 5 }, // multi-warehouse sum = 13
      { variant_id: "v-2", on_hand: 0, reserved: 0, available: 0 }, // 0 -> out_of_stock
    ];
    mockDbTables.combo_items = [
      { combo_variant_id: "v-combo", component_variant_id: "v-1", quantity: 2 },
    ];
  });

  it("enriches catalog products with Bengali names, warehouse inventory totals, and virtual combo stock", async () => {
    const products = await getCatalogProductsAction();

    expect(products).toHaveLength(3);
    expect(products[0]).toMatchObject({
      sku: "PAT-1KG",
      product_name_bn: "খেজুর গুড়",
      variant_name_bn: "১ কেজি",
      available_qty: 13,
      stock_status: "in_stock",
      weight_grams: 1000,
      is_combo: false,
    });
    expect(products[1]).toMatchObject({
      sku: "PAT-500G",
      available_qty: 0,
      stock_status: "out_of_stock",
      stock: "Out of Stock",
    });
    expect(products[2]).toMatchObject({
      sku: "COMBO-2X",
      is_combo: true,
      available_qty: 6, // floor(13 / 2)
      stock_status: "in_stock",
    });
  });
});
