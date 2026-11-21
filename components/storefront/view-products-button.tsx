"use client";

import React from "react";
import { motion } from "motion/react";
import { ChevronDown, Sparkles } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";

export interface ViewProductsButtonProps {
  onClick: () => void;
  lang?: StorefrontLang;
  label?: string;
  className?: string;
  size?: "default" | "compact";
  ariaLabel?: string;
}

/**
 * High-converting, artisanal "View Products & Order" CTA button
 * with dynamic light-sheen shimmer, subtle warm amber halo, and tactile micro-interactions.
 */
export function ViewProductsButton({
  onClick,
  lang = "bn",
  label,
  className = "",
  size = "default",
  ariaLabel,
}: ViewProductsButtonProps) {
  const t = STOREFRONT_TEXT[lang] || STOREFRONT_TEXT.bn;
  const displayLabel = label || t.viewProductsBtn;
  const defaultAriaLabel =
    lang === "bn" ? "পণ্য দেখুন ও অর্ডার করুন" : "View products and order";

  const sizeClasses =
    size === "compact"
      ? "py-2.5 sm:py-3 px-5 sm:px-6 text-xs sm:text-sm"
      : "py-3.5 sm:py-4 px-6 sm:px-8 text-sm sm:text-base";

  return (
    <div className={`relative inline-block group ${className}`}>
      {/* Outer Warm Amber Glow Halo with Soft Breathing Pulse */}
      <motion.div
        animate={{
          opacity: [0.55, 0.85, 0.55],
          scale: [0.98, 1.02, 0.98],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: "easeInOut",
        }}
        className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-500/35 via-amber-400/50 to-amber-600/35 dark:from-amber-600/30 dark:via-amber-500/40 dark:to-amber-600/30 blur-md pointer-events-none group-hover:opacity-100 group-hover:blur-lg transition-all"
        aria-hidden="true"
      />

      {/* Main Interactive Button with Shimmer */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || defaultAriaLabel}
        className={`relative inline-flex items-center gap-2.5 sm:gap-3 rounded-full bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 hover:from-amber-800 hover:via-amber-700 hover:to-amber-800 active:from-amber-900 active:via-amber-800 active:to-amber-900 text-white font-extrabold tracking-wide border-2 border-amber-300/70 dark:border-amber-400/50 shadow-[0_10px_25px_-5px_rgba(180,83,9,0.45),inset_0_1px_2px_rgba(255,255,255,0.5)] hover:shadow-[0_16px_32px_-5px_rgba(180,83,9,0.55),inset_0_1px_2px_rgba(255,255,255,0.6)] transition-all duration-200 ease-out touch-manipulation cursor-pointer select-none overflow-hidden focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-amber-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 ${sizeClasses}`}
      >
        {/* Shimmer Light Beam Effect - Motion Animated */}
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <motion.span
            className="absolute top-0 bottom-0 left-0 w-3/4 -skew-x-25 bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none"
            initial={{ x: "-150%" }}
            animate={{ x: ["-150%", "280%"] }}
            transition={{
              repeat: Infinity,
              repeatDelay: 1.2,
              duration: 1.5,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        </span>

        {/* Leading Sparkle Accent */}
        <Sparkles
          className="relative z-10 w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-200 shrink-0 motion-safe:animate-pulse"
          aria-hidden="true"
        />

        {/* Button Text */}
        <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] whitespace-nowrap">
          {displayLabel}
        </span>

        {/* Trailing Icon with Tactile Circular Badge */}
        <span
          className="relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/20 dark:bg-black/25 flex items-center justify-center shrink-0 border border-white/30 shadow-xs group-hover:bg-white/30 group-hover:scale-105 transition-all duration-200"
          aria-hidden="true"
        >
          <ChevronDown
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white group-hover:translate-y-0.5 transition-transform duration-200"
            aria-hidden="true"
          />
        </span>
      </motion.button>
    </div>
  );
}

export default ViewProductsButton;
