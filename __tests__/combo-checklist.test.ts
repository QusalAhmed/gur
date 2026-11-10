import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";

function parseWeightFromText(rawText = ""): number | null {
  if (!rawText || typeof rawText !== "string") return null;
  const text = rawText.toLowerCase();

  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|k\.g|kgs|কেজি|কিলো)/i);
  if (kgMatch) return parseFloat(kgMatch[1]);

  const gMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|gms|gram|grams|g|গ্রাম|গ্রা)(?![a-z])/i);
  if (gMatch) return parseFloat(gMatch[1]) / 1000;

  return null;
}

function extractUnitWeightKg(variantName = "", productName = "", sku = ""): number {
  const variantWeight = parseWeightFromText(variantName);
  if (variantWeight !== null) return variantWeight;

  const productWeight = parseWeightFromText(productName);
  if (productWeight !== null) return productWeight;

  const skuWeight = parseWeightFromText(sku);
  if (skuWeight !== null) return skuWeight;

  return 1;
}

// Pure helper function modeling the consolidation logic in OrderChecklistDialog
function consolidateOrders(orders: Order[]) {
  const map = new Map<string, {
    key: string;
    product_name: string;
    variant_name: string;
    sku: string;
    total_quantity: number;
    total_weight_kg: number;
    order_ids: string[];
    combo_sources?: Array<{ combo_name: string; count: number }>;
  }>();
  const idToKey = new Map<string, string>();
  const attrsToKey = new Map<string, string>();

  const resolveKey = (varId: string, attrsKey: string): string => {
    let key = (varId && idToKey.get(varId)) || attrsToKey.get(attrsKey);
    if (!key) {
      key = varId ? `var_${varId}`.toLowerCase() : attrsKey;
    }
    if (varId) idToKey.set(varId, key);
    attrsToKey.set(attrsKey, key);
    return key;
  };

  for (const order of orders) {
    if (!order.items || !Array.isArray(order.items)) continue;

    for (const item of order.items) {
      const isComboItem = Boolean(item.is_combo) || (Array.isArray(item.combo_components) && item.combo_components.length > 0);

      if (isComboItem && Array.isArray(item.combo_components) && item.combo_components.length > 0) {
        const comboQty = Number(item.quantity) || 1;
        const comboName = (item.product_name || "Combo").trim();

        for (const comp of item.combo_components) {
          const compProdName = (comp.product_name || "Unknown Product").trim();
          const compVarName = (comp.variant_name || "").trim();
          const compSku = (comp.sku || "").trim();
          const compVarId = (comp as any).component_variant_id ? String((comp as any).component_variant_id).trim() : "";
          const compAttrsKey = `${compProdName}___${compVarName}___${compSku}`.toLowerCase();
          const key = resolveKey(compVarId, compAttrsKey);

          const singleCompQty = Number(comp.quantity) || 1;
          const totalCompQty = singleCompQty * comboQty;
          const unitWeight = comp.weight_grams
            ? comp.weight_grams / 1000
            : extractUnitWeightKg(compVarName, compProdName, compSku);
          const lineWeight = unitWeight * totalCompQty;

          const existing = map.get(key);
          if (existing) {
            existing.total_quantity += totalCompQty;
            existing.total_weight_kg += lineWeight;
            if (!existing.order_ids.includes(order.id)) {
              existing.order_ids.push(order.id);
            }
            if (!existing.combo_sources) existing.combo_sources = [];
            const src = existing.combo_sources.find((s) => s.combo_name === comboName);
            if (src) {
              src.count += totalCompQty;
            } else {
              existing.combo_sources.push({ combo_name: comboName, count: totalCompQty });
            }
          } else {
            map.set(key, {
              key,
              product_name: compProdName,
              variant_name: compVarName,
              sku: compSku,
              total_quantity: totalCompQty,
              total_weight_kg: lineWeight,
              order_ids: [order.id],
              combo_sources: [{ combo_name: comboName, count: totalCompQty }],
            });
          }
        }
      } else {
        const prodName = (item.product_name || "Unknown Product").trim();
        const variantName = (item.variant_name || "").trim();
        const sku = (item.sku || "").trim();
        const itemVarId = item.variant_id ? String(item.variant_id).trim() : "";
        const itemAttrsKey = `${prodName}___${variantName}___${sku}`.toLowerCase();
        const key = resolveKey(itemVarId, itemAttrsKey);

        const qty = Number(item.quantity) || 1;
        const unitWeight = extractUnitWeightKg(variantName, prodName, sku);
        const lineWeight = unitWeight * qty;
        const existing = map.get(key);

        if (existing) {
          existing.total_quantity += qty;
          existing.total_weight_kg += lineWeight;
          if (!existing.order_ids.includes(order.id)) {
            existing.order_ids.push(order.id);
          }
        } else {
          map.set(key, {
            key,
            product_name: prodName,
            variant_name: variantName,
            sku,
            total_quantity: qty,
            total_weight_kg: lineWeight,
            order_ids: [order.id],
          });
        }
      }
    }
  }

  return Array.from(map.values());
}

