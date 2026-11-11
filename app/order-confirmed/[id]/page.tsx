"use client";

import React, { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Copy,
  Check,
  Phone,
  MessageSquare,
  ShoppingBag,
  ArrowLeft,
  Truck,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  CalendarCheck,
  Clock,
  PhoneCall,
  PackageCheck,
  MapPin,
  User,
  RotateCcw,
  FileText,
} from "lucide-react";
import { formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { markReturningCustomer } from "@/lib/storefront-intro";
import { useOrder } from "@/hooks/use-order";
import { useStorefrontProducts } from "@/hooks/use-storefront-products";
import type { OrderItem } from "@/types/order";
import { getClientFbpAndFbc, trackPurchase } from "@/lib/facebook-pixel";
import { enrichOrderMetaTrackingAction } from "@/actions/facebook-capi";

const HOTLINE_NUMBER = "01843557389";
const RAW_HOTLINE = HOTLINE_NUMBER.replace(/[^0-9]/g, "");

/**
 * Calculates probable delivery date range (2 to 3 days after order placed).
 */
function getProbableDeliveryDetails(dateStr?: string) {
  const baseDate = dateStr ? new Date(dateStr) : new Date();
  const valid = !isNaN(baseDate.getTime()) ? baseDate : new Date();

  const minDate = new Date(valid);
  minDate.setDate(minDate.getDate() + 2);

  const maxDate = new Date(valid);
  maxDate.setDate(maxDate.getDate() + 3);

  const bnMonths = [
    "জানুয়ারি",
    "ফেব্রুয়ারি",
    "মার্চ",
    "এপ্রিল",
    "মে",
    "জুন",
    "জুলাই",
    "আগস্ট",
    "সেপ্টেম্বর",
    "অক্টোবর",
    "নভেম্বর",
    "ডিসেম্বর",
  ];

  const minDay = toBnNumber(minDate.getDate());
  const maxDay = toBnNumber(maxDate.getDate());
  const minMonth = bnMonths[minDate.getMonth()];
  const maxMonth = bnMonths[maxDate.getMonth()];
  const year = toBnNumber(maxDate.getFullYear());

  const rangeText =
    minDate.getMonth() === maxDate.getMonth()
      ? `${minDay} - ${maxDay} ${maxMonth}, ${year}`
      : `${minDay} ${minMonth} - ${maxDay} ${maxMonth}, ${year}`;

  return {
    rangeText,
    relativeDaysText: "২ থেকে ৩ দিনের মধ্যে",
  };
}

/**
 * Matches item name to local product photography
 */
function getItemImage(productName?: string, variantName?: string): string {
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

function OrderConfirmedSkeleton() {
  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 flex flex-col justify-between p-4 sm:p-8 select-none">
      {/* Background Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-2xl mx-auto w-full flex items-center justify-between pb-4 border-b border-amber-200/80 dark:border-stone-800">
        <motion.div whileHover={{ x: -2 }} transition={{ duration: 0.15 }}>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold hover:text-amber-700 transition-colors text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>দোকানে ফিরে যান</span>
          </Link>
        </motion.div>

        <div className="flex items-center gap-1.5 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-700/60 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-950 dark:text-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span>খাঁটি খেজুরের গুড়</span>
        </div>
      </header>

      {/* Main Skeleton Card */}
      <div className="relative z-10 max-w-2xl mx-auto w-full my-auto py-6">
        <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border border-amber-200/90 dark:border-stone-800 shadow-2xl shadow-amber-950/10 p-5 sm:p-8 text-center space-y-5">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg ring-8 ring-emerald-50 dark:ring-emerald-900/30">
              <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.5]" />
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-3xl font-black text-amber-950 dark:text-amber-100 tracking-tight leading-tight flex items-center justify-center gap-2">
              <span>ধন্যবাদ! আপনার অর্ডারটি গ্রহণ করা হয়েছে</span>
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400 shrink-0" />
            </h1>
            <div className="mt-2.5 max-w-sm mx-auto space-y-2">
              <div className="h-3.5 bg-amber-200/50 dark:bg-stone-700/50 rounded-full animate-pulse w-3/4 mx-auto" />
              <div className="h-3 bg-amber-200/40 dark:bg-stone-700/40 rounded-full animate-pulse w-1/2 mx-auto" />
            </div>
          </div>

          <div className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl border border-amber-200/80 dark:border-stone-700/80 p-4 text-left space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-amber-200/60 dark:border-stone-700/60">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                অর্ডার নম্বর:
              </span>
              <div className="h-5 w-28 bg-amber-200/60 dark:bg-stone-700/60 rounded-md animate-pulse" />
            </div>

            {/* Probable delivery skeleton */}
            <div className="flex items-center justify-between text-xs sm:text-sm bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/60 px-3 py-2 rounded-xl">
              <span className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-200">
                <CalendarCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>সম্ভাব্য ডেলিভারি তারিখ:</span>
              </span>
              <div className="h-4 w-32 bg-amber-200/60 dark:bg-stone-700/60 rounded animate-pulse" />
            </div>

            {/* Invoice Table Skeleton */}
            <div className="pt-3 pb-1 border-t border-amber-200/60 dark:border-stone-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-36 bg-amber-200/60 dark:bg-stone-700/60 rounded animate-pulse" />
                <div className="h-4 w-16 bg-amber-200/40 dark:bg-stone-700/40 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-200/50 dark:bg-stone-700/50 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 bg-amber-200/50 dark:bg-stone-700/50 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-amber-200/40 dark:bg-stone-700/40 rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-amber-200/60 dark:bg-stone-700/60 rounded animate-pulse" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-dashed border-amber-300/80 dark:border-stone-700">
              <div>
                <span className="block text-xs font-bold text-stone-700 dark:text-stone-300 leading-tight">
                  ক্যাশ অন ডেলিভারি মোট প্রদেয়:
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  পণ্য হাতে পেয়ে দেখে টাকা দিন
                </span>
              </div>
              <div className="h-6 w-24 bg-amber-200/60 dark:bg-stone-700/60 rounded-md animate-pulse" />
            </div>
          </div>

          {/* Skeleton Section 1: Delivery Address Placeholder */}
          <div className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl border border-amber-200/80 dark:border-stone-700/80 p-4 text-left space-y-2.5">
            <div className="h-4 w-44 bg-amber-200/60 dark:bg-stone-700/60 rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="h-10 bg-amber-200/40 dark:bg-stone-700/40 rounded-xl animate-pulse" />
              <div className="h-10 bg-amber-200/40 dark:bg-stone-700/40 rounded-xl animate-pulse" />
            </div>
            <div className="h-12 bg-amber-200/40 dark:bg-stone-700/40 rounded-xl animate-pulse" />
          </div>

          {/* Skeleton Section 2: Timeline Placeholder */}
          <div className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl border border-amber-200/80 dark:border-stone-700/80 p-4 text-left space-y-2.5">
            <div className="h-4 w-48 bg-amber-200/60 dark:bg-stone-700/60 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-9 bg-amber-200/40 dark:bg-stone-700/40 rounded-xl animate-pulse" />
              <div className="h-9 bg-amber-200/40 dark:bg-stone-700/40 rounded-xl animate-pulse" />
            </div>
          </div>

          <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800 rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>কোন অগ্রিম টাকা দেওয়া লাগবে না। পার্সেল খুলে পরীক্ষা করার পর ডেলিভারিম্যানকে টাকা দিন।</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <a
              href={`tel:${RAW_HOTLINE}`}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm"
            >
              <Phone className="w-4 h-4" />
              <span>সরাসরি ফোনে কথা বলুন</span>
            </a>

            <div className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm">
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp চ্যাট করুন</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold text-xs sm:text-sm transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>আরও গুড় দেখতে দোকানে ফিরে যান</span>
            </Link>
          </div>
        </div>
      </div>

      <footer className="relative z-10 max-w-2xl mx-auto w-full text-center pt-4 border-t border-amber-200/80 dark:border-stone-800 text-[11px] text-stone-500">
        © 2026 খেজুরের খাঁটি গুড় • ঐতিহ্যবাহী নির্ভেজাল গুড়ের বিশ্বস্ত ঠিকানা
      </footer>
    </main>
  );
}

function OrderConfirmedContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orderId = (params?.id || "").trim();
  const receiptToken = (searchParams?.get("token") || "").trim() || null;
  const [copied, setCopied] = useState(false);

  // TanStack Query to fetch the single scrubbed order using the secret receipt token
  const { data: order, isLoading } = useOrder(orderId, {
    mode: "public",
    publicToken: receiptToken,
    enabled: Boolean(orderId && receiptToken),
    refetchInterval: (query) => {
      const currentOrder = query.state.data;
      if (currentOrder && currentOrder.status === "pending") {
        return 4000;
      }
      return false;
    },
  });

  const handleCopyOrderNumber = () => {
    if (order?.order_number && typeof navigator !== "undefined" && navigator?.clipboard) {
      navigator.clipboard.writeText(order.order_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch real products from server for authentic real product pictures
  const { data: storefrontData } = useStorefrontProducts();
  const catalogProducts = storefrontData?.products ?? [];

  const resolveRealProductImage = (item: OrderItem): string => {
    // 1. Direct image returned from order item on server
    if (item.image && typeof item.image === "string" && item.image.trim()) {
      return item.image;
    }

    // 2. Look up product in server catalog by product_id
    if (item.product_id && catalogProducts.length > 0) {
      const match = catalogProducts.find((p) => p.id === item.product_id);
      if (match?.image) return match.image;
    }

    // 3. Look up product in server catalog by product_name / product_name_bn
    if (item.product_name && catalogProducts.length > 0) {
      const cleanItemName = item.product_name.trim().toLowerCase();
      const match = catalogProducts.find((p) => {
        const pName = p.name.toLowerCase();
        const pNameBn = p.nameBn?.toLowerCase() || "";
        return (
          pName === cleanItemName ||
          pNameBn === cleanItemName ||
          cleanItemName.includes(pName) ||
          (pNameBn && cleanItemName.includes(pNameBn))
        );
      });
      if (match?.image) return match.image;
    }

    // 4. Default fallback image
    return getItemImage(item.product_name, item.variant_name);
  };
  
  // Requirement 2: Calculate probable delivery date (2-3 days later) on client to avoid unstable Date() in prerendering
  const [deliveryDetails, setDeliveryDetails] = useState<{
    rangeText: string;
    relativeDaysText: string;
  } | null>(null);

  useEffect(() => {
    setDeliveryDetails(getProbableDeliveryDetails(order?.date));
  }, [order?.date]);

  // Automatic Silent Tracking Enrichment & Deduplicated Pixel Purchase Event
  useEffect(() => {
    const orderNum = order?.order_number || order?.id;
    if (!order || !orderNum) return;

    markReturningCustomer();

    let isForceTest = false;
    let publicToken: string | undefined;
    if (typeof window !== "undefined") {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        publicToken = searchParams.get("token") || undefined;
        isForceTest = searchParams.get("test") === "1" || searchParams.get("force") === "1";
      } catch {
        // Safe fallback
      }
    }

    // 1. Fire browser Pixel Purchase event (with deduplication key = order_number)
    // Gate to ensure only confirmed/eligible orders are counted, matching CAPI purchase rules.
    let purchaseEventId: string | undefined;
    const CONFIRMED_PURCHASE_ELIGIBLE_STATUSES = [
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "partially_delivered",
    ];
    if (order.status && CONFIRMED_PURCHASE_ELIGIBLE_STATUSES.includes(order.status)) {
      const res = trackPurchase({
        orderNumber: orderNum,
        orderId: order.id,
        value: order.grand_total,
        currency: order.currency || "BDT",
        items: (order.items || []).map((item) => ({
          productId: item.product_id || undefined,
          variantId: item.variant_id || undefined,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })),
        phone: order.phone || order.shipping_phone,
        force: isForceTest,
      });
      purchaseEventId = res.eventId;
    }

    // 2. Silently enrich server meta_tracking with genuine customer IP, User-Agent, _fbp, _fbc, and shared eventId
    const { fbp, fbc } = getClientFbpAndFbc();
    const currentUrl = typeof window !== "undefined" ? window.location.href : undefined;

    enrichOrderMetaTrackingAction({
      orderIdentifier: orderNum,
      publicToken,
      fbp,
      fbc,
      url: currentUrl,
      eventId: purchaseEventId,
    }).catch((enrichErr) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Order Confirmed] Failed to enrich meta tracking:", enrichErr);
      }
    });
  }, [order?.order_number, order?.id, order?.status, order?.grand_total, order?.phone, order?.shipping_phone]);

  const whatsappMessage = encodeURIComponent(
    order?.order_number
      ? `আসসালামু আলাইকুম, আমি খাঁটি গুড় অর্ডার করেছি। আমার অর্ডার নম্বর: ${order.order_number}`
      : `আসসালামু আলাইকুম, আমি খাঁটি গুড় অর্ডার করেছি।`
  );

  const recipientName =
    order?.recipient_name || order?.customer || order?.address?.recipient_name;
  const primaryPhone =
    order?.phone || order?.shipping_phone || order?.address?.phone;
  const altPhone = order?.alternative_phone;
  const addressParts = [
    order?.address?.address_line?.trim(),
    order?.address?.district?.trim(),
    order?.address?.division?.trim(),
  ].filter(Boolean);
  const formattedAddress = addressParts.join(", ");

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 flex flex-col justify-between p-4 sm:p-8 select-none">
      {/* Background Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-2xl mx-auto w-full flex items-center justify-between pb-4 border-b border-amber-200/80 dark:border-stone-800">
        <motion.div whileHover={{ x: -2 }} transition={{ duration: 0.15 }}>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold hover:text-amber-700 transition-colors text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>দোকানে ফিরে যান</span>
          </Link>
        </motion.div>

        <div className="flex items-center gap-1.5 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-700/60 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-950 dark:text-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span>খাঁটি খেজুরের গুড়</span>
        </div>
      </header>

      {/* Main Content Card */}
      <div className="relative z-10 max-w-2xl mx-auto w-full my-auto py-6">
        {/* If order not found and not loading: Friendly Not Found view */}
        {!isLoading && !order ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border border-amber-200/90 dark:border-stone-800 shadow-2xl shadow-amber-950/10 p-6 sm:p-8 text-center space-y-5"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-lg ring-8 ring-amber-50 dark:ring-amber-900/30">
              <HelpCircle className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.2]" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-100">
                অর্ডারটি খুঁজে পাওয়া যায়নি
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-2 max-w-md mx-auto leading-relaxed">
                দুঃখিত, এই লিংকের কোনো অর্ডার পাওয়া যায়নি। লিংকটি সঠিক কিনা যাচাই করুন অথবা সরাসরি আমাদের হটলাইনে কল করুন।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <a
                href={`tel:${RAW_HOTLINE}`}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm"
              >
                <Phone className="w-4 h-4" />
                <span>হটলাইনে কল করুন</span>
              </a>

              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-amber-100 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-amber-950 dark:text-amber-100 font-bold py-3 px-4 rounded-xl border border-amber-300/80 dark:border-stone-700 transition-all text-xs sm:text-sm"
              >
                <ShoppingBag className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>দোকানে ফিরে যান</span>
              </Link>
            </div>
          </motion.div>
        ) : (
          /* Normal Instant Success Card with Shimmer Placeholder while loading */
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border border-amber-200/90 dark:border-stone-800 shadow-2xl shadow-amber-950/10 p-5 sm:p-8 text-center space-y-5"
          >
            {/* Animated Success Badge with Spring & Radar Aura */}
            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 14, stiffness: 220, delay: 0.05 }}
              className="relative inline-flex items-center justify-center"
            >
              {/* Subtle expanding ping aura */}
              <motion.span
                initial={{ scale: 0.85, opacity: 0.6 }}
                animate={{ scale: 1.45, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border-2 border-emerald-400/50 pointer-events-none"
              />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg ring-8 ring-emerald-50 dark:ring-emerald-900/30">
                <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.5]" />
              </div>
            </motion.div>

            <div>
              <h1 className="text-xl sm:text-3xl font-black text-amber-950 dark:text-amber-100 tracking-tight leading-tight flex items-center justify-center gap-2">
                <span>ধন্যবাদ! আপনার অর্ডারটি গ্রহণ করা হয়েছে</span>
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400 shrink-0" />
              </h1>

              {isLoading ? (
                <div className="mt-2.5 max-w-sm mx-auto space-y-2">
                  <div className="h-3.5 bg-amber-200/50 dark:bg-stone-700/50 rounded-full animate-pulse w-3/4 mx-auto" />
                  <div className="h-3 bg-amber-200/40 dark:bg-stone-700/40 rounded-full animate-pulse w-1/2 mx-auto" />
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-1.5 max-w-md mx-auto leading-relaxed">
                  {order?.customer ? (
                    <>
                      প্রিয় <span className="font-bold text-stone-900 dark:text-stone-100">{order.customer}</span>,{" "}
                    </>
                  ) : null}
                  আমাদের প্রতিনিধি অল্প কিছুক্ষণের মধ্যেই আপনার নম্বরে
                  {order?.phone ? (
                    <>
                      {" "}(<span className="font-mono font-bold text-stone-900 dark:text-stone-100">{order.phone}</span>){" "}
                    </>
                  ) : (
                    " "
                  )}
                  কল করে ডেলিভারি ও ঠিকানা নিশ্চিত করবেন।
                </p>
              )}
            </div>

            {/* Order Details & Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl sm:rounded-3xl border border-amber-200/80 dark:border-stone-700/80 p-4 sm:p-5 text-left space-y-3 shadow-xs"
            >
              {/* Order Number Row */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-amber-200/60 dark:border-stone-700/60">
                <span className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400">
                  অর্ডার নম্বর:
                </span>
                {isLoading ? (
                  <div className="h-5 w-28 bg-amber-200/60 dark:bg-stone-700/60 rounded-md animate-pulse" />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                      {order?.order_number || "GUR-ORDER"}
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleCopyOrderNumber}
                      className="p-1 rounded-lg hover:bg-amber-200/60 dark:hover:bg-stone-700 transition-colors text-amber-900 dark:text-amber-300 cursor-pointer"
                      title="অর্ডার নম্বর কপি করুন"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {copied ? (
                          <motion.span
                            key="check"
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.4, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="inline-block text-emerald-600"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="copy"
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.4, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="inline-block"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Requirement 2: Show Probable Delivery Date (2-3 days later) */}
              <div className="flex items-center justify-between text-xs sm:text-sm bg-gradient-to-r from-amber-100/90 via-amber-50/90 to-amber-100/80 dark:from-amber-950/60 dark:via-stone-900/60 dark:to-amber-950/40 border border-amber-300/90 dark:border-amber-700/60 px-3 py-2.5 rounded-xl shadow-xs">
                <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-200">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <CalendarCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold leading-tight">সম্ভাব্য ডেলিভারি তারিখ</span>
                    <span className="block text-[10px] text-amber-800/80 dark:text-amber-400/80 font-medium">
                      ({deliveryDetails?.relativeDaysText || "২ থেকে ৩ দিনের মধ্যে"})
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {deliveryDetails ? (
                    <span className="font-mono font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-100 block">
                      {deliveryDetails.rangeText}
                    </span>
                  ) : (
                    <div className="h-4 w-32 bg-amber-200/50 dark:bg-stone-700/50 rounded animate-pulse" />
                  )}
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                    হোম ডেলিভারি
                  </span>
                </div>
              </div>

              {/* Requirement 1: Order Item Section styled identically to main page invoice */}
              {isLoading ? (
                <div className="pt-3 pb-1 border-t border-amber-200/60 dark:border-stone-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-36 bg-amber-200/60 dark:bg-stone-700/60 rounded animate-pulse" />
                    <div className="h-4 w-16 bg-amber-200/40 dark:bg-stone-700/40 rounded animate-pulse" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-200/50 dark:bg-stone-700/50 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-3/4 bg-amber-200/50 dark:bg-stone-700/50 rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-amber-200/40 dark:bg-stone-700/40 rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-16 bg-amber-200/60 dark:bg-stone-700/60 rounded animate-pulse" />
                  </div>
                </div>
              ) : order?.items && order.items.length > 0 ? (
                <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2.5">
                  {/* Invoice Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-stone-200/80 dark:border-stone-800">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                      <ShoppingBag className="w-4 h-4 text-amber-600" />
                      <span>অর্ডারের সারসংক্ষেপ</span>
                    </div>
                    <span className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 font-bold">
                      {toBnNumber(order.items.length)} পদের গুড়
                    </span>
                  </div>

                  {/* TanStack-like Invoice Table (Reused from Main Page Checkout) */}
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                          <th className="pb-1.5 pr-2 font-bold">পণ্যের বিবরণ ও পরিমাণ</th>
                          <th className="pb-1.5 pr-1 text-right font-bold">মোট মূল্য</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                        {order.items.map((item, idx) => {
                          const itemImg = resolveRealProductImage(item);
                          const total = item.line_total || item.unit_price * item.quantity;
                          return (
                            <motion.tr
                              key={item.id || idx}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, delay: idx * 0.05 + 0.1 }}
                              className="hover:bg-amber-50/50 dark:hover:bg-stone-800/40 transition-colors"
                            >
                              <td className="py-2.5 pr-2">
                                <div className="flex items-start gap-2.5 sm:gap-3">
                                  {/* Product Thumbnail Image */}
                                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-amber-100 dark:bg-stone-800 shrink-0 border border-amber-300/80 dark:border-stone-700 shadow-xs">
                                    <Image
                                      src={itemImg}
                                      alt={item.product_name || "খেজুরের গুড়"}
                                      fill
                                      className="object-cover"
                                      sizes="56px"
                                    />
                                  </div>

                                  {/* Product Title, Variant & Unit Price */}
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-baseline gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 leading-tight">
                                        {item.product_name}
                                      </span>
                                      {item.variant_name && (
                                        <span className="inline-block bg-amber-100/90 dark:bg-stone-800 text-amber-900 dark:text-amber-300 font-bold text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded border border-amber-200/80 dark:border-stone-700">
                                          {item.variant_name}
                                        </span>
                                      )}
                                    </div>

                                    {/* Unit Price */}
                                    <div className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-400 font-semibold">
                                      <span>দর: </span>
                                      <span className="font-mono font-bold text-stone-900 dark:text-stone-200">
                                        {formatStorePrice(item.unit_price, "bn")}
                                      </span>
                                      <span className="text-[10px] text-stone-500"> / প্যাক</span>
                                    </div>

                                    {/* Quantity displayed below the price */}
                                    <div className="pt-0.5">
                                      <span className="inline-flex items-center gap-1 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 font-bold text-[11px]">
                                        <span>পরিমাণ:</span>
                                        <span className="font-mono font-black text-amber-950 dark:text-amber-200">
                                          {toBnNumber(item.quantity)}
                                        </span>
                                        <span className="text-[10px] text-stone-500 font-normal">প্যাক</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Total price column */}
                              <td className="py-2.5 pl-2 text-right align-top whitespace-nowrap">
                                <span className="block font-mono text-xs sm:text-sm font-black text-amber-950 dark:text-amber-100 leading-tight">
                                  {formatStorePrice(total, "bn")}
                                </span>
                                <span className="block font-mono text-[10.5px] font-bold text-stone-600 dark:text-stone-300 mt-0.5">
                                  {toBnNumber(item.quantity)} প্যাক
                                </span>
                                <span className="block font-mono text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                                  ({formatStorePrice(item.unit_price, "bn")} × {toBnNumber(item.quantity)})
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Price Breakdown & Grand Total Card (reused from main page) */}
                  <div className="mt-2 pt-2.5 border-t border-stone-200 dark:border-stone-800 space-y-1.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                      <span className="font-semibold">পণ্যের মোট মূল্য:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                        {formatStorePrice(Number(order.subtotal) || 0, "bn")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          ডেলিভারি চার্জ:
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                        {formatStorePrice(Number(order.shipping_total) || 0, "bn")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-stone-300 dark:border-stone-700 text-sm sm:text-base font-black text-amber-950 dark:text-amber-100">
                      <div>
                        <span className="block leading-tight">ক্যাশ অন ডেলিভারি মোট প্রদেয়:</span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                          পণ্য হাতে পেয়ে দেখে টাকা দিন
                        </span>
                      </div>
                      <span className="font-mono text-base sm:text-xl text-emerald-700 dark:text-emerald-400 font-black">
                        {formatStorePrice(Number(order.grand_total) || 0, "bn")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* When 0 products selected (direct phone order) */
                <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                  <div className="bg-amber-100/50 dark:bg-stone-800/80 rounded-xl p-3 text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                      <PhoneCall className="w-4 h-4 text-amber-600" />
                      <span>সরাসরি ফোন অর্ডার</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      আমাদের প্রতিনিধি সরাসরি ফোন করে আপনার পছন্দের গুড় ও পরিমাণ নিশ্চিত করে ডেলিভারির ব্যবস্থা করবেন।
                    </p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Section 1: ডেলিভারি ঠিকানা ও প্রাপকের তথ্য (Delivery Address & Recipient Card) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.16 }}
              className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl sm:rounded-3xl border border-amber-200/80 dark:border-stone-700/80 p-4 sm:p-5 text-left space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-stone-700/60">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>ডেলিভারি ঠিকানা ও প্রাপকের তথ্য</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-amber-900 dark:text-amber-200 font-semibold bg-amber-100/90 dark:bg-amber-950/70 px-2.5 py-0.5 rounded-full border border-amber-300/80 dark:border-amber-700/60">
                  হোম ডেলিভারি
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                {/* Recipient Name */}
                <div className="flex items-start gap-2.5 bg-white/80 dark:bg-stone-900/60 p-2.5 sm:p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60">
                  <User className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                      প্রাপকের নাম
                    </span>
                    <span className="font-bold text-stone-900 dark:text-stone-100 truncate block">
                      {recipientName || "সম্মানিত গ্রাহক"}
                    </span>
                  </div>
                </div>

                {/* Primary Phone */}
                <div className="flex items-start gap-2.5 bg-white/80 dark:bg-stone-900/60 p-2.5 sm:p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60">
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                      যোগাযোগের নম্বর
                    </span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100 block">
                      {primaryPhone || "নম্বর প্রদান করা হয়নি"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alternative Phone if provided */}
              {altPhone && (
                <div className="flex items-start gap-2.5 bg-white/80 dark:bg-stone-900/60 p-2.5 sm:p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60 text-xs sm:text-sm">
                  <Phone className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                      বিকল্প মোবাইল নম্বর
                    </span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100 block">
                      {altPhone}
                    </span>
                  </div>
                </div>
              )}

              {/* Complete Delivery Address */}
              <div className="bg-white/80 dark:bg-stone-900/60 p-2.5 sm:p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60 text-xs sm:text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <span className="block text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                      সম্পূর্ণ ডেলিভারি ঠিকানা
                    </span>
                    <p className="font-bold text-stone-900 dark:text-stone-100 leading-snug">
                      {formattedAddress || "ঠিকানা ফোনে নিশ্চিত করা হবে"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Note if provided */}
              {order?.customer_note && order.customer_note.trim() && (
                <div className="bg-amber-100/70 dark:bg-stone-900/80 border border-amber-300/80 dark:border-amber-700/60 rounded-xl p-2.5 sm:p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-amber-800 dark:text-amber-300 mt-0.5 shrink-0" />
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-amber-950 dark:text-amber-200">
                        আপনার বিশেষ নির্দেশনা (নোট):
                      </span>
                      <p className="text-stone-800 dark:text-stone-200 leading-relaxed italic">
                        &ldquo;{order.customer_note.trim()}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Address modification helper hint */}
              <div className="text-[11px] text-stone-500 dark:text-stone-400 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-amber-200/40 dark:border-stone-700/40">
                <span>ঠিকানা বা তথ্যে কোনো পরিবর্তন করতে চাইলে:</span>
                <a
                  href={`https://wa.me/88${RAW_HOTLINE}?text=${encodeURIComponent(
                    `আসসালামু আলাইকুম, আমার অর্ডার ${order?.order_number || ""} এর ডেলিভারি ঠিকানায় কিছু পরিবর্তন করতে চাই।`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3 text-[#25D366]" />
                  <span>WhatsApp-এ মেসেজ পাঠান</span>
                </a>
              </div>
            </motion.div>

            {/* Section 2: অর্ডার পরবর্তী ধাপসমূহ (Next Steps / Delivery Progress Timeline) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.24 }}
              className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl sm:rounded-3xl border border-amber-200/80 dark:border-stone-700/80 p-4 sm:p-5 text-left space-y-3.5 shadow-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-stone-700/60">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>অর্ডার পরবর্তী ধাপসমূহ (ডেলিভারি প্রসেস)</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  ৪টি সহজ ধাপ
                </span>
              </div>

              <div className="space-y-3 relative before:absolute before:left-3.5 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-amber-200 dark:before:bg-stone-700">
                {/* Step 1: অর্ডার গ্রহণ সম্পন্ন */}
                <div className="relative flex items-start gap-3 pl-1">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 z-10 shadow-sm ring-4 ring-white dark:ring-stone-800">
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                  </div>
                  <div className="flex-1 bg-white/80 dark:bg-stone-900/60 p-2.5 sm:p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                        ১. অর্ডার গ্রহণ সম্পন্ন
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                        সম্পন্ন
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
                      আপনার অর্ডারটি আমাদের ডাটাবেজে সফলভাবে নিবন্ধিত হয়েছে।
                    </p>
                  </div>
                </div>

                {/* Step 2: কনফার্মেশন কল */}
                <div className="relative flex items-start gap-3 pl-1">
                  <div className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 z-10 shadow-sm ring-4 ring-white dark:ring-stone-800">
                    <motion.span
                      animate={{ scale: [1, 1.45, 1], opacity: [0.65, 0, 0.65] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 rounded-full bg-amber-400"
                    />
                    <PhoneCall className="w-3 h-3 sm:w-3.5 sm:h-3.5 relative z-10" />
                  </div>
                  <div className="flex-1 bg-white/90 dark:bg-stone-900/70 p-2.5 sm:p-3 rounded-xl border border-amber-300 dark:border-amber-700/60 shadow-xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                        ২. কনফার্মেশন কল
                      </span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
                        চলমান / পরবর্তী ধাপ
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                      কিছুক্ষণের মধ্যেই আমাদের কাস্টমার সার্ভিস প্রতিনিধি কল করে আপনার ঠিকানা ও অর্ডার কনফার্ম করবেন।
                    </p>
                  </div>
                </div>

                {/* Step 3: নিরাপদ প্যাকেজিং ও প্রেরণ */}
                <div className="relative flex items-start gap-3 pl-1">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0 z-10 shadow-xs ring-4 ring-white dark:ring-stone-800 font-bold text-xs">
                    ৩
                  </div>
                  <div className="flex-1 bg-white/60 dark:bg-stone-900/40 p-2.5 sm:p-3 rounded-xl border border-stone-200 dark:border-stone-700/50">
                    <span className="font-bold text-xs sm:text-sm text-stone-800 dark:text-stone-200 block">
                      ৩. নিরাপদ প্যাকেজিং ও কুরিয়ারে প্রেরণ
                    </span>
                    <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                      বিশেষ বাবল র‍্যাপ ও মজবুত কার্টনে যত্নসহকারে প্যাক করে দ্রুততম সময়ে কুরিয়ারে হস্তান্তর করা হবে।
                    </p>
                  </div>
                </div>

                {/* Step 4: পার্সেল খুলে দেখে ক্যাশ অন ডেলিভারি */}
                <div className="relative flex items-start gap-3 pl-1">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0 z-10 shadow-xs ring-4 ring-white dark:ring-stone-800 font-bold text-xs">
                    ৪
                  </div>
                  <div className="flex-1 bg-white/60 dark:bg-stone-900/40 p-2.5 sm:p-3 rounded-xl border border-stone-200 dark:border-stone-700/50">
                    <span className="font-bold text-xs sm:text-sm text-stone-800 dark:text-stone-200 block">
                      ৪. পার্সেল খুলে দেখে ক্যাশ অন ডেলিভারি
                    </span>
                    <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                      ডেলিভারিম্যানের সামনে প্যাকেট খুলে খাঁটি গুড়ের ঘ্রাণ ও মান পরীক্ষা করে নিশ্চিত হয়ে মূল্য পরিশোধ করুন।
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Section 3: ১০০% নিরাপদ ডেলিভারি ও রিপ্লেসমেন্ট গ্যারান্টি (Replacement & Quality Guarantee) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.32 }}
              className="bg-gradient-to-br from-emerald-50/80 via-white/80 to-emerald-50/60 dark:from-emerald-950/40 dark:via-stone-900/60 dark:to-emerald-950/30 rounded-2xl sm:rounded-3xl border border-emerald-300/80 dark:border-emerald-800/80 p-4 sm:p-5 text-left space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80 dark:border-emerald-800/60">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>১০০% নিরাপদ ডেলিভারি ও রিপ্লেসমেন্ট গ্যারান্টি</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-900/70 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                  কোন ঝুঁকি নেই
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 text-xs sm:text-sm">
                {/* Guarantee item 1: 100% Pure */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-2.5 bg-white/80 dark:bg-stone-900/70 p-2.5 sm:p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/50 shadow-xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                      ১০০% খাঁটি ও নির্ভেজাল খেজুরের গুড়
                    </h4>
                    <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
                      কোনো চিনি, কৃত্রিম রং, হাইড্রোজ বা রাসায়নিক প্রিজারভেটিভ নেই। ভেজাল প্রমাণে ১০০% মূল্য ফেরত।
                    </p>
                  </div>
                </motion.div>

                {/* Guarantee item 2: Instant Replacement */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-2.5 bg-white/80 dark:bg-stone-900/70 p-2.5 sm:p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/50 shadow-xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                      ভাঙা বা নষ্ট হলে তাৎক্ষণিক ফ্রি রিপ্লেসমেন্ট
                    </h4>
                    <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
                      কুরিয়ারে পরিবহনের সময় পাত্র ভেঙে গেলে বা কোনো ক্ষতি হলে কোনো প্রশ্ন ছাড়াই নতুন গুড় পাঠানো হবে।
                    </p>
                  </div>
                </motion.div>

                {/* Guarantee item 3: Open box check */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-2.5 bg-white/80 dark:bg-stone-900/70 p-2.5 sm:p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/50 shadow-xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                      খুলে দেখে নেওয়ার সুবিধা (Open-Box Delivery)
                    </h4>
                    <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
                      ডেলিভারিম্যানের সামনে প্যাকেট খুলে ঘ্রাণ ও গুণমান পরীক্ষা করে সন্তুষ্ট হলে তবেই মূল্য পরিশোধ করুন।
                    </p>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Section 4: প্রাকৃতিক গুড় ভালো ও ফ্রেশ রাখার নিয়ম (Storage & Care Tips) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.40 }}
              className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl sm:rounded-3xl border border-amber-200/80 dark:border-stone-700/80 p-4 sm:p-5 text-left space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-stone-700/60">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>প্রাকৃতিক গুড় ভালো ও ফ্রেশ রাখার নিয়ম</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-amber-900 dark:text-amber-200 font-semibold bg-amber-100/90 dark:bg-amber-950/70 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                  সংরক্ষণ টিপস
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                {/* Tip 1 */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white/70 dark:bg-stone-900/60 p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60 space-y-1 shadow-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                    <span className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center justify-center text-xs">১</span>
                    <span>বায়ুরোধী পাত্রে রাখুন</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 leading-relaxed pl-6.5">
                    গুড় খোলার পর সবসময় শুকনো এয়ারটাইট কাঁচের পাত্র বা ফুড-গ্রেড বক্সে মুখ বন্ধ করে রাখুন।
                  </p>
                </motion.div>

                {/* Tip 2 */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white/70 dark:bg-stone-900/60 p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60 space-y-1 shadow-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                    <span className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center justify-center text-xs">২</span>
                    <span>শুকনো চামচ ব্যবহার করুন</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 leading-relaxed pl-6.5">
                    গুড় নেওয়ার সময় কখনো ভেজা হাত বা ভেজা চামচ ব্যবহার করবেন না, এতে গুড় দ্রুত নষ্ট হতে পারে।
                  </p>
                </motion.div>

                {/* Tip 3 */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white/70 dark:bg-stone-900/60 p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60 space-y-1 shadow-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                    <span className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center justify-center text-xs">৩</span>
                    <span>শীতল ও শুষ্ক স্থান</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 leading-relaxed pl-6.5">
                    সরাসরি রোদ ও স্যাঁতসেঁতে পরিবেশ এড়িয়ে ঠান্ডা ও শুষ্ক জায়গায় গুড়ের পাত্র রাখুন।
                  </p>
                </motion.div>

                {/* Tip 4 */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white/70 dark:bg-stone-900/60 p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60 space-y-1 shadow-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                    <span className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center justify-center text-xs">৪</span>
                    <span>নরমাল ফ্রিজে সংরক্ষণ</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 leading-relaxed pl-6.5">
                    ঝোলা গুড় বা নলেন গুড়ের প্রাকৃতিক সুবাস ও স্বাদ দীর্ঘদিন অটুট রাখতে সাধারণ ফ্রিজে রাখা ভালো।
                  </p>
                </motion.div>
              </div>
            </motion.div>

            {/* Cash on Delivery Notice & CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.48 }}
              className="space-y-4"
            >
              {/* Cash on Delivery Reassurance Notice */}
              <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800 rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 text-left">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>কোন অগ্রিম টাকা দেওয়া লাগবে না। পার্সেল খুলে পরীক্ষা করার পর ডেলিভারিম্যানকে টাকা দিন।</span>
              </div>

              {/* Quick Direct Communication Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <motion.a
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  href={`tel:${RAW_HOTLINE}`}
                  className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>সরাসরি ফোনে কথা বলুন</span>
                </motion.a>

                <motion.a
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  href={`https://wa.me/88${RAW_HOTLINE}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp চ্যাট করুন</span>
                </motion.a>
              </div>

              {/* Return to Shop Button */}
              <div className="pt-2">
                <motion.div whileHover={{ x: -3 }} transition={{ duration: 0.15 }} className="inline-block">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold text-xs sm:text-sm transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>আরও গুড় দেখতে দোকানে ফিরে যান</span>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-2xl mx-auto w-full text-center pt-4 border-t border-amber-200/80 dark:border-stone-800 text-[11px] text-stone-500 space-y-2">
        <p>© 2026 খেজুরের খাঁটি গুড় • ঐতিহ্যবাহী নির্ভেজাল গুড়ের বিশ্বস্ত ঠিকানা</p>
        <div className="flex items-center justify-center gap-3 text-xs text-stone-500">
          <Link href="/contact" className="hover:text-amber-800 dark:hover:text-amber-300 font-medium transition-colors">
            যোগাযোগ
          </Link>
          <span>•</span>
          <Link href="/privacy-policy" className="hover:text-amber-800 dark:hover:text-amber-300 font-medium transition-colors">
            গোপনীয়তা নীতি
          </Link>
        </div>
      </footer>
    </main>
  );
}

export default function OrderConfirmedDynamicPage() {
  return (
    <Suspense fallback={<OrderConfirmedSkeleton />}>
      <OrderConfirmedContent />
    </Suspense>
  );
}
