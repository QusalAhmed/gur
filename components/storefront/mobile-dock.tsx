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
import { buildImageKitUrl } from "@/lib/imagekit/url";

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

  // Smart Auto-Hide on Scroll Down, Reveal immediately on Scroll Up
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
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        className="pointer-events-auto relative w-full bg-[#FAF8F5]/95 dark:bg-[#141210]/95 backdrop-blur-xl border-t border-amber-900/10 dark:border-stone-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.5)] select-none"
        aria-label="Mobile Store Navigation"
      >
        {/* Specular hairline top glow */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 dark:via-amber-500/30 to-transparent pointer-events-none" />

        <div className="grid grid-cols-3 items-center w-full max-w-sm mx-auto h-13 sm:h-14 px-2">
          {/* 1. Home Tab */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={handleHomeClick}
            aria-label={lang === "bn" ? `${displayName} - হোম` : `${displayName} - Home`}
            className={`flex flex-col items-center justify-center h-full py-1 relative touch-manipulation cursor-pointer transition-colors ${
              activeSection === "intro"
                ? "text-amber-950 dark:text-amber-300 font-bold"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <div className="relative flex items-center justify-center">
              {logoUrl ? (
                <div
                  className={`w-6 h-6 rounded-full overflow-hidden border transition-all ${
                    activeSection === "intro"
                      ? "border-amber-500 ring-2 ring-amber-400/60 shadow-2xs"
                      : "border-stone-300 dark:border-stone-700"
                  }`}
                >
                  <Image
                    src={buildImageKitUrl(logoUrl, { width: 48, height: 48, quality: 80, format: "auto" })}
                    alt={displayName}
                    width={24}
                    height={24}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <Home
                  className="w-5 h-5 transition-transform"
                  aria-hidden="true"
                  strokeWidth={activeSection === "intro" ? 2.4 : 1.9}
                />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">
              {lang === "bn" ? "হোম" : "Home"}
            </span>
            {activeSection === "intro" && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-600 dark:bg-amber-400" />
            )}
          </motion.button>

          {/* 2. Direct Hotline Call Tab */}
          <motion.a
            whileTap={{ scale: 0.9 }}
            href={`tel:${rawHotlineDigits}`}
            onClick={() => trackContact({ channel: "phone", customData: { source: "mobile_dock" } })}
            aria-label={`${t.hotlineLabel}: ${defaultHotline}`}
            className="flex flex-col items-center justify-center h-full py-1 relative touch-manipulation cursor-pointer text-stone-500 dark:text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            title={t.hotlineLabel}
          >
            <div className="relative flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" strokeWidth={2} />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <span className="text-[10px] mt-1 font-semibold tracking-tight leading-none text-emerald-700 dark:text-emerald-400">
              {lang === "bn" ? "কল" : "Call"}
            </span>
          </motion.a>

          {/* 3. Cart / Order Tab */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            data-tour="mobile-checkout-cta"
            onClick={handleCartClick}
            aria-label={
              lang === "bn"
                ? `কার্ট ও অর্ডার, ${displayCartQuantity}টি পণ্য, মোট ৳${toBengaliNumber(displayCartSubtotal)}`
                : `Cart & Checkout, ${displayCartQuantity} items, total ৳${displayCartSubtotal.toLocaleString()}`
            }
            className={`flex flex-col items-center justify-center h-full py-1 relative touch-manipulation cursor-pointer transition-colors ${
              displayCartQuantity > 0 || activeSection === "checkout"
                ? "text-amber-950 dark:text-amber-300 font-bold"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <ShoppingBag
                className={`w-5 h-5 transition-transform ${displayCartQuantity > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
                aria-hidden="true"
                strokeWidth={displayCartQuantity > 0 || activeSection === "checkout" ? 2.4 : 1.9}
              />
              {displayCartQuantity > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[10px] font-black rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-xs ring-2 ring-[#FAF8F5] dark:ring-[#141210]">
                  {displayCartQuantity}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">
              {displayCartQuantity > 0
                ? (lang === "bn" ? `৳${toBengaliNumber(displayCartSubtotal)}` : `৳${displayCartSubtotal.toLocaleString()}`)
                : (lang === "bn" ? "কার্ট" : "Cart")}
            </span>
            {activeSection === "checkout" && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-600 dark:bg-amber-400" />
            )}
          </motion.button>
        </div>
      </motion.nav>
    </div>
  );
}
