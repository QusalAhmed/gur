"use client";

import React, { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
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
} from "lucide-react";
import { formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { useOrder } from "@/hooks/use-order";
import { useStorefrontProducts } from "@/hooks/use-storefront-products";
import type { OrderItem } from "@/types/order";

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
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold hover:text-amber-700 transition-colors text-xs sm:text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>দোকানে ফিরে যান</span>
        </Link>

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
  const orderId = (params?.id || "").trim();
  const [copied, setCopied] = useState(false);

  // TanStack Query to fetch the single order in background using the UUID or order_number
  const { data: order, isLoading } = useOrder(orderId, {
    enabled: Boolean(orderId),
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

  const whatsappMessage = encodeURIComponent(
    order?.order_number
      ? `আসসালামু আলাইকুম, আমি খাঁটি গুড় অর্ডার করেছি। আমার অর্ডার নম্বর: ${order.order_number}`
      : `আসসালামু আলাইকুম, আমি খাঁটি গুড় অর্ডার করেছি।`
  );

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 flex flex-col justify-between p-4 sm:p-8 select-none">
      {/* Background Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-2xl mx-auto w-full flex items-center justify-between pb-4 border-b border-amber-200/80 dark:border-stone-800">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold hover:text-amber-700 transition-colors text-xs sm:text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>দোকানে ফিরে যান</span>
        </Link>

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
            {/* Animated Success Badge (0ms instant) */}
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
            <div className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl sm:rounded-3xl border border-amber-200/80 dark:border-stone-700/80 p-4 sm:p-5 text-left space-y-3">
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
                    <button
                      type="button"
                      onClick={handleCopyOrderNumber}
                      className="p-1 rounded-lg hover:bg-amber-200/60 dark:hover:bg-stone-700 transition-colors text-amber-900 dark:text-amber-300 cursor-pointer"
                      title="অর্ডার নম্বর কপি করুন"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
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
                            <tr key={item.id || idx} className="hover:bg-amber-50/50 dark:hover:bg-stone-800/40 transition-colors">
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
                                  <div className="space-y-0.5 min-w-0">
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

                                    <div className="flex items-center gap-1.5 text-[11px] text-amber-800/90 dark:text-amber-400 font-medium">
                                      <span>দর: {formatStorePrice(item.unit_price, "bn")}</span>
                                      <span>•</span>
                                      <span className="inline-flex items-center bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-1.5 py-0.2 rounded border border-stone-200 dark:border-stone-700 font-bold text-[10.5px]">
                                        পরিমাণ: {toBnNumber(item.quantity)} প্যাক
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
                                <span className="block font-mono text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                                  ({formatStorePrice(item.unit_price, "bn")} × {toBnNumber(item.quantity)})
                                </span>
                              </td>
                            </tr>
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
            </div>

            {/* Cash on Delivery Reassurance Notice */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800 rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 text-left">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>কোন অগ্রিম টাকা দেওয়া লাগবে না। পার্সেল খুলে পরীক্ষা করার পর ডেলিভারিম্যানকে টাকা দিন।</span>
            </div>

            {/* Quick Direct Communication Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <a
                href={`tel:${RAW_HOTLINE}`}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm"
              >
                <Phone className="w-4 h-4" />
                <span>সরাসরি ফোনে কথা বলুন</span>
              </a>

              <a
                href={`https://wa.me/88${RAW_HOTLINE}?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp চ্যাট করুন</span>
              </a>
            </div>

            {/* Return to Shop Button */}
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold text-xs sm:text-sm transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>আরও গুড় দেখতে দোকানে ফিরে যান</span>
              </Link>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-2xl mx-auto w-full text-center pt-4 border-t border-amber-200/80 dark:border-stone-800 text-[11px] text-stone-500">
        © 2026 খেজুরের খাঁটি গুড় • ঐতিহ্যবাহী নির্ভেজাল গুড়ের বিশ্বস্ত ঠিকানা
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
