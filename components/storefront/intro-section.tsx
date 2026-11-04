"use client";

import React from "react";
import {
  Sparkles,
  ShieldCheck,
  Flame,
  Truck,
  Award,
  CheckCircle2,
  MapPin,
  HeartHandshake,
  Clock,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";
import { RollingNumber } from "@/components/storefront/rolling-number";

interface IntroSectionProps {
  lang?: StorefrontLang;
  hotline?: string;
  storeName?: string;
  storeSubtitle?: string;
  isActive?: boolean;
  onScrollToProducts?: () => void;
  onScrollToWhyBuy?: () => void;
  onScrollToContact?: () => void;
}

export function IntroSection({
  lang = "bn",
  storeName,
  storeSubtitle,
  isActive = true,
  onScrollToWhyBuy,
  onScrollToContact,
}: IntroSectionProps) {
  const t = STOREFRONT_TEXT[lang];
  const displayName = storeName || t.introHeroTitle;
  const displaySubtitle = storeSubtitle || t.introHeroSubtitle;

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

  return (
    <section
      id="intro"
      data-section-index="0"
      className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col pt-3.5 sm:pt-16 pb-16 sm:pb-8 px-3 sm:px-6 md:px-12 relative overflow-y-auto bg-gradient-to-b from-[#FAF8F5] via-[#FFFDF9] to-[#F5EEDB] dark:from-[#141210] dark:via-[#181512] dark:to-[#1e1711] text-stone-900 dark:text-stone-100 select-none scroll-smooth"
    >
      {/* Soft Ambient Warm Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-b from-amber-300/35 via-amber-200/15 to-transparent dark:from-amber-950/30 dark:via-transparent dark:to-transparent pointer-events-none blur-3xl" />

      {/* Main Content Container - completely static without render-blocking animation delays */}
      <div className="relative z-10 w-full max-w-3xl sm:max-w-4xl mx-auto my-auto py-2 space-y-4 sm:space-y-6">
        {/* Top Heritage Pill & Badges */}
        <div className="text-center space-y-2 px-2">
          <div className="inline-flex items-center gap-1.5 bg-amber-100/90 dark:bg-stone-850 border border-amber-300/90 dark:border-amber-700/60 px-3.5 py-1 rounded-full text-amber-950 dark:text-amber-200 text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>{t.introBadge}</span>
            <span className="opacity-40">•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {t.introOriginBadge}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-amber-950 dark:text-amber-50 tracking-tight leading-tight pt-1">
            {displayName}
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-stone-700 dark:text-stone-300 max-w-2xl mx-auto leading-relaxed font-normal">
            {displaySubtitle}
          </p>

          {/* Quick Trust Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 bg-white/90 dark:bg-stone-900 border border-amber-200 dark:border-stone-800 py-0.5 px-2.5 rounded-full text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {t.introPurityBadge}
            </span>
            <span className="inline-flex items-center gap-1 bg-white/90 dark:bg-stone-900 border border-amber-200 dark:border-stone-800 py-0.5 px-2.5 rounded-full text-[11px] font-semibold text-amber-900 dark:text-amber-300 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              {t.locationText}
            </span>
            <span className="inline-flex items-center gap-1 bg-white/90 dark:bg-stone-900 border border-amber-200 dark:border-stone-800 py-0.5 px-2.5 rounded-full text-[11px] font-semibold text-teal-800 dark:text-teal-300 shadow-2xs">
              <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              {t.introCodBadge}
            </span>
          </div>
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
                        delay={0.1 + idx * 0.08}
                      />
                    </span>
                  </div>
                  <span className="block text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 font-medium leading-tight">
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 Core Pillars of the Business */}
        <div className="space-y-2 px-1">
          <div className="text-center sm:text-left mb-1.5">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
              {t.introMissionTitle}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
            {pillars.map((p, idx) => {
              const Icon = p.icon;
              return (
                <div
                  key={idx}
                  className="relative overflow-hidden bg-white/90 dark:bg-stone-900/90 border border-stone-200/90 dark:border-stone-800 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-start gap-3"
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${p.iconBg} ${p.iconColor} border flex items-center justify-center shrink-0 shadow-inner`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-100 leading-snug">
                      {p.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Business Story & Heritage Statement */}
        <div className="bg-gradient-to-br from-amber-100/90 via-amber-50/80 to-white dark:from-stone-900 dark:via-stone-900 dark:to-stone-850 border border-amber-300/80 dark:border-stone-700/80 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-2 text-stone-800 dark:text-stone-200">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-100 uppercase tracking-wide">
              {t.introHeritageHeading}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-normal">
            {t.introHeritageText}
          </p>
          <div className="pt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] sm:text-xs font-semibold text-emerald-800 dark:text-emerald-400 border-t border-amber-200/80 dark:border-stone-800">
            <span>{t.introCustomerPromise}</span>
            <div className="flex items-center gap-2">
              {onScrollToWhyBuy && (
                <button
                  type="button"
                  onClick={onScrollToWhyBuy}
                  className="text-amber-800 dark:text-amber-300 hover:underline font-bold shrink-0 cursor-pointer"
                >
                  {lang === "bn" ? "কেন আমাদের গুড় সেরা? ❯" : "Why Choose Us? ❯"}
                </button>
              )}
              {onScrollToContact && (
                <button
                  type="button"
                  onClick={onScrollToContact}
                  className="text-stone-600 dark:text-stone-400 hover:underline font-semibold shrink-0 cursor-pointer"
                >
                  {lang === "bn" ? "যোগাযোগ ❯" : "Contact ❯"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default IntroSection;
