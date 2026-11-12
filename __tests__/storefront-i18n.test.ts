import { describe, expect, it } from "vitest";
import { formatStorePrice, STOREFRONT_TEXT, toBnNumber } from "@/lib/storefront-i18n";

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
});
