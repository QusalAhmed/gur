import { toBengaliDigits } from "@/lib/admin-format";

export interface ResolveProductImageAltInput {
  productName: string;
  productNameBn?: string | null;
  altText?: string | null;
  altTextBn?: string | null;
  isPrimary: boolean;
  /** 1-based position for secondary images (2, 3, ...). Ignored when isPrimary is true. */
  imageNumber: number;
}

/**
 * Resolves English and Bengali alt text for a product image, preserving any
 * custom alt text and falling back to the product's English/Bengali names.
 */
export function resolveProductImageAltTexts({
  productName,
  productNameBn,
  altText,
  altTextBn,
  isPrimary,
  imageNumber,
}: ResolveProductImageAltInput): {
  alt_text: string | null;
  alt_text_bn: string | null;
} {
  const enBase = productName.trim();
  const bnBase = productNameBn?.trim() || enBase;

  const existingEn = altText?.trim();
  const existingBn = altTextBn?.trim();

  const hasSuffix = !isPrimary && imageNumber > 1;
  const suffixEn = hasSuffix ? ` - ${imageNumber}` : "";
  const suffixBn = hasSuffix ? ` - ${toBengaliDigits(imageNumber)}` : "";

  return {
    alt_text: existingEn || (enBase ? `${enBase}${suffixEn}` : null),
    alt_text_bn: existingBn || (bnBase ? `${bnBase}${suffixBn}` : null),
  };
}
