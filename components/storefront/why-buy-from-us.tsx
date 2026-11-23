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
      title: t.whyBuyReasonPriceTitle,
      desc: t.whyBuyReasonPriceDesc,
    },
    {
      icon: Box,
      title: t.whyBuyReason5Title,
      desc: t.whyBuyReason5Desc,
    },
    {
      icon: Truck,
      title: t.whyBuyReason6Title,
      desc: t.whyBuyReason6Desc,
    },
  ];

  const sectionContent = (
    <div className="relative z-10 w-full max-w-3xl sm:max-w-4xl mx-auto my-auto py-2 space-y-4">
      {/* Header Title */}
      <div className="text-center mb-4 sm:mb-6 px-2 space-y-1">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight">
          {t.whyBuyTitle}
        </h2>
      </div>

      {/* Core Reasons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-0.5">
        {reasons.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="relative bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-xl p-3.5 sm:p-4 shadow-xs flex items-start gap-3 sm:gap-3.5 cursor-default transition-colors hover:border-stone-300 dark:hover:border-stone-700"
            >
              {/* Icon Container */}
              <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-5 h-5 text-amber-800 dark:text-amber-400" />
              </div>

              {/* Title & Description */}
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm sm:text-base font-semibold text-stone-900 dark:text-stone-100 leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-normal">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Refund Assurance Card */}
      <div className="mt-3.5 sm:mt-4 bg-stone-50 dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800 rounded-xl p-3.5 sm:p-4 text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 text-stone-900 dark:text-stone-100 font-semibold text-sm sm:text-base">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t.whyBuyGuaranteeTitle}</span>
        </div>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
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
      className="min-h-[100dvh] w-full snap-start shrink-0 flex flex-col pt-3.5 sm:pt-16 pb-16 sm:pb-8 px-3 sm:px-6 md:px-12 relative bg-[#faf8f5] dark:bg-[#141210] text-stone-900 dark:text-stone-100 select-none scroll-smooth"
    >
      {sectionContent}
    </section>
  );
}

export default WhyBuyFromUs;
