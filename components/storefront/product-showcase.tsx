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
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPos = container.scrollTop;
      const height = container.clientHeight || window.innerHeight;
      const idx = Math.round(scrollPos / height);
      setActiveSectionIndex(Math.max(0, Math.min(totalSections - 1, idx)));
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [totalSections]);

  // Smooth scroll to a specific section (0: Overview, 1..N: Products, N+1: Checkout)
  const scrollToSection = (sectionIndex: number) => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight || window.innerHeight;
    container.scrollTo({ top: sectionIndex * height, behavior: "smooth" });
    if (sectionIndex === 0) {
      const overviewEl = container.querySelector("#storefront-overview") || container.querySelector("#intro");
      if (overviewEl) {
        overviewEl.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  // Smooth scroll to an element inside Section 0 (e.g. Why Buy From Us) or Contact Section
  const handleScrollToElement = (elementId: string) => {
    if (elementId === "contact") {
      scrollToSection(checkoutSectionIndex);
      setTimeout(() => {
        const targetEl = document.getElementById("contact");
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 120);
      return;
    }
    const container = containerRef.current;
    if (container && activeSectionIndex !== 0) {
      scrollToSection(0);
    }
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
        const height = container.clientHeight || window.innerHeight;
        container.scrollTo({ top: productsStartIndex * height, behavior: "instant" as ScrollBehavior });
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

  // Discrete 1-step scroll for desktop mouse wheels so 1 tick smoothly changes product
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      if (isTourActiveRef.current) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 15) return;
      if (isScrolling) {
        e.preventDefault();
        return;
      }

      // If user is hovering over an element that has vertical scroll (e.g. Overview section or inner scrollables),
      // allow normal native scrolling within the section until it reaches the edge
      const target = e.target as HTMLElement;
      const scrollableParent = target?.closest(".overflow-y-auto") as HTMLElement | null;
      if (scrollableParent && scrollableParent !== container) {
        const canScroll = scrollableParent.scrollHeight > scrollableParent.clientHeight;
        if (canScroll) {
          const atTop = scrollableParent.scrollTop <= 4;
          const atBottom =
            scrollableParent.scrollHeight -
              scrollableParent.clientHeight -
              scrollableParent.scrollTop <= 10;

          // If scrolling down and haven't reached the bottom of inner content, allow normal inner scroll
          if (e.deltaY > 0 && !atBottom) {
            return;
          }
          // If scrolling up and haven't reached the top of inner content, allow normal inner scroll
          if (e.deltaY < 0 && !atTop) {
            return;
          }
        }
      }

      const height = container.clientHeight || window.innerHeight;
      const currentIdx = Math.round(container.scrollTop / height);

      if (e.deltaY > 0 && currentIdx < totalSections - 1) {
        e.preventDefault();
        isScrolling = true;
        container.scrollTo({ top: (currentIdx + 1) * height, behavior: "smooth" });
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 550);
      } else if (e.deltaY < 0 && currentIdx > 0) {
        e.preventDefault();
        isScrolling = true;
        container.scrollTo({ top: (currentIdx - 1) * height, behavior: "smooth" });
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 550);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, [totalSections, isTourActiveRef]);

  // Keyboard Up/Down arrow keys support for changing full-screen products
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTourActiveRef.current) return;
      // Don't intercept if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const height = container.clientHeight || window.innerHeight;
      const currentIdx = Math.round(container.scrollTop / height);

      // If user is inside any scrollable section (overview, product card, checkout), let keyboard scroll the inner content first
      const currentSectionEl = container.children[currentIdx] as HTMLElement | null;
      if (currentSectionEl && currentSectionEl.scrollHeight > currentSectionEl.clientHeight) {
        const atTop = currentSectionEl.scrollTop <= 4;
        const atBottom =
          currentSectionEl.scrollHeight - currentSectionEl.clientHeight - currentSectionEl.scrollTop <= 10;
        if ((e.key === "ArrowDown" || e.key === "PageDown") && !atBottom) {
          return;
        }
        if ((e.key === "ArrowUp" || e.key === "PageUp") && !atTop) {
          return;
        }
      }

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        if (currentIdx < totalSections - 1) {
          e.preventDefault();
          container.scrollTo({ top: (currentIdx + 1) * height, behavior: "smooth" });
        }
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        if (currentIdx > 0) {
          e.preventDefault();
          container.scrollTo({ top: (currentIdx - 1) * height, behavior: "smooth" });
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
    <div className="relative w-full h-[100dvh] overflow-hidden bg-amber-50 dark:bg-stone-950 font-sans select-none">
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
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth touch-pan-y overscroll-y-contain flex flex-col"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {/* Section 0: Brand & Value Proposition (Intro & Why Choose Us) under the same scrolling area */}
        <section
          id="storefront-overview"
          data-section-index="0"
          className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col pt-3.5 sm:pt-16 pb-16 sm:pb-8 relative overflow-y-auto bg-[#faf8f5] dark:bg-[#141210] text-stone-900 dark:text-stone-100 select-none scroll-smooth"
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
          <section className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12]">
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
