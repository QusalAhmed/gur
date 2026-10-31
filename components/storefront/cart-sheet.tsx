"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartItems,
  selectIsCartOpen,
  selectCartTotalQuantity,
  selectCartSubtotal,
  closeCart,
  incrementQuantity,
  decrementQuantity,
  removeFromCart,
  clearCart,
} from "@/lib/redux/slices/cart-slice";

interface CartSheetProps {
  lang: StorefrontLang;
  onProceedToCheckout: () => void;
}

export function CartSheet({ lang, onProceedToCheckout }: CartSheetProps) {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectIsCartOpen);
  const items = useAppSelector(selectCartItems);
  const totalQuantity = useAppSelector(selectCartTotalQuantity);
  const subtotal = useAppSelector(selectCartSubtotal);
  const [isMounted, setIsMounted] = useState(false);

  const t = STOREFRONT_TEXT[lang];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        dispatch(closeCart());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, dispatch]);

  const handleCheckoutClick = () => {
    dispatch(closeCart());
    onProceedToCheckout();
  };

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => dispatch(closeCart())}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative z-10 w-full max-w-md h-full bg-[#fdfbf7] dark:bg-stone-900 border-l border-amber-200 dark:border-stone-800 shadow-2xl flex flex-col justify-between overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-heading"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-amber-200/80 dark:border-stone-800 flex items-center justify-between bg-amber-100/70 dark:bg-stone-850">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-amber-600 text-amber-50 flex items-center justify-center shadow-md">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="cart-heading" className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 leading-tight">
                    {t.cartTitle}
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    {lang === "bn" ? toBnNumber(totalQuantity) : totalQuantity} {t.itemsCount}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => dispatch(clearCart())}
                    className="p-2 text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 rounded-lg hover:bg-white dark:hover:bg-stone-800 transition-colors touch-manipulation text-xs font-semibold flex items-center gap-1"
                    title={t.clearCartBtn}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden xs:inline">{t.clearCartBtn}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dispatch(closeCart())}
                  className="p-2 text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white rounded-full hover:bg-white dark:hover:bg-stone-800 transition-colors touch-manipulation"
                  aria-label="Close cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-amber-100 dark:divide-stone-800">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-stone-800 flex items-center justify-center text-3xl shadow-inner">
                    🍯
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-amber-950 dark:text-amber-100">
                    {t.cartEmptyTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-xs leading-relaxed">
                    {t.cartEmptySubtitle}
                  </p>
                  <button
                    type="button"
                    onClick={() => dispatch(closeCart())}
                    className="mt-3 bg-amber-800 hover:bg-amber-900 text-amber-50 font-bold text-sm py-2.5 px-6 rounded-full shadow-md transition-all touch-manipulation"
                  >
                    {t.backToShopBtn}
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5 pt-1">
                  {items.map((item) => {
                    const itemTitle = lang === "bn" ? item.productNameBn || item.productName : item.productName;
                    const variantTitle = lang === "bn" ? item.variantNameBn || item.variantName : item.variantName;
                    const itemLineTotal = item.quantity * item.unitPrice;

                    return (
                      <div
                        key={item.id}
                        className="pt-3.5 first:pt-0 flex items-start gap-3 group"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-amber-100/60 dark:bg-stone-800 border border-amber-200 dark:border-stone-700 shrink-0 shadow-sm">
                          <Image
                            src={item.image}
                            alt={itemTitle}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <h4 className="font-extrabold text-sm text-amber-950 dark:text-amber-100 truncate">
                                {itemTitle}
                              </h4>
                              <span className="inline-block bg-amber-100/80 dark:bg-stone-800 text-amber-900 dark:text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-md mt-0.5">
                                {variantTitle}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => dispatch(removeFromCart({ productId: item.productId, variantId: item.variantId }))}
                              className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md touch-manipulation transition-colors"
                              aria-label="Remove item"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-1">
                            {/* Stepper (+ / -) */}
                            <div className="flex items-center bg-white dark:bg-stone-800 border border-amber-300 dark:border-stone-700 rounded-lg p-0.5 shadow-sm">
                              <button
                                type="button"
                                onClick={() => dispatch(decrementQuantity({ productId: item.productId, variantId: item.variantId }))}
                                className="w-7 h-7 rounded-md bg-amber-50 hover:bg-amber-100 dark:bg-stone-700 dark:hover:bg-stone-600 text-amber-950 dark:text-amber-100 flex items-center justify-center font-bold active:scale-95 transition-all touch-manipulation"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-7 text-center font-bold text-xs text-amber-950 dark:text-amber-100">
                                {lang === "bn" ? toBnNumber(item.quantity) : item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => dispatch(incrementQuantity({ productId: item.productId, variantId: item.variantId }))}
                                disabled={item.quantity >= 50}
                                className="w-7 h-7 rounded-md bg-amber-50 hover:bg-amber-100 dark:bg-stone-700 dark:hover:bg-stone-600 text-amber-950 dark:text-amber-100 flex items-center justify-center font-bold active:scale-95 disabled:opacity-40 transition-all touch-manipulation"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <div className="font-black text-sm text-emerald-700 dark:text-emerald-400">
                                {formatStorePrice(itemLineTotal, lang)}
                              </div>
                              <div className="text-[10px] text-stone-500 dark:text-stone-400">
                                {formatStorePrice(item.unitPrice, lang)} / {lang === "bn" ? "প্রতিটি" : "each"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Summary & Checkout CTA */}
            {items.length > 0 && (
              <div className="p-4 sm:p-5 bg-amber-100/90 dark:bg-stone-850 border-t border-amber-200/90 dark:border-stone-800 space-y-3">
                <div className="space-y-1.5 text-xs sm:text-sm">
                  <div className="flex justify-between text-stone-700 dark:text-stone-300">
                    <span>{t.subtotal}</span>
                    <span className="font-bold">{formatStorePrice(subtotal, lang)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 dark:text-stone-400 text-xs">
                    <span>{t.deliveryCharge}</span>
                    <span className="font-medium">{lang === "bn" ? "৳৭০ (ঢাকা) / ৳১৩০ (বাইরে)" : "৳70 (Dhaka) / ৳130 (Out)"}</span>
                  </div>
                  <div className="pt-2 border-t border-amber-200 dark:border-stone-700 flex justify-between items-baseline">
                    <span className="font-extrabold text-sm sm:text-base text-amber-950 dark:text-amber-100">
                      {t.totalAmount}
                    </span>
                    <span className="font-black text-lg sm:text-xl text-emerald-700 dark:text-emerald-400">
                      {formatStorePrice(subtotal, lang)} <span className="text-xs font-normal text-stone-500">(+ডেলিভারি)</span>
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-amber-900/80 dark:text-amber-300/80 text-center font-medium bg-amber-200/60 dark:bg-stone-800/80 py-1.5 px-2 rounded-lg">
                  🛡️ {t.codLabel}
                </div>

                <button
                  type="button"
                  onClick={handleCheckoutClick}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-base py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-700/25 transition-all flex items-center justify-center gap-2 group touch-manipulation"
                >
                  <span>{t.checkoutNowBtn}</span>
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

