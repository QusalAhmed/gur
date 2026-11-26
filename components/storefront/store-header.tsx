"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Phone, ShoppingBag, ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartTotalQuantity,
  openCart,
} from "@/lib/redux/slices/cart-slice";
import { CartSheet } from "./cart-sheet";
import { trackContact } from "@/lib/facebook-pixel";

import { imageKitLoader, isImageKitUrl } from "@/lib/imagekit/loader";

interface StoreHeaderProps {
  storeName?: string;
  logoUrl?: string;
  hotline?: string;
  showBackToHome?: boolean;
}

const emptySubscribe = () => () => {};

export function StoreHeader({
  storeName = "Gramayon",
  logoUrl,
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
            className="flex items-center gap-2.5 min-w-0 pr-2 group"
            title="হোমপেইজ"
          >
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
              <Image
                src={logoUrl || "/admin-icon/icon-192.png"}
                loader={logoUrl && isImageKitUrl(logoUrl) ? imageKitLoader : undefined}
                alt={storeName}
                width={32}
                height={32}
                loading="eager"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div className="min-w-0">
              <span className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight block leading-tight truncate">
                {storeName}
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium block leading-tight">
                ১০০% খাঁটি ও প্রাকৃতিক
              </span>
            </div>
          </Link>
        </div>

        {/* Center / Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-300">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg hover:text-stone-900 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors"
          >
            হোম
          </Link>
          <Link
            href="/products"
            className="px-3 py-1.5 rounded-lg hover:text-stone-900 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors"
          >
            পণ্যসমূহ
          </Link>
          <Link
            href="/contact"
            className="px-3 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold shadow-xs"
          >
            যোগাযোগ
          </Link>
          <Link
            href="/privacy-policy"
            className="px-3 py-1.5 rounded-lg hover:text-stone-900 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors"
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
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl shadow-2xs transition-colors touch-manipulation"
          >
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">হটলাইন:</span>
            <span className="font-mono text-xs sm:text-sm">{hotline}</span>
          </a>

          {/* Cart Button */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => dispatch(openCart())}
            className="relative inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="শপিং কার্ট"
          >
            <ShoppingBag className="w-4 h-4 text-amber-800 dark:text-amber-400" />
            {displayCartQuantity > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-800 text-white text-[11px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center tabular-nums shadow-xs">
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

