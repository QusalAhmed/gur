"use client";

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  Sparkles,
  Calendar,
  ArrowRight,
  RotateCw,
  CircleAlert,
  CheckCircle2,
  PackageX,
  Factory,
  Database,
  Radio,
  Wifi,
} from "lucide-react";
import { useLiveStock, StockDayProjection } from "@/hooks/use-live-stock";
import { StorefrontLang, toBnNumber } from "@/lib/storefront-i18n";

interface LiveStockSectionProps {
  lang?: StorefrontLang;
  onScrollToProducts?: () => void;
}

export function LiveStockSection({
  lang = "bn",
  onScrollToProducts,
}: LiveStockSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.15, once: false });
  const hasTriggeredInitialViewSync = useRef<boolean>(false);

  const {
    todayStockKg,
    dailyProductionKg,
    totalActiveOrdersKg,
    activeOrderCount,
    projections,
    nextAvailableDay,
    isLoading,
    isLiveConnected,
    isRefetching,
    lastUpdatedAt,
    refresh,
  } = useLiveStock(50);

  const isBn = lang === "bn";

  // Trigger a fresh database fetch as soon as the section scrolls into view
  useEffect(() => {
    if (isInView && !hasTriggeredInitialViewSync.current) {
      hasTriggeredInitialViewSync.current = true;
      refresh();
    }
  }, [isInView, refresh]);

  return (
    <section
      ref={sectionRef}
      id="live-stock-section"
      className="w-full rounded-2xl bg-gradient-to-b from-amber-50/95 via-orange-50/60 to-amber-100/70 dark:from-stone-900/95 dark:via-[#1c1611]/85 dark:to-stone-900/95 border border-amber-200/90 dark:border-amber-900/50 p-4 sm:p-5 shadow-md shadow-amber-950/5 backdrop-blur-sm relative overflow-hidden"
    >
      {/* Background ambient glow */}
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-400/10 dark:bg-amber-600/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header with Live Pulse Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between gap-3 mb-3"
      >
        <div className="flex items-center gap-2">
          {/* Animated live radar dot */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <div className="flex items-center gap-1.5">
            <h3 className="font-extrabold text-sm sm:text-base text-amber-950 dark:text-amber-100 tracking-tight">
              {isBn ? "লাইভ স্টক ও ভবিষ্যৎ প্রাপ্যতা" : "Live Stock & Future Availability"}
            </h3>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
              LIVE
            </span>
          </div>
        </div>

        {/* Live status badge / manual refresh trigger */}
        <button
          type="button"
          onClick={() => refresh()}
          disabled={isRefetching || isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100/90 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-750 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 transition-colors cursor-pointer"
          title={isBn ? "ডাটাবেজ থেকে রিফ্রেশ করুন" : "Refresh from database"}
        >
          <RotateCw
            className={`w-3 h-3 text-amber-700 dark:text-amber-400 ${
              isRefetching || isLoading ? "animate-spin" : ""
            }`}
          />
          <span className="hidden xs:inline">
            {isRefetching || isLoading
              ? isBn
                ? "ফেচ হচ্ছে..."
                : "Fetching..."
              : isLiveConnected
              ? isBn
                ? "ডাটাবেজ লাইভ"
                : "DB Live"
              : isBn
              ? "রিফ্রেশ"
              : "Refresh"}
          </span>
        </button>
      </motion.div>

      {/* Database Fetching / Loading Animation Banner */}
      <AnimatePresence mode="wait">
        {isLoading || isRefetching ? (
          <motion.div
            key="db-fetching"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 overflow-hidden"
          >
            <div className="relative rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 dark:from-amber-950/50 dark:via-orange-950/40 dark:to-amber-950/50 border border-amber-400/40 dark:border-amber-700/60 p-2.5 sm:p-3 overflow-hidden shadow-xs">
              {/* Shimmer scanline beam sweeping horizontally */}
              <motion.div
                className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-amber-300/35 dark:via-amber-400/20 to-transparent pointer-events-none"
                animate={{ x: ["-100%", "450%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {/* Pulsing Database Icon with ripple rings */}
                  <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 dark:bg-amber-500/30 shrink-0">
                    <Database className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                    <motion.span
                      className="absolute inset-0 rounded-lg border-2 border-amber-500/60 dark:border-amber-400/50"
                      animate={{ scale: [1, 1.4, 1.7], opacity: [0.9, 0.4, 0] }}
                      transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-100">
                        {isBn
                          ? "ডাটাবেজ থেকে লাইভ স্টক ফেচ হচ্ছে..."
                          : "Fetching live stock from database..."}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-stone-600 dark:text-stone-300">
                      {isBn
                        ? "সক্রিয় অর্ডার ও দৈনিক উৎপাদন কোটা সিঙ্ক করা হচ্ছে"
                        : "Syncing active order volume & production quotas"}
                    </p>
                  </div>
                </div>

                {/* Animated data sync activity indicator */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400"
                        animate={{ scale: [1, 1.6, 1], opacity: [0.35, 1, 0.35] }}
                        transition={{ duration: 0.75, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 uppercase hidden sm:inline">
                    SYNCING
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="db-connected"
            initial={{ opacity: 0, y: -4 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="mb-3 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 px-0.5"
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Database className="w-3 h-3" />
                {isBn ? "ডাটাবেজ সংযুক্ত" : "Database Connected"}
              </span>
              <span className="text-stone-300 dark:text-stone-700">•</span>
              <span>
                {isBn
                  ? "অর্ডার আসার সাথে সাথে স্বয়ংক্রিয় গণনা"
                  : "Live instant calculation"}
              </span>
            </div>
            {lastUpdatedAt && (
              <span className="text-[10px] font-mono hidden sm:inline text-stone-400">
                {isBn ? "আপডেট: " : "Updated: "}
                {lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtitle / explanation */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-xs sm:text-[13px] text-stone-600 dark:text-stone-300 mb-4 leading-relaxed"
      >
        {isBn ? (
          <>
            আমাদের প্রতিটি ড্রপ গুড় গাছিদের থেকে তাজা সংগৃহীত।{" "}
            <strong className="text-amber-900 dark:text-amber-200">
              আজকের মজুদ ০ কেজি (সম্পূর্ণ বুকড)
            </strong>
            । নিচের লাইভ টাইমলাইনে বর্তমান অর্ডার অনুযায়ী পরবর্তী প্রস্তুত ব্যাচ ও
            উপলব্ধ স্টক দেখুন:
          </>
        ) : (
          <>
            Fresh molasses is tapped and processed daily.{" "}
            <strong className="text-amber-900 dark:text-amber-200">
              Current stock is 0 KG (Fully Booked)
            </strong>
            . Below is the live batch availability calculated from existing customer orders:
          </>
        )}
      </motion.p>

      {/* Top Quick Stats Strip */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {/* Metric 1: Current Stock */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white/85 dark:bg-stone-800/80 rounded-xl p-2.5 sm:p-3 border border-amber-200/70 dark:border-stone-700 flex flex-col justify-between shadow-xs"
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
            <PackageX className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>{isBn ? "আজকের স্টক" : "Today's Stock"}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {isBn ? toBnNumber(0) : "0"}
            </span>
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
              {isBn ? "কেজি (বুকড)" : "KG (Sold Out)"}
            </span>
          </div>
        </motion.div>

        {/* Metric 2: Daily Production Quota */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="bg-white/85 dark:bg-stone-800/80 rounded-xl p-2.5 sm:p-3 border border-amber-200/70 dark:border-stone-700 flex flex-col justify-between shadow-xs"
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
            <Factory className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{isBn ? "দৈনিক উৎপাদন" : "Daily Yield"}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-amber-900 dark:text-amber-100 font-mono">
              {isBn ? toBnNumber(dailyProductionKg) : dailyProductionKg}
            </span>
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
              {isBn ? "কেজি / দিন" : "KG / day"}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Dynamic Stock Timeline Cards */}
      <div className="space-y-3">
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-200 px-0.5"
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            {isBn ? "দিনভিত্তিক প্রাপ্যতা ও ডেলিভারি ব্যাচ" : "Day-by-Day Availability"}
          </span>
          {nextAvailableDay && (
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
              {isBn
                ? `পরবর্তী খালি ব্যাচ: ${nextAvailableDay.dayNameBn}`
                : `Next available: ${nextAvailableDay.dayNameEn}`}
            </span>
          )}
        </motion.div>

        {/* Loading skeleton animation using Framer Motion */}
        {isLoading ? (
          <div className="space-y-2.5">
            {[0, 1].map((s) => (
              <motion.div
                key={s}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: s * 0.2 }}
                className="relative rounded-xl p-3.5 bg-amber-100/50 dark:bg-stone-800/60 border border-amber-200/60 dark:border-stone-700 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="h-4 w-28 bg-amber-300/40 dark:bg-stone-700 rounded-md" />
                  <div className="h-4 w-20 bg-amber-300/40 dark:bg-stone-700 rounded-full" />
                </div>
                <div className="h-2 w-full bg-amber-300/30 dark:bg-stone-700/60 rounded-full mb-2" />
                <div className="h-3 w-3/4 bg-amber-300/20 dark:bg-stone-700/40 rounded-md" />
              </motion.div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {projections.map((proj, idx) => (
              <TimelineDayCard
                key={proj.dayKey}
                proj={proj}
                isBn={isBn}
                idx={idx}
                dailyProductionKg={dailyProductionKg}
                isInView={isInView}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Order CTA / scroll down */}
      {onScrollToProducts && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="mt-4 pt-3 border-t border-dashed border-amber-300/80 dark:border-stone-800 flex items-center justify-between gap-2"
        >
          <p className="text-[11px] text-stone-600 dark:text-stone-400">
            {isBn
              ? "সিরিয়াল অনুযায়ী প্রি-অর্ডার নিশ্চিত করতে প্রোডাক্ট নির্বাচন করুন:"
              : "Select a package to secure your spot in upcoming batch:"}
          </p>
          <button
            type="button"
            onClick={onScrollToProducts}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <span>{isBn ? "অর্ডার করুন" : "Order Now"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </section>
  );
}

interface TimelineDayCardProps {
  proj: StockDayProjection;
  isBn: boolean;
  idx: number;
  dailyProductionKg: number;
  isInView: boolean;
}

function TimelineDayCard({
  proj,
  isBn,
  idx,
  dailyProductionKg,
  isInView,
}: TimelineDayCardProps) {
  const isAvailable = proj.availableKg > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={
        isInView
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 18, scale: 0.97 }
      }
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.36, delay: 0.1 + idx * 0.08, ease: "easeOut" }}
      className={`rounded-xl p-3 sm:p-3.5 border transition-all ${
        proj.isToday
          ? "bg-stone-100/90 dark:bg-stone-800/60 border-stone-300/80 dark:border-stone-700"
          : isAvailable
          ? "bg-gradient-to-r from-emerald-50/90 via-emerald-100/60 to-teal-50/80 dark:from-emerald-950/40 dark:via-emerald-900/30 dark:to-stone-900 border-emerald-300 dark:border-emerald-700 shadow-sm"
          : "bg-amber-100/50 dark:bg-stone-800/50 border-amber-300/80 dark:border-amber-900/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Day Name & Date */}
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
              proj.isToday
                ? "bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300"
                : isAvailable
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-amber-200 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
            }`}
          >
            {isBn ? toBnNumber(idx + 1) : idx + 1}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                {isBn ? proj.dayNameBn : proj.dayNameEn}
              </span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                ({isBn ? `${proj.dateFormattedBn}, ${proj.weekdayBn}` : `${proj.dateFormattedEn}, ${proj.weekdayEn}`})
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {proj.isToday ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
              <PackageX className="w-3 h-3 text-rose-500" />
              {isBn ? "মজুদ শেষ (০ কেজি)" : "Sold Out (0 KG)"}
            </span>
          ) : isAvailable ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="w-3 h-3" />
              {isBn
                ? `${toBnNumber(proj.availableKg)} কেজি পাওয়া যাবে`
                : `${proj.availableKg} KG Available`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
              <CircleAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              {isBn ? "১০০% প্রি-অর্ডার বুকড" : "100% Booked"}
            </span>
          )}
        </div>
      </div>

      {/* Animated Progress Bar (Booked vs Available) */}
      {!proj.isToday && (
        <div className="space-y-1">
          <div className="w-full bg-stone-200 dark:bg-stone-750 h-2 rounded-full overflow-hidden flex">
            {/* Booked segment */}
            <motion.div
              initial={{ width: 0 }}
              animate={isInView ? { width: `${proj.percentBooked}%` } : { width: 0 }}
              transition={{ duration: 0.8, delay: 0.2 + idx * 0.1, ease: "easeOut" }}
              className={`h-full ${
                isAvailable
                  ? "bg-amber-500 dark:bg-amber-600"
                  : "bg-rose-500 dark:bg-rose-600"
              }`}
            />
            {/* Available segment */}
            {isAvailable && (
              <motion.div
                initial={{ width: 0 }}
                animate={isInView ? { width: `${100 - proj.percentBooked}%` } : { width: 0 }}
                transition={{ duration: 0.8, delay: 0.25 + idx * 0.1, ease: "easeOut" }}
                className="h-full bg-emerald-500 dark:bg-emerald-400"
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 font-mono">
            <span>
              {isBn ? "বুকড: " : "Booked: "}
              <strong className="text-stone-700 dark:text-stone-300">
                {isBn ? toBnNumber(proj.bookedKg) : proj.bookedKg} কেজি
              </strong>
            </span>
            <span>
              {isBn ? "অবশিষ্ট খালি: " : "Remaining: "}
              <strong
                className={
                  isAvailable
                    ? "text-emerald-700 dark:text-emerald-300 font-bold"
                    : "text-rose-600 dark:text-rose-400 font-bold"
                }
              >
                {isBn ? toBnNumber(proj.availableKg) : proj.availableKg} কেজি
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Context note */}
      <p className="mt-1.5 text-[11px] text-stone-600 dark:text-stone-400 leading-normal">
        {proj.isToday ? (
          isBn ? (
            "আজকের সংগৃহীত ও প্রস্তুত গুড়ের প্রতিটি কেজি পূর্ববর্তী গ্রাহকদের ঠিকানায় পাঠানোর জন্য বুকড।"
          ) : (
            "Today's harvested molasses is entirely booked and packing for shipment."
          )
        ) : isAvailable ? (
          isBn ? (
            `উৎপাদন ক্ষমতা ${toBnNumber(proj.capacityKg)} কেজি থেকে বর্তমান অর্ডার বাদ দিয়ে ${toBnNumber(proj.availableKg)} কেজি উন্মুক্ত আছে।`
          ) : (
            `${proj.availableKg} KG remains open out of ${proj.capacityKg} KG daily yield after existing orders.`
          )
        ) : (
          isBn ? (
            `আগামীকালের পুরো ${toBnNumber(proj.capacityKg)} কেজি বর্তমান অর্ডারে বুক হয়ে গেছে। নতুন অর্ডার পরশু বা পরবর্তী ব্যাচে অন্তর্ভুক্ত হবে।`
          ) : (
            `The entire ${proj.capacityKg} KG batch is booked by prior orders. Fresh orders will roll to subsequent batch.`
          )
        )}
      </p>
    </motion.div>
  );
}

export default LiveStockSection;
