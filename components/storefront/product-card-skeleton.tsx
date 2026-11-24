"use client";

import React from "react";

export function ProductCardSkeleton() {
  return (
    <section
      id="products"
      data-product-card="true"
      data-section-index="1"
      className="h-[100vh] min-h-[100vh] max-h-[100vh] w-full snap-start snap-always shrink-0 flex flex-col justify-center pt-3.5 sm:pt-16 pb-16 sm:pb-6 px-3 sm:px-6 md:px-10 lg:px-16 relative overflow-hidden bg-[#faf8f5] dark:bg-[#141210] text-stone-900 dark:text-stone-100 select-none"
    >
      <div className="relative z-10 w-full max-w-5xl lg:max-w-6xl mx-auto my-auto grid grid-cols-1 md:grid-cols-2 items-center gap-4 sm:gap-6 md:gap-8 lg:gap-12 py-2">
        {/* Left Column: Image Skeleton */}
        <div className="w-full flex flex-col items-center justify-center">
          {/* Mobile only Meta Header */}
          <div className="md:hidden w-full max-w-md flex items-center justify-between mb-2">
            <div className="h-6 w-20 bg-stone-200/80 dark:bg-stone-800 rounded-lg animate-pulse" />
            <div className="h-6 w-24 bg-stone-200/80 dark:bg-stone-800 rounded-lg animate-pulse" />
          </div>

          <div className="relative w-full max-w-[260px] sm:max-w-md md:max-w-none aspect-square max-h-[260px] sm:max-h-[420px] md:max-h-[440px] lg:max-h-[480px] rounded-2xl bg-stone-200/70 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 overflow-hidden flex items-center justify-center animate-pulse" />
        </div>

        {/* Right Column: Info & Control Deck Skeleton */}
        <div className="w-full max-w-lg md:max-w-none lg:max-w-xl mx-auto flex flex-col justify-center space-y-3 sm:space-y-4">
          <div className="hidden md:flex items-center justify-between">
            <div className="h-6 w-20 bg-stone-200/80 dark:bg-stone-800 rounded-lg animate-pulse" />
            <div className="h-6 w-24 bg-stone-200/80 dark:bg-stone-800 rounded-lg animate-pulse" />
          </div>

          <div className="space-y-2 text-center md:text-left">
            <div className="h-7 sm:h-8 w-44 sm:w-56 bg-stone-300/80 dark:bg-stone-700 rounded-lg mx-auto md:mx-0 animate-pulse" />
            <div className="h-4 w-60 sm:w-72 bg-stone-200/80 dark:bg-stone-800 rounded-md mx-auto md:mx-0 animate-pulse" />
          </div>

          <div className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5 animate-pulse">
            <div className="h-9 w-full bg-stone-200/80 dark:bg-stone-800 rounded-lg" />
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="h-5 w-24 bg-stone-200/80 dark:bg-stone-800 rounded-md" />
            </div>
            <div className="h-11 w-full bg-stone-200/80 dark:bg-stone-800 rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
