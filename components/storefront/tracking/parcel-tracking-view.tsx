"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Truck,
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ParcelTrackingData } from "@/types/tracking";
import { getParcelTrackingAction } from "@/actions/tracking";
import { OrderCartDetailsCard } from "./order-cart-details-card";

const HOTLINE_NUMBER = "01843557389";
const HOTLINE_RAW = HOTLINE_NUMBER.replace(/[^0-9]/g, "");

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
function toBn(num: number | string): string {
  return String(num).replace(/[0-9]/g, (w) => BN_DIGITS[Number(w)] || w);
}

function formatCheckpointDate(isoDate: string, lang: "bn" | "en"): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;

    if (lang === "bn") {
      const bnMonths = [
        "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
        "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
      ];
      const day = toBn(d.getDate());
      const month = bnMonths[d.getMonth()];
      const year = toBn(d.getFullYear());

      let hours = d.getHours();
      const minutes = toBn(String(d.getMinutes()).padStart(2, "0"));
      const ampm = hours >= 12 ? "বিকাল/রাত" : "সকাল";
      hours = hours % 12 || 12;

      return `${day} ${month}, ${year} • ${ampm} ${toBn(hours)}:${minutes}`;
    }

    const enMonths = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const day = d.getDate();
    const month = enMonths[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
  } catch {
    return isoDate;
  }
}

// 5 Core Steps in the order fulfillment journey
const TIMELINE_STEPS = [
  {
    key: "placed",
    labelBn: "অর্ডার গ্রহণ",
    labelEn: "Order Placed",
    descBn: "অর্ডার সফলভাবে সিস্টেমে যুক্ত হয়েছে",
    descEn: "Order received in our system",
  },
  {
    key: "confirmed",
    labelBn: "যাচাই ও নিশ্চিত",
    labelEn: "Confirmed & Packed",
    descBn: "রস যাচাই ও প্যাকেজিং সম্পন্ন",
    descEn: "Verified & ready for packing",
  },
  {
    key: "shipped",
    labelBn: "কুরিয়ারে হস্তান্তর",
    labelEn: "With Courier",
    descBn: "স্টিডফাস্ট কুরিয়ারে বুকিং সম্পন্ন",
    descEn: "Handed over to Steadfast Courier",
  },
  {
    key: "in_transit",
    labelBn: "ডেলিভারির পথে",
    labelEn: "In Transit",
    descBn: "রাইডারের মাধ্যমে গন্তব্যে যাচ্ছে",
    descEn: "Moving to delivery destination",
  },
  {
    key: "delivered",
    labelBn: "ডেলিভারি সম্পন্ন",
    labelEn: "Delivered",
    descBn: "গ্রাহক পণ্য হাতে পেয়ে টাকা দিয়েছেন",
    descEn: "Parcel delivered successfully",
  },
] as const;

function calculateCurrentStepIndex(status: string): number {
  const norm = (status || "").toLowerCase().trim();
  switch (norm) {
    case "pending":
    case "draft":
    case "incomplete_order":
      return 0;
    case "confirmed":
    case "processing":
      return 1;
    case "shipped":
      return 2;
    case "in_transit":
    case "out_for_delivery":
      return 3;
    case "delivered":
      return 4;
    case "cancelled":
    case "returned":
      return -1;
    default:
      return 1;
  }
}

interface ParcelTrackingViewProps {
  initialData: ParcelTrackingData;
}

