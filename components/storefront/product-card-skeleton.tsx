"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export function ProductCardSkeleton() {
  return (
    <section
      id="products"
      data-product-card="true"
      data-section-index="1"
      className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col justify-center pt-3.5 sm:pt-16 pb-16 sm:pb-6 px-3 sm:px-6 md:px-10 lg:px-16 relative overflow-y-auto bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 select-none"
    >
      {/* Subtle Rustic Texture Backdrop Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 w-full max-w-5xl lg:max-w-6xl mx-auto my-auto grid grid-cols-1 md:grid-cols-2 items-center gap-4 sm:gap-6 md:gap-8 lg:gap-12 py-2">
        {/* Left Column: Image Skeleton */}
        <div className="w-full flex flex-col items-center justify-center">
          {/* Mobile only Meta Header */}
          <div className="md:hidden w-full max-w-md flex items-center justify-between mb-2">
            <div className="h-7 w-24 bg-amber-200/70 dark:bg-stone-800 rounded-full animate-pulse border border-amber-300/40" />
            <div className="h-7 w-28 bg-amber-200/70 dark:bg-stone-800 rounded-full animate-pulse border border-amber-300/40" />
          </div>

          <div className="relative w-full max-w-[340px] xs:max-w-[380px] sm:max-w-md md:max-w-none aspect-[4/3] sm:aspect-square md:aspect-[4/3] lg:aspect-square max-h-[280px] sm:max-h-[360px] md:max-h-[380px] lg:max-h-[440px] rounded-3xl bg-amber-200/50 dark:bg-stone-800/80 border-2 border-amber-300/60 dark:border-stone-700 shadow-xl overflow-hidden flex items-center justify-center animate-pulse">
            <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-amber-400/40 dark:text-amber-500/30 animate-pulse" />
          </div>

          <div className="w-48 xs:w-56 sm:w-64 md:w-72 h-2 sm:h-2.5 bg-gradient-to-r from-transparent via-[#b47137]/60 to-transparent rounded-full shadow-md mt-2 opacity-70 animate-pulse" />
          <div className="h-4 w-36 sm:w-44 bg-amber-200/70 dark:bg-stone-800 rounded-full mx-auto mt-2 animate-pulse" />
        </div>

        {/* Right Column: Info & Control Deck Skeleton */}
        <div className="w-full max-w-lg md:max-w-none lg:max-w-xl mx-auto flex flex-col justify-center space-y-3 sm:space-y-4">
          <div className="hidden md:flex items-center justify-between">
            <div className="h-7 w-24 sm:w-28 bg-amber-200/70 dark:bg-stone-800 rounded-full animate-pulse border border-amber-300/40" />
            <div className="h-7 w-28 sm:w-36 bg-amber-200/70 dark:bg-stone-800 rounded-full animate-pulse border border-amber-300/40" />
          </div>

          <div className="space-y-2 text-center md:text-left">
            <div className="h-7 sm:h-8 w-44 sm:w-56 bg-amber-300/70 dark:bg-stone-700 rounded-xl mx-auto md:mx-0 animate-pulse" />
            <div className="h-3.5 sm:h-4 w-60 sm:w-72 bg-amber-200/60 dark:bg-stone-800 rounded-lg mx-auto md:mx-0 animate-pulse" />
          </div>

          <div className="w-full bg-amber-100/90 dark:bg-stone-900/90 backdrop-blur-md border border-amber-300/80 dark:border-stone-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl shadow-amber-950/10 space-y-2.5 animate-pulse">
            <div className="h-8 w-full bg-amber-200/80 dark:bg-stone-800 rounded-xl" />
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="h-6 w-28 bg-amber-200/80 dark:bg-stone-800 rounded-lg" />
            </div>
            <div className="h-12 w-full bg-amber-200/80 dark:bg-stone-800 rounded-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
