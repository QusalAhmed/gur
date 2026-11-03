"use client";

import React from "react";
import { motion, type Variants } from "motion/react";
import {
  ShieldCheck,
  PackageCheck,
  Flame,
  Sparkles,
  Box,
  Truck,
  CheckCircle2,
  Award,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";

interface WhyBuyFromUsProps {
  lang?: StorefrontLang;
  onScrollToProducts?: () => void;
}

// Container staggered children animation variants (Linear / Stripe inspiration)
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
};

// Card pop-in spring animation variants
const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 22,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 22,
      stiffness: 280,
    },
  },
};

export function WhyBuyFromUs({ lang = "bn" }: WhyBuyFromUsProps) {
  const t = STOREFRONT_TEXT[lang];

  const reasons = [
    {
      icon: ShieldCheck,
      iconColor: "text-emerald-700 dark:text-emerald-300",
      iconBg: "bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800",
      accentGlow: "from-emerald-500/10 dark:from-emerald-500/15",
      title: t.whyBuyReason1Title,
      desc: t.whyBuyReason1Desc,
    },
    {
      icon: PackageCheck,
      iconColor: "text-blue-700 dark:text-blue-300",
      iconBg: "bg-blue-100 dark:bg-blue-950/80 border-blue-300 dark:border-blue-800",
      accentGlow: "from-blue-500/10 dark:from-blue-500/15",
      title: t.whyBuyReason2Title,
      desc: t.whyBuyReason2Desc,
    },
    {
      icon: Flame,
      iconColor: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800",
      accentGlow: "from-amber-500/10 dark:from-amber-500/15",
      title: t.whyBuyReason3Title,
      desc: t.whyBuyReason3Desc,
    },
    {
      icon: Sparkles,
      iconColor: "text-yellow-700 dark:text-yellow-300",
      iconBg: "bg-yellow-100 dark:bg-yellow-950/80 border-yellow-300 dark:border-yellow-800",
      accentGlow: "from-yellow-500/10 dark:from-yellow-500/15",
      title: t.whyBuyReason4Title,
      desc: t.whyBuyReason4Desc,
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

  return (
    <section
      id="why-buy-from-us"
      className="w-full pt-2 pb-3 select-none text-stone-900 dark:text-stone-100"
    >
      {/* Header Pill & Title with Smooth Slide-Up Reveal */}
      <div className="text-center mb-4 sm:mb-6 px-2 space-y-1 sm:space-y-1.5">
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.92 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="inline-flex items-center gap-1.5 bg-amber-100/90 dark:bg-stone-850 border border-amber-300/80 dark:border-stone-700 px-3.5 py-1 rounded-full text-amber-950 dark:text-amber-200 text-xs font-bold shadow-xs hover:border-amber-400 transition-colors"
        >
          <motion.span
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            className="inline-block"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          </motion.span>
          <span>{t.whyBuyBadge}</span>
          <span className="opacity-40">•</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
            {t.authenticityBadge}
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 dark:text-stone-50 tracking-tight leading-tight pt-0.5"
        >
          {t.whyBuyTitle}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.16, ease: "easeOut" }}
          className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-lg mx-auto leading-relaxed"
        >
          {t.whyBuySubtitle}
        </motion.p>
      </div>

      {/* 6 Core Reasons Grid with Staggered Cascading Reveal */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 px-0.5"
      >
        {reasons.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={idx}
              variants={cardVariants}
              whileHover={{
                y: -4,
                scale: 1.015,
                transition: { type: "spring", stiffness: 400, damping: 25 },
              }}
              whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-amber-400/90 dark:hover:border-amber-600/80 rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-lg hover:shadow-amber-950/5 dark:hover:shadow-black/30 transition-all duration-300 flex items-start gap-3 sm:gap-3.5 cursor-default"
            >
              {/* Subtle Ambient Radial Highlight on Hover (Linear inspiration) */}
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
                <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100 leading-snug group-hover:text-amber-900 dark:group-hover:text-amber-200 transition-colors">
                  {item.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Trust & Refund Assurance Banner with Ambient Breathing Animation */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.55, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ scale: 1.01 }}
        className="relative overflow-hidden mt-3.5 sm:mt-4 bg-gradient-to-r from-emerald-50 via-amber-50/50 to-emerald-50 dark:from-emerald-950/30 dark:via-stone-900 dark:to-emerald-950/30 border-2 border-emerald-500/50 dark:border-emerald-600/50 rounded-2xl p-3.5 sm:p-4 text-center space-y-1.5 shadow-sm"
      >
        <div className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs sm:text-sm">
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 8, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="inline-flex items-center justify-center"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </motion.div>
          <span>{t.whyBuyGuaranteeTitle}</span>
        </div>
        <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
          {t.whyBuyGuaranteeDesc}
        </p>
      </motion.div>
    </section>
  );
}

export default WhyBuyFromUs;