export function ParcelTrackingView({ initialData }: ParcelTrackingViewProps) {
  const [data, setData] = useState<ParcelTrackingData>(initialData);
  const [lang, setLang] = useState<"bn" | "en">("bn");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAllCheckpoints, setShowAllCheckpoints] = useState(true);
  const [isRefreshing, startTransition] = useTransition();

  const handleCopy = (text: string, field: string) => {
    if (typeof navigator !== "undefined" && navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleRefresh = () => {
    startTransition(async () => {
      const res = await getParcelTrackingAction(data.orderId);
      if (res.success) {
        setData(res.data);
      }
    });
  };

  const currentStep = calculateCurrentStepIndex(data.status);
  const isDelivered = data.status === "delivered";
  const isCancelled = data.status === "cancelled";
  const isReturned = data.status === "returned";

  // WhatsApp pre-filled message
  const waMessage = encodeURIComponent(
    lang === "bn"
      ? `আসসালামু আলাইকুম, আমার পার্সেল #${data.orderNumber} ট্র্যাকিং সম্পর্কে জানতে চাই।`
      : `Hello, I need assistance tracking my order #${data.orderNumber}.`
  );
  const waUrl = `https://wa.me/88${HOTLINE_RAW}?text=${waMessage}`;

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 flex flex-col justify-between p-3.5 sm:p-6 md:p-8 select-none transition-colors">
      {/* Background Texture Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] -z-10" />

      {/* Top Header Navbar */}
      <header className="relative z-10 max-w-4xl mx-auto w-full flex items-center justify-between pb-4 border-b border-amber-200/80 dark:border-stone-800 gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 sm:gap-2 text-amber-950 dark:text-amber-300 font-bold hover:text-amber-700 transition-colors text-xs sm:text-sm group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>{lang === "bn" ? "দোকানে ফিরে যান" : "Back to Store"}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Brand Badge */}
          <div className="hidden xs:inline-flex items-center gap-1.5 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-700/60 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-950 dark:text-amber-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>{lang === "bn" ? "খাঁটি খেজুরের গুড়" : "Pure Date Palm Gur"}</span>
          </div>

          {/* Bilingual Toggle */}
          <div className="flex items-center rounded-full bg-amber-200/60 dark:bg-stone-800 p-0.5 border border-amber-300/80 dark:border-stone-700">
            <button
              onClick={() => setLang("bn")}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold transition-all",
                lang === "bn"
                  ? "bg-amber-900 text-amber-50 shadow-xs"
                  : "text-amber-950/70 dark:text-stone-400 hover:text-amber-950 dark:hover:text-stone-200"
              )}
            >
              বাংলা
            </button>
            <button
              onClick={() => setLang("en")}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold transition-all",
                lang === "en"
                  ? "bg-amber-900 text-amber-50 shadow-xs"
                  : "text-amber-950/70 dark:text-stone-400 hover:text-amber-950 dark:hover:text-stone-200"
              )}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="relative z-10 max-w-4xl mx-auto w-full my-6 sm:my-8 space-y-5 sm:space-y-6">
        
        {/* Status Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white/95 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border border-amber-200/90 dark:border-stone-800 shadow-2xl shadow-amber-950/10 p-5 sm:p-7 space-y-6"
        >
          {/* Header Row: Status badge & Refresh button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md ring-4",
                  isDelivered
                    ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 ring-emerald-50 dark:ring-emerald-900/30"
                    : isCancelled || isReturned
                    ? "bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 ring-rose-50 dark:ring-rose-900/30"
                    : "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 ring-amber-50 dark:ring-amber-900/30"
                )}
              >
                {isDelivered ? (
                  <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
                ) : isCancelled ? (
                  <XCircle className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
                ) : isReturned ? (
                  <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
                ) : (
                  <Truck className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2] animate-pulse" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                    {lang === "bn" ? "পার্সেল স্ট্যাটাস" : "Parcel Status"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold text-xs px-2.5 py-0.5 rounded-full",
                      isDelivered
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : isCancelled || isReturned
                        ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                        : "bg-amber-100/80 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700"
                    )}
                  >
                    {isDelivered
                      ? lang === "bn"
                        ? "ডেলিভারি সম্পন্ন"
                        : "Delivered"
                      : isCancelled
                      ? lang === "bn"
                        ? "অর্ডার বাতিল"
                        : "Cancelled"
                      : isReturned
                      ? lang === "bn"
                        ? "পার্সেল ফেরত"
                        : "Returned"
                      : currentStep >= 2
                      ? lang === "bn"
                        ? "কুরিয়ারের মাধ্যমে পাঠানো হয়েছে"
                        : "In Transit with Courier"
                      : lang === "bn"
                      ? "প্রস্তুত ও প্যাকেজিং চলছে"
                      : "Preparing & Packaging"}
                  </Badge>
                </div>

                <h1 className="text-lg sm:text-2xl font-black text-amber-950 dark:text-amber-100 tracking-tight mt-0.5">
                  {isDelivered
                    ? lang === "bn"
                      ? "আপনার পার্সেল সফলভাবে ডেলিভারি হয়েছে!"
                      : "Your parcel has been delivered!"
                    : isCancelled
                    ? lang === "bn"
                      ? "অর্ডারটি বাতিল করা হয়েছে"
                      : "This order has been cancelled"
                    : isReturned
                    ? lang === "bn"
                      ? "পার্সেলটি ফেরত পাঠানো হয়েছে"
                      : "Parcel returned to sender"
                    : lang === "bn"
                    ? "আপনার পার্সেলটি গন্তব্যে পৌঁছাচ্ছে"
                    : "Your parcel is on its way to you"}
                </h1>
              </div>
            </div>

            {/* Quick Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-amber-300/80 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-amber-100/60 dark:hover:bg-stone-800 rounded-xl text-xs gap-1.5"
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5 text-amber-700 dark:text-amber-400", {
                  "animate-spin": isRefreshing,
                })}
              />
              <span>{isRefreshing ? (lang === "bn" ? "রিফ্রেশ হচ্ছে..." : "Refreshing...") : (lang === "bn" ? "আপডেট দেখুন" : "Refresh")}</span>
            </Button>
          </div>

          {/* Identifier Info Bar (Order Number + Courier Tracking Code) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/70 dark:bg-stone-800/60 p-3.5 sm:p-4 rounded-2xl border border-amber-200/80 dark:border-stone-700/80">
            {/* Order Number */}
            <div className="flex items-center justify-between sm:justify-start gap-2 text-xs sm:text-sm">
              <span className="text-stone-600 dark:text-stone-400 font-medium">
                {lang === "bn" ? "অর্ডার নম্বর:" : "Order Number:"}
              </span>
              <button
                onClick={() => handleCopy(data.orderNumber, "orderNumber")}
                className="inline-flex items-center gap-1.5 font-bold font-mono text-amber-950 dark:text-amber-200 hover:text-amber-700 transition-colors bg-white/80 dark:bg-stone-900/80 px-2 py-0.5 rounded-md border border-amber-200/70 dark:border-stone-700"
                title={lang === "bn" ? "কপি করতে ক্লিক করুন" : "Click to copy"}
              >
                <span>{data.orderNumber}</span>
                {copiedField === "orderNumber" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-stone-400 hover:text-amber-700" />
                )}
              </button>
            </div>

            {/* Courier Tracking Code */}
            <div className="flex items-center justify-between sm:justify-start gap-2 text-xs sm:text-sm">
              <span className="text-stone-600 dark:text-stone-400 font-medium">
                {lang === "bn" ? "কুরিয়ার ট্র্যাকিং কোড:" : "Courier Tracking:"}
              </span>
              {data.courierTrackingCode ? (
                <button
                  onClick={() => handleCopy(data.courierTrackingCode!, "trackingCode")}
                  className="inline-flex items-center gap-1.5 font-bold font-mono text-amber-950 dark:text-amber-200 hover:text-amber-700 transition-colors bg-white/80 dark:bg-stone-900/80 px-2 py-0.5 rounded-md border border-amber-200/70 dark:border-stone-700"
                  title={lang === "bn" ? "কপি করতে ক্লিক করুন" : "Click to copy"}
                >
                  <span>{data.courierTrackingCode}</span>
                  {copiedField === "trackingCode" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-stone-400 hover:text-amber-700" />
                  )}
                </button>
              ) : (
                <span className="text-xs text-amber-800 dark:text-amber-400 font-medium italic">
                  {lang === "bn" ? "প্রস্তুত হচ্ছে (শীঘ্রই আসবে)" : "Pending assignment"}
                </span>
              )}
            </div>
          </div>

          {/* Probable Delivery Notice */}
          {!isDelivered && !isCancelled && !isReturned && (
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs sm:text-sm bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/60 px-4 py-3 rounded-2xl">
              <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-200">
                <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>
                  {lang === "bn" ? "সম্ভাব্য ডেলিভারি তারিখ:" : "Estimated Delivery:"}
                </span>
                <span className="underline decoration-amber-400 underline-offset-2">
                  {lang === "bn" ? data.estimatedDeliveryRangeBn : data.estimatedDeliveryRangeEn}
                </span>
              </div>
              <span className="text-xs text-amber-800 dark:text-amber-300 font-semibold bg-amber-200/60 dark:bg-amber-900/50 px-2.5 py-0.5 rounded-full">
                {lang === "bn" ? data.estimatedDeliveryDaysBn : data.estimatedDeliveryDaysEn}
              </span>
            </div>
          )}

          {/* Visual 5-Stage Stepper */}
          {!isCancelled && !isReturned && (
            <div className="pt-2">
              <div className="relative">
                {/* Connecting background progress line */}
                <div className="absolute top-5 left-4 right-4 sm:left-6 sm:right-6 h-1 bg-amber-100 dark:bg-stone-800 -z-0 rounded-full" />
                <div
                  className="absolute top-5 left-4 sm:left-6 h-1 bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-500 -z-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, (currentStep / (TIMELINE_STEPS.length - 1)) * 100))}%`,
                  }}
                />

                {/* Steps Nodes */}
                <div className="grid grid-cols-5 relative z-10 gap-1 text-center">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const isDone = currentStep > idx;
                    const isCurrent = currentStep === idx;

                    return (
                      <div key={step.key} className="flex flex-col items-center">
                        <div
                          className={cn(
                            "w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-sm ring-4",
                            isDone
                              ? "bg-amber-600 dark:bg-amber-500 text-white ring-amber-100 dark:ring-amber-950/60"
                              : isCurrent
                              ? "bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-300 border-2 border-amber-600 ring-amber-200/80 dark:ring-amber-900/50 animate-pulse"
                              : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 ring-transparent"
                          )}
                        >
                          {isDone ? (
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                          ) : (
                            <span>{lang === "bn" ? toBn(idx + 1) : idx + 1}</span>
                          )}
                        </div>

                        <span
                          className={cn(
                            "mt-2 text-[11px] sm:text-xs font-bold leading-tight line-clamp-2 px-0.5",
                            isCurrent
                              ? "text-amber-950 dark:text-amber-200"
                              : isDone
                              ? "text-stone-700 dark:text-stone-300"
                              : "text-stone-400 dark:text-stone-600"
                          )}
                        >
                          {lang === "bn" ? step.labelBn : step.labelEn}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* 2-Column Responsive Body Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          
          {/* Left Column: Live Checkpoints & Storefront Cart Details Items + Details Section (7 cols) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            
            {/* Live Webhook & Courier Checkpoint Feed */}
            <Card className="bg-white/95 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border-amber-200/90 dark:border-stone-800 shadow-xl shadow-amber-950/5 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-amber-200/70 dark:border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h2 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100">
                    {lang === "bn" ? "লাইভ কুরিয়ার চেকপয়েন্ট ও আপডেট" : "Live Courier Checkpoints"}
                  </h2>
                </div>
                <button
                  onClick={() => setShowAllCheckpoints(!showAllCheckpoints)}
                  className="text-xs font-bold text-amber-800 dark:text-amber-400 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                >
                  <span>{showAllCheckpoints ? (lang === "bn" ? "সংক্ষেপ করুন" : "Collapse") : (lang === "bn" ? "সব দেখুন" : "View All")}</span>
                  {showAllCheckpoints ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              <CardContent className="p-4 sm:p-5">
                {data.checkpoints && data.checkpoints.length > 0 ? (
                  <div className="relative pl-5 sm:pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-amber-200/80 dark:before:bg-stone-700">
                    {(showAllCheckpoints ? data.checkpoints : data.checkpoints.slice(-3)).map((cp, i) => (
                      <div key={cp.id || i} className="relative group">
                        {/* Dot indicator */}
                        <div
                          className={cn(
                            "absolute -left-[1.65rem] sm:-left-[1.85rem] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-stone-900 shadow-xs",
                            cp.isCourierEvent
                              ? "bg-amber-600 ring-2 ring-amber-300 dark:ring-amber-800"
                              : "bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
                          )}
                        />

                        <div className="bg-amber-50/60 dark:bg-stone-800/50 p-3 rounded-xl border border-amber-200/60 dark:border-stone-700/60 transition-all hover:border-amber-300">
                          <div className="flex items-center justify-between flex-wrap gap-1 text-[11px] text-stone-500 dark:text-stone-400 pb-1">
                            <span className="font-semibold text-amber-900/90 dark:text-amber-300">
                              {formatCheckpointDate(cp.timestamp, lang)}
                            </span>
                            {cp.isCourierEvent && (
                              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.2 rounded font-bold">
                                Steadfast
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-200 leading-snug">
                            {cp.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-stone-500 text-xs sm:text-sm space-y-2">
                    <Truck className="w-8 h-8 text-amber-600/60 mx-auto" />
                    <p>
                      {lang === "bn"
                        ? "কুরিয়ারের প্রথম স্ক্যান ও চেকপয়েন্ট রেকর্ড করা হচ্ছে..."
                        : "Awaiting first scan from courier..."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reused Storefront Cart Details Items and Details Section */}
            <OrderCartDetailsCard data={data} lang={lang} />

          </div>

          {/* Right Column: Courier Partner, Destination, & Support (5 cols) */}
          <div className="lg:col-span-5 space-y-5 sm:space-y-6">
            
            {/* Courier Card */}
            <Card className="bg-white/95 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border-amber-200/90 dark:border-stone-800 shadow-xl shadow-amber-950/5 p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">
                  {lang === "bn" ? "ডেলিভারি পার্টনার:" : "Courier Partner:"}
                </span>
                <Badge className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border-amber-300 font-bold">
                  {data.courierName}
                </Badge>
              </div>

              {data.courierTrackingUrl && (
                <div className="pt-1">
                  <a
                    href={data.courierTrackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md transition-all group"
                  >
                    <span>{lang === "bn" ? "স্টিডফাস্ট পোর্টালে লাইভ দেখুন" : "Track on Steadfast Portal"}</span>
                    <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </div>
              )}
            </Card>

            {/* Recipient & Destination Card (Privacy Preserved) */}
            <Card className="bg-white/95 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border-amber-200/90 dark:border-stone-800 shadow-xl shadow-amber-950/5 p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{lang === "bn" ? "সুরক্ষিত প্রাপকের তথ্য" : "Verified Recipient"}</span>
              </div>

              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60 dark:border-stone-800">
                  <span className="text-stone-500 font-medium">
                    {lang === "bn" ? "প্রাপকের নাম:" : "Recipient:"}
                  </span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 font-mono">
                    {data.maskedCustomerName}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60 dark:border-stone-800">
                  <span className="text-stone-500 font-medium">
                    {lang === "bn" ? "মোবাইল নম্বর:" : "Contact Phone:"}
                  </span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 font-mono">
                    {data.maskedCustomerPhone}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">
                    {lang === "bn" ? "ডেলিভারি জেলা:" : "District / City:"}
                  </span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    {data.destinationDistrict}
                    {data.destinationDivision && ` (${data.destinationDivision})`}
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick Support & Hotline Card */}
            <Card className="bg-white/95 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border-amber-200/90 dark:border-stone-800 shadow-xl shadow-amber-950/5 p-4 sm:p-5 space-y-3">
              <h3 className="font-bold text-xs sm:text-sm text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>{lang === "bn" ? "ডেলিভারি নিয়ে কোনো প্রশ্ন আছে?" : "Have delivery questions?"}</span>
              </h3>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* WhatsApp Chat */}
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-xs transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === "bn" ? "WhatsApp চ্যাট" : "WhatsApp"}</span>
                </a>

                {/* Direct Hotline Call */}
                <a
                  href={`tel:${HOTLINE_NUMBER}`}
                  className="inline-flex items-center justify-center gap-1.5 bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-xs transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === "bn" ? "হটলাইনে কল" : "Call Hotline"}</span>
                </a>
              </div>
            </Card>

          </div>

        </div>

      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-4xl mx-auto w-full text-center pt-6 pb-2 border-t border-amber-200/80 dark:border-stone-800 text-[11px] text-stone-500">
        © 2026 {lang === "bn" ? "খেজুরের খাঁটি গুড় • ঐতিহ্যবাহী নির্ভেজাল গুড়ের বিশ্বস্ত ঠিকানা" : "Pure Artisanal Date Palm Jaggery"}
      </footer>
    </main>
  );
}
