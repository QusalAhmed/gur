"use client";

import React, { useState, useRef, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { Phone, Globe, ShoppingBag, ShoppingCart, Sparkles, Package, ShieldCheck } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { ProductCard, StorefrontProduct } from "./product-card";
import { ProductCardSkeleton } from "./product-card-skeleton";
import dynamic from "next/dynamic";
import { IntroSection } from "./intro-section";
import { WhyBuyFromUs } from "./why-buy-from-us";
import { ContactSection } from "./contact-section";
import type { SelectedProductData } from "./quick-order-sheet";
import { MobileDock } from "./mobile-dock";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartTotalQuantity,
  selectCartSubtotal,
  selectIsCartOpen,
  openCart,
  CartItem,
} from "@/lib/redux/slices/cart-slice";

// Code-split heavy interactive sections & modals to reduce initial mobile bundle size
const CheckoutSection = dynamic(
  () => import("./checkout-section").then((mod) => mod.CheckoutSection),
  { ssr: true }
);

const QuickOrderSheet = dynamic(
  () => import("./quick-order-sheet").then((mod) => mod.QuickOrderSheet),
  { ssr: false }
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
  messengerUrl?: string;
  isLoading?: boolean;
  featuredIdentifier?: string;
  autoScrollToProduct?: boolean;
}

