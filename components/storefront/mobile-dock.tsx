"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Phone, ShoppingBag, Home } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartTotalQuantity,
  selectCartSubtotal,
  openCart,
} from "@/lib/redux/slices/cart-slice";
import { trackContact } from "@/lib/facebook-pixel";
import { imageKitLoader, isImageKitUrl } from "@/lib/imagekit/loader";

export interface MobileDockProps {
  lang: StorefrontLang;
  onToggleLang?: () => void;
  defaultHotline?: string;
  storeName?: string;
  logoUrl?: string;
  activeSection?: "intro" | "products" | "checkout";
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onIntroClick?: () => void;
  onCheckoutClick?: () => void;
}

const emptySubscribe = () => () => {};

const toBengaliNumber = (num: number | string): string => {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
};

export function MobileDock({
  lang,
  defaultHotline = "01843557389",
  storeName,
  logoUrl,
  activeSection = "intro",
  scrollContainerRef,
  onIntroClick,
  onCheckoutClick,
}: MobileDockProps) {
  const dispatch = useAppDispatch();
  const cartTotalQuantity = useAppSelector(selectCartTotalQuantity);
  const cartSubtotal = useAppSelector(selectCartSubtotal);
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const displayCartQuantity = mounted ? cartTotalQuantity : 0;
  const displayCartSubtotal = mounted ? cartSubtotal : 0;

  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Smart Auto-Hide on Scroll Down, Reveal immediately on Scroll Up or 5s after scrolling stops
  useEffect(() => {
    const handleScrollDelta = (currentY: number) => {
      const delta = currentY - lastScrollY.current;
      if (currentY <= 30) {
        setIsVisible(true);
      } else if (delta > 12) {
        setIsVisible(false);
      } else if (delta < -8) {
        setIsVisible(true);
      }
      lastScrollY.current = currentY;

      // Automatically show bottom bar after 5 seconds of end of scrolling
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 5000);
    };

    const container = scrollContainerRef?.current;

    const onContainerScroll = () => {
      if (container) handleScrollDelta(container.scrollTop);
    };

    const onWindowScroll = () => {
      handleScrollDelta(window.scrollY);
    };

    if (container) {
      container.addEventListener("scroll", onContainerScroll, { passive: true });
    }
    window.addEventListener("scroll", onWindowScroll, { passive: true });

    // Also observe the overview section if present
    const overviewEl = document.getElementById("storefront-overview");
    const onOverviewScroll = () => {
      if (overviewEl) handleScrollDelta(overviewEl.scrollTop);
    };
    if (overviewEl) {
      overviewEl.addEventListener("scroll", onOverviewScroll, { passive: true });
    }

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (container) {
        container.removeEventListener("scroll", onContainerScroll);
      }
      window.removeEventListener("scroll", onWindowScroll);
      if (overviewEl) {
        overviewEl.removeEventListener("scroll", onOverviewScroll);
      }
    };
  }, [scrollContainerRef]);

  const t = STOREFRONT_TEXT[lang];
  const rawHotlineDigits = defaultHotline.replace(/[^0-9]/g, "");
  const displayName = storeName || t.storeName;

  const handleHomeClick = () => {
    if (onIntroClick) {
      onIntroClick();
    } else {
      const introEl =
        document.getElementById("intro") ||
        document.getElementById("storefront-overview") ||
        document.getElementById("contact");
      if (introEl) {
        introEl.scrollIntoView({ behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const handleCartClick = () => {
    if (displayCartQuantity > 0 && onCheckoutClick) {
      onCheckoutClick();
    } else {
      dispatch(openCart());
    }
  };

  return (
    <div
      data-mobile-dock="true"
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden w-full pointer-events-none"
    >
      <motion.nav
        initial={false}
        animate={{
          y: isVisible ? 0 : "100%",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="pointer-events-auto relative w-full bg-[#faf8f5]/95 dark:bg-[#141210]/95 backdrop-blur-xl border-t border-stone-200/90 dark:border-stone-800 shadow-sm select-none"
        aria-label="Mobile Store Navigation"
      >
        <div className="grid grid-cols-3 items-center w-full max-w-sm mx-auto h-13 sm:h-14 px-2">
          {/* 1. Home Tab */}
          <button
            type="button"
            onClick={handleHomeClick}
            aria-label={lang === "bn" ? `${displayName} - হোম` : `${displayName} - Home`}
            className={`flex flex-col items-center justify-center h-full py-1 relative touch-manipulation cursor-pointer transition-colors ${
              activeSection === "intro"
                ? "text-stone-900 dark:text-stone-100 font-semibold"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <div className="relative flex items-center justify-center">
              {logoUrl ? (
                <div
                  className={`w-6 h-6 shrink-0 flex items-center justify-center transition-opacity ${
                    activeSection === "intro" ? "opacity-100" : "opacity-75"
                  }`}
                >
                  <Image
                    src={logoUrl}
                    loader={isImageKitUrl(logoUrl) ? imageKitLoader : undefined}
                    alt={displayName}
                    width={24}
                    height={24}
                    loading="eager"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <Home
                  className="w-5 h-5"
                  aria-hidden="true"
                  strokeWidth={activeSection === "intro" ? 2.2 : 1.75}
                />
              )}
            </div>
            <span className="text-[11px] mt-1 tracking-tight leading-none">
              {lang === "bn" ? "হোম" : "Home"}
            </span>
            {activeSection === "intro" && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-800 dark:bg-amber-400" />
            )}
          </button>

          {/* 2. Direct Hotline Call Tab */}
          <a
            href={`tel:${rawHotlineDigits}`}
            onClick={() => trackContact({ channel: "phone", customData: { source: "mobile_dock" } })}
            aria-label={`${t.hotlineLabel}: ${defaultHotline}`}
            className="flex flex-col items-center justify-center h-full py-1 relative touch-manipulation cursor-pointer text-stone-500 dark:text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            title={t.hotlineLabel}
          >
            <div className="relative flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" strokeWidth={1.75} />
              <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600" />
              </span>
            </div>
            <span className="text-[11px] mt-1 font-medium tracking-tight leading-none text-emerald-700 dark:text-emerald-400">
              {lang === "bn" ? "কল" : "Call"}
            </span>
          </a>

          {/* 3. Cart / Order Tab */}
          <button
            type="button"
            onClick={handleCartClick}
            aria-label={
              lang === "bn"
                ? `কার্ট ও অর্ডার, ${displayCartQuantity}টি পণ্য, মোট ৳${toBengaliNumber(displayCartSubtotal)}`
                : `Cart & Checkout, ${displayCartQuantity} items, total ৳${displayCartSubtotal.toLocaleString()}`
            }
            className={`flex flex-col items-center justify-center h-full py-1 relative touch-manipulation cursor-pointer transition-colors ${
              displayCartQuantity > 0 || activeSection === "checkout"
                ? "text-stone-900 dark:text-stone-100 font-semibold"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <ShoppingBag
                className={`w-5 h-5 ${displayCartQuantity > 0 ? "text-amber-800 dark:text-amber-400" : ""}`}
                aria-hidden="true"
                strokeWidth={displayCartQuantity > 0 || activeSection === "checkout" ? 2.2 : 1.75}
              />
              {displayCartQuantity > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-amber-800 dark:bg-amber-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-xs tabular-nums">
                  {displayCartQuantity}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 tracking-tight leading-none tabular-nums">
              {displayCartQuantity > 0
                ? (lang === "bn" ? `৳${toBengaliNumber(displayCartSubtotal)}` : `৳${displayCartSubtotal.toLocaleString()}`)
                : (lang === "bn" ? "কার্ট" : "Cart")}
            </span>
            {activeSection === "checkout" && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-800 dark:bg-amber-400" />
            )}
          </button>
        </div>
      </motion.nav>
    </div>
  );
}
