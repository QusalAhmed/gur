import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import { getSiteUrl, normalizeSiteUrl } from "@/lib/site-url";
import type { StorefrontProduct } from "@/components/storefront/product-card";

export type SeoBusinessType =
  | "Store"
  | "FoodEstablishment"
  | "LocalBusiness"
  | "Organization";

export interface ResolvedSeoSettings {
  siteUrl: string;
  storeName: string;
  storeNameEn: string;
  storeNameBn: string;
  storeSubtitle: string;
  supportPhone: string;
  email: string;
  address: string;
  logoUrl: string;
  defaultTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  keywords: string[];
  keywordsRaw: string;
  ogImageUrl: string;
  twitterHandle: string;
  homeTitle: string;
  homeDescription: string;
  productsTitle: string;
  productsDescription: string;
  contactTitle: string;
  contactDescription: string;
  privacyTitle: string;
  privacyDescription: string;
  businessType: SeoBusinessType;
  businessDescription: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  googleVerification: string;
  ga4MeasurementId: string;
  allowIndexing: boolean;
}

const DEFAULT_STORE_NAME_BN = "খেজুরের খাঁটি গুড়";
const DEFAULT_STORE_NAME_EN = "Pure Cane & Date Palm Molasses";
const DEFAULT_STORE_SUBTITLE =
  "আমার নিজের বাসায় তৈরী খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়";
const DEFAULT_TITLE = "খেজুরের খাটি গুড় | Pure Cane & Date Palm Molasses";
const DEFAULT_TITLE_TEMPLATE = "%s | খেজুরের খাটি গুড়";
const DEFAULT_DESCRIPTION =
  "Pure sugarcane and date palm molasses (ঝোলা গুড়, পাটালি গুড়) manufacturing, retail, and B2B wholesale distribution platform in Bangladesh.";
const DEFAULT_CONTACT_TITLE = "যোগাযোগ ও সরাসরি অর্ডার";
const DEFAULT_CONTACT_DESCRIPTION =
  "গাছিদের খাঁটি খেজুরের গুড় কিনতে বা যেকোনো তথ্যে সরাসরি ফোন, হোয়াটসঅ্যাপ বা মেসেঞ্জারে আমাদের সাথে যোগাযোগ করুন। বাঘা, রাজশাহী।";
const DEFAULT_PRIVACY_TITLE = "গোপনীয়তা নীতি (Privacy Policy)";
const DEFAULT_PRIVACY_DESCRIPTION =
  "আমাদের প্ল্যাটফর্মে গ্রাহকদের ব্যক্তিগত তথ্যের সর্বোচ্চ নিরাপত্তা ও গোপনীয়তা রক্ষা আমাদের প্রধান অগ্রাধিকার। জানুন আমাদের প্রাইভেসি পলিসি।";
const DEFAULT_PRODUCTS_TITLE = "সকল খাঁটি গুড়ের পণ্যসমূহ";
const DEFAULT_PRODUCTS_DESCRIPTION =
  "বাঘা, রাজশাহীর আসল ঝোলা গুড়, দানাদার পাটালি ও নলেন গুড়ের সংগ্রহ। ১০০% খাঁটি ও ক্যাশ অন ডেলিভারিতে অর্ডার করুন।";

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/^["']|["']$/g, "").trim();
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "false" || lower === "0" || lower === "no") return false;
    if (lower === "true" || lower === "1" || lower === "yes") return true;
  }
  return fallback;
}

function sanitizeHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function resolveAbsoluteMediaUrl(rawPath: string, siteUrl: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return "";
  const resolved = resolveCdnImageUrl(trimmed);
  if (!resolved) return "";
  if (resolved.startsWith("/")) return `${siteUrl}${resolved}`;
  return resolved.startsWith("http://") || resolved.startsWith("https://") ? resolved : "";
}

function sanitizeBusinessType(raw: string): SeoBusinessType {
  switch (raw) {
    case "Store":
    case "FoodEstablishment":
    case "LocalBusiness":
    case "Organization":
      return raw;
    default:
      return "Store";
  }
}

export function sanitizeGa4Id(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  return /^(G|GT)-[A-Z0-9]{4,20}$/.test(trimmed) ? trimmed : "";
}

