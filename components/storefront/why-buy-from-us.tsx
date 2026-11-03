"use client";

import React from "react";
import { motion } from "motion/react";
import {
  ShieldCheck,
  PackageCheck,
  Flame,
  Sparkles,
  Box,
  Truck,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";

interface WhyBuyFromUsProps {
  lang?: StorefrontLang;
  onScrollToProducts?: () => void;
}

export function WhyBuyFromUs({
  lang = "bn",
  onScrollToProducts,
}: WhyBuyFromUsProps) {
  const t = STOREFRONT_TEXT[lang];

  const reasons = [
    {
      icon: ShieldCheck,
      iconColor: "text-emerald-700 dark:text-emerald-300",
      iconBg: "bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800",
      title: t.whyBuyReason1Title,
      desc: t.whyBuyReason1Desc,
    },
    {
      icon: PackageCheck,
      iconColor: "text-blue-700 dark:text-blue-300",
      iconBg: "bg-blue-100 dark:bg-blue-950/80 border-blue-300 dark:border-blue-800",
      title: t.whyBuyReason2Title,
      desc: t.whyBuyReason2Desc,
    },
    {
      icon: Flame,
      iconColor: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800",
      title: t.whyBuyReason3Title,
      desc: t.whyBuyReason3Desc,
    },
    {
      icon: Sparkles,
      iconColor: "text-yellow-700 dark:text-yellow-300",
      iconBg: "bg-yellow-100 dark:bg-yellow-950/80 border-yellow-300 dark:border-yellow-800",
      title: t.whyBuyReason4Title,
      desc: t.whyBuyReason4Desc,
    },
    {
      icon: Box,
      iconColor: "text-purple-700 dark:text-purple-300",
      iconBg: "bg-purple-100 dark:bg-purple-950/80 border-purple-300 dark:border-purple-800",
      title: t.whyBuyReason5Title,
      desc: t.whyBuyReason5Desc,
    },
    {
      icon: Truck,
      iconColor: "text-teal-700 dark:text-teal-300",
      iconBg: "bg-teal-100 dark:bg-teal-950/80 border-teal-300 dark:border-teal-800",
      title: t.whyBuyReason6Title,
      desc: t.whyBuyReason6Desc,
    },
  ];

  return (
    <section
      id="why-buy-from-us"
      className="w-full pt-2 pb-3 select-none text-stone-900 dark:text-stone-100"
    >
      {/* Header Pill & Title */}
      <div className="text-center mb-4 sm:mb-6 px-2 space-y-1 sm:space-y-1.5">
        <div className="inline-flex items-center gap-1.5 bg-amber-100/90 dark:bg-stone-850 border border-amber-300/80 dark:border-stone-700 px-3.5 py-1 rounded-full text-amber-950 dark:text-amber-200 text-xs font-bold shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span>{t.whyBuyBadge}</span>
          <span className="opacity-40">•</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
            {t.authenticityBadge}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 dark:text-stone-50 tracking-tight leading-tight pt-0.5">
          {t.whyBuyTitle}
        </h2>

        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-lg mx-auto leading-relaxed">
          {t.whyBuySubtitle}
        </p>
      </div>

      {/* 6 Core Reasons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 px-0.5">
        {reasons.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={idx}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-amber-400/80 dark:hover:border-amber-600/70 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all flex items-start gap-3 sm:gap-3.5"
            >
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${item.iconBg} ${item.iconColor} border flex items-center justify-center shrink-0 shadow-xs mt-0.5`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100 leading-snug">
                  {item.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Trust & Refund Assurance Banner */}
      <div className="mt-3.5 sm:mt-4 bg-gradient-to-r from-emerald-50 via-amber-50/50 to-emerald-50 dark:from-emerald-950/30 dark:via-stone-900 dark:to-emerald-950/30 border-2 border-emerald-500/50 dark:border-emerald-600/50 rounded-2xl p-3.5 sm:p-4 text-center space-y-1.5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t.whyBuyGuaranteeTitle}</span>
        </div>
        <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
          {t.whyBuyGuaranteeDesc}
        </p>

        {onScrollToProducts && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onScrollToProducts}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm py-2 px-4 sm:px-5 rounded-full shadow-md transition-all cursor-pointer touch-manipulation"
            >
              <span>{t.whyBuyBrowseBtn}</span>
              <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default WhyBuyFromUs;

