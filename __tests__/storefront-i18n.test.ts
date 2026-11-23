import { describe, expect, it } from "vitest";
import { formatStorePrice, STOREFRONT_TEXT, toBnNumber, formatStoreItemUnit } from "@/lib/storefront-i18n";

describe("Storefront i18n number formatting", () => {
  it("formats dynamic prices in English digits with standard comma grouping in both bn and en modes", () => {
    expect(formatStorePrice(0, "bn")).toBe("৳ 0");
    expect(formatStorePrice(700, "bn")).toBe("৳ 700");
    expect(formatStorePrice(1400, "bn")).toBe("৳ 1,400");
    expect(formatStorePrice(125000, "bn")).toBe("৳ 125,000");
    expect(formatStorePrice(1399.6, "bn")).toBe("৳ 1,400");

    expect(formatStorePrice(1400, "en")).toBe("৳ 1,400");
    expect(formatStorePrice(125000, "en")).toBe("৳ 125,000");
  });

  it("uses English digits for animated IntroSection stats in Bengali mode", () => {
    expect(STOREFRONT_TEXT.bn.introStat1Number).toBe("20+");
    expect(STOREFRONT_TEXT.bn.introStat2Number).toBe("5,000+");
    expect(STOREFRONT_TEXT.bn.introStat3Number).toBe("100%");
    expect(STOREFRONT_TEXT.bn.introStat4Number).toBe("64");
  });

  it("keeps toBnNumber working for Bengali date formatting", () => {
    expect(toBnNumber(12)).toBe("১২");
    expect(toBnNumber(2026)).toBe("২০২৬");
  });

  it("formats unit price based on weight and labels combos appropriately", () => {
    // 1 kg variant
    expect(formatStoreItemUnit({ weightGrams: 1000 }, "bn")).toBe("১ কেজি");
    expect(formatStoreItemUnit({ weightGrams: 1000 }, "en")).toBe("1 kg");

    // 500g variant
    expect(formatStoreItemUnit({ weightGrams: 500 }, "bn")).toBe("৫০০ গ্রাম");
    expect(formatStoreItemUnit({ weightGrams: 500 }, "en")).toBe("500g");

    // Text parsing fallback when weightGrams is not present
    expect(formatStoreItemUnit({ variantName: "0.5 kg (500g)" }, "bn")).toBe("৫০০ গ্রাম");
    expect(formatStoreItemUnit({ variant_name: "১ কেজি পাটালি" }, "bn")).toBe("১ কেজি");

    // Combo items
    expect(formatStoreItemUnit({ isCombo: true, weightGrams: 3000 }, "bn")).toBe("কম্বো");
    expect(formatStoreItemUnit({ isCombo: true, weightGrams: 3000 }, "en")).toBe("combo");
    expect(formatStoreItemUnit({ variantName: "Combo (3kg Liquid Jhola Gur)" }, "bn")).toBe("কম্বো");

    // Empty/fallback item
    expect(formatStoreItemUnit({}, "bn")).toBe("১ কেজি");
    expect(formatStoreItemUnit({}, "en")).toBe("1 kg");
  });
});
