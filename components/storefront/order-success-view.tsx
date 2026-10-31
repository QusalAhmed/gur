"use client";

import React from "react";
import { motion } from "motion/react";
import { CheckCircle2, Phone, MessageSquare, ArrowRight, ShieldCheck } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";

interface OrderSuccessViewProps {
  orderNumber: string;
  customerName: string;
  phone: string;
  grandTotal: number;
  deliveryZone: "inside_dhaka" | "outside_dhaka";
  lang: StorefrontLang;
  hotline?: string;
  onReset: () => void;
}

export function OrderSuccessView({
  orderNumber,
  customerName,
  phone,
  grandTotal,
  deliveryZone,
  lang,
  hotline = "01843557389",
  onReset,
}: OrderSuccessViewProps) {
  const t = STOREFRONT_TEXT[lang];
  const rawHotlineDigits = hotline.replace(/[^0-9]/g, "");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="p-3.5 sm:p-7 flex flex-col items-center text-center max-w-lg mx-auto"
    >
      {/* Big Animated Success Checkmark */}
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 14, stiffness: 180, delay: 0.1 }}
        className="w-16 h-16 sm:w-22 sm:h-22 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-4 border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-lg mb-3 sm:mb-4 shrink-0"
      >
        <CheckCircle2 className="w-10 h-10 sm:w-13 sm:h-13 stroke-[2.2]" />
      </motion.div>

      {/* Main Success Title */}
      <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-amber-950 dark:text-amber-100 tracking-tight mb-1.5 leading-snug">
        {t.successTitle}
      </h2>

      {/* Order Number Badge */}
      <div className="inline-flex items-center gap-2 bg-amber-100/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl px-3 sm:px-4 py-1.5 mt-0.5 mb-3 sm:mb-4 shadow-sm">
        <span className="text-amber-900 dark:text-amber-300 font-medium text-xs sm:text-base">
          {t.orderNumberLabel}
        </span>
        <span className="font-mono font-bold text-amber-950 dark:text-amber-100 text-base sm:text-xl tracking-wider">
          #{orderNumber}
        </span>
      </div>

      {/* Reassurance Notice Box */}
      <div className="w-full bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-emerald-900 dark:text-emerald-200 text-xs sm:text-base mb-4 sm:mb-5 leading-relaxed flex items-start gap-2.5 sm:gap-3 text-left">
        <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold mb-0.5">
            {lang === "bn" ? "অর্ডার নিশ্চিতকরণ ও ডেলিভারি:" : "Order Confirmation & Delivery:"}
          </p>
          <p className="text-xs sm:text-sm opacity-90">{t.callConfirmationNotice}</p>
        </div>
      </div>

      {/* Summary Box */}
      <div className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-left mb-4 sm:mb-5 space-y-2">
        <div className="flex justify-between items-center text-xs sm:text-base text-stone-600 dark:text-stone-400">
          <span>{t.customerNameLabel}</span>
          <span className="font-semibold text-stone-900 dark:text-stone-100">{customerName}</span>
        </div>
        <div className="flex justify-between items-center text-xs sm:text-base text-stone-600 dark:text-stone-400">
          <span>{lang === "bn" ? "মোবাইল নম্বর:" : "Phone:"}</span>
          <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
            {lang === "bn" ? toBnNumber(phone) : phone}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs sm:text-base text-stone-600 dark:text-stone-400">
          <span>{lang === "bn" ? "ডেলিভারি এলাকা:" : "Area:"}</span>
          <span className="font-medium text-stone-900 dark:text-stone-100">
            {deliveryZone === "inside_dhaka" ? t.insideDhaka : t.outsideDhaka}
          </span>
        </div>
        <div className="border-t border-stone-200 dark:border-stone-700/80 pt-2 flex justify-between items-center text-sm sm:text-lg">
          <span className="font-bold text-amber-950 dark:text-amber-100">{t.amountDueOnDelivery}</span>
          <span className="font-extrabold text-lg sm:text-2xl text-emerald-700 dark:text-emerald-400">
            {formatStorePrice(grandTotal, lang)}
          </span>
        </div>
      </div>

      {/* Direct Contact Buttons for Aged Customers */}
      <div className="w-full flex flex-col sm:flex-row gap-2.5 sm:gap-3 mb-4 sm:mb-6">
        <a
          href={`tel:${rawHotlineDigits}`}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold py-3 sm:py-3.5 px-4 rounded-xl shadow-md transition-all text-sm sm:text-base touch-manipulation"
        >
          <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{t.callHotlineBtn}</span>
        </a>
        <a
          href={`https://wa.me/88${rawHotlineDigits}?text=${encodeURIComponent(
            `আমার অর্ডার #${orderNumber} সম্পর্কে জানতে চাই।`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white font-bold py-3 sm:py-3.5 px-4 rounded-xl shadow-md transition-all text-sm sm:text-base touch-manipulation"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{t.whatsappBtn}</span>
        </a>
      </div>

      {/* Return to Shop Button */}
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 text-stone-600 hover:text-amber-800 dark:text-stone-400 dark:hover:text-amber-200 font-semibold text-sm sm:text-base py-2 px-3 transition-colors touch-manipulation"
      >
        <span>{t.backToShopBtn}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
