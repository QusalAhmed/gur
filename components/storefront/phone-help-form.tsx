"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Phone,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ShieldCheck,
  X,
  ArrowRight,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";
import { parseBdPhone, isValidBdPhone } from "@/lib/phone";
import { useSubmitAssistedPhoneOrderMutation } from "@/hooks/use-order";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectCartItems } from "@/lib/redux/slices/cart-slice";
import { StorefrontOrderItem } from "@/actions/storefront-order";
import { toast } from "sonner";
import { trackContact } from "@/lib/facebook-pixel";
import { CopyPhoneButton } from "./copy-phone-button";

interface PhoneHelpFormProps {
  lang?: StorefrontLang;
  hotline?: string;
  storeName?: string;
  onScrollToProducts?: () => void;
}

const DRAFT_ORDER_SESSION_KEY = "gur_draft_order_id";

export function PhoneHelpForm({
  lang = "bn",
  hotline = "01843557389",
  onScrollToProducts,
}: PhoneHelpFormProps) {
  const [phone, setPhone] = useState("");
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
  const lastSubmittedPhoneRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

    // Primary auto-submit handler
    const performAutoSubmit = useCallback(
      async (validNormalizedPhone: string, validLocalPhone: string) => {
        if (
          isSubmittingRef.current ||
          lastSubmittedPhoneRef.current === validNormalizedPhone
        ) {
          return;
        }

        isSubmittingRef.current = true;
        setErrorMessage(null);

        // Attach active Redux cart items for staff fulfillment context
        const resolvedItems: StorefrontOrderItem[] = cartItems.map((item) => ({
          productId: item.productId,
          productName: lang === "bn" ? item.productNameBn || item.productName : item.productName,
          variantId: item.variantId,
          variantName: lang === "bn" ? item.variantNameBn || item.variantName : item.variantName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));

        // Read draft order id from session if present
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
                  customerPhone: validNormalizedPhone,
                  items: resolvedItems,
                });

                  if (res.success) {
                    trackContact({
                      channel: "phone",
                      phone: validNormalizedPhone,
                      customData: { source: "phone_help_form" },
                    });
                    lastSubmittedPhoneRef.current = validNormalizedPhone;
              setSubmittedData({
                phone: validLocalPhone,
                orderNumber: res.orderNumber || "",
              });
              setIsModalOpen(true);
              setErrorMessage(null);

              toast.success(
                lang === "bn" ? "অর্ডার ড্রাফট সংরক্ষিত" : "Order Draft Saved",
                {
                  description:
                    lang === "bn"
                      ? `আপনার ফোন নম্বরটি সফলভাবে ডাটাবেজে সংরক্ষিত হয়েছে! (অর্ডার নং: ${res.orderNumber})`
                      : `Your phone number was stored successfully! (Order #${res.orderNumber})`,
                  duration: 6000,
                }
              );

              try {
                sessionStorage.removeItem(DRAFT_ORDER_SESSION_KEY);
              } catch {
                // Safe ignore
              }
            } else {
              setErrorMessage(res.error || t.phoneHelpInvalidError);
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t.phoneHelpInvalidError;
            setErrorMessage(message || t.phoneHelpInvalidError);
          } finally {
            isSubmittingRef.current = false;
          }
        },
        [cartItems, lang, submitMutation, t.phoneHelpInvalidError]
  );

    // Automatically submit to server when a valid phone number is entered
    useEffect(() => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

    if (!isPhoneValid) {
      return;
    }

    // Prevent duplicate submissions for the same normalized number
    if (lastSubmittedPhoneRef.current === parsedPhone.normalized) {
      return;
    }

    // 500ms debounce after typing the complete valid number
    debounceTimerRef.current = setTimeout(() => {
      performAutoSubmit(parsedPhone.normalized, parsedPhone.local);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isPhoneValid, parsedPhone.normalized, parsedPhone.local, performAutoSubmit]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Close modal on Escape key for keyboard accessibility
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const handleModalBrowseClick = () => {
    setIsModalOpen(false);
    if (onScrollToProducts) {
      onScrollToProducts();
    } else {
      window.location.href = "/products";
    }
  };

  return (
    <div id="incomplete-order-form" className="w-full">
      {/* Top Banner & Title */}
      <div className="text-center mb-3 sm:mb-4 px-2 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-1 rounded-md text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-medium">
          <PhoneCall className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span>{t.phoneHelpBadge}</span>
          <span className="opacity-40">•</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            {t.phoneHelpAutoSubmitHint}
          </span>
        </div>

        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-50 tracking-tight leading-tight">
          {t.phoneHelpTitle}
        </h3>

        <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
          {t.phoneHelpSubtitle}
        </p>
      </div>

      {/* Elevated Card with Single Phone Input Field */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="assistedPhoneInput"
                  className="flex items-center gap-1.5 text-sm sm:text-base font-semibold text-stone-800 dark:text-stone-200"
                >
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  <span>{t.phoneHelpInputLabel}</span>
                  <span className="text-rose-600 text-xs font-bold">*</span>
                </label>

                {/* Live Auto-Submission Status Indicator */}
                <div aria-live="polite" className="inline-flex items-center">
                  {submitMutation.isPending ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-600" aria-hidden="true" />
                      <span>{t.phoneHelpAutoSubmitting}</span>
                    </span>
                  ) : isPhoneValid ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                      <span>{t.phoneHelpValidBadge}</span>
                    </span>
                  ) : null}
                </div>
              </div>

                  <div className="relative">
                    <input
                      id="assistedPhoneInput"
                      type="tel"
                      data-clarity-mask="true"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder={t.phoneHelpInputPlaceholder}
                      aria-required="true"
                      aria-invalid={Boolean(errorMessage)}
                      aria-describedby={errorMessage ? "assisted-phone-error assisted-phone-desc" : "assisted-phone-desc"}
                      className={`w-full font-mono text-base sm:text-lg font-bold px-3.5 py-2.5 sm:py-3 rounded-xl border transition-colors outline-hidden bg-stone-50/80 dark:bg-stone-850 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 placeholder:font-sans placeholder:text-sm ${isPhoneValid
                          ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
                          : errorMessage
                            ? "border-rose-500 ring-2 ring-rose-500/20"
                            : "border-stone-300 dark:border-stone-700 focus:border-amber-700 focus:ring-1 focus:ring-amber-700/20"
                        }`}
                      autoComplete="tel"
                    />

                    {/* Spinner inside input when auto-submitting */}
                    {submitMutation.isPending && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-amber-600">
                        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                      {errorMessage && (
                        <div id="assisted-phone-error" role="alert" className="flex items-center gap-1.5 text-xs sm:text-sm text-rose-600 dark:text-rose-400 pt-0.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{errorMessage}</span>
                        </div>
                      )}

                    <p id="assisted-phone-desc" className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 pt-1 leading-relaxed">
                      {lang === "bn"
                        ? "সরাসরি আপনার মোবাইল নম্বরটি লিখলেই আমাদের সিস্টেমে চলে যাবে — কোনো বাটনে চাপ দিতে হবে না।"
                        : "Simply enter your mobile number and your request will submit automatically without pressing any button."}
                    </p>
                  </div>

        {/* Quick Hotline & Fast Callback Reminder */}
                <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-stone-600 dark:text-stone-400 text-xs sm:text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <span>{t.phoneHelpOrCallDirect}</span>
                    <a
                      href={`tel:${rawHotline}`}
                      aria-label={`${t.phoneHelpOrCallDirect} ${hotline}`}
                      className="font-mono font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      {hotline}
                    </a>
                    <CopyPhoneButton
                      phone={hotline}
                      lang={lang}
                      variant="icon"
                      className="py-0.5 px-1.5 h-6 text-emerald-700 dark:text-emerald-400 bg-transparent border-0 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50"
                    />
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    <Clock className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                    <span>{lang === "bn" ? "অল্প সময়েই কল ব্যাক" : "Fast Callback"}</span>
                  </span>
                </div>
              </div>

              {/* Submission Success Modal Notification */}
              <AnimatePresence>
                {isModalOpen && submittedData && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
                    <motion.div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="assisted-phone-modal-heading"
                      initial={{ scale: 0.95, opacity: 0, y: 16 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 16 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="relative w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl text-center overflow-hidden"
                    >
                      {/* Close Button */}
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                        aria-label={lang === "bn" ? "বন্ধ করুন" : "Close"}
                      >
                        <X className="w-5 h-5" aria-hidden="true" />
                      </button>

                      {/* Confirmation Icon */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3 sm:mb-4 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" aria-hidden="true" />
                      </div>

                      {/* Title & Description */}
                      <h3 id="assisted-phone-modal-heading" className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-50 leading-tight">
                        {t.phoneHelpModalTitle}
                      </h3>

                      <p className="text-sm text-stone-600 dark:text-stone-400 mt-2 leading-relaxed">
                        {t.phoneHelpModalDesc}
                      </p>

                      {/* Submitted Phone & Reference Box */}
                      <div className="my-4 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl p-3 text-left space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-stone-500 dark:text-stone-400 font-medium">
                            {t.phoneHelpModalNumberLabel}
                          </span>
                          <span
                            data-clarity-mask="true"
                            className="font-mono font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base"
                          >
                            {submittedData.phone}
                          </span>
                        </div>

                        {submittedData.orderNumber && (
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="text-stone-500 dark:text-stone-400 font-medium">
                              {t.phoneHelpModalOrderRefLabel}
                            </span>
                            <span className="font-mono font-bold text-amber-800 dark:text-amber-400 text-sm sm:text-base">
                              {submittedData.orderNumber}
                            </span>
                          </div>
                        )}

                        <div className="pt-1.5 border-t border-stone-200 dark:border-stone-750 flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
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
                          className="w-full bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-medium text-xs sm:text-sm py-2.5 sm:py-3 px-5 rounded-xl shadow-xs transition-colors cursor-pointer touch-manipulation"
                        >
                          {t.phoneHelpModalCloseBtn}
                        </button>

                        <button
                          type="button"
                          onClick={handleModalBrowseClick}
                          className="w-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-medium text-xs sm:text-sm py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>{t.phoneHelpModalBrowseBtn}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={`tel:${rawHotline}`}
                          className="inline-flex items-center justify-center gap-1.5 text-xs text-amber-900 dark:text-amber-400 font-medium pt-1 hover:underline cursor-pointer"
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
            </div>
            );
}

            export default PhoneHelpForm;
