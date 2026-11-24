"use client";

import React, { useState, useRef, useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import { Phone, Globe, ShoppingBag, ShoppingCart, Package, ChevronDown } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice } from "@/lib/storefront-i18n";
import { ProductCard, StorefrontProduct } from "./product-card";
import { ProductCardSkeleton } from "./product-card-skeleton";
import dynamic from "next/dynamic";
import { IntroSection } from "./intro-section";
import { WhyBuyFromUs } from "./why-buy-from-us";
import { ViewProductsButton } from "./view-products-button";
import { ContactSection } from "./contact-section";
import { MobileDock } from "./mobile-dock";
import { trackContact } from "@/lib/facebook-pixel";
import { claritySetTag } from "@/lib/clarity";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartTotalQuantity,
  selectCartSubtotal,
  selectIsCartOpen,
  openCart,
  CartItem,
} from "@/lib/redux/slices/cart-slice";
import { useStorefrontIntro } from "@/hooks/use-storefront-intro";
import { buildImageKitUrl } from "@/lib/imagekit/url";
import type { DeliveryChargeConfig } from "@/lib/delivery-charge";

// Code-split heavy interactive sections & modals to reduce initial mobile bundle size
const CheckoutSection = dynamic(
  () => import("./checkout-section").then((mod) => mod.CheckoutSection),
  { ssr: true }
);

const CartSheet = dynamic(
  () => import("./cart-sheet").then((mod) => mod.CartSheet),
  { ssr: false }
);

const emptySubscribe = () => () => {};

interface ProductShowcaseProps {
  products: StorefrontProduct[];
  defaultHotline?: string;
  storeName?: string;
  storeSubtitle?: string;
  logoUrl?: string;
  messengerUrl?: string;
  isLoading?: boolean;
  featuredIdentifier?: string;
  initialVariantId?: string;
  autoScrollToProduct?: boolean;
  deliveryConfig?: DeliveryChargeConfig;
}

