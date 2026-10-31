"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export function ProductCardSkeleton() {
  return (
    <section
      id="products"
      data-product-card="true"
      data-section-index="1"
      className="h-[100dvh] max-h-[100dvh] min-h-[580px] w-full snap-start snap-always shrink-0 flex flex-col justify-between pt-3.5 sm:pt-18 pb-16 sm:pb-4 px-2.5 xs:px-3 sm:px-6 md:px-12 relative overflow-y-auto sm:overflow-hidden bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 select-none"
    >
      {/* Subtle Rustic Texture Backdrop Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Meta Header: Product Counter + Quality Badge Placeholders */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex items-center justify-between">
        <div className="h-7 w-24 sm:w-28 bg-amber-200/70 dark:bg-stone-800 rounded-full animate-pulse border border-amber-300/40" />
        <div className="h-7 w-28 sm:w-36 bg-amber-200/70 dark:bg-stone-800 rounded-full animate-pulse border border-amber-300/40" />
      </div>

      {/* Center Image Showcase Frame with Shelf Pedestal */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto py-2">
        <div className="relative w-64 h-64 xs:w-72 xs:h-72 sm:w-84 sm:h-84 md:w-92 md:h-92 rounded-3xl bg-amber-200/50 dark:bg-stone-800/80 border-2 border-amber-300/60 dark:border-stone-700 shadow-xl overflow-hidden flex items-center justify-center animate-pulse">
          <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-amber-400/40 dark:text-amber-500/30 animate-pulse" />
        </div>

        {/* Artisanal Clay/Wood Shelf Pedestal Bar */}
        <div className="w-56 xs:w-64 sm:w-80 h-2 sm:h-2.5 bg-gradient-to-r from-transparent via-[#b47137]/60 to-transparent rounded-full shadow-md mt-2 opacity-70 animate-pulse" />

        {/* Heritage Badge Placeholder */}
        <div className="h-4 w-36 sm:w-44 bg-amber-200/70 dark:bg-stone-800 rounded-full mx-auto mt-2 animate-pulse" />

        {/* Product Title & Short Bio Placeholders */}
        <div className="text-center mt-2 px-2 max-w-sm sm:max-w-md space-y-2">
          <div className="h-7 sm:h-8 w-44 sm:w-56 bg-amber-300/70 dark:bg-stone-700 rounded-xl mx-auto animate-pulse" />
          <div className="h-3.5 sm:h-4 w-60 sm:w-72 bg-amber-200/60 dark:bg-stone-800 rounded-lg mx-auto animate-pulse" />
        </div>
      </div>

      {/* Bottom Control Deck: Price Pill + Stepper Deck Placeholder */}
      <div className="relative z-10 w-full max-w-lg mx-auto bg-amber-100/90 dark:bg-stone-900/90 backdrop-blur-md border border-amber-300/80 dark:border-stone-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl shadow-amber-950/10 space-y-2.5 animate-pulse">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="h-8 w-24 bg-amber-200/80 dark:bg-stone-800 rounded-xl" />
          <div className="flex gap-1.5">
            <div className="h-8 w-16 bg-amber-200/80 dark:bg-stone-800 rounded-xl" />
            <div className="h-8 w-16 bg-amber-200/80 dark:bg-stone-800 rounded-xl" />
          </div>
        </div>
        <div className="h-12 w-full bg-amber-200/80 dark:bg-stone-800 rounded-2xl" />
      </div>
    </section>
  );
}