describe("Combo Packing Checklist Consolidation", () => {
  it("explodes combo items into exact physical jars with combo source tracking", () => {
    const orders = [
      {
        id: "ord-1",
        customer: "Rahim",
        phone: "+8801711111111",
        status: "pending",
        payment: "unpaid",
        grand_total: 650,
        items: [
          {
            id: "it-1",
            sku: "GUR-JHOLA-1KG",
            product_name: "Jhola Gur",
            variant_name: "1kg Jar",
            quantity: 1,
            unit_price: 650,
            line_total: 650,
            is_combo: false,
          },
        ],
        notes: [],
      },
      {
        id: "ord-2",
        customer: "Karim",
        phone: "+8801822222222",
        status: "pending",
        payment: "unpaid",
        grand_total: 1900,
        items: [
          {
            id: "it-2",
            sku: "GUR-WINTER-COMBO",
            product_name: "Winter Special Combo",
            variant_name: "1 Combo Pack",
            quantity: 2,
            unit_price: 950,
            line_total: 1900,
            is_combo: true,
            combo_components: [
              {
                component_variant_id: "var-jhola-1kg",
                sku: "GUR-JHOLA-1KG",
                product_name: "Jhola Gur",
                variant_name: "1kg Jar",
                quantity: 1,
                unit_price: 650,
                weight_grams: 1000,
              },
              {
                component_variant_id: "var-patali-500g",
                sku: "GUR-PATALI-500G",
                product_name: "Patali Gur",
                variant_name: "500g Block",
                quantity: 1,
                unit_price: 450,
                weight_grams: 500,
              },
            ],
          },
        ],
        notes: [],
      },
    ];

    const consolidated = consolidateOrders(orders as unknown as Order[]);

    // Jhola Gur: 1 from ord-1 + 2 from ord-2 (combo x2) = 3 total
    const jhola = consolidated.find((c) => c.sku === "GUR-JHOLA-1KG");
    expect(jhola).toBeDefined();
    expect(jhola?.total_quantity).toBe(3);
    expect(jhola?.total_weight_kg).toBe(3); // 1kg * 3
    expect(jhola?.combo_sources).toEqual([
      { combo_name: "Winter Special Combo", count: 2 },
    ]);

    // Patali Gur: 0 loose + 2 from ord-2 (combo x2) = 2 total
    const patali = consolidated.find((c) => c.sku === "GUR-PATALI-500G");
    expect(patali).toBeDefined();
    expect(patali?.total_quantity).toBe(2);
    expect(patali?.total_weight_kg).toBe(1.0); // 0.5kg * 2 = 1.0kg
    expect(patali?.combo_sources).toEqual([
      { combo_name: "Winter Special Combo", count: 2 },
    ]);
  });

  it("handles live DB format where weight_grams is 0 and parses weight from variant name", () => {
    const orders = [
      {
        id: "ord-live-1",
        customer: "Live Customer",
        phone: "+8801999999999",
        status: "pending",
        payment: "unpaid",
        grand_total: 1100,
        items: [
          {
            id: "it-live",
            sku: "MOL-COMBO-TRIO",
            product_name: "Combo (Patali 1kg + Danadar 1kg + Liquid 1kg)",
            variant_name: "Combo (Patali 1kg + Danadar 1kg + Liquid 1kg)",
            quantity: 1,
            unit_price: 1100,
            line_total: 1100,
            is_combo: true,
            combo_components: [
              {
                component_variant_id: "var-1",
                product_name: "Liquid Gur",
                variant_name: "Standard Pack (1kg)",
                sku: "MOL-7443",
                quantity: 1,
                weight_grams: 0,
              },
              {
                component_variant_id: "var-2",
                product_name: "Grainy Liquid Gur",
                variant_name: "Standard Pack (1kg)",
                sku: "MOL-4885",
                quantity: 1,
                weight_grams: 0,
              },
              {
                component_variant_id: "var-3",
                product_name: "Patali Gur",
                variant_name: "Standard Pack (1kg)",
                sku: "MOL-3497",
                quantity: 1,
                weight_grams: 0,
              },
            ],
          },
        ],
        notes: [],
      },
    ];

    const consolidated = consolidateOrders(orders as unknown as Order[]);

    // Must be exploded into exactly 3 items
    expect(consolidated).toHaveLength(3);

    const liquid = consolidated.find((c) => c.sku === "MOL-7443");
    expect(liquid?.total_quantity).toBe(1);
    expect(liquid?.total_weight_kg).toBe(1); // Parsed from "Standard Pack (1kg)"

    const grainy = consolidated.find((c) => c.sku === "MOL-4885");
    expect(grainy?.total_quantity).toBe(1);
    expect(grainy?.total_weight_kg).toBe(1);

    const patali = consolidated.find((c) => c.sku === "MOL-3497");
    expect(patali?.total_quantity).toBe(1);
    expect(patali?.total_weight_kg).toBe(1);

    // Total package weight must be 3kg
    const totalWeight = consolidated.reduce((acc, it) => acc + it.total_weight_kg, 0);
    expect(totalWeight).toBe(3);
  });

  it("reconciles key between component without variant_id and loose item with variant_id regardless of processing order", () => {
    // Order 1: Loose item with variant_id = "v-liquid"
    const orderWithVariantId = {
      id: "ord-loose",
      order_number: "ORD-001",
      customer_name: "Customer A",
      items: [
        {
          product_name: "Liquid Gur",
          variant_name: "1kg Jar",
          sku: "MOL-100",
          variant_id: "v-liquid",
          quantity: 2,
        },
      ],
    };

    // Order 2: Combo containing component with same name/sku but WITHOUT component_variant_id
    const orderWithoutVariantId = {
      id: "ord-combo",
      order_number: "ORD-002",
      customer_name: "Customer B",
      items: [
        {
          product_name: "Special Combo",
          quantity: 1,
          is_combo: true,
          combo_components: [
            {
              product_name: "Liquid Gur",
              variant_name: "1kg Jar",
              sku: "MOL-100",
              quantity: 3,
            },
          ],
        },
      ],
    };

    // Forward order: Loose item with variant_id processed first
    const forwardConsolidated = consolidateOrders([orderWithVariantId, orderWithoutVariantId] as unknown as Order[]);
    expect(forwardConsolidated).toHaveLength(1);
    expect(forwardConsolidated[0].total_quantity).toBe(5);
    expect(forwardConsolidated[0].order_ids).toHaveLength(2);

    // Reverse order: Combo component without variant_id processed first
    const reverseConsolidated = consolidateOrders([orderWithoutVariantId, orderWithVariantId] as unknown as Order[]);
    expect(reverseConsolidated).toHaveLength(1);
    expect(reverseConsolidated[0].total_quantity).toBe(5);
    expect(reverseConsolidated[0].order_ids).toHaveLength(2);
  });
});
