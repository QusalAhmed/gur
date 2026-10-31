"use client";

import React, { useState, useRef, useEffect } from "react";
import { Phone, Globe, ShoppingBag } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { ProductCard, StorefrontProduct } from "./product-card";
import { QuickOrderSheet, SelectedProductData } from "./quick-order-sheet";
import { CartSheet } from "./cart-sheet";
import { MobileDock } from "./mobile-dock";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartTotalQuantity,
  selectCartSubtotal,
  selectCartItems,
  openCart,
  CartItem,
} from "@/lib/redux/slices/cart-slice";

interface ProductShowcaseProps {
  products: StorefrontProduct[];
  defaultHotline?: string;
  storeName?: string;
  storeSubtitle?: string;
}

export function ProductShowcase({
  products,
  defaultHotline = "01843557389",
  storeName,
  storeSubtitle,
}: ProductShowcaseProps) {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const cartTotalQuantity = useAppSelector(selectCartTotalQuantity);
  const cartSubtotal = useAppSelector(selectCartSubtotal);

  const [lang, setLang] = useState<StorefrontLang>("bn");
  const [isMounted, setIsMounted] = useState(false);
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

  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const t = STOREFRONT_TEXT[lang];
  const displayStoreName = storeName || t.storeName;
  const rawHotlineDigits = defaultHotline.replace(/[^0-9]/g, "");

  // Prevent SSR hydration mismatch for client-side state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Track active product index on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPos = container.scrollTop;
      const height = container.clientHeight || window.innerHeight;
      const idx = Math.round(scrollPos / height);
      setActiveIndex(Math.max(0, Math.min(products.length - 1, idx)));
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [products.length]);

  const scrollToProduct = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight || window.innerHeight;
    container.scrollTo({ top: index * height, behavior: "smooth" });
  };

  const handleOpenOrder = (selectedData: SelectedProductData, quantity: number) => {
    setActiveOrderModal({
      isOpen: true,
      product: selectedData,
      quantity,
      cartItems: undefined,
    });
  };

  const handleCheckoutFromCart = () => {
    setActiveOrderModal({
      isOpen: true,
      product: null,
      quantity: 1,
      cartItems,
    });
  };

  const handleCloseOrder = () => {
    setActiveOrderModal((prev) => ({ ...prev, isOpen: false }));
  };

  const toggleLanguage = () => {
    setLang((prev) => (prev === "bn" ? "en" : "bn"));
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-amber-50 dark:bg-stone-950 font-sans">
      {/* Sticky Header: Desktop / Tablet Only (Hidden on mobile phones to maximize vertical space) */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 sm:h-16 px-3 sm:px-6 md:px-8 bg-amber-100/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-amber-200/70 dark:border-stone-800 hidden sm:flex items-center justify-between shadow-sm">
        {/* Logo & Store Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-amber-50 flex items-center justify-center font-black shadow-md shrink-0 text-base sm:text-lg">
            🍯
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black text-amber-950 dark:text-amber-100 tracking-tight leading-tight truncate">
              {displayStoreName}
            </h1>
            <p className="text-[10px] sm:text-xs text-stone-600 dark:text-stone-400 font-medium hidden md:block truncate">
              {storeSubtitle || t.storeSubtitle}
            </p>
          </div>
        </div>

          {/* Right Action Cluster: Redux Cart + Direct Hotline + Language Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Redux Cart Button with Live Counter Badge */}
            <button
              type="button"
              onClick={() => dispatch(openCart())}
              className="relative inline-flex items-center gap-1 sm:gap-1.5 bg-white dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-stone-700 active:scale-95 border-2 border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-100 font-bold text-xs sm:text-sm py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-full transition-all shadow-sm touch-manipulation"
              aria-label="Open Cart"
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 dark:text-amber-300 shrink-0" />
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
              className="inline-flex items-center gap-1 sm:gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-full shadow-md transition-all touch-manipulation"
              title={t.hotlineLabel}
            >
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse shrink-0" />
              <span className="hidden sm:inline">{t.hotlineLabel}:</span>
              <span className="font-mono text-xs sm:text-sm">{defaultHotline}</span>
            </a>

            {/* 1-Tap Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1 bg-white/90 dark:bg-stone-800 hover:bg-white dark:hover:bg-stone-700 active:scale-95 border border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-200 font-bold text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 rounded-full transition-all shadow-sm touch-manipulation"
            >
              <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t.langToggle}</span>
            </button>
          </div>
      </header>

      {/* Bead / Dot Pagination (Visible on Tablets & Desktops only to prevent accidental taps on phones) */}
      {products.length > 1 && (
        <aside className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col items-center gap-3 bg-amber-950/15 dark:bg-stone-900/40 backdrop-blur-md p-2 rounded-full border border-amber-300/40">
          {products.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => scrollToProduct(idx)}
              className={`w-3 h-3 rounded-full transition-all ${activeIndex === idx
                  ? "bg-amber-600 ring-4 ring-amber-400/30 scale-125"
                  : "bg-amber-900/30 dark:bg-stone-600 hover:bg-amber-600/70"
                }`}
              aria-label={`Scroll to product ${idx + 1}`}
            />
          ))}
        </aside>
      )}

      {/* Main Content: Products Showcase or Warm Empty State */}
      {products.length === 0 ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-stone-800 flex items-center justify-center text-4xl mb-4 shadow-md">
            🍯
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
        </div>
      ) : (
        <main
          ref={containerRef}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth touch-pan-y overscroll-y-contain"
        >
          {products.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              index={idx}
              totalProducts={products.length}
              lang={lang}
              onOrderClick={handleOpenOrder}
            />
          ))}
        </main>
      )}

      {/* Mobile Floating Island Dock (Eye-catching frosted pill on mobile phones) */}
      <MobileDock
        lang={lang}
        onToggleLang={toggleLanguage}
        defaultHotline={defaultHotline}
        storeName={storeName}
      />

      {/* Redux Cart Drawer Sheet */}
      <CartSheet lang={lang} onProceedToCheckout={handleCheckoutFromCart} />

      {/* Quick 1-Step Order Bottom Sheet */}
        {
          activeOrderModal.isOpen && (
            <QuickOrderSheet
              isOpen={activeOrderModal.isOpen}
              onClose={handleCloseOrder}
              product={activeOrderModal.product}
              quantity={activeOrderModal.quantity}
              cartItems={activeOrderModal.cartItems}
              lang={lang}
              hotline={defaultHotline}
            />
          )
        }
    </div>
  );
}
