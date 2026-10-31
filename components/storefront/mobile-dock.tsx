"use client";

import React from "react";
import { motion } from "motion/react";
import { Phone, ShoppingBag, Globe, Sparkles } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, toBnNumber } from "@/lib/storefront-i18n";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartTotalQuantity,
  openCart,
} from "@/lib/redux/slices/cart-slice";

interface MobileDockProps {
  lang: StorefrontLang;
  onToggleLang: () => void;
  defaultHotline?: string;
  storeName?: string;
  onCheckoutClick?: () => void;
}

export function MobileDock({
  lang,
  onToggleLang,
  defaultHotline = "01843557389",
  storeName,
  onCheckoutClick,
}: MobileDockProps) {
  const dispatch = useAppDispatch();
  const cartTotalQuantity = useAppSelector(selectCartTotalQuantity);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const t = STOREFRONT_TEXT[lang];

  const rawHotlineDigits = defaultHotline.replace(/[^0-9]/g, "");
  const displayName = storeName || t.storeName;

  return (
    <div className="fixed bottom-2.5 inset-x-2.5 z-40 sm:hidden flex justify-center pointer-events-none">
      <motion.nav
        initial={{ y: 50, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300, delay: 0.1 }}
        className="pointer-events-auto w-full max-w-sm bg-gradient-to-r from-amber-100/95 via-amber-50/95 to-amber-100/95 dark:from-stone-900/95 dark:via-stone-900/95 dark:to-stone-850/95 backdrop-blur-xl border-2 border-amber-300/80 dark:border-amber-700/60 rounded-full shadow-[0_12px_32px_rgba(120,53,15,0.22)] py-1.5 px-2.5 flex items-center justify-between gap-1 select-none"
        aria-label="Mobile Store Navigation"
      >
        {/* 1. Store Brand & Logo (1-Tap shortcut to Contact Section) */}
        <button
          type="button"
          onClick={() => {
            const contactEl = document.getElementById("contact");
            if (contactEl) {
              contactEl.scrollIntoView({ behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="flex items-center gap-1.5 min-w-0 pl-1 pr-1.5 text-left active:scale-95 transition-transform touch-manipulation cursor-pointer"
          title="যোগাযোগ ও তথ্য দেখুন"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-amber-50 flex items-center justify-center font-black shadow-sm shrink-0">
            <Sparkles className="w-4 h-4 text-amber-100" />
          </div>
          <div className="min-w-0 hidden xs:block">
            <span className="block font-black text-xs text-amber-950 dark:text-amber-100 truncate tracking-tight leading-tight">
              {displayName}
            </span>
            <span className="block text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 leading-tight">
              {t.authenticityBadge}
            </span>
          </div>
        </button>

        {/* 2. Direct Call Hotline Button (High-reassurance for senior shoppers) */}
        <motion.a
          whileTap={{ scale: 0.92 }}
          href={`tel:${rawHotlineDigits}`}
          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 rounded-full shadow-md transition-all touch-manipulation shrink-0"
          title={t.hotlineLabel}
        >
          <Phone className="w-3.5 h-3.5 animate-pulse shrink-0" />
          <span className="font-mono text-xs">{defaultHotline}</span>
        </motion.a>

        {/* 3. Redux Cart Button with Live Bouncing Badge (Clicks jump to Checkout section) */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={() => {
            if (onCheckoutClick) {
              onCheckoutClick();
            } else {
              dispatch(openCart());
            }
          }}
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-stone-800 border-2 border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-100 shadow-sm transition-all touch-manipulation shrink-0"
          aria-label={t.cartTitle}
        >
          <ShoppingBag className="w-4 h-4 text-amber-700 dark:text-amber-300" />
          {mounted && cartTotalQuantity > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white text-[10px] font-black rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center shadow-md animate-bounce ring-2 ring-white dark:ring-stone-900"
            >
              {lang === "bn" ? toBnNumber(cartTotalQuantity) : cartTotalQuantity}
            </motion.span>
          )}
        </motion.button>

        {/* 4. Language Switcher Button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={onToggleLang}
          className="inline-flex items-center gap-1 bg-white/90 dark:bg-stone-800 border border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-200 font-bold text-[11px] py-1.5 px-2.5 rounded-full transition-all shadow-sm touch-manipulation shrink-0"
          aria-label="Change Language"
        >
          <Globe className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{t.langToggle}</span>
        </motion.button>
      </motion.nav>
    </div>
  );
}
