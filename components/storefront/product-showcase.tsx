"use client";

import React, { useState, useRef, useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import { Phone, Globe, ShoppingBag, ShoppingCart, Package, ChevronDown } from "lucide-react";
import { useScroll } from "motion/react";
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
  const productsTrackRef = useRef<HTMLElement>(null);

  // Framer Motion scroll progress for the sticky products track
  const { scrollYProgress: trackProgress } = useScroll({
    target: productsTrackRef,
    offset: ["start start", "end end"],
  });

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

  // Track active section on window scroll based on focal point & sticky product track progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const focalPoint = scrollY + window.innerHeight * 0.4;

      // If scrolled near the bottom of the entire page, active section is always the last section (Checkout & Contact)
      if (window.innerHeight + scrollY >= document.documentElement.scrollHeight - 60) {
        setActiveSectionIndex(checkoutSectionIndex);
        return;
      }

      const trackEl = productsTrackRef.current || (document.getElementById("products") as HTMLElement | null);
      const checkoutEl = document.getElementById("checkout");

      if (!trackEl || !checkoutEl) {
        const container = containerRef.current;
        if (!container) return;
        const sections = Array.from(container.children) as HTMLElement[];
        let currentIdx = 0;
        for (let i = 0; i < sections.length; i++) {
          const sec = sections[i];
          const top = sec.offsetTop;
          const bottom = top + sec.offsetHeight;
          if (focalPoint >= top && focalPoint < bottom) {
            currentIdx = i;
            break;
          }
        }
        setActiveSectionIndex(currentIdx);
        return;
      }

      const trackTop = trackEl.offsetTop;
      const checkoutTop = checkoutEl.offsetTop;

      if (focalPoint < trackTop) {
        setActiveSectionIndex(0);
      } else if (focalPoint >= checkoutTop) {
        setActiveSectionIndex(checkoutSectionIndex);
      } else {
        // Inside sticky products track
        if (products.length <= 1) {
          setActiveSectionIndex(productsStartIndex);
        } else {
          const trackScrollableDistance = (products.length - 1) * window.innerHeight;
          const currentTrackOffset = Math.max(0, Math.min(trackScrollableDistance, scrollY - trackTop));
          const progress = trackScrollableDistance > 0 ? currentTrackOffset / trackScrollableDistance : 0;
          const activeProdIdx = Math.min(
            products.length - 1,
            Math.max(0, Math.round(progress * (products.length - 1)))
          );
          setActiveSectionIndex(productsStartIndex + activeProdIdx);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [totalSections, products.length, isLoading, checkoutSectionIndex, productsStartIndex]);

  // Smooth scroll to a specific section (0: Overview, 1..N: Products, N+1: Checkout)
  const scrollToSection = (sectionIndex: number) => {
    if (sectionIndex === 0) {
      const overviewEl = document.getElementById("storefront-overview");
      if (overviewEl) {
        overviewEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    if (sectionIndex >= checkoutSectionIndex) {
      const checkoutEl = document.getElementById("checkout");
      if (checkoutEl) {
        checkoutEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    // It's a product index in the sticky track
    const productOffsetIdx = sectionIndex - productsStartIndex;
    const trackEl = productsTrackRef.current || (document.getElementById("products") as HTMLElement | null);
    if (trackEl) {
      const trackTop = trackEl.offsetTop;
      const targetScrollY = trackTop + productOffsetIdx * window.innerHeight;
      window.scrollTo({ top: targetScrollY, behavior: "smooth" });
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
    const targetProductParam =
      featuredIdentifier ||
      searchParams?.get("product") ||
      searchParams?.get("p") ||
      searchParams?.get("id");

    const shouldScroll =
      autoScrollToProduct ||
      Boolean(featuredIdentifier) ||
      (typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/products") ||
          Boolean(searchParams?.has("product")) ||
          Boolean(searchParams?.has("p")) ||
          Boolean(searchParams?.has("id")) ||
          window.location.hash === "#products" ||
          window.location.hash.startsWith("#product-")));

    if (!shouldScroll) return;

    const performScroll = () => {
      const trackEl = productsTrackRef.current || (document.getElementById("products") as HTMLElement | null);
      let targetProductIdx = 0;

      if (targetProductParam) {
        const foundIdx = products.findIndex(
          (p) => p.id === targetProductParam || p.slug === targetProductParam
        );
        if (foundIdx >= 0) targetProductIdx = foundIdx;
      } else if (typeof window !== "undefined" && window.location.hash.startsWith("#product-")) {
        const hashId = window.location.hash.replace("#product-", "");
        const foundIdx = products.findIndex((p) => p.id === hashId || p.slug === hashId);
        if (foundIdx >= 0) targetProductIdx = foundIdx;
      }

      if (trackEl) {
        const trackTop = trackEl.offsetTop;
        const targetScrollY = trackTop + targetProductIdx * window.innerHeight;
        window.scrollTo({ top: targetScrollY, behavior: "instant" as ScrollBehavior });
      } else {
        const height = window.innerHeight;
        window.scrollTo({ top: (productsStartIndex + targetProductIdx) * height, behavior: "instant" as ScrollBehavior });
      }
      setActiveSectionIndex(productsStartIndex + targetProductIdx);
      hasAutoScrolledRef.current = true;
    };

    performScroll();
    const rafId = requestAnimationFrame(performScroll);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [autoScrollToProduct, featuredIdentifier, isLoading, products, productsStartIndex]);

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
    <div data-storefront-root className="relative w-full min-h-[100dvh] bg-amber-50 dark:bg-stone-950 font-sans select-none">
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
          className="min-h-[100dvh] w-full shrink-0 flex flex-col pt-3.5 sm:pt-16 pb-16 sm:pb-8 relative bg-[#faf8f5] dark:bg-[#141210] text-stone-900 dark:text-stone-100 select-none scroll-smooth"
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
          <section className="min-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12]">
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
          <section
            id="products"
            ref={productsTrackRef}
            data-product-card="true"
            className="relative w-full"
            style={{
              height: products.length > 1 ? `${products.length * 100}dvh` : "100dvh",
            }}
          >
            <div className="sticky top-0 h-[100dvh] w-full overflow-hidden flex items-center justify-center">
              {products.map((product, idx) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={idx}
                  totalProducts={products.length}
                  lang={lang}
                  trackProgress={trackProgress}
                  isActive={activeSectionIndex === productsStartIndex + idx}
                  pauseViewTracking={isTourActive}
                  priority={Boolean(autoScrollToProduct || featuredIdentifier) && idx === 0}
                  initialVariantId={idx === 0 ? initialVariantId : undefined}
                  onScrollToNext={() => scrollToSection(productsStartIndex + idx + 1)}
                  onScrollToOrder={() => scrollToSection(checkoutSectionIndex)}
                />
              ))}
            </div>
          </section>
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
