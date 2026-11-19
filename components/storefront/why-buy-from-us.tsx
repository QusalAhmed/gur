"use client";

import React from "react";
import {
  BadgePercent,
  Box,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";

interface WhyBuyFromUsProps {
  lang?: StorefrontLang;
  hotline?: string;
  onScrollToProducts?: () => void;
  onScrollToContact?: () => void;
  isStandaloneSection?: boolean;
}

export function WhyBuyFromUs({
  lang = "bn",
  isStandaloneSection = true,
}: WhyBuyFromUsProps) {
  const t = STOREFRONT_TEXT[lang];

  const reasons = [
    {
      icon: BadgePercent,
      iconColor: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800",
      accentGlow: "from-amber-500/10 dark:from-amber-500/15",
      title: t.whyBuyReasonPriceTitle,
      desc: t.whyBuyReasonPriceDesc,
    },
    {
      icon: Box,
      iconColor: "text-purple-700 dark:text-purple-300",
      iconBg: "bg-purple-100 dark:bg-purple-950/80 border-purple-300 dark:border-purple-800",
      accentGlow: "from-purple-500/10 dark:from-purple-500/15",
      title: t.whyBuyReason5Title,
      desc: t.whyBuyReason5Desc,
    },
    {
      icon: Truck,
      iconColor: "text-teal-700 dark:text-teal-300",
      iconBg: "bg-teal-100 dark:bg-teal-950/80 border-teal-300 dark:border-teal-800",
      accentGlow: "from-teal-500/10 dark:from-teal-500/15",
      title: t.whyBuyReason6Title,
      desc: t.whyBuyReason6Desc,
    },
  ];

  const sectionContent = (
    <div className="relative z-10 w-full max-w-3xl sm:max-w-4xl mx-auto my-auto py-2 space-y-4">
      {/* Header Title - Rendered immediately with zero delay */}
      <div className="text-center mb-4 sm:mb-6 px-2 space-y-1 sm:space-y-1.5">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 dark:text-stone-50 tracking-tight leading-tight pt-0.5">
          {t.whyBuyTitle}
        </h2>
      </div>

      {/* Core Reasons Grid - 2 cards per row on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 px-0.5">
        {reasons.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="group relative overflow-hidden bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-amber-400/90 dark:hover:border-amber-600/80 rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-lg hover:shadow-amber-950/5 dark:hover:shadow-black/30 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98] flex items-start gap-3 sm:gap-3.5 cursor-default"
            >
              {/* Subtle Ambient Radial Highlight on Hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${item.accentGlow} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
              />

              {/* Icon Container with Micro-interaction */}
              <div
                className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${item.iconBg} ${item.iconColor} border flex items-center justify-center shrink-0 shadow-xs mt-0.5 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:stroke-[2.3]" />
              </div>

              {/* Title & Description */}
              <div className="relative min-w-0 space-y-1">
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-stone-100 leading-snug group-hover:text-amber-900 dark:group-hover:text-amber-200 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Refund Assurance Banner - Instant load without delay */}
      <div className="relative overflow-hidden mt-3.5 sm:mt-4 bg-gradient-to-r from-emerald-50 via-amber-50/50 to-emerald-50 dark:from-emerald-950/30 dark:via-stone-900 dark:to-emerald-950/30 border-2 border-emerald-500/50 dark:border-emerald-600/50 rounded-2xl p-3.5 sm:p-4 text-center space-y-1.5 shadow-sm transition-transform duration-200 hover:scale-[1.01]">
        <div className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm sm:text-base">
          <div className="inline-flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <span>{t.whyBuyGuaranteeTitle}</span>
        </div>
        <p className="text-xs sm:text-sm md:text-base text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
          {t.whyBuyGuaranteeDesc}
        </p>
      </div>
    </div>
  );

  if (!isStandaloneSection) {
    return (
      <section id="why-buy-from-us" className="w-full pt-2 sm:pt-4 pb-2 sm:pb-4 px-3 sm:px-6 md:px-12 select-none text-stone-900 dark:text-stone-100">
        {sectionContent}
      </section>
    );
  }

  return (
    <section
      id="why-buy-from-us"
      data-section-index="1"
      className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col pt-3.5 sm:pt-16 pb-16 sm:pb-8 px-3 sm:px-6 md:px-12 relative overflow-y-auto bg-gradient-to-b from-[#FAF8F5] via-[#FFFDF9] to-[#F5EEDB] dark:from-[#141210] dark:via-[#181512] dark:to-[#1e1711] text-stone-900 dark:text-stone-100 select-none scroll-smooth"
    >
      {/* Soft Ambient Warm Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-b from-amber-300/35 via-amber-200/15 to-transparent dark:from-amber-950/30 dark:via-transparent dark:to-transparent pointer-events-none blur-3xl" />
      {sectionContent}
    </section>
  );
}

export default WhyBuyFromUs;