/**
 * Cached loader for public SEO & store branding settings from Supabase `site_settings`.
 * Invalidated immediately when admin saves `/admin/settings` via `revalidateTag("site-settings")`.
 */
export async function getCachedSeoSettings(): Promise<ResolvedSeoSettings> {
  "use cache";
  cacheTag("site-settings", "storefront-products");
  cacheLife({
    stale: 300,
    revalidate: 300,
    expire: 3600,
  });

  const rawMap = new Map<string, unknown>();

  try {
    const client = getSupabaseAdmin();
    const { data, error } = await client
      .from("site_settings")
      .select("key, value")
      .eq("is_public", true);

    if (!error && data) {
      for (const row of data) {
        rawMap.set(row.key, row.value);
      }
    }
  } catch (err) {
    console.warn("[SEO Settings] Failed to fetch from Supabase, using defaults:", err);
  }

  const envSiteUrl = getSiteUrl();
  const dbSiteUrl = cleanString(rawMap.get("seo.site_url"));
  const siteUrl = dbSiteUrl ? normalizeSiteUrl(dbSiteUrl) : envSiteUrl;

  const storeNameEn = cleanString(rawMap.get("store.name")) || DEFAULT_STORE_NAME_EN;
  const storeNameBn = cleanString(rawMap.get("store.name_bn")) || DEFAULT_STORE_NAME_BN;
  const storeName = storeNameBn || storeNameEn;
  const storeSubtitle = cleanString(rawMap.get("store.subtitle")) || DEFAULT_STORE_SUBTITLE;

  const supportPhone = cleanString(rawMap.get("store.support_phone")) || "01843557389";
  const email = cleanString(rawMap.get("store.email"));
  const address = cleanString(rawMap.get("store.address")) || "বাঘা, রাজশাহী, বাংলাদেশ";
  const logoUrl = resolveAbsoluteMediaUrl(cleanString(rawMap.get("store.logo_url")), siteUrl);

  const defaultTitle = cleanString(rawMap.get("seo.default_title")) || DEFAULT_TITLE;
  const rawTemplate = cleanString(rawMap.get("seo.title_template"));
  const titleTemplate = rawTemplate
    ? rawTemplate.includes("%s")
      ? rawTemplate
      : `%s | ${rawTemplate}`
    : DEFAULT_TITLE_TEMPLATE;
  const defaultDescription =
    cleanString(rawMap.get("seo.default_description")) || DEFAULT_DESCRIPTION;

  const keywordsRaw = cleanString(rawMap.get("seo.keywords"));
  const keywords = keywordsRaw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const ogImageUrl = resolveAbsoluteMediaUrl(
    cleanString(rawMap.get("seo.og_image_url")),
    siteUrl
  );

  const rawTwitter = cleanString(rawMap.get("seo.twitter_handle"));
  const twitterHandle = rawTwitter
    ? rawTwitter.startsWith("@")
      ? rawTwitter
      : `@${rawTwitter}`
    : "";

  return {
    siteUrl,
    storeName,
    storeNameEn,
    storeNameBn,
    storeSubtitle,
    supportPhone,
    email,
    address,
    logoUrl,
    defaultTitle,
    titleTemplate,
    defaultDescription,
    keywords,
    keywordsRaw,
    ogImageUrl,
    twitterHandle,
    homeTitle: cleanString(rawMap.get("seo.home_title")),
    homeDescription: cleanString(rawMap.get("seo.home_description")),
    productsTitle: cleanString(rawMap.get("seo.products_title")) || DEFAULT_PRODUCTS_TITLE,
    productsDescription:
      cleanString(rawMap.get("seo.products_description")) || DEFAULT_PRODUCTS_DESCRIPTION,
    contactTitle: cleanString(rawMap.get("seo.contact_title")) || DEFAULT_CONTACT_TITLE,
    contactDescription:
      cleanString(rawMap.get("seo.contact_description")) || DEFAULT_CONTACT_DESCRIPTION,
    privacyTitle: cleanString(rawMap.get("seo.privacy_title")) || DEFAULT_PRIVACY_TITLE,
    privacyDescription:
      cleanString(rawMap.get("seo.privacy_description")) || DEFAULT_PRIVACY_DESCRIPTION,
    businessType: sanitizeBusinessType(cleanString(rawMap.get("seo.business_type"))),
    businessDescription:
      cleanString(rawMap.get("seo.business_description")) || defaultDescription,
    facebookUrl: sanitizeHttpUrl(cleanString(rawMap.get("seo.facebook_url"))),
    instagramUrl: sanitizeHttpUrl(cleanString(rawMap.get("seo.instagram_url"))),
    youtubeUrl: sanitizeHttpUrl(cleanString(rawMap.get("seo.youtube_url"))),
    googleVerification: cleanString(rawMap.get("seo.google_verification")),
    ga4MeasurementId: sanitizeGa4Id(cleanString(rawMap.get("seo.ga4_measurement_id"))),
    allowIndexing: cleanBoolean(rawMap.get("seo.allow_indexing"), true),
  };
}

