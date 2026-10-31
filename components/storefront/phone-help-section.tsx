"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Phone,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Truck,
  ShieldCheck,
  Clock,
  User,
  ShoppingBag,
  ChevronDown,
  X,
  ArrowRight,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";
import { parseBdPhone, isValidBdPhone } from "@/lib/phone";
import { useSubmitAssistedPhoneOrderMutation } from "@/hooks/use-order";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectCartItems } from "@/lib/redux/slices/cart-slice";
import { StorefrontOrderItem } from "@/actions/storefront-order";

interface PhoneHelpSectionProps {
  lang?: StorefrontLang;
  hotline?: string;
  storeName?: string;
  onScrollToProducts?: () => void;
}

const DRAFT_ORDER_SESSION_KEY = "gur_draft_order_id";

export function PhoneHelpSection({
  lang = "bn",
  hotline = "01843557389",
  storeName,
  onScrollToProducts,
}: PhoneHelpSectionProps) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    phone: string;
    orderNumber: string;
  } | null>(null);

  const t = STOREFRONT_TEXT[lang];
  const cartItems = useAppSelector(selectCartItems);

  const rawHotline = hotline.replace(/[^0-9]/g, "");
  const parsedPhone = parseBdPhone(phone);
  const isPhoneValid = parsedPhone.isValid;

  const submitMutation = useSubmitAssistedPhoneOrderMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isValidBdPhone(phone)) {
      setErrorMessage(t.phoneHelpInvalidError);
      return;
    }

    // Map any active Redux cart items for staff context
    const resolvedItems: StorefrontOrderItem[] = cartItems.map((item) => ({
      productId: item.productId,
      productName: lang === "bn" ? item.productNameBn || item.productName : item.productName,
      variantId: item.variantId,
      variantName: lang === "bn" ? item.variantNameBn || item.variantName : item.variantName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    // Check if there was an ongoing draft in this session
    let savedDraftId: string | undefined = undefined;
    try {
      const stored = sessionStorage.getItem(DRAFT_ORDER_SESSION_KEY);
      if (stored) savedDraftId = stored;
    } catch {
      // Safe fallback
    }

    try {
      const res = await submitMutation.mutateAsync({
        orderId: savedDraftId,
        customerPhone: parsedPhone.normalized,
        customerName: name.trim() || undefined,
        customerNote: note.trim() || undefined,
        items: resolvedItems,
      });

      if (res.success) {
        setSubmittedData({
          phone: parsedPhone.local,
          orderNumber: res.orderNumber || "",
        });
        setIsModalOpen(true);
        setPhone("");
        setName("");
        setNote("");
        setErrorMessage(null);

        try {
          sessionStorage.removeItem(DRAFT_ORDER_SESSION_KEY);
        } catch {
          // Safe ignore
        }
      } else {
        setErrorMessage(res.error || t.phoneHelpInvalidError);
      }
    } catch (err: any) {
      setErrorMessage(err.message || t.phoneHelpInvalidError);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleModalBrowseClick = () => {
    setIsModalOpen(false);
    if (onScrollToProducts) {
      onScrollToProducts();
    } else {
      const el = document.getElementById("products") || document.querySelector("section:nth-of-type(3)");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="phone-order-help"
      data-section-index="1"
      className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col justify-between pt-3 sm:pt-12 pb-16 sm:pb-6 px-3 sm:px-6 md:px-12 relative overflow-y-auto sm:overflow-hidden bg-[#FAF8F5] dark:bg-[#141210] text-stone-900 dark:text-stone-100 select-none"
    >
      {/* Soft Ambient Warm Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-gradient-to-b from-amber-200/35 via-amber-100/10 to-transparent dark:from-amber-950/20 dark:via-transparent dark:to-transparent pointer-events-none blur-3xl" />

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex-1 flex flex-col justify-center my-auto py-1 sm:py-2">
        {/* Top Heritage Pill & Headline */}
        <div className="text-center mb-2.5 sm:mb-4 px-2 space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-amber-100/90 dark:bg-stone-850 border border-amber-300/80 dark:border-stone-700 px-3.5 py-1 rounded-full text-amber-950 dark:text-amber-200 text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>{t.phoneHelpBadge}</span>
            <span className="opacity-40">•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {lang === "bn" ? "কোনো ফর্ম পূরণের ঝামেলা নেই" : "No Complex Forms"}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 dark:text-stone-50 tracking-tight leading-tight">
            {t.phoneHelpTitle}
          </h2>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
            {t.phoneHelpSubtitle}
          </p>
        </div>

        {/* Elevated Form Card */}
        <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-2 border-amber-400/80 dark:border-amber-600/60 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl shadow-amber-950/10">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
            {/* Phone Number Field (High prominence) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="assistedPhone"
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-stone-800 dark:text-stone-200"
                >
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  <span>{t.phoneHelpInputLabel}</span>
                  <span className="text-rose-600 text-xs font-bold">*</span>
                </label>
                {isPhoneValid && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{t.phoneHelpValidBadge}</span>
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  id="assistedPhone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={t.phoneHelpInputPlaceholder}
                  className={`w-full font-mono text-base sm:text-lg font-bold px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border-2 transition-all outline-hidden bg-stone-50/80 dark:bg-stone-850 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 placeholder:font-sans placeholder:text-sm ${
                    isPhoneValid
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
                      : errorMessage
                        ? "border-rose-500 ring-2 ring-rose-500/20"
                        : "border-stone-300 dark:border-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  }`}
                  autoComplete="tel"
                />
              </div>

              {errorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 pt-0.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Optional Customer Name & Note Fields (Compact 2-col or stacked) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              <div className="space-y-1">
                <label
                  htmlFor="assistedName"
                  className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-stone-700 dark:text-stone-300"
                >
                  <User className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                  <span>{t.phoneHelpNameLabel}</span>
                </label>
                <input
                  id="assistedName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.phoneHelpNamePlaceholder}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg sm:rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-850 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="assistedNote"
                  className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-stone-700 dark:text-stone-300"
                >
                  <ShoppingBag className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                  <span>{t.phoneHelpNoteLabel}</span>
                </label>
                <input
                  id="assistedNote"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.phoneHelpNotePlaceholder}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg sm:rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-850 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>

            {/* Big Action Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-600 hover:from-emerald-700 hover:to-emerald-800 active:scale-98 text-white font-black text-xs sm:text-sm md:text-base py-3 sm:py-3.5 px-6 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-950/15 flex items-center justify-center gap-2 cursor-pointer transition-all touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              <span>
                {submitMutation.isPending ? t.phoneHelpSubmitting : t.phoneHelpSubmitBtn}
              </span>
            </motion.button>
          </form>

          {/* Quick Hotline Fallback & Trust Icons */}
          <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-stone-600 dark:text-stone-400 text-[11px] sm:text-xs">
            <span className="flex items-center gap-1">
              <span>{t.phoneHelpOrCallDirect}</span>
              <a
                href={`tel:${rawHotline}`}
                className="font-mono font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                {hotline}
              </a>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <Clock className="w-3 h-3 text-emerald-600" />
              <span>{lang === "bn" ? "অল্প সময়েই কল ব্যাক" : "Fast Callback"}</span>
            </span>
          </div>
        </div>

        {/* 3 Reassurance Badges */}
        <div className="mt-2.5 sm:mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
          <div className="bg-stone-100/90 dark:bg-stone-850/90 border border-stone-200 dark:border-stone-800 rounded-xl p-1.5 sm:p-2">
            <Phone className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-0.5" />
            <span className="block text-[10px] sm:text-xs font-bold text-stone-800 dark:text-stone-200 leading-tight">
              {t.phoneHelpTrustCall}
            </span>
          </div>
          <div className="bg-stone-100/90 dark:bg-stone-850/90 border border-stone-200 dark:border-stone-800 rounded-xl p-1.5 sm:p-2">
            <Truck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 mx-auto mb-0.5" />
            <span className="block text-[10px] sm:text-xs font-bold text-stone-800 dark:text-stone-200 leading-tight">
              {t.phoneHelpTrustCod}
            </span>
          </div>
          <div className="bg-stone-100/90 dark:bg-stone-850/90 border border-stone-200 dark:border-stone-800 rounded-xl p-1.5 sm:p-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 mx-auto mb-0.5" />
            <span className="block text-[10px] sm:text-xs font-bold text-stone-800 dark:text-stone-200 leading-tight">
              {t.phoneHelpTrustPure}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action: "Or View Products & Order Yourself" */}
      <div className="relative z-10 w-full text-center pt-1 pb-1">
        <button
          type="button"
          onClick={onScrollToProducts}
          className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-extrabold text-xs sm:text-sm py-1.5 px-4 rounded-full transition-all group cursor-pointer"
        >
          <span>{lang === "bn" ? "অথবা নিজে পণ্য দেখে অর্ডার করুন" : "Or browse products to order yourself"}</span>
          <ChevronDown className="w-4 h-4 animate-bounce group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* Submission Success Modal Notification */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isModalOpen && submittedData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-white dark:bg-stone-900 border-2 border-emerald-500 rounded-3xl p-5 sm:p-7 shadow-2xl text-center overflow-hidden"
            >
              {/* Close 'X' Button in Top-Right Corner */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Celebration Checkmark Badge */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3 sm:mb-4 shadow-inner ring-8 ring-emerald-500/20">
                <CheckCircle2 className="w-9 h-9 sm:w-10 sm:h-10 animate-bounce" />
              </div>

              {/* Title & Description */}
              <h3 className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-50 leading-tight">
                {t.phoneHelpModalTitle}
              </h3>

              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
                {t.phoneHelpModalDesc}
              </p>

              {/* Submitted Phone & Reference Details Box */}
              <div className="my-4 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-2xl p-3 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 dark:text-stone-400 font-semibold">
                    {t.phoneHelpModalNumberLabel}
                  </span>
                  <span className="font-mono font-bold text-stone-900 dark:text-stone-100 text-sm">
                    {submittedData.phone}
                  </span>
                </div>

                {submittedData.orderNumber && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500 dark:text-stone-400 font-semibold">
                      {t.phoneHelpModalOrderRefLabel}
                    </span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {submittedData.orderNumber}
                    </span>
                  </div>
                )}

                <div className="pt-1 border-t border-stone-200 dark:border-stone-750 flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {lang === "bn"
                      ? "পণ্য হাতে পেয়ে দেখে টাকা দিন (ক্যাশ অন ডেলিভারি)। কোনো অগ্রিম টাকা নেই।"
                      : "Pay cash on delivery after inspecting products. No advance payment."}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs sm:text-sm py-2.5 sm:py-3 px-5 rounded-xl sm:rounded-2xl shadow-md transition-all cursor-pointer touch-manipulation"
                >
                  {t.phoneHelpModalCloseBtn}
                </button>

                <button
                  type="button"
                  onClick={handleModalBrowseClick}
                  className="w-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl sm:rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{t.phoneHelpModalBrowseBtn}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <a
                  href={`tel:${rawHotline}`}
                  className="inline-flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold pt-1 hover:underline cursor-pointer"
                >
                  <Phone className="w-3 h-3" />
                  <span>
                    {t.phoneHelpModalCallHotline}: {hotline}
                  </span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default PhoneHelpSection;

