"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Phone, ShoppingBag, ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartTotalQuantity,
  openCart,
} from "@/lib/redux/slices/cart-slice";
import { CartSheet } from "./cart-sheet";
import { trackContact } from "@/lib/facebook-pixel";

interface StoreHeaderProps {
  storeName?: string;
  hotline?: string;
  showBackToHome?: boolean;
}

const emptySubscribe = () => () => {};

export function StoreHeader({
  storeName = "খেজুরের খাঁটি গুড়",
  hotline = "01843557389",
  showBackToHome = true,
}: StoreHeaderProps) {
  const dispatch = useAppDispatch();
  const cartTotalQuantity = useAppSelector(selectCartTotalQuantity);
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const displayCartQuantity = mounted ? cartTotalQuantity : 0;

  const rawHotlineDigits = hotline.replace(/[^0-9]/g, "");

  return (
    <>
      <header className="sticky top-0 z-40 w-full h-14 sm:h-16 px-4 sm:px-8 bg-amber-100/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-amber-200/80 dark:border-stone-800 flex items-center justify-between shadow-xs select-none">
        {/* Left: Brand or Back Link */}
        <div className="flex items-center gap-3">
          {showBackToHome && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 hover:text-amber-950 dark:hover:text-amber-100 bg-amber-200/60 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-700 py-1.5 px-3 rounded-full transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>হোমে ফিরুন</span>
            </Link>
          )}

          <Link
            href="/"
            className="flex items-center gap-2 min-w-0 pr-2 group"
            title="হোমপেইজ"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-amber-50 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-amber-100" />
            </div>
            <div className="min-w-0">
              <span className="text-sm sm:text-base font-black text-amber-950 dark:text-amber-100 tracking-tight block leading-tight truncate">
                {storeName}
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block leading-tight">
                ১০০% খাঁটি ও প্রাকৃতিক
              </span>
            </div>
          </Link>
        </div>

        {/* Center / Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-2 bg-amber-200/50 dark:bg-stone-800/60 p-1 rounded-full border border-amber-300/60 dark:border-stone-700 text-xs font-bold text-amber-950 dark:text-amber-100">
          <Link
            href="/"
            className="px-3 py-1 rounded-full hover:bg-white/70 dark:hover:bg-stone-700 transition-colors"
          >
            হোম
          </Link>
          <Link
            href="/products"
            className="px-3 py-1 rounded-full hover:bg-white/70 dark:hover:bg-stone-700 transition-colors"
          >
            পণ্যসমূহ
          </Link>
          <Link
            href="/contact"
            className="px-3 py-1 rounded-full bg-white text-amber-900 shadow-xs"
          >
            যোগাযোগ
          </Link>
          <Link
            href="/privacy-policy"
            className="px-3 py-1 rounded-full hover:bg-white/70 dark:hover:bg-stone-700 transition-colors"
          >
            প্রাইভেসি পলিসি
          </Link>
        </nav>

        {/* Right: Hotline & Cart */}
        <div className="flex items-center gap-2">
          {/* Hotline Button */}
          <a
            href={`tel:${rawHotlineDigits}`}
            onClick={() => trackContact({ channel: "phone", customData: { source: "header_hotline" } })}
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4 rounded-full shadow-md transition-all touch-manipulation"
          >
            <Phone className="w-3.5 h-3.5 animate-pulse shrink-0" />
            <span className="hidden sm:inline">হটলাইন:</span>
            <span className="font-mono text-xs sm:text-sm">{hotline}</span>
          </a>

          {/* Cart Button */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => dispatch(openCart())}
            className="relative inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-stone-800 border-2 border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-100 shadow-xs hover:bg-amber-50 active:scale-95 transition-all cursor-pointer"
            aria-label="শপিং কার্ট"
          >
            <ShoppingBag className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            {displayCartQuantity > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[10px] font-black rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center shadow-md animate-bounce ring-2 ring-white dark:ring-stone-900">
                {displayCartQuantity}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Cart Sheet Drawer */}
      <CartSheet lang="bn" onProceedToCheckout={() => {
        window.location.href = "/#checkout";
      }} />
    </>
  );
}

export default StoreHeader;

