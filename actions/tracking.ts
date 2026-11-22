"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/security";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import { getStorefrontProductsAction } from "@/actions/storefront-products";
import type {
  ParcelTrackingData,
  ParcelTrackingResult,
  ParcelCheckpoint,
  ParcelTrackingItem,
} from "@/types/tracking";

/**
 * Masks customer phone number for public privacy.
 * E.g. "+8801712345678" -> "017******78"
 */
function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "–";
  const clean = phone.replace(/[^0-9]/g, "");
  const local = clean.startsWith("880") ? clean.slice(2) : clean;
  if (local.length >= 7) {
    const prefix = local.slice(0, 3);
    const suffix = local.slice(-2);
    return `${prefix}******${suffix}`;
  }
  return local.replace(/.(?=.{2})/g, "*");
}

/**
 * Masks customer name for privacy.
 * E.g. "Mohammad Rahman" -> "M******n"
 */
function maskName(name?: string | null): string {
  if (!name || !name.trim()) return "সম্মানিত গ্রাহক / Valued Customer";
  const trimmed = name.trim();
  if (trimmed.length <= 2) return `${trimmed[0]}*`;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  return `${first}${"*".repeat(Math.min(6, trimmed.length - 2))}${last}`;
}

/**
 * Local fallback photography if database has no image
 */
function resolveItemImageFallback(productName?: string, variantName?: string): string {
  const text = `${productName || ""} ${variantName || ""}`.toLowerCase();
  if (text.includes("ঝোল") || text.includes("liquid") || text.includes("নলেন")) {
    return "/images/products/date-palm-liquid.jpg";
  }
  if (text.includes("পাটালী") || text.includes("patali") || text.includes("দানাদার")) {
    return "/images/products/date-palm-patali.jpg";
  }
  if (text.includes("জার") || text.includes("jar")) {
    return "/images/products/nolen-gur-jar.jpg";
  }
  if (text.includes("আখের") || text.includes("sugarcane")) {
    return "/images/products/organic-sugarcane.jpg";
  }
  return "/images/products/date-palm-patali.jpg";
}

/**
 * Calculates delivery ETA strings in Bengali and English
 */
function computeDeliveryEta(dateStr?: string | null) {
  const baseDate = dateStr ? new Date(dateStr) : new Date();
  const valid = !isNaN(baseDate.getTime()) ? baseDate : new Date();

  const minDate = new Date(valid);
  minDate.setDate(minDate.getDate() + 2);

  const maxDate = new Date(valid);
  maxDate.setDate(maxDate.getDate() + 3);

  const bnMonths = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
  ];
  const enMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const toBn = (n: number) => String(n).replace(/\d/g, (d) => bnDigits[Number(d)] ?? d);

  const minDayBn = toBn(minDate.getDate());
  const maxDayBn = toBn(maxDate.getDate());
  const minMonthBn = bnMonths[minDate.getMonth()];
  const maxMonthBn = bnMonths[maxDate.getMonth()];
  const yearBn = toBn(maxDate.getFullYear());

  const minDayEn = minDate.getDate();
  const maxDayEn = maxDate.getDate();
  const minMonthEn = enMonths[minDate.getMonth()];
  const maxMonthEn = enMonths[maxDate.getMonth()];
  const yearEn = maxDate.getFullYear();

  const rangeBn =
    minDate.getMonth() === maxDate.getMonth()
      ? `${minDayBn} - ${maxDayBn} ${maxMonthBn}, ${yearBn}`
      : `${minDayBn} ${minMonthBn} - ${maxDayBn} ${maxMonthBn}, ${yearBn}`;

  const rangeEn =
    minDate.getMonth() === maxDate.getMonth()
      ? `${minMonthEn} ${minDayEn} - ${maxDayEn}, ${yearEn}`
      : `${minMonthEn} ${minDayEn} - ${maxDayEn}, ${yearEn}`;

  return {
    rangeBn,
    rangeEn,
    daysBn: "২ থেকে ৩ দিনের মধ্যে",
    daysEn: "Within 2 - 3 business days",
  };
}

