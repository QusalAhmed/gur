import { describe, it, expect } from "vitest";
import {
  resolveOrderTotalWeightKg,
  formatWeightDisplay,
} from "@/app/admin/(protected)/orders/print/page";
import type { Order } from "@/types/order";

describe("Invoice Total Weight Resolution and Formatting", () => {
  describe("formatWeightDisplay", () => {
    it("formats integer weights without trailing decimals", () => {
      expect(formatWeightDisplay(1)).toBe("WEIGHT: 1 kg");
      expect(formatWeightDisplay(2)).toBe("WEIGHT: 2 kg");
      expect(formatWeightDisplay(10)).toBe("WEIGHT: 10 kg");
    });

    it("formats single decimal weights cleanly", () => {
      expect(formatWeightDisplay(1.5)).toBe("WEIGHT: 1.5 kg");
      expect(formatWeightDisplay(0.5)).toBe("WEIGHT: 0.5 kg");
      expect(formatWeightDisplay(2.5)).toBe("WEIGHT: 2.5 kg");
    });

    it("formats two-decimal weights without unnecessary trailing zeros", () => {
      expect(formatWeightDisplay(1.25)).toBe("WEIGHT: 1.25 kg");
      expect(formatWeightDisplay(2.75)).toBe("WEIGHT: 2.75 kg");
      expect(formatWeightDisplay(1.50)).toBe("WEIGHT: 1.5 kg");
    });
  });

  describe("resolveOrderTotalWeightKg", () => {
    it("uses order.total_weight_kg when already present and greater than 0", () => {
      const order = {
        id: "ord-1",
        total_weight_kg: 2.5,
        items: [],
      } as unknown as Order;

      expect(resolveOrderTotalWeightKg(order)).toBe(2.5);
    });

    it("falls back to item weight_grams when order.total_weight_kg is missing or 0", () => {
      const order = {
        id: "ord-2",
        items: [
          { quantity: 2, weight_grams: 1000 },
          { quantity: 1, weight_grams: 500 },
        ],
      } as unknown as Order;

      expect(resolveOrderTotalWeightKg(order)).toBe(2.5);
    });

    it("handles combo components with weight_grams", () => {
      const order = {
        id: "ord-3",
        items: [
          {
            quantity: 2,
            combo_components: [
              { quantity: 1, weight_grams: 1000 },
              { quantity: 2, weight_grams: 500 },
            ],
          },
        ],
      } as unknown as Order;

      // Each combo has 1*1000g + 2*500g = 2000g = 2kg
      // Total 2 combos = 4kg
      expect(resolveOrderTotalWeightKg(order)).toBe(4);
    });

    it("extracts weights from variant names in English and Bengali", () => {
      const order = {
        id: "ord-4",
        items: [
          { quantity: 1, variant_name: "Standard Pack (1kg)" },
          { quantity: 2, variant_name: "স্ট্যান্ডার্ড প্যাক (০.৫ কেজি)" },
        ],
      } as unknown as Order;

      // 1kg + 2 * 0.5kg = 2kg
      expect(resolveOrderTotalWeightKg(order)).toBe(2);
    });

    it("returns null when weight is 0 or cannot be resolved", () => {
      const orderEmpty = {
        id: "ord-5",
        items: [],
      } as unknown as Order;
      expect(resolveOrderTotalWeightKg(orderEmpty)).toBeNull();

      const orderNoWeight = {
        id: "ord-6",
        items: [{ quantity: 1, variant_name: "Custom Box", product_name: "Merchandise" }],
      } as unknown as Order;
      expect(resolveOrderTotalWeightKg(orderNoWeight)).toBeNull();
    });
  });
});