export function ProductShowcase({
  products,
  defaultHotline = "01843557389",
  storeName,
  storeSubtitle,
  messengerUrl,
  isLoading = false,
  featuredIdentifier,
  autoScrollToProduct = false,
}: ProductShowcaseProps) {
  const dispatch = useAppDispatch();
  const cartTotalQuantity = useAppSelector(selectCartTotalQuantity);
  const cartSubtotal = useAppSelector(selectCartSubtotal);
  const isCartOpen = useAppSelector(selectIsCartOpen);

  const [lang, setLang] = useState<StorefrontLang>("bn");
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [activeOrderModal, setActiveOrderModal] = useState<{
    isOpen: boolean;
    product: SelectedProductData | null;
    quantity: number;
    cartItems?: CartItem[];
  }>({
    isOpen: false,
    product: null,
    quantity: 1,
    cartItems: undefined,
  });

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const t = STOREFRONT_TEXT[lang];
  const displayStoreName = storeName || t.storeName;
  const rawHotlineDigits = defaultHotline.replace(/[^0-9]/g, "");

  // Section mapping:
  // Section 0: Business Introductory Section (Representing the business, origin, craft & pillars)
  // Section 1: Why Buy From Us Section (Core value propositions, 6 reasons & guarantee)
  // Section 2: Contact & Incomplete Order Form (combined under same section with normal scrolling)
  // Sections 3..effectiveProductCount + 2: Products
  // Section checkoutSectionIndex: Checkout Section
  const introSectionIndex = 0;
  const whyBuySectionIndex = 1;
  const contactSectionIndex = 2;
  const productsStartIndex = 3;
  const effectiveProductCount = isLoading ? 1 : Math.max(1, products.length);
  const checkoutSectionIndex = productsStartIndex + effectiveProductCount;
  const totalSections = checkoutSectionIndex + 1;

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

  // Smooth scroll to a specific section (0: Contact, 1..N: Products)
  const scrollToSection = (sectionIndex: number) => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight || window.innerHeight;
    container.scrollTo({ top: sectionIndex * height, behavior: "smooth" });
  };

  const hasAutoScrolledRef = useRef(false);

  // Automatically scroll down to the product section on load
  useEffect(() => {
    if (hasAutoScrolledRef.current) return;
    if (isLoading || products.length === 0) return;

    const shouldScroll =
      autoScrollToProduct ||
      Boolean(featuredIdentifier) ||
      (typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/products") ||
          window.location.search.includes("product=") ||
          window.location.search.includes("p=") ||
          window.location.hash === "#products"));

    if (!shouldScroll) return;

    const performScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const productEl = (container.querySelector("#products") ||
        container.querySelector("[data-product-card]")) as HTMLElement | null;

      if (productEl) {
        productEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const height = container.clientHeight || window.innerHeight;
        container.scrollTo({ top: productsStartIndex * height, behavior: "smooth" });
      }
      hasAutoScrolledRef.current = true;
    };

    const t1 = setTimeout(performScroll, 80);
    const t2 = setTimeout(performScroll, 350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [autoScrollToProduct, featuredIdentifier, isLoading, products.length, productsStartIndex]);

  // Discrete 1-step scroll for desktop mouse wheels so 1 tick smoothly changes product
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 15) return;
      if (isScrolling) {
        e.preventDefault();
        return;
      }

      // If user is hovering over an element that has vertical scroll (e.g. Contact & Incomplete form section),
      // allow normal native scrolling within the section until it reaches the edge
      const target = e.target as HTMLElement;
      const scrollableParent = target?.closest(".overflow-y-auto") as HTMLElement | null;
      if (scrollableParent && scrollableParent !== container) {
        const canScroll = scrollableParent.scrollHeight > scrollableParent.clientHeight;
        if (canScroll) {
          const atTop = scrollableParent.scrollTop <= 2;
          const atBottom =
            Math.abs(
              scrollableParent.scrollHeight -
                scrollableParent.clientHeight -
                scrollableParent.scrollTop
            ) <= 6;

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
  }, [totalSections]);

  // Keyboard Up/Down arrow keys support for changing full-screen products
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const height = container.clientHeight || window.innerHeight;
      const currentIdx = Math.round(container.scrollTop / height);

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
  }, [totalSections]);

  const handleOpenOrder = (selectedData: SelectedProductData, quantity: number) => {
    setActiveOrderModal({
      isOpen: true,
      product: selectedData,
      quantity,
      cartItems: undefined,
    });
  };

  const handleCheckoutFromCart = () => {
    scrollToSection(checkoutSectionIndex);
  };

  const handleCloseOrder = () => {
    setActiveOrderModal((prev) => ({ ...prev, isOpen: false }));
  };

  const toggleLanguage = () => {
    setLang((prev) => (prev === "bn" ? "en" : "bn"));
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-amber-50 dark:bg-stone-950 font-sans select-none">
      {/* Sticky Header: Desktop / Tablet Only (Hidden on mobile phones to maximize vertical space) */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 sm:h-16 px-3 sm:px-6 md:px-8 bg-amber-100/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-amber-200/70 dark:border-stone-800 hidden sm:flex items-center justify-between shadow-sm select-none">
        {/* Logo & Store Title */}
        <button
          type="button"
          onClick={() => scrollToSection(0)}
          aria-label={lang === "bn" ? `${displayStoreName} - হোমপেইজ` : `${displayStoreName} - Homepage`}
          className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2 text-left cursor-pointer active:scale-95 transition-transform"
          title="যোগাযোগ ও হোমপেইজ"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-amber-50 flex items-center justify-center font-black shadow-md shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-100" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black text-amber-950 dark:text-amber-100 tracking-tight leading-tight truncate">
              {displayStoreName}
            </h1>
            <p className="text-[10px] sm:text-xs text-stone-600 dark:text-stone-400 font-medium hidden md:block truncate">
              {storeSubtitle || t.storeSubtitle}
            </p>
          </div>
        </button>

        {/* Desktop Navigation Links: Intro, Why Us, Products, Contact & Phone Order, Checkout */}
        <nav className="hidden lg:flex items-center gap-1 bg-amber-200/60 dark:bg-stone-800/70 p-1 rounded-full border border-amber-300/60 dark:border-stone-700">
          <button
            type="button"
            onClick={() => scrollToSection(introSectionIndex)}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSectionIndex === introSectionIndex
                ? "bg-white text-amber-900 shadow-xs"
                : "text-amber-950 dark:text-amber-100 hover:bg-white/70 dark:hover:bg-stone-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>{t.navIntro}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection(whyBuySectionIndex)}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSectionIndex === whyBuySectionIndex
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-amber-950 dark:text-amber-100 hover:bg-white/70 dark:hover:bg-stone-700"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t.navWhyBuy}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection(productsStartIndex)}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSectionIndex >= productsStartIndex && activeSectionIndex < checkoutSectionIndex
                ? "bg-white text-amber-800 shadow-xs"
                : "text-amber-950 dark:text-amber-100 hover:bg-white/70 dark:hover:bg-stone-700"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>{t.navProducts}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection(contactSectionIndex)}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSectionIndex === contactSectionIndex
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-amber-950 dark:text-amber-100 hover:bg-white/70 dark:hover:bg-stone-700"
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{t.navContact}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection(checkoutSectionIndex)}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSectionIndex === checkoutSectionIndex
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-amber-950 dark:text-amber-100 hover:bg-white/70 dark:hover:bg-stone-700"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{t.navCheckout}</span>
            {isMounted && cartTotalQuantity > 0 && (
              <span className="bg-amber-600 text-white text-[10px] font-black rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-xs">
                {lang === "bn" ? toBnNumber(cartTotalQuantity) : cartTotalQuantity}
              </span>
            )}
          </button>
          <Link
            href="/privacy-policy"
            className="px-2.5 py-1 rounded-full text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-white/60 dark:hover:bg-stone-700 transition-all hidden xl:inline-block"
            title={lang === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy"}
          >
            {lang === "bn" ? "প্রাইভেসি" : "Privacy"}
          </Link>
        </nav>

        {/* Right Action Cluster: Redux Cart + Direct Hotline + Language Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Redux Cart Button with Live Counter Badge */}
          <button
            type="button"
            onClick={() => dispatch(openCart())}
            className="relative inline-flex items-center gap-1 sm:gap-1.5 bg-white dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-stone-700 active:scale-95 border-2 border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-100 font-bold text-xs sm:text-sm py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-full transition-all shadow-sm touch-manipulation cursor-pointer"
            aria-label={lang === "bn" ? `কার্ট খুলুন, ${toBnNumber(cartTotalQuantity)}টি পণ্য রয়েছে` : `Open cart, ${cartTotalQuantity} items`}
          >
            <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 dark:text-amber-300 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t.cartTitle}</span>
            {isMounted && cartTotalQuantity > 0 && (
              <span className="bg-amber-600 text-white text-[11px] font-black rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center animate-bounce shadow">
                {lang === "bn" ? toBnNumber(cartTotalQuantity) : cartTotalQuantity}
              </span>
            )}
            {isMounted && cartSubtotal > 0 && (
              <span className="hidden md:inline font-mono text-emerald-700 dark:text-emerald-400 text-xs">
                ({formatStorePrice(cartSubtotal, lang)})
              </span>
            )}
          </button>

          {/* Direct Call Button (Specially optimized for aged shoppers on mobile) */}
          <a
            href={`tel:${rawHotlineDigits}`}
            aria-label={`${t.hotlineLabel}: ${defaultHotline}`}
            className="inline-flex items-center gap-1 sm:gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-full shadow-md transition-all touch-manipulation"
            title={t.hotlineLabel}
          >
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t.hotlineLabel}:</span>
            <span className="font-mono text-xs sm:text-sm">{defaultHotline}</span>
          </a>

          {/* 1-Tap Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={lang === "bn" ? "Switch language to English" : "ভাষা বাংলায় পরিবর্তন করুন"}
            className="inline-flex items-center gap-1 bg-white/90 dark:bg-stone-800 hover:bg-white dark:hover:bg-stone-700 active:scale-95 border border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-200 font-bold text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 rounded-full transition-all shadow-sm touch-manipulation cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <span>{t.langToggle}</span>
          </button>
        </div>
      </header>

      {/* Bead / Dot Pagination (Visible on Tablets & Desktops for easy jumping) */}
      <aside className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col items-center gap-3 bg-amber-950/15 dark:bg-stone-900/40 backdrop-blur-md p-2 rounded-full border border-amber-300/40 select-none">
        {/* Dot 0: Business Introduction Section */}
        <button
          type="button"
          onClick={() => scrollToSection(introSectionIndex)}
          className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
            activeSectionIndex === introSectionIndex
              ? "bg-amber-600 ring-4 ring-amber-400/40 scale-125 shadow-md"
              : "bg-amber-900/40 dark:bg-stone-600 hover:bg-amber-600/70"
          }`}
          title={t.navIntro}
          aria-label="Scroll to Business Introduction"
        />

        {/* Dot 1: Why Buy From Us Section */}
        <button
          type="button"
          onClick={() => scrollToSection(whyBuySectionIndex)}
          className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
            activeSectionIndex === whyBuySectionIndex
              ? "bg-emerald-600 ring-4 ring-emerald-400/40 scale-125 shadow-md"
              : "bg-amber-900/40 dark:bg-stone-600 hover:bg-emerald-600/70"
          }`}
          title={t.navWhyBuy}
          aria-label="Scroll to Why Buy From Us"
        />

        {/* Dot 2: Contact & Incomplete Order Help Section */}
        <button
          type="button"
          onClick={() => scrollToSection(contactSectionIndex)}
          className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
            activeSectionIndex === contactSectionIndex
              ? "bg-emerald-600 ring-4 ring-emerald-400/40 scale-125 shadow-md"
              : "bg-amber-900/40 dark:bg-stone-600 hover:bg-emerald-600/70"
          }`}
          title={t.navContact}
          aria-label="Scroll to Contact & Order"
        />

        {/* Dots 3..N: Product Cards or Skeleton */}
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

        {/* Dot Final: Checkout Section */}
        <button
          type="button"
          onClick={() => scrollToSection(checkoutSectionIndex)}
          className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
            activeSectionIndex === checkoutSectionIndex
              ? "bg-emerald-600 ring-4 ring-emerald-400/40 scale-125 shadow-md"
              : "bg-amber-900/40 dark:bg-stone-600 hover:bg-emerald-600/70"
          }`}
          title={t.navCheckout}
          aria-label="Scroll to Checkout"
        />
      </aside>

      {/* Main Full-Screen Snap-Scroll Container */}
      <main
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth touch-pan-y overscroll-y-contain flex flex-col"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {/* Section 0: Business Introductory Section */}
        <IntroSection
          lang={lang}
          storeName={displayStoreName}
          storeSubtitle={storeSubtitle}
          isActive={activeSectionIndex === introSectionIndex}
          onScrollToWhyBuy={() => scrollToSection(whyBuySectionIndex)}
          onScrollToContact={() => scrollToSection(contactSectionIndex)}
        />

        {/* Section 1: Why Buy From Us Section (Placed below Introductory Section) */}
        <WhyBuyFromUs lang={lang} />

        {/* Section 2: Full-Screen Contact & Incomplete Order Help Section (Combined) */}
        <ContactSection
          lang={lang}
          hotline={defaultHotline}
          storeName={storeName}
          messengerUrl={messengerUrl}
          onScrollToProducts={() => scrollToSection(productsStartIndex)}
          onScrollToWhyBuy={() => scrollToSection(whyBuySectionIndex)}
        />

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
            <p className="text-stone-600 dark:text-stone-400 mt-2 max-w-sm text-sm sm:text-base leading-relaxed">
              {lang === "bn"
                ? "বর্তমানে নতুন ব্যাচের তাজা গুড় প্রস্তুত হচ্ছে। সরাসরি ফোনে প্রি-অর্ডার করতে নিচের নম্বরে কল করুন।"
                : "Fresh artisanal molasses is currently being prepared. Call us directly to pre-order."}
            </p>
            <a
              href={`tel:${rawHotlineDigits}`}
              className="mt-6 inline-flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3.5 px-6 rounded-full shadow-lg transition-all text-base sm:text-lg touch-manipulation"
            >
              <Phone className="w-5 h-5 animate-pulse" />
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
              priority={Boolean(autoScrollToProduct || featuredIdentifier) && idx === 0}
              onOrderClick={handleOpenOrder}
            />
          ))
        )}

        {/* Section checkoutSectionIndex: Full-Screen Cart Summary & Checkout */}
        <CheckoutSection
          lang={lang}
          hotline={defaultHotline}
          onScrollToProducts={() => scrollToSection(productsStartIndex)}
        />
      </main>

      {/* Mobile Floating Island Dock (Eye-catching frosted pill on mobile phones) */}
      <MobileDock
        lang={lang}
        onToggleLang={toggleLanguage}
        defaultHotline={defaultHotline}
        storeName={storeName}
        onIntroClick={() => scrollToSection(introSectionIndex)}
        onCheckoutClick={() => scrollToSection(checkoutSectionIndex)}
      />

      {/* Redux Cart Drawer Sheet */}
      {isCartOpen && (
        <CartSheet lang={lang} onProceedToCheckout={handleCheckoutFromCart} />
      )}

      {/* Quick 1-Step Order Bottom Sheet */}
      {activeOrderModal.isOpen && (
        <QuickOrderSheet
          isOpen={activeOrderModal.isOpen}
          onClose={handleCloseOrder}
          product={activeOrderModal.product}
          quantity={activeOrderModal.quantity}
          cartItems={activeOrderModal.cartItems}
          lang={lang}
          hotline={defaultHotline}
        />
      )}
    </div>
  );
}