export async function getParcelTrackingAction(
  orderId: string
): Promise<ParcelTrackingResult> {
  const cleanId = (orderId || "").trim();
  if (!cleanId || !isValidUuid(cleanId)) {
    return {
      success: false,
      error: "Invalid or expired tracking link.",
      notFound: true,
    };
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch Order details strictly by public_token for guest order privacy
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        public_token,
        status,
        fulfillment_status,
        payment_status,
        payment_method,
        subtotal,
        shipping_total,
        grand_total,
        amount_paid,
        total_weight_kg,
        courier_consignment_id,
        courier_tracking_code,
        courier_tracking_url,
        shipping_address,
        customer_name,
        customer_phone,
        shipping_phone,
        customer_alternative_phone,
        placed_at,
        confirmed_at,
        shipped_at,
        delivered_at,
        created_at
      `)
      .eq("public_token", cleanId)
      .maybeSingle();

    if (orderErr) {
      console.error("[TrackingAction] Order query error:", orderErr);
      return {
        success: false,
        error: "Failed to retrieve tracking data. Please try again later.",
      };
    }

    if (!order) {
      return {
        success: false,
        error: "No parcel found matching this identifier.",
        notFound: true,
      };
    }

    // 2. Fetch Order Items
    const { data: rawItems } = await supabase
      .from("order_items")
      .select("id, product_id, variant_id, product_name, variant_name, quantity, unit_price, line_total, weight_grams, sku")
      .eq("order_id", order.id);

    // 3. Fetch authentic original product pictures from product_images and storefront catalog
    let catalogProducts: Array<{ id: string; name: string; nameBn?: string; image?: string }> = [];
    try {
      const storefrontData = await getStorefrontProductsAction();
      catalogProducts = storefrontData?.products || [];
    } catch (catErr) {
      console.warn("[TrackingAction] Failed to load storefront catalog for images:", catErr);
    }

    const productIds = (rawItems || []).map((i) => i.product_id).filter(Boolean);
    const productImagesMap = new Map<string, string>(); // key: variant_id || product_id -> cdnUrl

    if (productIds.length > 0) {
      try {
        const { data: dbImages } = await supabase
          .from("product_images")
          .select("product_id, variant_id, storage_path, is_primary, sort_order")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (dbImages) {
          for (const img of dbImages) {
            const resolvedUrl = resolveCdnImageUrl(img.storage_path);
            if (resolvedUrl) {
              if (img.variant_id && !productImagesMap.has(img.variant_id)) {
                productImagesMap.set(img.variant_id, resolvedUrl);
              }
              if (img.product_id && !productImagesMap.has(img.product_id)) {
                productImagesMap.set(img.product_id, resolvedUrl);
              }
            }
          }
        }
      } catch (imgLookupErr) {
        console.warn("[TrackingAction] Failed to fetch product_images:", imgLookupErr);
      }
    }

    const items: ParcelTrackingItem[] = (rawItems || []).map((item) => {
      const wGrams = Number(item.weight_grams) || 0;
      const wKg = wGrams > 0 ? wGrams / 1000 : 1;

      // Resolution hierarchy for original product photos:
      // 1. Exact variant image from product_images
      let originalImage = item.variant_id ? productImagesMap.get(item.variant_id) : undefined;

      // 2. Product primary/first image from product_images
      if (!originalImage && item.product_id) {
        originalImage = productImagesMap.get(item.product_id);
      }

      // 3. Match from active storefront catalog by product_id
      if (!originalImage && item.product_id && catalogProducts.length > 0) {
        const matched = catalogProducts.find((p) => p.id === item.product_id);
        if (matched?.image) {
          originalImage = matched.image;
        }
      }

      // 4. Match from active storefront catalog by product name / Bengali name
      if (!originalImage && item.product_name && catalogProducts.length > 0) {
        const cleanName = item.product_name.trim().toLowerCase();
        const matched = catalogProducts.find((p) => {
          const pName = (p.name || "").toLowerCase();
          const pNameBn = (p.nameBn || "").toLowerCase();
          return (
            pName === cleanName ||
            pNameBn === cleanName ||
            cleanName.includes(pName) ||
            (pNameBn && cleanName.includes(pNameBn))
          );
        });
        if (matched?.image) {
          originalImage = matched.image;
        }
      }

      // 5. Fallback only if no product photo is stored in the database
      if (!originalImage) {
        originalImage = resolveItemImageFallback(item.product_name, item.variant_name);
      }

      return {
        id: item.id,
        productName: item.product_name || "খেজুরের গুড়",
        variantName: item.variant_name || null,
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unit_price) || 0,
        lineTotal: Number(item.line_total) || 0,
        weightGrams: wGrams,
        weightKg: wKg,
        sku: item.sku || undefined,
        description: "গাছিদের সংগ্রহ করা তাজা ও নির্ভেজাল ঐতিহ্যবাহী খাঁটি গুড়।",
        image: originalImage,
      };
    });

    // 4. Fetch Order Events / Checkpoints
    const { data: rawEvents } = await supabase
      .from("order_events")
      .select("id, event_type, from_value, to_value, message, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    const checkpoints: ParcelCheckpoint[] = (rawEvents || []).map((ev) => {
      const type = (ev.event_type || "").toLowerCase();
      let stage: ParcelCheckpoint["stage"] = "general";
      let isCourier = false;

      if (type.includes("placed") || type.includes("created")) {
        stage = "placed";
      } else if (type.includes("confirm")) {
        stage = "confirmed";
      } else if (type.includes("process") || type.includes("pack")) {
        stage = "processing";
      } else if (type.includes("ship") || type.includes("dispatched")) {
        stage = "shipped";
        isCourier = true;
      } else if (type.includes("in_transit") || type.includes("courier_tracking_step")) {
        stage = "in_transit";
        isCourier = true;
      } else if (type.includes("out_for_delivery")) {
        stage = "out_for_delivery";
        isCourier = true;
      } else if (type.includes("delivered")) {
        stage = "delivered";
        isCourier = true;
      } else if (type.includes("return")) {
        stage = "returned";
        isCourier = true;
      } else if (type.includes("cancel")) {
        stage = "cancelled";
      }

      if (type.startsWith("courier_") || (ev.message || "").toLowerCase().includes("steadfast")) {
        isCourier = true;
      }

      return {
        id: ev.id,
        eventType: ev.event_type,
        message: ev.message || "Status updated",
        timestamp: ev.created_at,
        stage,
        isCourierEvent: isCourier,
      };
    });

    // Ensure baseline checkpoints exist based on order timestamps if events were empty
    if (checkpoints.length === 0) {
      if (order.placed_at || order.created_at) {
        checkpoints.push({
          id: "synth-placed",
          eventType: "order_placed",
          message: "অর্ডার সফলভাবে গ্রহণ করা হয়েছে (Order Placed)",
          timestamp: order.placed_at || order.created_at,
          stage: "placed",
          isCourierEvent: false,
        });
      }
      if (order.confirmed_at) {
        checkpoints.push({
          id: "synth-confirmed",
          eventType: "order_confirmed",
          message: "অর্ডার নিশ্চিত ও যাচাই সম্পন্ন হয়েছে (Order Confirmed)",
          timestamp: order.confirmed_at,
          stage: "confirmed",
          isCourierEvent: false,
        });
      }
      if (order.shipped_at) {
        checkpoints.push({
          id: "synth-shipped",
          eventType: "order_shipped",
          message: "কুরিয়ার পার্টনারে হস্তান্তর করা হয়েছে (Dispatched to Courier)",
          timestamp: order.shipped_at,
          stage: "shipped",
          isCourierEvent: true,
        });
      }
      if (order.delivered_at) {
        checkpoints.push({
          id: "synth-delivered",
          eventType: "order_delivered",
          message: "পার্সেল গ্রাহকের কাছে সফলভাবে পৌঁছে দেওয়া হয়েছে (Delivered)",
          timestamp: order.delivered_at,
          stage: "delivered",
          isCourierEvent: true,
        });
      }
    }

    // 5. Privacy-preserving customer fields
    const resolvedPhone =
      order.customer_phone ||
      order.shipping_phone ||
      order.customer_alternative_phone ||
      order.shipping_address?.phone ||
      "";
    const maskedCustomerPhone = maskPhoneNumber(resolvedPhone);
    const maskedCustomerName = maskName(
      order.customer_name || order.shipping_address?.recipient_name
    );

    const destinationDistrict =
      order.shipping_address?.district ||
      order.shipping_address?.city ||
      "Dhaka / ঢাকা";
    const destinationDivision =
      order.shipping_address?.division || undefined;

    // 6. Courier Info
    const courierTrackingCode = order.courier_tracking_code || null;
    const courierConsignmentId = order.courier_consignment_id || null;
    const courierTrackingUrl =
      order.courier_tracking_url ||
      (courierTrackingCode ? `https://steadfast.com.bd/t/${courierTrackingCode}` : null);

    // 7. Delivery ETA
    const eta = computeDeliveryEta(order.shipped_at || order.confirmed_at || order.placed_at);

    // 8. Financials
    const computedSubtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const subtotal = Number(order.subtotal) > 0 ? Number(order.subtotal) : computedSubtotal;
    const shippingTotal = Number(order.shipping_total) || 0;
    const grandTotal = Number(order.grand_total) || (subtotal + shippingTotal);
    const amountPaid = Number(order.amount_paid) || 0;
    const codPayable = Math.max(0, grandTotal - amountPaid);
    const totalWeightKg = Number(order.total_weight_kg) || items.reduce((sum, it) => sum + (it.weightKg || 1) * it.quantity, 0);

    const trackingData: ParcelTrackingData = {
      orderId: order.id,
      orderNumber: order.order_number,
      publicToken: order.public_token,
      status: order.status,
      fulfillmentStatus: order.fulfillment_status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      subtotal,
      shippingTotal,
      grandTotal,
      amountPaid,
      codPayable,
      totalWeightKg,

      maskedCustomerName,
      maskedCustomerPhone,
      destinationDistrict,
      destinationDivision,

      courierName: "Steadfast Courier",
      courierTrackingCode,
      courierConsignmentId,
      courierTrackingUrl,

      placedAt: order.placed_at || order.created_at,
      confirmedAt: order.confirmed_at || null,
      shippedAt: order.shipped_at || null,
      deliveredAt: order.delivered_at || null,

      estimatedDeliveryRangeBn: eta.rangeBn,
      estimatedDeliveryRangeEn: eta.rangeEn,
      estimatedDeliveryDaysBn: eta.daysBn,
      estimatedDeliveryDaysEn: eta.daysEn,

      checkpoints,
      items,
    };

    return {
      success: true,
      data: trackingData,
    };
  } catch (error: any) {
    console.error("[TrackingAction] Unexpected exception:", error);
    return {
      success: false,
      error: "An unexpected error occurred while fetching parcel details.",
    };
  }
}
