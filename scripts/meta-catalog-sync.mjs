#!/usr/bin/env node

/**
 * Meta Catalog Sync CLI Tool
 *
 * Usage:
 *   node scripts/meta-catalog-sync.mjs              # Sync all products to Meta Catalog
 *   node scripts/meta-catalog-sync.mjs --test       # Test Meta connection & catalog details
 *   node scripts/meta-catalog-sync.mjs --fetch      # Fetch items live from Meta Catalog
 *   node scripts/meta-catalog-sync.mjs --mode=create # Force 'create' method
 *   node scripts/meta-catalog-sync.mjs --product=<id> # Sync specific product
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import bizSdk from "facebook-nodejs-business-sdk";

// 1. Load environment variables from .env / .env.local
function loadEnv() {
  const envPaths = [".env.local", ".env"];
  for (const p of envPaths) {
    const full = path.resolve(process.cwd(), p);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const catalogId =
  process.env.META_CATALOG_ID ||
  process.env.FACEBOOK_CATALOG_ID;

const accessToken =
  process.env.META_ACCESS_TOKEN ||
  process.env.FACEBOOK_ACCESS_TOKEN ||
  process.env.FACEBOOK_CAPI_ACCESS_TOKEN;

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://khatikhejurgur.shop"
).replace(/\/+$/, "");

console.log("\x1b[34m%s\x1b[0m", "==================================================");
console.log("\x1b[34m%s\x1b[0m", "     Meta Business SDK - Catalog Integration      ");
console.log("\x1b[34m%s\x1b[0m", "==================================================");

if (!accessToken) {
  console.error("\x1b[31m%s\x1b[0m", "❌ Error: META_ACCESS_TOKEN (or FACEBOOK_CAPI_ACCESS_TOKEN) is not set in environment.");
  process.exit(1);
}

if (!catalogId) {
  console.error("\x1b[31m%s\x1b[0m", "❌ Error: META_CATALOG_ID is not set in environment.");
  console.log("👉 Please add META_CATALOG_ID=<your_catalog_id> to your .env file.");
  process.exit(1);
}

// Initialize Meta SDK
const { FacebookAdsApi, ProductCatalog, ProductItem } = bizSdk;
FacebookAdsApi.init(accessToken);
const catalog = new ProductCatalog(catalogId);

const args = process.argv.slice(2);
const isTest = args.includes("--test");
const isFetch = args.includes("--fetch");
const modeArg = args.find((a) => a.startsWith("--mode="))?.split("=")[1] || "auto";
const productArg = args.find((a) => a.startsWith("--product="))?.split("=")[1];

async function main() {
  if (isTest) {
    console.log(`\n🔍 Testing connection to Meta Catalog ID: ${catalogId}...`);
    try {
      const details = await catalog.get([
        ProductCatalog.Fields.id,
        ProductCatalog.Fields.name,
        ProductCatalog.Fields.product_count,
        ProductCatalog.Fields.feed_count,
        ProductCatalog.Fields.vertical,
      ]);
      const data = details._data || details;
      console.log("\x1b[32m%s\x1b[0m", "✅ Connection Successful!");
      console.log(`   Catalog Name:  ${data.name || details.name}`);
      console.log(`   Catalog ID:    ${data.id || details.id}`);
      console.log(`   Product Count: ${data.product_count ?? details.product_count ?? 0}`);
      console.log(`   Feed Count:    ${data.feed_count ?? details.feed_count ?? 0}`);
    } catch (err) {
      console.error("\x1b[31m%s\x1b[0m", `❌ Connection Failed: ${err.message}`);
      if (err.error_subcode === 33 || err.message?.includes("Unsupported get request")) {
        console.log("\n\x1b[33m%s\x1b[0m", "💡 Why this error happens:");
        console.log("   In Meta Graph API, 'Unsupported get request (Error 100, Subcode 33)' means your");
        console.log("   Access Token does not have permission to view or manage this Catalog ID.");
        console.log("\n\x1b[36m%s\x1b[0m", "👉 Solution Steps:");
        console.log("   1. In Meta Business Settings (business.facebook.com/settings) > Users > System Users:");
        console.log("      Select your System User -> Click 'Add Assets' -> Catalogs -> Select catalog " + catalogId);
        console.log("      Enable 'Manage Catalog' (Full control) -> Save Changes.");
        console.log("   2. Click 'Generate New Token' on the System User -> Ensure 'catalog_management' is checked.");
        console.log("   3. Put the new token into .env as META_ACCESS_TOKEN=<your_new_token>.");
      } else if (err.response) {
        console.error(JSON.stringify(err.response, null, 2));
      }
      process.exit(1);
    }
    return;
  }

  if (isFetch) {
    console.log(`\n📦 Fetching products from Meta Catalog (${catalogId})...`);
    try {
      const fields = [
        ProductItem.Fields.id,
        ProductItem.Fields.retailer_id,
        ProductItem.Fields.name,
        ProductItem.Fields.price,
        ProductItem.Fields.availability,
        ProductItem.Fields.image_url,
      ];
      const productsCursor = await catalog.getProducts(fields, { limit: 25 });
      console.log(`\x1b[32m%s\x1b[0m`, `✅ Retrieved ${productsCursor.length} items from Meta:`);
      for (const p of productsCursor) {
        console.log(` - [${p.retailer_id || p.id}] ${p.name} | ${p.price || "N/A"} (${p.availability || "unknown"})`);
      }
    } catch (err) {
      console.error("\x1b[31m%s\x1b[0m", `❌ Fetch Failed: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // Full Sync
  console.log(`\n🚀 Starting Catalog Synchronization...`);
  console.log(`   Target Catalog ID: ${catalogId}`);
  console.log(`   Mode:              ${modeArg}`);
  if (productArg) console.log(`   Target Product:    ${productArg}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("\x1b[31m%s\x1b[0m", "❌ Supabase configuration missing in .env.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let query = supabase
    .from("products")
    .select(`
      id, slug, name, name_bn, summary, summary_bn, description,
      status, google_product_category, product_type,
      category:categories(name, google_product_category, product_type),
      variants:product_variants(*),
      images:product_images(*)
    `)
    .eq("status", "active");

  if (productArg) query = query.eq("id", productArg);

  const { data: dbProducts, error: dbErr } = await query;

  if (dbErr || !dbProducts || dbProducts.length === 0) {
    console.error("\x1b[31m%s\x1b[0m", `❌ No active products found: ${dbErr?.message || "Empty set"}`);
    process.exit(1);
  }

  console.log(`📦 Found ${dbProducts.length} active product(s) in Supabase.`);

  // Check existing items if mode is auto
  const existingIds = new Set();
  if (modeArg === "auto") {
    try {
      const cursor = await catalog.getProducts([ProductItem.Fields.id, ProductItem.Fields.retailer_id], { limit: 100 });
      for (const p of cursor) {
        if (p.retailer_id) existingIds.add(String(p.retailer_id));
        if (p.id) existingIds.add(String(p.id));
      }
    } catch {
      // Ignore if empty
    }
  }

  const requests = [];

  for (const prod of dbProducts) {
    const rawImages = Array.isArray(prod.images) ? prod.images : [];
    rawImages.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

    // Resolve all image URLs to absolute public HTTPS URLs
    const allResolvedImages = rawImages
      .map((img) => {
        const sp = img.storage_path;
        if (!sp) return null;
        if (sp.startsWith("http://") || sp.startsWith("https://")) return sp;
        return sp.startsWith("http") ? sp : `https://ik.imagekit.io/qusal/${sp.replace(/^\//, "")}`;
      })
      .filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx);

    let primaryImageUrl = allResolvedImages[0] || `${siteUrl}/images/products/blackstrap-drum.jpg`;
    const extraImageUrls = allResolvedImages.filter((u) => u !== primaryImageUrl);

    const title = prod.name_bn || prod.name;
    const desc = prod.summary_bn || prod.summary || prod.description || title;
    const link = prod.slug ? `${siteUrl}/products/${prod.slug}` : `${siteUrl}#${prod.id}`;
    const variants = (prod.variants || []).filter((v) => v.is_active !== false);

    const defaultVar = variants.find((v) => v.is_default) || variants[0] || { price: 500, stock_status: "in_stock" };
    const priceStr = `${(Number(defaultVar.price) || 0).toFixed(2)} BDT`;
    const availability = defaultVar.stock_status === "out_of_stock" ? "out of stock" : "in stock";

    const defaultGpc = "Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses";
    const basePType = "Food & Beverage > Pantry > Sweeteners";
    let gpc = prod.google_product_category?.trim() || prod.category?.google_product_category?.trim() || defaultGpc;
    let pType = prod.product_type?.trim() || prod.category?.product_type?.trim() || "";

    if (!pType) {
      const slug = (prod.slug || "").toLowerCase();
      const name = `${prod.name || ""} ${prod.name_bn || ""}`.toLowerCase();
      if (slug.includes("nut-jaggery") || slug.includes("badam") || name.includes("বাদাম")) {
        pType = `${basePType} > Specialty Jaggery > Nut Jaggery`;
      } else if (slug.includes("coconut") || name.includes("নারিকেল") || name.includes("নারকেল")) {
        pType = `${basePType} > Specialty Jaggery > Coconut Jaggery`;
      } else if (slug.includes("grainy") || name.includes("দানাদার")) {
        pType = `${basePType} > Liquid Jaggery > Granular Jhola Gur`;
      } else if (slug.includes("liquid") || name.includes("পাতলা") || name.includes("ঝোলা")) {
        pType = `${basePType} > Liquid Jaggery > Thin Jhola Gur`;
      } else if (slug.includes("first-cut") || name.includes("প্রথম কাট")) {
        pType = `${basePType} > Date Palm Jaggery > First Cut Patali`;
      } else if (slug.includes("chocolate") || slug.includes("sandesh") || name.includes("সন্দেশ") || name.includes("চকলেট")) {
        pType = `${basePType} > Flavored Jaggery > Sandesh Gur`;
      } else if (slug.includes("patali") || name.includes("পাটালি") || name.includes("পাঙালি") || name.includes("পাঙ্গালী")) {
        pType = `${basePType} > Date Palm Jaggery > Patali Gur`;
      } else {
        pType = `${basePType} > ${prod.category?.name || "Date Palm Jaggery"}`;
      }
    }

    const method =
      modeArg === "create" ? "create" : modeArg === "update" ? "update" : existingIds.has(prod.id) ? "update" : "create";

    requests.push({
      method,
      data: {
        id: prod.id,
        title,
        description: desc,
        brand: "খেজুরের খাটি গুড়",
        price: priceStr,
        image_link: primaryImageUrl,
        ...(extraImageUrls.length > 0
          ? {
              additional_image_link: extraImageUrls,
              additional_image_urls: extraImageUrls,
            }
          : {}),
        availability,
        link,
        condition: "new",
        google_product_category: gpc,
        product_type: pType,
        fb_product_category: gpc,
      },
    });

    console.log(
      `   + Prepared [${method.toUpperCase()}] ${title} (${priceStr})\n` +
      `     • Google Product Category: ${gpc}\n` +
      `     • Product Type:            ${pType}\n` +
      `     • ID: ${prod.id} (${1 + extraImageUrls.length} total images)`
    );
  }

  console.log(`\n📤 Dispatching items_batch to Meta Business SDK (${requests.length} item(s))...`);

  try {
    const response = await catalog.createItemsBatch([], {
      item_type: "PRODUCT_ITEM",
      requests,
    });
    console.log("\x1b[32m%s\x1b[0m", `\n✅ Meta Catalog Synchronization Finished!`);
    console.log(`   Handles: ${JSON.stringify(response.handles || response._data?.handles || [])}`);
  } catch (err) {
    console.error("\x1b[31m%s\x1b[0m", `\n❌ Batch Upload Failed: ${err.message}`);
    if (err.response) console.error(JSON.stringify(err.response, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

