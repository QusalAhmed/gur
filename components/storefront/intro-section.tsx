"use client";

import React from "react";
import Image from "next/image";
import {
  Sparkles,
  ShieldCheck,
  Flame,
  Truck,
  HeartHandshake,
  Clock,
  ChevronDown,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";
import { RollingNumber } from "@/components/storefront/rolling-number";
import { buildImageKitUrl } from "@/lib/imagekit/url";

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
      icon: Sparkles,
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
      color: "text-amber-700 dark:text-amber-400",
    },
    {
      number: t.introStat2Number,
      label: t.introStat2Label,
      icon: HeartHandshake,
      color: "text-emerald-700 dark:text-emerald-400",
    },
    {
      number: t.introStat3Number,
      label: t.introStat3Label,
      icon: ShieldCheck,
      color: "text-yellow-700 dark:text-yellow-400",
    },
    {
      number: t.introStat4Number,
      label: t.introStat4Label,
      icon: Truck,
      color: "text-blue-700 dark:text-blue-400",
    },
  ];

  const sectionContent = (
    <div className="relative z-10 w-full max-w-3xl sm:max-w-4xl mx-auto my-auto py-2 space-y-4 sm:space-y-6">
      {/* Brand Header */}
      <div className="text-center px-2">
        {/* Logo centered above brand name */}
        {optimizedLogoUrl && (
          <div className="flex justify-center -mb-2 sm:-mb-3 md:-mb-4">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 shrink-0 flex items-center justify-center transition-transform duration-300 hover:scale-105">
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

        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-amber-950 dark:text-amber-50 tracking-tight leading-tight">
          {displayName}
        </h1>

        <p className="mt-1.5 sm:mt-2 text-sm sm:text-base md:text-lg text-stone-700 dark:text-stone-300 max-w-2xl mx-auto leading-relaxed font-normal">
          {displaySubtitle}
        </p>
      </div>

      {/* Business Key Stats Grid */}
      <div className="px-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="bg-white/90 dark:bg-stone-900/90 border border-amber-200/90 dark:border-stone-800/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 text-center shadow-xs"
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Icon className={`w-4 h-4 ${s.color}`} />
                  <span className="font-mono text-lg sm:text-xl font-black text-amber-950 dark:text-amber-100 inline-flex items-center justify-center">
                    <RollingNumber
                      value={s.number}
                      isActive={isActive}
                      delay={idx * 0.05}
                    />
                  </span>
                </div>
                <span className="block text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-medium leading-tight">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action: "View Products & Order" */}
      <div className="text-center pt-1 pb-1">
        <button
          type="button"
          onClick={handleScrollToProducts}
          aria-label={lang === "bn" ? "পণ্য দেখুন ও অর্ডার করুন" : "View products and order"}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 hover:from-amber-800 hover:to-amber-800 text-white font-extrabold text-sm sm:text-base py-3 sm:py-3.5 px-6 sm:px-8 rounded-full shadow-lg shadow-amber-900/15 active:scale-95 transition-all touch-manipulation group cursor-pointer"
        >
          <span>{t.viewProductsBtn}</span>
          <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" aria-hidden="true" />
        </button>
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
      className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col pt-3.5 sm:pt-16 pb-16 sm:pb-8 px-3 sm:px-6 md:px-12 relative overflow-y-auto bg-gradient-to-b from-[#FAF8F5] via-[#FFFDF9] to-[#F5EEDB] dark:from-[#141210] dark:via-[#181512] dark:to-[#1e1711] text-stone-900 dark:text-stone-100 select-none scroll-smooth"
    >
      {/* Soft Ambient Warm Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-b from-amber-300/35 via-amber-200/15 to-transparent dark:from-amber-950/30 dark:via-transparent dark:to-transparent pointer-events-none blur-3xl" />
      {sectionContent}
    </section>
  );
}

export default IntroSection;