export function buildOrganizationJsonLd(seo: ResolvedSeoSettings) {
  const sameAs = [seo.facebookUrl, seo.instagramUrl, seo.youtubeUrl].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": seo.businessType,
    name: seo.storeName,
    alternateName: seo.storeNameEn !== seo.storeName ? seo.storeNameEn : undefined,
    url: seo.siteUrl,
    description: seo.businessDescription || seo.defaultDescription,
    telephone: seo.supportPhone || undefined,
    email: seo.email || undefined,
    logo: seo.logoUrl || undefined,
    image: seo.ogImageUrl || seo.logoUrl || undefined,
    address: seo.address
      ? {
          "@type": "PostalAddress",
          streetAddress: seo.address,
          addressCountry: "BD",
        }
      : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };
}

export function buildBreadcrumbJsonLd(
  siteUrl: string,
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.path.startsWith("http")
        ? item.path
        : `${siteUrl}${item.path.startsWith("/") ? item.path : `/${item.path}`}`,
    })),
  };
}

export function buildProductJsonLd(
  seo: ResolvedSeoSettings,
  product: StorefrontProduct,
  selectedVariantId?: string
) {
  const productUrl = `${seo.siteUrl}/products/${encodeURIComponent(product.slug || product.id)}`;
  const images = (product.images && product.images.length > 0 ? product.images : [product.image])
    .filter(Boolean)
    .map((img) => (img.startsWith("/") ? `${seo.siteUrl}${img}` : img));

  const variants = product.variants || [];
  const activeVariant =
    (selectedVariantId ? variants.find((v) => v.id === selectedVariantId) : undefined) ||
    variants.find((v) => v.isDefault) ||
    variants[0];

  const prices = variants.map((v) => Number(v.price)).filter((p) => Number.isFinite(p) && p > 0);
  const lowPrice = prices.length > 0 ? Math.min(...prices) : Number(activeVariant?.price || 0);
  const highPrice = prices.length > 0 ? Math.max(...prices) : lowPrice;

  const isInStock = variants.some(
    (v) => (v.stockStatus || "in_stock").toLowerCase() !== "out_of_stock"
  );
  const availability = isInStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  const offers =
    prices.length > 1 && lowPrice !== highPrice
      ? {
          "@type": "AggregateOffer",
          url: productUrl,
          priceCurrency: "BDT",
          lowPrice,
          highPrice,
          offerCount: variants.length,
          availability,
        }
      : {
          "@type": "Offer",
          url: productUrl,
          priceCurrency: "BDT",
          price: Number(activeVariant?.price || lowPrice || 0),
          availability,
          seller: {
            "@type": "Organization",
            name: seo.storeName,
          },
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameBn || product.name,
    description:
      product.seoDescription || product.summaryBn || product.summary || seo.defaultDescription,
    image: images.length > 0 ? images : undefined,
    sku: product.slug || product.id,
    brand: {
      "@type": "Brand",
      name: seo.storeName,
    },
    offers,
    ...(product.ratingCount && product.ratingCount > 0 && product.ratingAvg
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(product.ratingAvg).toFixed(1),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };
}

export function buildFaqPageJsonLd(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
