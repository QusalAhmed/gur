"use client";

import React from "react";

export function ProductCardSkeleton() {
  return (
    <section
      id="products"
      data-product-card="true"
      data-section-index="1"
      className="relative w-full h-[100dvh] flex items-center justify-center p-2.5 sm:p-4 md:p-6 lg:p-8 select-none"
    >
      <div className="relative w-full max-w-5xl lg:max-w-6xl mx-auto rounded-3xl bg-white/92 dark:bg-stone-900/92 backdrop-blur-md border border-amber-200/70 dark:border-stone-800 shadow-xl overflow-hidden flex flex-col justify-center max-h-[92dvh] p-4 sm:p-6 md:p-8">
        {/* Subtle amber gradient line on top edge */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />

        {/* Top Header Row Skeleton */}
        <div className="flex items-center justify-between pb-3 shrink-0">
          <div className="h-6 w-24 bg-stone-200/80 dark:bg-stone-800 rounded-full animate-pulse" />
          <div className="h-6 w-36 bg-emerald-100/60 dark:bg-emerald-950/40 rounded-full animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 sm:gap-6 md:gap-8 lg:gap-10 pt-1">
          {/* Left Column: Image Skeleton */}
          <div className="w-full flex flex-col items-center justify-center">
            <div className="relative w-full max-w-[240px] sm:max-w-[340px] md:max-w-none aspect-square max-h-[240px] sm:max-h-[360px] md:max-h-[420px] lg:max-h-[460px] rounded-2xl bg-stone-200/70 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 overflow-hidden flex items-center justify-center animate-pulse" />
          </div>

          {/* Right Column: Info & Control Deck Skeleton */}
          <div className="w-full max-w-lg md:max-w-none lg:max-w-xl mx-auto flex flex-col justify-center space-y-3 sm:space-y-4">
            <div className="space-y-2 text-center md:text-left">
              <div className="h-7 sm:h-8 w-44 sm:w-56 bg-stone-300/80 dark:bg-stone-700 rounded-lg mx-auto md:mx-0 animate-pulse" />
              <div className="h-4 w-60 sm:w-72 bg-stone-200/80 dark:bg-stone-800 rounded-md mx-auto md:mx-0 animate-pulse" />
            </div>

            <div className="w-full bg-stone-50 dark:bg-stone-850 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3 animate-pulse">
              <div className="flex gap-2">
                <div className="h-8 w-20 bg-stone-200/80 dark:bg-stone-800 rounded-xl" />
                <div className="h-8 w-24 bg-stone-200/80 dark:bg-stone-800 rounded-xl" />
              </div>
              <div className="h-5 w-28 bg-stone-200/80 dark:bg-stone-800 rounded-md" />
              <div className="h-11 w-full bg-stone-200/80 dark:bg-stone-800 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