export function ProductShowcase({
  products,
  defaultHotline = "01843557389",
  storeName,
  storeSubtitle,
  logoUrl,
  messengerUrl,
  isLoading = false,
  featuredIdentifier,
  initialVariantId,
  autoScrollToProduct = false,
  deliveryConfig,
}: ProductShowcaseProps) {
  const dispatch = useAppDispatch();
  const cartTotalQuantity = useAppSelector(selectCartTotalQuantity);
  const cartSubtotal = useAppSelector(selectCartSubtotal);
  const isCartOpen = useAppSelector(selectIsCartOpen);

  const [lang, setLang] = useState<StorefrontLang>("bn");
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const displayCartQuantity = isMounted ? cartTotalQuantity : 0;
  const displayCartSubtotal = isMounted ? cartSubtotal : 0;
  // Section mapping:
  // Section 0: Brand & Value Proposition (Intro & Why Buy From Us under same scrolling area)
  // Sections 1..effectiveProductCount: Products
  // Section checkoutSectionIndex: Checkout & Contact Section (Order Form, Contact & Live Stock under same scrolling area)
  const introSectionIndex = 0;
  const productsStartIndex = 1;
  const effectiveProductCount = isLoading ? 1 : Math.max(1, products.length);
  const checkoutSectionIndex = productsStartIndex + effectiveProductCount;
  const totalSections = checkoutSectionIndex + 1;

  const [activeSectionIndex, setActiveSectionIndex] = useState(() => {
    if (autoScrollToProduct || Boolean(featuredIdentifier)) {
      return productsStartIndex;
    }
    return 0;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef(activeSectionIndex);
  useEffect(() => {
    activeSectionRef.current = activeSectionIndex;
  }, [activeSectionIndex]);

  const t = STOREFRONT_TEXT[lang];
  const displayStoreName = storeName || t.storeName;
  const rawHotlineDigits = defaultHotline.replace(/[^0-9]/g, "");

  const { isTourActive, isTourActiveRef } = useStorefrontIntro({
    lang,
    activeSectionIndex,
    productsStartIndex,
    isLoading,
    hasProducts: products.length > 0,
    isCartOpen,
    containerRef,
  });

  // Track active full-screen section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;
      const sections = Array.from(container.children) as HTMLElement[];
      if (!sections.length) return;

      const viewportCenter = window.scrollY + window.innerHeight / 2;
      let closestIdx = 0;
      let minDistance = Infinity;

      sections.forEach((sec, idx) => {
        const center = sec.offsetTop + sec.offsetHeight / 2;
        const dist = Math.abs(center - viewportCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      setActiveSectionIndex(Math.max(0, Math.min(totalSections - 1, closestIdx)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [totalSections]);

  // Smooth scroll to a specific section (0: Overview, 1..N: Products, N+1: Checkout)
  const scrollToSection = (sectionIndex: number) => {
    const container = containerRef.current;
    if (!container) return;
    const targetEl = container.children[sectionIndex] as HTMLElement | null;
    if (targetEl) {
      window.scrollTo({ top: targetEl.offsetTop, behavior: "smooth" });
    } else {
      const height = window.innerHeight;
      window.scrollTo({ top: sectionIndex * height, behavior: "smooth" });
    }
    if (sectionIndex === 0) {
      const overviewEl = container.querySelector("#storefront-overview") as HTMLElement | null;
      if (overviewEl) {
        overviewEl.scrollTo({ top: 0, behavior: "smooth" });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (sectionIndex === checkoutSectionIndex) {
      const checkoutEl = container.querySelector("#checkout") as HTMLElement | null;
      if (checkoutEl) {
        checkoutEl.scrollTop = 0;
      }
    }
  };

  // Smooth scroll to an element inside Section 0 (e.g. Why Buy From Us) or Contact Section
  const handleScrollToElement = (elementId: string) => {
    const targetEl = document.getElementById(elementId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const hasAutoScrolledRef = useRef(false);

  // Automatically scroll down to the product section on load
  useEffect(() => {
    if (hasAutoScrolledRef.current) return;
    if (isLoading || products.length === 0) return;

    const searchParams =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const shouldScroll =
      autoScrollToProduct ||
      Boolean(featuredIdentifier) ||
      (typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/products") ||
          Boolean(searchParams?.has("product")) ||
          Boolean(searchParams?.has("p")) ||
          Boolean(searchParams?.has("id")) ||
          window.location.hash === "#products"));

    if (!shouldScroll) return;

    const performScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const productEl = (container.querySelector("#products") ||
        container.querySelector("[data-product-card]")) as HTMLElement | null;

      if (productEl) {
        productEl.scrollIntoView({ behavior: "instant", block: "start" });
      } else {
        const targetEl = container.children[productsStartIndex] as HTMLElement | null;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "instant", block: "start" });
        } else {
          window.scrollTo({ top: productsStartIndex * window.innerHeight, behavior: "instant" as ScrollBehavior });
        }
      }
      setActiveSectionIndex(productsStartIndex);
      hasAutoScrolledRef.current = true;
    };

    performScroll();
    const rafId = requestAnimationFrame(performScroll);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [autoScrollToProduct, featuredIdentifier, isLoading, products.length, productsStartIndex]);

  // Block wheel & touch scrolling while the onboarding tour is active
  useEffect(() => {
    if (!isTourActiveRef.current) return;
    const block = (e: Event) => { if (isTourActiveRef.current) e.preventDefault(); };
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    return () => {
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
    };
  }, [isTourActive, isTourActiveRef]);

  // Discrete transitions across sections (Section 0 <-> Products <-> Checkout)
  useEffect(() => {
    let isTransitioning = false;
    let transitionTimer: NodeJS.Timeout;

    const triggerTransition = (targetIdx: number) => {
      if (isTransitioning) return;
      const clampedIdx = Math.max(0, Math.min(totalSections - 1, targetIdx));
      isTransitioning = true;
      activeSectionRef.current = clampedIdx;
      setActiveSectionIndex(clampedIdx);
      scrollToSection(clampedIdx);
      clearTimeout(transitionTimer);
      transitionTimer = setTimeout(() => {
        isTransitioning = false;
      }, 500);
    };

    // 1. Wheel handler for desktop mouse & trackpad
    const handleWheel = (e: WheelEvent) => {
      if (isTourActiveRef.current) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 18) return;
      if (isTransitioning) {
        e.preventDefault();
        return;
      }

      const currentIdx = activeSectionRef.current;
      const overviewEl = document.getElementById("storefront-overview");
      const checkoutEl = document.getElementById("checkout");

      // Boundary: Section 0 (Overview)
      if (currentIdx === 0 && overviewEl) {
        if (e.deltaY > 0) {
          const atBottom = overviewEl.scrollHeight - overviewEl.clientHeight - overviewEl.scrollTop <= 16;
          if (atBottom) {
            e.preventDefault();
            triggerTransition(productsStartIndex);
          }
        }
        return;
      }

      // Inside Products: 1 discrete wheel notch advances 1 product card
      if (currentIdx >= productsStartIndex && currentIdx < checkoutSectionIndex) {
        if (e.deltaY > 0) {
          e.preventDefault();
          triggerTransition(currentIdx + 1);
        } else if (e.deltaY < 0) {
          e.preventDefault();
          triggerTransition(currentIdx - 1);
        }
        return;
      }

      // Boundary: Checkout section scrolling up to last product
      if (currentIdx >= checkoutSectionIndex && checkoutEl) {
        if (e.deltaY < 0) {
          const atTop = checkoutEl.scrollTop <= 8;
          if (atTop) {
            e.preventDefault();
            triggerTransition(checkoutSectionIndex - 1);
          }
        }
        return;
      }
    };

    // 2. Touch handler for mobile swipe transitions at boundaries
    let touchStartY = 0;
    let touchStartX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTourActiveRef.current || isTransitioning) return;
      if (e.changedTouches.length !== 1) return;

      const deltaY = e.changedTouches[0].clientY - touchStartY;
      const deltaX = e.changedTouches[0].clientX - touchStartX;

      // Only handle clear vertical gestures (swipe distance >= 35px, more vertical than horizontal)
      if (Math.abs(deltaY) < 35 || Math.abs(deltaY) < Math.abs(deltaX) * 1.2) {
        return;
      }

      const currentIdx = activeSectionRef.current;
      const overviewEl = document.getElementById("storefront-overview");
      const checkoutEl = document.getElementById("checkout");

      // Boundary: Section 0 (Overview) swipe UP (deltaY < 0, scrolling down) -> enter Products
      if (currentIdx === 0 && deltaY < 0 && overviewEl) {
        const atBottom = overviewEl.scrollHeight - overviewEl.clientHeight - overviewEl.scrollTop <= 28;
        if (atBottom) {
          triggerTransition(productsStartIndex);
        }
        return;
      }

      // Boundary: Product 1 swipe DOWN (deltaY > 0, scrolling up) -> enter Overview
      if (currentIdx === productsStartIndex && deltaY > 0) {
        triggerTransition(0);
        return;
      }

      // Boundary: Last product swipe UP (deltaY < 0, scrolling down) -> enter Checkout
      if (currentIdx === checkoutSectionIndex - 1 && deltaY < 0) {
        triggerTransition(checkoutSectionIndex);
        return;
      }

      // Boundary: Checkout swipe DOWN (deltaY > 0, scrolling up) -> enter last product
      if (currentIdx >= checkoutSectionIndex && deltaY > 0 && checkoutEl) {
        const atTop = checkoutEl.scrollTop <= 20;
        if (atTop) {
          triggerTransition(checkoutSectionIndex - 1);
        }
        return;
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      clearTimeout(transitionTimer);
    };
  }, [totalSections, productsStartIndex, checkoutSectionIndex, isTourActiveRef]);

  // Keyboard Up/Down arrow keys support for changing full-screen products
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTourActiveRef.current) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;
      const sections = Array.from(container.children) as HTMLElement[];
      if (!sections.length) return;

      // Determine which section is currently snapped by finding closest to scroll position
      const scrollY = window.scrollY;
      let currentIdx = 0;
      let minDist = Infinity;
      sections.forEach((sec, idx) => {
        const dist = Math.abs(sec.offsetTop - scrollY);
        if (dist < minDist) {
          minDist = dist;
          currentIdx = idx;
        }
      });

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        if (currentIdx < totalSections - 1) {
          e.preventDefault();
          scrollToSection(currentIdx + 1);
        }
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        if (currentIdx > 0) {
          e.preventDefault();
          scrollToSection(currentIdx - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSections, isTourActiveRef]);

  const handleCheckoutFromCart = () => {
    scrollToSection(checkoutSectionIndex);
  };

  const toggleLanguage = () => {
    setLang((prev) => {
      const next = prev === "bn" ? "en" : "bn";
      claritySetTag("lang", next);
      return next;
    });
  };

  return (
    <div className="relative w-full min-h-screen bg-amber-50 dark:bg-stone-950 font-sans select-none">
      {/* Sticky Header: Desktop / Tablet Only (Hidden on mobile phones to maximize vertical space) */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 sm:h-16 px-3 sm:px-6 md:px-8 bg-[#faf8f5]/95 dark:bg-[#141210]/95 backdrop-blur-md border-b border-stone-200/90 dark:border-stone-800 hidden sm:flex items-center justify-between shadow-xs select-none">
        {/* Logo & Store Title */}
        <button
          type="button"
          onClick={() => scrollToSection(0)}
          aria-label={lang === "bn" ? `${displayStoreName} - হোমপেইজ` : `${displayStoreName} - Homepage`}
          className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2 text-left cursor-pointer transition-opacity hover:opacity-90"
          title={lang === "bn" ? "পরিচিতি ও হোমপেইজ" : "About & Homepage"}
        >
          {logoUrl ? (
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center">
              <Image
                src={buildImageKitUrl(logoUrl, { width: 80, height: 80, quality: 80, format: "auto" })}
                alt={displayStoreName}
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-800 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              গ
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight truncate">
              {displayStoreName}
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-normal hidden md:block truncate">
              {storeSubtitle || t.storeSubtitle}
            </p>
          </div>
        </button>

        {/* Desktop Navigation Links: Intro, Products, Checkout & Contact */}
        <nav className="hidden lg:flex items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl border border-stone-200/80 dark:border-stone-700">
          <button
            type="button"
            onClick={() => scrollToSection(0)}
            className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSectionIndex === 0
                ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs"
                : "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <span>{t.navIntro}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection(productsStartIndex)}
            className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSectionIndex >= productsStartIndex && activeSectionIndex < checkoutSectionIndex
                ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs"
                : "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>{t.navProducts}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection(checkoutSectionIndex)}
            className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSectionIndex === checkoutSectionIndex
                ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs"
                : "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{t.navCheckout}</span>
            {displayCartQuantity > 0 && (
              <span className="bg-amber-800 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-xs tabular-nums">
                {displayCartQuantity}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleScrollToElement("contact")}
            className="px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{lang === "bn" ? "যোগাযোগ" : "Contact"}</span>
          </button>
        </nav>

        {/* Right Action Cluster: Redux Cart + Direct Hotline + Language Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Redux Cart Button with Live Counter Badge */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => dispatch(openCart())}
            className="relative inline-flex items-center gap-1.5 bg-white dark:bg-stone-850 hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-semibold text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl transition-colors shadow-xs touch-manipulation cursor-pointer"
            aria-label={lang === "bn" ? `কার্ট খুলুন, ${displayCartQuantity}টি পণ্য রয়েছে` : `Open cart, ${displayCartQuantity} items`}
          >
            <ShoppingBag className="w-4 h-4 text-amber-800 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t.cartTitle}</span>
            {displayCartQuantity > 0 && (
              <span className="bg-amber-800 text-white text-[10px] font-bold rounded-full h-4 min-w-[18px] px-1 flex items-center justify-center shadow-xs tabular-nums">
                {displayCartQuantity}
              </span>
            )}
            {displayCartSubtotal > 0 && (
              <span className="hidden md:inline font-mono text-stone-700 dark:text-stone-300 text-xs sm:text-sm tabular-nums">
                ({formatStorePrice(displayCartSubtotal, lang)})
              </span>
            )}
          </button>

          {/* Direct Call Button */}
          <a
            href={`tel:${rawHotlineDigits}`}
            onClick={() => trackContact({ channel: "phone", customData: { source: "showcase_header" } })}
            aria-label={`${t.hotlineLabel}: ${defaultHotline}`}
            className="inline-flex items-center gap-1 sm:gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl shadow-2xs transition-colors touch-manipulation"
            title={t.hotlineLabel}
          >
            <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t.hotlineLabel}:</span>
            <span className="font-mono text-xs sm:text-sm">{defaultHotline}</span>
          </a>

          {/* 1-Tap Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={lang === "bn" ? "Switch language to English" : "ভাষা বাংলায় পরিবর্তন করুন"}
            className="inline-flex items-center gap-1 bg-white/90 dark:bg-stone-850 hover:bg-white dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 font-medium text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 rounded-xl transition-colors shadow-2xs touch-manipulation cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400 shrink-0" aria-hidden="true" />
            <span>{t.langToggle}</span>
          </button>
        </div>
      </header>

      {/* Bead / Dot Pagination (Visible on Tablets & Desktops for easy jumping) */}
      <aside className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col items-center gap-3 bg-amber-950/15 dark:bg-stone-900/40 backdrop-blur-md p-2 rounded-full border border-amber-300/40 select-none">
        {/* Dot 0: Overview */}
        <button
          type="button"
          onClick={() => scrollToSection(0)}
          className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
            activeSectionIndex === 0
              ? "bg-amber-600 ring-4 ring-amber-400/40 scale-125 shadow-md"
              : "bg-amber-900/40 dark:bg-stone-600 hover:bg-amber-600/70"
          }`}
          title={lang === "bn" ? "পরিচিতি" : "About"}
          aria-label="Scroll to Overview"
        />

        {/* Dots 1..N: Product Cards or Skeleton */}
        {isLoading ? (
          <button
            type="button"
            onClick={() => scrollToSection(productsStartIndex)}
            className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer animate-pulse ${
              activeSectionIndex === productsStartIndex
                ? "bg-amber-600 ring-4 ring-amber-400/40 scale-125 shadow-md"
                : "bg-amber-900/40 dark:bg-stone-600 hover:bg-amber-600/70"
            }`}
            title={lang === "bn" ? "পণ্য (লোড হচ্ছে...)" : "Products (Loading...)"}
            aria-label="Scroll to Products"
          />
        ) : products.length === 0 ? (
          <button
            type="button"
            onClick={() => scrollToSection(productsStartIndex)}
            className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
              activeSectionIndex === productsStartIndex
                ? "bg-amber-600 ring-4 ring-amber-400/40 scale-125 shadow-md"
                : "bg-amber-900/40 dark:bg-stone-600 hover:bg-amber-600/70"
            }`}
            title={t.navProducts}
            aria-label="Scroll to Products"
          />
        ) : (
          products.map((p, idx) => {
            const sIdx = productsStartIndex + idx;
            const isActive = activeSectionIndex === sIdx;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => scrollToSection(sIdx)}
                className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
                  isActive
                    ? "bg-amber-600 ring-4 ring-amber-400/40 scale-125 shadow-md"
                    : "bg-amber-900/40 dark:bg-stone-600 hover:bg-amber-600/70"
                }`}
                title={p.nameBn || p.name}
                aria-label={`Scroll to product ${idx + 1}`}
              />
            );
          })
        )}

        {/* Dot Final: Checkout & Contact Section */}
        <button
          type="button"
          onClick={() => scrollToSection(checkoutSectionIndex)}
          className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
            activeSectionIndex === checkoutSectionIndex
              ? "bg-emerald-600 ring-4 ring-emerald-400/40 scale-125 shadow-md"
              : "bg-amber-900/40 dark:bg-stone-600 hover:bg-emerald-600/70"
          }`}
          title={lang === "bn" ? "অর্ডার ও যোগাযোগ" : "Order & Contact"}
          aria-label="Scroll to Checkout and Contact"
        />
      </aside>

      {/* Main Full-Screen Snap-Scroll Container */}
      <main
        ref={containerRef}
        className="w-full flex flex-col"
      >
        {/* Section 0: Brand & Value Proposition (Intro & Why Choose Us) under the same scrolling area */}
        <section
          id="storefront-overview"
          data-section-index="0"
          className="h-[100vh] min-h-[100vh] max-h-[100vh] w-full snap-start shrink-0 flex flex-col pt-3.5 sm:pt-16 pb-16 sm:pb-8 relative overflow-y-auto bg-[#faf8f5] dark:bg-[#141210] text-stone-900 dark:text-stone-100 select-none"
        >

          {/* Mobile Non-Sticky Language Switcher (Right Top of Page on Phone - Scrolls away with content) */}
          <div
            className="absolute top-3 right-3 z-20 sm:hidden"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={lang === "bn" ? "Switch language to English" : "ভাষা বাংলায় পরিবর্তন করুন"}
              className="inline-flex items-center gap-1.5 bg-white/90 dark:bg-stone-850 hover:bg-white dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 font-medium text-xs py-1.5 px-3 rounded-xl transition-colors shadow-2xs touch-manipulation cursor-pointer select-none"
            >
              <Globe className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <span className="font-mono text-[11px] tracking-tight">{t.langToggle}</span>
            </button>
          </div>

          {/* 1. Business Introductory Section */}
          <IntroSection
            lang={lang}
            storeName={displayStoreName}
            storeSubtitle={storeSubtitle}
            logoUrl={logoUrl}
            isActive={activeSectionIndex === 0}
            isStandaloneSection={false}
            onScrollToProducts={() => scrollToSection(productsStartIndex)}
            onScrollToWhyBuy={() => handleScrollToElement("why-buy-from-us")}
            onScrollToContact={() => handleScrollToElement("contact")}
          />

          {/* Soft Decorative Separator */}
          <div className="w-full max-w-3xl sm:max-w-4xl mx-auto px-4 my-2 sm:my-3">
            <div className="border-t border-dashed border-amber-300/80 dark:border-stone-800" />
          </div>

          {/* 2. Why Buy From Us Section (Placed below Introductory Section) */}
          <WhyBuyFromUs
            lang={lang}
            isStandaloneSection={false}
            onScrollToProducts={() => scrollToSection(productsStartIndex)}
            onScrollToContact={() => handleScrollToElement("contact")}
          />

          {/* Bottom Action: "View Products & Order" button at bottom of overview area */}
          <div className="relative z-10 w-full text-center pt-2 pb-8 sm:pb-6 px-4">
            <ViewProductsButton
              onClick={() => scrollToSection(productsStartIndex)}
              lang={lang}
              label={t.viewProductsBtn}
            />
          </div>
        </section>

        {/* Sections 1..N: Full-Screen Products or Skeleton */}
        {isLoading ? (
          <ProductCardSkeleton />
        ) : products.length === 0 ? (
          <section className="h-[100vh] min-h-[100vh] max-h-[100vh] w-full snap-start shrink-0 flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12]">
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-stone-800 flex items-center justify-center mb-4 shadow-md text-amber-700 dark:text-amber-400">
              <Package className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-950 dark:text-amber-100">
              {lang === "bn" ? "নতুন পণ্য শীঘ্রই আসছে" : "Fresh Stock Coming Soon"}
            </h2>
            <p className="text-stone-600 dark:text-stone-400 mt-2 max-w-sm text-base sm:text-lg leading-relaxed">
              {lang === "bn"
                ? "বর্তমানে নতুন ব্যাচের তাজা গুড় প্রস্তুত হচ্ছে। সরাসরি ফোনে প্রি-অর্ডার করতে নিচের নম্বরে কল করুন।"
                : "Fresh artisanal molasses is currently being prepared. Call us directly to pre-order."}
            </p>
            <a
              href={`tel:${rawHotlineDigits}`}
              onClick={() => trackContact({ channel: "phone", customData: { source: "showcase_preorder" } })}
              className="mt-6 inline-flex items-center gap-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-3 px-6 rounded-xl shadow-xs transition-colors text-base touch-manipulation"
            >
              <Phone className="w-5 h-5" />
              <span>{t.hotlineLabel}: {defaultHotline}</span>
            </a>
          </section>
        ) : (
          products.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              index={idx}
              totalProducts={products.length}
              lang={lang}
              isActive={activeSectionIndex === productsStartIndex + idx}
              pauseViewTracking={isTourActive}
              priority={Boolean(autoScrollToProduct || featuredIdentifier) && idx === 0}
              initialVariantId={idx === 0 ? initialVariantId : undefined}
            />
          ))
        )}

        {/* Section checkoutSectionIndex: Full-Screen Cart Summary, Checkout & Contact under same scrolling area */}
        <CheckoutSection
          lang={lang}
          hotline={defaultHotline}
          onScrollToProducts={() => scrollToSection(productsStartIndex)}
          deliveryConfig={deliveryConfig}
        >
          {/* Contact & Customer Support Form (placed below order form under the same scrolling section) */}
          <ContactSection
            lang={lang}
            hotline={defaultHotline}
            storeName={storeName}
            messengerUrl={messengerUrl}
            isStandaloneSection={false}
            onScrollToProducts={() => scrollToSection(productsStartIndex)}
            onScrollToWhyBuy={() => handleScrollToElement("why-buy-from-us")}
          />
        </CheckoutSection>
      </main>

      {/* Mobile Floating Island Dock (Eye-catching frosted pill on mobile phones) */}
      <MobileDock
        lang={lang}
        defaultHotline={defaultHotline}
        storeName={storeName}
        logoUrl={logoUrl}
        activeSection={
          activeSectionIndex === 0
            ? "intro"
            : activeSectionIndex >= checkoutSectionIndex
            ? "checkout"
            : "products"
        }
        scrollContainerRef={containerRef}
        onIntroClick={() => scrollToSection(introSectionIndex)}
        onCheckoutClick={() => scrollToSection(checkoutSectionIndex)}
      />

      {/* Redux Cart Drawer Sheet */}
      {isCartOpen && (
        <CartSheet
          lang={lang}
          onProceedToCheckout={handleCheckoutFromCart}
          deliveryConfig={deliveryConfig}
        />
      )}
    </div>
  );
}
