"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { X, Check, ShieldCheck, MapPin, Phone, PhoneCall, User, Home, Truck, Loader2, AlertCircle, Info, ArrowRight } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { placeStorefrontOrderAction, StorefrontOrderResult } from "@/actions/storefront-order";
import { OrderSuccessView } from "./order-success-view";
import { useAppDispatch } from "@/lib/redux/hooks";
import { clearCart, CartItem } from "@/lib/redux/slices/cart-slice";

export interface SelectedProductData {
  productId: string;
  productName: string;
  productNameBn: string;
  variantId: string;
  variantName: string;
  variantNameBn: string;
  unitPrice: number;
  image: string;
}

interface QuickOrderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  product?: SelectedProductData | null;
  quantity?: number;
  cartItems?: CartItem[];
  lang: StorefrontLang;
  hotline?: string;
}

export function QuickOrderSheet({
  isOpen,
  onClose,
  product,
  quantity = 1,
  cartItems,
  lang,
  hotline = "01843557389",
}: QuickOrderSheetProps) {
  const dispatch = useAppDispatch();
  const t = STOREFRONT_TEXT[lang];

  // Resolve checkout items: either multi-item cart or single direct product
  const resolvedItems: Array<{
    id: string;
    productId: string;
    productName: string;
    productNameBn?: string;
    variantId: string;
    variantName: string;
    variantNameBn?: string;
    unitPrice: number;
    quantity: number;
    image: string;
  }> = (cartItems && cartItems.length > 0)
      ? cartItems
      : product
        ? [
          {
            id: `${product.productId}-${product.variantId}`,
            productId: product.productId,
            productName: product.productName,
            productNameBn: product.productNameBn,
            variantId: product.variantId,
            variantName: product.variantName,
            variantNameBn: product.variantNameBn,
            unitPrice: product.unitPrice,
            quantity: Math.max(1, quantity),
            image: product.image,
          },
        ]
        : [];

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryZone, setDeliveryZone] = useState<"inside_dhaka" | "outside_dhaka">("inside_dhaka");
  const [addressLine, setAddressLine] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<StorefrontOrderResult | null>(null);

  const subtotal = resolvedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingFee = resolvedItems.length === 0 ? 0 : (deliveryZone === "inside_dhaka" ? 70 : 130);
  const grandTotal = subtotal + shippingFee;

  const handleResetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setAddressLine("");
    setDeliveryZone("inside_dhaka");
    setErrorMessage(null);
    setOrderResult(null);
    onClose();
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic frontend check: Only mobile phone number is mandatory
    const cleanDigits = customerPhone.replace(/[^0-9]/g, "");
    if (cleanDigits.length < 11) {
      setErrorMessage(
        lang === "bn"
          ? "অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন (উদা: 017XXXXXXXX)।"
          : "Please enter a valid 11-digit mobile number."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await placeStorefrontOrderAction({
        customerName,
        customerPhone,
        deliveryZone,
        addressLine,
        items: resolvedItems.map((i) => ({
          productId: i.productId,
          productName: lang === "bn" ? i.productNameBn || i.productName : i.productName,
          variantId: i.variantId,
          variantName: lang === "bn" ? i.variantNameBn || i.variantName : i.variantName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });

      if (res.success) {
        // Clear Redux cart on successful order
        dispatch(clearCart());
        setOrderResult(res);
      } else {
        setErrorMessage(res.error || (lang === "bn" ? "অর্ডার সম্পন্ন হতে সমস্যা হয়েছে।" : "Failed to place order."));
      }
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "bn" ? "অনাকাঙ্ক্ষিত ত্রুটি ঘটেছে।" : "An unexpected error occurred."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          {/* Dim Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={!isSubmitting ? onClose : undefined}
            className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm"
          />

          {/* Modal / Bottom Sheet Box */}
          <motion.div
            initial={{ y: "100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative z-10 w-full max-w-xl bg-amber-50/95 dark:bg-stone-900 border-t sm:border border-amber-200/80 dark:border-stone-800 rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[94dvh] sm:max-h-[88dvh] flex flex-col text-stone-900 dark:text-stone-100"
          >
            {/* Sheet Handle for mobile */}
            <div className="w-12 h-1 bg-amber-300 dark:bg-stone-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

            {/* Header */}
            <div className="px-4 sm:px-6 pt-3 pb-2.5 sm:pt-4 sm:pb-3 flex items-center justify-between border-b border-amber-200/60 dark:border-stone-800 bg-amber-100/50 dark:bg-stone-800/40 shrink-0">
              <div>
                <h3 className="text-lg sm:text-2xl font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5 sm:gap-2">
                  <span>{t.orderSheetTitle}</span>
                  <span className="text-[10px] sm:text-xs bg-amber-700 text-amber-50 font-semibold px-2 py-0.5 rounded-full shrink-0">
                    {lang === "bn" ? "ক্যাশ অন ডেলিভারি" : "COD"}
                  </span>
                </h3>
                <p className="text-[11px] sm:text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-0.5">
                  {t.orderSheetSubtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-200/60 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 transition-colors shrink-0 touch-manipulation"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Content Area */}
            {orderResult ? (
              /* Success View */
              <div className="overflow-y-auto px-4 py-4 sm:px-7 sm:py-6 flex-1">
                <OrderSuccessView
                  orderNumber={orderResult.orderNumber || "MOL-1001"}
                  customerName={orderResult.customerName || customerName}
                  phone={orderResult.phone || customerPhone}
                  grandTotal={orderResult.grandTotal || grandTotal}
                  deliveryZone={orderResult.deliveryZone || deliveryZone}
                  lang={lang}
                  hotline={hotline}
                  onReset={handleResetForm}
                />
              </div>
            ) : (
              /* Order Input Form with Sticky Footer */
              <form onSubmit={handleSubmitOrder} className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable Form Fields */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4 space-y-3.5 sm:space-y-4">
                          {/* Selected Items Summary Card */}
                          {resolvedItems.length === 0 ? (
                            <div className="bg-amber-100/70 dark:bg-stone-800/80 border border-amber-300/80 dark:border-stone-700 rounded-xl sm:rounded-2xl p-3 shadow-sm flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-900/60 flex items-center justify-center text-amber-800 dark:text-amber-200 shrink-0">
                                <PhoneCall className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                                  {lang === "bn" ? "সরাসরি ফোন অর্ডার" : "Direct Phone Order"}
                                </h4>
                                <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-300">
                                  {lang === "bn"
                                    ? "কোনো পণ্য সিলেক্ট করেননি। শুধু মোবাইল নম্বর দিলেই আমরা কল করে পণ্য ও অর্ডার নিশ্চিত করব।"
                                    : "No product selected. Submit your phone number and we will call you to confirm."}
                                </p>
                              </div>
                            </div>
                          ) : resolvedItems.length === 1 ? (
                            <div className="bg-amber-100/70 dark:bg-stone-800/80 border border-amber-300/80 dark:border-stone-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-center gap-2.5 sm:gap-3.5 shadow-sm">
                              <div className="w-14 h-14 sm:w-16 sm:h-16 relative rounded-lg sm:rounded-xl overflow-hidden bg-amber-200 dark:bg-stone-700 shrink-0 border border-amber-300/60">
                                <Image
                                  src={resolvedItems[0].image}
                                  alt={resolvedItems[0].productName}
                                  fill
                                  className="object-cover"
                                  sizes="64px"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm sm:text-base md:text-lg text-amber-950 dark:text-amber-100 truncate">
                                  {lang === "bn" ? resolvedItems[0].productNameBn || resolvedItems[0].productName : resolvedItems[0].productName}
                                </h4>
                                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300">
                                  {lang === "bn" ? resolvedItems[0].variantNameBn || resolvedItems[0].variantName : resolvedItems[0].variantName}{" "}
                                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                                    × {lang === "bn" ? toBnNumber(resolvedItems[0].quantity) : resolvedItems[0].quantity}
                                  </span>
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] sm:text-xs text-stone-500 dark:text-stone-400 block">
                                  {t.subtotal}
                                </span>
                              <span className="font-extrabold text-sm sm:text-base md:text-lg text-amber-900 dark:text-amber-300">
                                {formatStorePrice(subtotal, lang)}
                              </span>
                            </div>
                    </div>
                          ) : (
                          /* Multi-Item Order Summary */
                          <div className="bg-amber-100/70 dark:bg-stone-800/80 border border-amber-300/80 dark:border-stone-700 rounded-xl sm:rounded-2xl p-3 shadow-sm space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-200 pb-1 border-b border-amber-200 dark:border-stone-700">
                              <span>{t.selectedProduct} ({lang === "bn" ? toBnNumber(resolvedItems.length) : resolvedItems.length} {t.itemsCount}):</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{formatStorePrice(subtotal, lang)}</span>
                            </div>
                            <div className="max-h-36 overflow-y-auto divide-y divide-amber-200/60 dark:divide-stone-700 space-y-2">
                              {resolvedItems.map((item) => (
                                <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-9 h-9 relative rounded-lg overflow-hidden bg-amber-200 dark:bg-stone-700 shrink-0">
                                      <Image src={item.image} alt={item.productName} fill className="object-cover" sizes="36px" />
                                    </div>
                                    <div className="min-w-0 truncate">
                                      <p className="font-bold text-amber-950 dark:text-amber-100 truncate">
                                        {lang === "bn" ? item.productNameBn || item.productName : item.productName}
                                      </p>
                                      <p className="text-[11px] text-stone-500">
                                        {lang === "bn" ? item.variantNameBn || item.variantName : item.variantName} × {lang === "bn" ? toBnNumber(item.quantity) : item.quantity}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="font-bold text-amber-950 dark:text-amber-100 shrink-0">
                                    {formatStorePrice(item.unitPrice * item.quantity, lang)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                  )}

                        {/* Error Notification Alert */}
                        {errorMessage && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 dark:bg-red-950/60 border-2 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-medium flex items-center gap-2"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                            <span>{errorMessage}</span>
                          </motion.div>
                        )}

                        {/* Full Name (Optional) */}
                        <div className="space-y-1">
                          <label className="block text-sm sm:text-base font-bold text-amber-950 dark:text-amber-100">
                            {t.fullNameLabel}
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                              <User className="w-4 h-4 sm:w-5 sm:h-5 text-amber-800/70" />
                            </div>
                            <input
                              type="text"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder={t.fullNamePlaceholder}
                              className="w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 text-base rounded-xl border-2 border-amber-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:border-amber-600 dark:focus:border-amber-400 font-medium transition-colors shadow-sm touch-manipulation"
                            />
                          </div>
                        </div>

                        {/* Mobile Phone Number (Mandatory) */}
                        <div className="space-y-1">
                          <label className="block text-sm sm:text-base font-bold text-amber-950 dark:text-amber-100">
                            {t.phoneLabel} <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                              <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-amber-800/70" />
                            </div>
                            <input
                              type="tel"
                              required
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder={t.phonePlaceholder}
                              className="w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 text-base rounded-xl border-2 border-amber-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:border-amber-600 dark:focus:border-amber-400 font-mono font-medium transition-colors shadow-sm touch-manipulation"
                            />
                          </div>
                          <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 italic flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 inline text-amber-700 dark:text-amber-400 shrink-0" />
                            <span>{t.phoneHelp}</span>
                          </p>
                        </div>

                        {/* Delivery Zone Selection (2 Touch Cards) */}
                        <div className="space-y-1">
                          <label className="block text-sm sm:text-base font-bold text-amber-950 dark:text-amber-100">
                            {t.zoneLabel}
                          </label>
                          <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            {/* Inside Dhaka */}
                            <button
                              type="button"
                              onClick={() => setDeliveryZone("inside_dhaka")}
                              className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 text-left flex items-start justify-between transition-all touch-manipulation ${deliveryZone === "inside_dhaka"
                                  ? "bg-amber-100 dark:bg-amber-950/60 border-amber-600 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20"
                                  : "bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-amber-300"
                                }`}
                            >
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <Home
                                  className={`w-4 h-4 shrink-0 ${deliveryZone === "inside_dhaka"
                                      ? "text-amber-700 dark:text-amber-400"
                                      : "text-stone-400"
                                    }`}
                                />
                                <div>
                                  <span className="font-bold text-xs sm:text-base block text-stone-900 dark:text-stone-100 leading-tight">
                                    {t.insideDhaka}
                                  </span>
                                  <span className="text-[10px] sm:text-xs text-stone-600 dark:text-stone-400 font-medium">
                                    {t.insideDhakaFee}
                                  </span>
                                </div>
                              </div>
                              {deliveryZone === "inside_dhaka" && (
                                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </button>

                            {/* Outside Dhaka */}
                            <button
                              type="button"
                              onClick={() => setDeliveryZone("outside_dhaka")}
                              className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 text-left flex items-start justify-between transition-all touch-manipulation ${deliveryZone === "outside_dhaka"
                                  ? "bg-amber-100 dark:bg-amber-950/60 border-amber-600 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20"
                                  : "bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-amber-300"
                                }`}
                            >
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <Truck
                                  className={`w-4 h-4 shrink-0 ${deliveryZone === "outside_dhaka"
                                      ? "text-amber-700 dark:text-amber-400"
                                      : "text-stone-400"
                                    }`}
                                />
                                <div>
                                  <span className="font-bold text-xs sm:text-base block text-stone-900 dark:text-stone-100 leading-tight">
                                    {t.outsideDhaka}
                                  </span>
                                  <span className="text-[10px] sm:text-xs text-stone-600 dark:text-stone-400 font-medium">
                                    {t.outsideDhakaFee}
                                  </span>
                                </div>
                              </div>
                              {deliveryZone === "outside_dhaka" && (
                                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Complete Address (Optional) */}
                        <div className="space-y-1">
                          <label className="block text-sm sm:text-base font-bold text-amber-950 dark:text-amber-100">
                            {t.addressLabel}
                          </label>
                          <div className="relative">
                            <div className="absolute top-2.5 left-3 pointer-events-none text-stone-400">
                              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-amber-800/70" />
                            </div>
                            <textarea
                              rows={2}
                              value={addressLine}
                              onChange={(e) => setAddressLine(e.target.value)}
                              placeholder={t.addressPlaceholder}
                              className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 text-base rounded-xl border-2 border-amber-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:border-amber-600 dark:focus:border-amber-400 font-medium transition-colors shadow-sm resize-none touch-manipulation"
                            />
                          </div>
                        </div>

                        {/* Cash On Delivery Assurance Pill */}
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800 rounded-xl p-2.5 flex items-center gap-2.5 text-emerald-950 dark:text-emerald-200">
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div className="text-[11px] sm:text-xs">
                            <span className="font-bold block leading-tight">{t.paymentMethodLabel} {t.codLabel}</span>
                            <span className="opacity-80">
                              {lang === "bn"
                                ? "অর্ডার করতে কোনো অগ্রিম পেমেন্ট নেই। পার্সেল পেয়ে টাকা দিন।"
                                : "No upfront payment. Pay securely when parcel arrives."}
                            </span>
                          </div>
                        </div>
                    </div>

                    {/* Sticky Bottom Action Bar with Total Bill & Submit CTA */}
                    <div className="bg-amber-100/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-amber-200/90 dark:border-stone-800 px-4 py-3 sm:px-6 sm:py-4 shadow-lg shrink-0">
                      {resolvedItems.length > 0 && (
                        <div className="flex justify-between items-center mb-2 text-xs sm:text-sm">
                          <div className="text-stone-600 dark:text-stone-300">
                            <span>{t.subtotal} {formatStorePrice(subtotal, lang)}</span>
                            <span className="mx-1.5">•</span>
                            <span>{t.deliveryCharge} {formatStorePrice(shippingFee, lang)}</span>
                          </div>
                          <div className="font-black text-base sm:text-lg text-amber-950 dark:text-amber-100">
                            <span className="text-emerald-700 dark:text-emerald-400 font-mono">
                              {formatStorePrice(grandTotal, lang)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Big Tactile Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-75 disabled:pointer-events-none text-white font-extrabold text-base sm:text-xl py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl shadow-xl shadow-emerald-700/25 transition-all flex items-center justify-center gap-2 touch-manipulation"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{t.processingOrder}</span>
                          </>
                        ) : resolvedItems.length === 0 ? (
                          <span className="flex items-center justify-center gap-2">
                            <span>{lang === "bn" ? "অর্ডার নিশ্চিত করুন (কল অনুরোধ)" : "Confirm Phone Order"}</span>
                            <ArrowRight className="w-5 h-5" />
                          </span>
                        ) : (
                          <>
                            <span>{t.confirmOrderBtn}</span>
                            <span className="text-emerald-200 text-sm sm:text-base font-mono">
                              ({formatStorePrice(grandTotal, lang)})
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
            )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          );
}
