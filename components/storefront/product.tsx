import { Sparkles, Loader2 } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { ProductShowcase } from "@/components/storefront/product-showcase";
import { StorefrontProduct } from "@/components/storefront/product-card";

export function resolveProductImage(storageUrl?: string): string {
  if (storageUrl && (storageUrl.startsWith("http://") || storageUrl.startsWith("https://"))) {
    return storageUrl;
  }
  // Generic placeholder if no image was uploaded in Supabase storage
  return "/images/products/blackstrap-drum.jpg";
}

export async function getStorefrontData(): Promise<{
  products: StorefrontProduct[];
  hotline: string;
  storeName: string;
  storeSubtitle: string;
}> {
  const client = supabaseAdmin || supabase;

  // 1. Fetch site settings for store name and support phone
  let hotline = "01843557389";
  let storeName = "খেজুরের খাটি গুড়";
  let storeSubtitle = "গ্রামের গাছিদের তৈরি খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়";

  try {
    const { data: settings } = await client
      .from("site_settings")
      .select("key, value")
      .in("key", ["store.support_phone", "store.name_bn", "store.name"]);

    if (settings) {
      for (const row of settings) {
        const cleanVal = String(row.value || "").replace(/^["']|["']$/g, "").trim();
        if (!cleanVal) continue;
        if (row.key === "store.support_phone") hotline = cleanVal;
        if (row.key === "store.name_bn" || row.key === "store.name") storeName = cleanVal;
      }
    }
  } catch (err) {
    console.warn("Could not fetch site_settings:", err);
  }

  // 2. Fetch real active products, variants, and primary images from Supabase
  let realProducts: StorefrontProduct[] = [];

  try {
    const [prodRes, varRes, imgRes] = await Promise.all([
      client
        .from("products")
        .select("id, name, name_bn, summary, summary_bn, origin, rating_avg, rating_count, sort_order")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      client
        .from("product_variants")
        .select("id, product_id, name, name_bn, price, net_quantity, net_unit, stock_status")
        .order("price", { ascending: true }),
      client
        .from("product_images")
        .select("product_id, storage_path, is_primary, sort_order")
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);

    const variantsByProduct = new Map<string, any[]>();
    if (varRes.data) {
      for (const v of varRes.data) {
        const list = variantsByProduct.get(v.product_id) || [];
        list.push({
          id: v.id,
          name: v.name,
          nameBn: v.name_bn || v.name,
          price: Number(v.price) || 0,
          netQuantity: v.net_quantity,
          netUnit: v.net_unit,
          stockStatus: v.stock_status,
        });
        variantsByProduct.set(v.product_id, list);
      }
    }

    const imagesByProduct = new Map<string, string[]>();
    if (imgRes.data) {
      for (const img of imgRes.data) {
        let pubUrl = img.storage_path;
        if (pubUrl && !pubUrl.startsWith("http")) {
          const { data } = client.storage.from("catalog-images").getPublicUrl(img.storage_path);
          pubUrl = data?.publicUrl || "";
        }
        if (pubUrl) {
          const list = imagesByProduct.get(img.product_id) || [];
          if (img.is_primary) {
            list.unshift(pubUrl);
          } else {
            list.push(pubUrl);
          }
          imagesByProduct.set(img.product_id, list);
        }
      }
    }

    if (prodRes.data && prodRes.data.length > 0) {
      realProducts = prodRes.data.map((p) => {
        const productImgs = imagesByProduct.get(p.id) || [];
        const resolvedImgs =
          productImgs.length > 0 ? productImgs : [resolveProductImage()];
        const primaryImg = resolvedImgs[0];
        const variants = (variantsByProduct.get(p.id) || [
          {
            id: `v-${p.id}`,
            name: "1 Pack",
            nameBn: "১ প্যাক",
            price: 700,
          },
        ]).sort((a, b) => Number(a.price) - Number(b.price));

        return {
          id: p.id,
          name: p.name,
          nameBn: p.name_bn || p.name,
          summary: p.summary,
          summaryBn: p.summary_bn,
          image: primaryImg,
          images: resolvedImgs,
          origin: p.origin,
          ratingAvg: Number(p.rating_avg) || 5,
          ratingCount: Number(p.rating_count) || 1,
          variants,
        };
      });
    }
  } catch (err) {
    console.error("Error fetching real products from Supabase DB in components/storefront/product.tsx:", err);
  }

  return {
    products: realProducts,
    hotline,
    storeName,
    storeSubtitle,
  };
}

export function ProductLoading() {
  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#fdfbf7] dark:bg-stone-950 text-amber-950 dark:text-amber-100">
      <div className="w-16 h-16 rounded-full bg-amber-200 dark:bg-stone-800 flex items-center justify-center text-amber-800 dark:text-amber-200 shadow-lg">
        <Sparkles className="w-8 h-8 animate-pulse" />
      </div>
      <p className="mt-4 font-bold text-lg flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-amber-700 dark:text-amber-300" />
        <span>দোকানের পণ্য লোড হচ্ছে...</span>
      </p>
    </div>
  );
}

export async function Product() {
  const { products, hotline, storeName, storeSubtitle } = await getStorefrontData();

  return (
    <ProductShowcase
      products={products}
      defaultHotline={hotline}
      storeName={storeName}
      storeSubtitle={storeSubtitle}
    />
  );
}

export default Product;
export {
  Product as Products,
  Product as StorefrontProducts,
  Product as StorefrontContent,
  ProductLoading as StorefrontLoading,
};

