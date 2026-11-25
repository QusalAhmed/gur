import { describe, expect, it } from "vitest";
import { resolveProductImageAltTexts } from "@/lib/product-image-alt";

describe("resolveProductImageAltTexts", () => {
  it("uses exact EN and BN product names for primary images when alt text is empty", () => {
    expect(
      resolveProductImageAltTexts({
        productName: "Khejurer Gur",
        productNameBn: "খেজুরের গুড়",
        isPrimary: true,
        imageNumber: 1,
      })
    ).toEqual({
      alt_text: "Khejurer Gur",
      alt_text_bn: "খেজুরের গুড়",
    });
  });

  it("appends EN and Bengali digit suffixes for secondary gallery images", () => {
    expect(
      resolveProductImageAltTexts({
        productName: "Khejurer Gur",
        productNameBn: "খেজুরের গুড়",
        isPrimary: false,
        imageNumber: 2,
      })
    ).toEqual({
      alt_text: "Khejurer Gur - 2",
      alt_text_bn: "খেজুরের গুড় - ২",
    });
  });

  it("falls back to English product name for alt_text_bn when name_bn is empty", () => {
    expect(
      resolveProductImageAltTexts({
        productName: "Patali Gur",
        productNameBn: "",
        isPrimary: false,
        imageNumber: 3,
      })
    ).toEqual({
      alt_text: "Patali Gur - 3",
      alt_text_bn: "Patali Gur - ৩",
    });
  });

  it("preserves custom alt_text and alt_text_bn when provided", () => {
    expect(
      resolveProductImageAltTexts({
        productName: "Khejurer Gur",
        productNameBn: "খেজুরের গুড়",
        altText: "Custom EN alt",
        altTextBn: "কাস্টম বাংলা অল্ট",
        isPrimary: false,
        imageNumber: 2,
      })
    ).toEqual({
      alt_text: "Custom EN alt",
      alt_text_bn: "কাস্টম বাংলা অল্ট",
    });
  });

  it("auto-fills only the missing language when one custom alt text is provided", () => {
    expect(
      resolveProductImageAltTexts({
        productName: "Khejurer Gur",
        productNameBn: "খেজুরের গুড়",
        altText: "Custom EN alt",
        altTextBn: "   ",
        isPrimary: true,
        imageNumber: 1,
      })
    ).toEqual({
      alt_text: "Custom EN alt",
      alt_text_bn: "খেজুরের গুড়",
    });
  });
});
