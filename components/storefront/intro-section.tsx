"use client";

import React from "react";
import Image from "next/image";
import {
  Wind,
  ShieldCheck,
  Flame,
  Truck,
  HeartHandshake,
  Clock,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";
import { RollingNumber } from "@/components/storefront/rolling-number";
import { buildImageKitUrl } from "@/lib/imagekit/url";
import { ViewProductsButton } from "./view-products-button";

interface IntroSectionProps {
  lang?: StorefrontLang;
  hotline?: string;
  storeName?: string;
  storeSubtitle?: string;
  logoUrl?: string;
  isActive?: boolean;
  isStandaloneSection?: boolean;
  onScrollToProducts?: () => void;
  onScrollToWhyBuy?: () => void;
  onScrollToContact?: () => void;
}

export function IntroSection({
  lang = "bn",
  storeName,
  storeSubtitle,
  logoUrl,
  isActive = true,
  isStandaloneSection = true,
  onScrollToProducts,
  onScrollToWhyBuy,
  onScrollToContact,
}: IntroSectionProps) {
  const t = STOREFRONT_TEXT[lang];
  const displayName = storeName || t.introHeroTitle;
  const displaySubtitle = storeSubtitle || t.introHeroSubtitle;

  const optimizedLogoUrl = logoUrl
    ? buildImageKitUrl(logoUrl, { width: 256, height: 256, quality: 85, format: "auto" })
    : "";

  const handleScrollToProducts = () => {
    if (onScrollToProducts) {
      onScrollToProducts();
      return;
    }
    const el = document.getElementById("products") || document.getElementById("product-0");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const pillars = [
    {
      icon: ShieldCheck,
      iconColor: "text-emerald-700 dark:text-emerald-300",
      iconBg: "bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-850",
      accentGlow: "from-emerald-500/10 to-transparent",
      title: t.introPillar1Title,
      desc: t.introPillar1Desc,
    },
    {
      icon: Flame,
      iconColor: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-850",
      accentGlow: "from-amber-500/10 to-transparent",
      title: t.introPillar2Title,
      desc: t.introPillar2Desc,
    },
    {
      icon: Wind,
      iconColor: "text-yellow-700 dark:text-yellow-300",
      iconBg: "bg-yellow-100 dark:bg-yellow-950/80 border-yellow-300 dark:border-yellow-850",
      accentGlow: "from-yellow-500/10 to-transparent",
      title: t.introPillar3Title,
      desc: t.introPillar3Desc,
    },
    {
      icon: Truck,
      iconColor: "text-teal-700 dark:text-teal-300",
      iconBg: "bg-teal-100 dark:bg-teal-950/80 border-teal-300 dark:border-teal-850",
      accentGlow: "from-teal-500/10 to-transparent",
      title: t.introPillar4Title,
      desc: t.introPillar4Desc,
    },
  ];

  const stats = [
    {
      number: t.introStat1Number,
      label: t.introStat1Label,
      icon: Clock,
    },
    {
      number: t.introStat2Number,
      label: t.introStat2Label,
      icon: HeartHandshake,
    },
    {
      number: t.introStat3Number,
      label: t.introStat3Label,
      icon: ShieldCheck,
    },
    {
      number: t.introStat4Number,
      label: t.introStat4Label,
      icon: Truck,
    },
  ];

  const sectionContent = (
    <div className="relative z-10 w-full max-w-3xl sm:max-w-4xl mx-auto my-auto py-2 space-y-4 sm:space-y-6">
      {/* Brand Header */}
      <div className="text-center px-2">
        {/* Logo centered above brand name */}
        {optimizedLogoUrl && (
          <div className="flex justify-center -mb-2 sm:-mb-3 md:-mb-4">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 shrink-0 flex items-center justify-center">
              <Image
                src={optimizedLogoUrl}
                alt={displayName}
                width={128}
                height={128}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight">
          {displayName}
        </h1>

        <p className="mt-1.5 sm:mt-2 text-sm sm:text-base md:text-lg text-stone-600 dark:text-stone-300 max-w-2xl mx-auto leading-relaxed font-normal">
          {displaySubtitle}
        </p>
      </div>

      {/* Business Key Stats Grid */}
      <div className="px-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-xl p-3 text-center shadow-xs"
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Icon className="w-4 h-4 text-amber-800 dark:text-amber-400" />
                  <span className="font-mono text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 inline-flex items-center justify-center tabular-nums">
                    <RollingNumber
                      value={s.number}
                      isActive={isActive}
                      delay={idx * 0.05}
                    />
                  </span>
                </div>
                <span className="block text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-normal leading-tight">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action: "View Products & Order" */}
      <div className="text-center pt-2 pb-1">
        <ViewProductsButton
          onClick={handleScrollToProducts}
          lang={lang}
          label={t.viewProductsBtn}
        />
      </div>
    </div>
  );

  if (!isStandaloneSection) {
    return (
      <div
        id="intro"
        className="w-full pt-2 sm:pt-4 pb-2 sm:pb-4 px-3 sm:px-6 md:px-12 relative text-stone-900 dark:text-stone-100 select-none"
      >
        {sectionContent}
      </div>
    );
  }

  return (
    <section
      id="intro"
      data-section-index="0"
      className="min-h-[100dvh] w-full snap-start shrink-0 flex flex-col pt-3.5 sm:pt-16 pb-16 sm:pb-8 px-3 sm:px-6 md:px-12 relative bg-[#faf8f5] dark:bg-[#141210] text-stone-900 dark:text-stone-100 select-none scroll-smooth"
    >
      {sectionContent}
    </section>
  );
}

export default IntroSection;
