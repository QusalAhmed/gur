"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { useForm } from "@tanstack/react-form";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
  Truck,
  Phone,
  PhoneCall,
  User,
  MapPin,
  FileText,
  Loader2,
  ArrowRight,
  ArrowUp,
  ChevronUp,
  Sparkles,
  AlertCircle,
  Leaf,
} from "lucide-react";
import {
  StorefrontLang,
  STOREFRONT_TEXT,
  formatStorePrice,
  toBnNumber,
} from "@/lib/storefront-i18n";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  selectCartItems,
  selectCartSubtotal,
  selectCartTotalQuantity,
  incrementQuantity,
  decrementQuantity,
  removeFromCart,
  clearCart,
  CartItem,
} from "@/lib/redux/slices/cart-slice";
import { placeStorefrontOrderAction } from "@/actions/storefront-order";
import { FormFieldError } from "@/components/ui/tanstack-form";
import { SlidingNumber } from "@/components/ui/sliding-number";

interface CheckoutSectionProps {
  lang: StorefrontLang;
  hotline: string;
  onScrollToProducts: () => void;
}

export function CheckoutSection({
  lang,
  hotline = "01843557389",
  onScrollToProducts,
}: CheckoutSectionProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const cartSubtotal = useAppSelector(selectCartSubtotal);
  const cartTotalQuantity = useAppSelector(selectCartTotalQuantity);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const displayCartItems = mounted ? cartItems : [];
  const displaySubtotal = mounted ? cartSubtotal : 0;
  const displayTotalQuantity = mounted ? cartTotalQuantity : 0;

  const [deliveryZone, setDeliveryZone] = useState<"inside_dhaka" | "outside_dhaka">("inside_dhaka");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = STOREFRONT_TEXT[lang];
  const deliveryCharge = deliveryZone === "inside_dhaka" ? 70 : 130;
  const grandTotal = displaySubtotal + (displayCartItems.length > 0 ? deliveryCharge : 0);
  const rawHotline = hotline.replace(/[^0-9]/g, "");

  // =========================================================================
  // 1. TanStack Table Configuration for Cart Summary (Clean 2-Column Structure)
  // =========================================================================
  const columnHelper = createColumnHelper<CartItem>();

  const columns = useMemo<ColumnDef<CartItem, any>[]>(
    () => [
      // Column 1: Compound Item Card (Image, Title, Description, Unit Price, Pack, Stepper, Delete)
      columnHelper.display({
        id: "itemDetails",
        header: lang === "bn" ? "পণ্যের বিবরণ ও পরিমাণ" : "Item & Quantity",
        cell: (info) => {
          const item = info.row.original;
          const name = lang === "bn" ? item.productNameBn || item.productName : item.productName;
          const variant = lang === "bn" ? item.variantNameBn || item.variantName : item.variantName;
          const desc =
            (lang === "bn" ? item.descriptionBn || item.description : item.description) ||
            (lang === "bn"
              ? "গাছিদের সংগ্রহ করা তাজা ও নির্ভেজাল ঐতিহ্যবাহী খাঁটি গুড়।"
              : "Authentic artisanal pure handcrafted date jaggery.");

          return (
            <div className="flex items-start gap-2.5 sm:gap-3.5 py-2.5 pr-2">
              {/* Product Thumbnail Image */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-amber-100 dark:bg-stone-800 shrink-0 border border-amber-300/80 dark:border-stone-700 shadow-xs">
                <Image
                  src={item.image || "/images/products/blackstrap-drum.jpg"}
                  alt={name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 56px, 64px"
                />
              </div>

              {/* Product Info & Controls Stack */}
              <div className="flex-1 min-w-0 space-y-1">
                {/* Title & Pack Badge */}
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 leading-tight">
                    {name}
                  </span>
                  <span className="inline-block bg-amber-100/90 dark:bg-stone-800 text-amber-900 dark:text-amber-300 font-bold text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md border border-amber-200/80 dark:border-stone-700">
                    {variant}
                  </span>
                </div>

                {/* 1-to-2 Line Description */}
                <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                  {desc}
                </p>

                {/* Unit Price */}
                <div className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-400 font-semibold">
                  <span>{lang === "bn" ? "দর: " : "Unit Price: "}</span>
                  <span className="font-mono font-bold text-stone-900 dark:text-stone-200">
                    {formatStorePrice(item.unitPrice, lang)}
                  </span>
                  <span className="text-[10px] text-stone-500"> / {lang === "bn" ? "প্যাক" : "pack"}</span>
                </div>

                {/* Bottom Controls: Interactive Quantity Stepper + Remove Button */}
                <div className="flex items-center gap-2 pt-1">
                  {/* Stepper with - and + */}
                  <div className="inline-flex items-center gap-1 bg-stone-100 dark:bg-stone-800 rounded-xl p-1 border border-stone-300/80 dark:border-stone-700 shadow-inner">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch(
                          decrementQuantity({
                            productId: item.productId,
                            variantId: item.variantId,
                          })
                        )
                      }
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white dark:bg-stone-700 hover:bg-amber-100 dark:hover:bg-stone-600 active:scale-95 flex items-center justify-center text-stone-800 dark:text-stone-200 font-bold transition-all shadow-xs touch-manipulation cursor-pointer"
                      aria-label={lang === "bn" ? "পরিমাণ কমান" : "Decrease quantity"}
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    <div className="min-w-[28px] text-center font-mono font-black text-xs sm:text-sm text-stone-900 dark:text-stone-100 flex items-center justify-center px-1">
                      <SlidingNumber value={item.quantity} isBengali={lang === "bn"} />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        dispatch(
                          incrementQuantity({
                            productId: item.productId,
                            variantId: item.variantId,
                          })
                        )
                      }
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white dark:bg-stone-700 hover:bg-amber-100 dark:hover:bg-stone-600 active:scale-95 flex items-center justify-center text-stone-800 dark:text-stone-200 font-bold transition-all shadow-xs touch-manipulation cursor-pointer"
                      aria-label={lang === "bn" ? "পরিমাণ বাড়ান" : "Increase quantity"}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() =>
                      dispatch(
                        removeFromCart({
                          productId: item.productId,
                          variantId: item.variantId,
                        })
                      )
                    }
                    className="inline-flex items-center gap-1 py-1 px-2 text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-900/60 rounded-lg transition-colors cursor-pointer text-xs font-semibold"
                    title={lang === "bn" ? "পণ্যটি মুছুন" : "Remove item"}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span className="hidden sm:inline text-[11px] font-medium text-rose-600 dark:text-rose-400">
                      {lang === "bn" ? "বাতিল" : "Remove"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        },
      }),

      // Column 2: Total Price with Live Calculation Subtitle
      columnHelper.display({
        id: "totalPrice",
        header: () => (
          <div className="text-right">
            {lang === "bn" ? "মোট মূল্য" : "Total Price"}
          </div>
        ),
        cell: (info) => {
          const item = info.row.original;
          const total = item.quantity * item.unitPrice;
          const formattedUnit = formatStorePrice(item.unitPrice, lang);
          const formattedQty = lang === "bn" ? toBnNumber(item.quantity) : item.quantity;
          return (
            <div className="text-right py-2.5 pl-2">
              <span className="block font-mono text-sm sm:text-base font-black text-amber-950 dark:text-amber-100 leading-tight">
                {formatStorePrice(total, lang)}
              </span>
              <span className="block font-mono text-[11px] text-stone-500 dark:text-stone-400 mt-1 whitespace-nowrap">
                ({formattedUnit} × {formattedQty})
              </span>
            </div>
          );
        },
      }),
    ],
    [lang, dispatch, columnHelper]
  );

  const table = useReactTable({
    data: displayCartItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // =========================================================================
  // 2. TanStack Form Configuration for 1-Step Checkout
  // =========================================================================
  const form = useForm({
    defaultValues: {
      customerName: "",
      customerPhone: "",
      addressLine: "",
      customerNote: "",
    },
    onSubmit: async ({ value }) => {
      setSubmissionError(null);

      setIsSubmitting(true);
      try {
        const orderPayload = {
          customerName: value.customerName?.trim() || undefined,
          customerPhone: value.customerPhone.trim(),
          deliveryZone,
          addressLine: value.addressLine?.trim() || undefined,
          customerNote: value.customerNote?.trim() || undefined,
          items: cartItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            variantId: item.variantId,
            variantName: item.variantName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        };

        const result = await placeStorefrontOrderAction(orderPayload);

        if (result.success && result.orderNumber) {
          // Clear the Redux cart upon confirmed placement
          dispatch(clearCart());

          // Redirect to dedicated order confirmation page
          const queryParams = new URLSearchParams({
            orderNumber: result.orderNumber,
            total: String(result.grandTotal || grandTotal),
            name: result.customerName || value.customerName,
            phone: result.phone || value.customerPhone,
            zone: deliveryZone,
          });

          router.push(`/order-confirmed?${queryParams.toString()}`);
        } else {
          setSubmissionError(
            result.error ||
            (lang === "bn"
              ? "অর্ডার সম্পন্ন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।"
              : "Failed to place order. Please try again.")
          );
        }
      } catch (err: any) {
        setSubmissionError(
          err?.message ||
          (lang === "bn"
            ? "অর্ডার প্রসেসিংয়ে সমস্যা হয়েছে। সরাসরি ফোনে যোগাযোগ করুন।"
            : "An unexpected error occurred. Please contact us via phone.")
        );
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <section
      id="checkout"
      data-section-index="checkout"
      className="h-[100dvh] max-h-[100dvh] min-h-[620px] w-full snap-start snap-always shrink-0 flex flex-col justify-between pt-3.5 sm:pt-16 pb-16 sm:pb-6 px-3 sm:px-6 md:px-12 relative overflow-y-auto bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 select-none"
    >
      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex-1 my-2 sm:my-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 items-start">
          {/* Left Column (5 Cols): Either Selected Items Table OR Direct Phone Order Assistance */}
          {displayCartItems.length > 0 ? (
            <div className="lg:col-span-5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-amber-200/90 dark:border-stone-800 p-3.5 sm:p-5 shadow-xl shadow-amber-950/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                    <h3 className="font-black text-base sm:text-lg text-stone-900 dark:text-stone-100">
                      {lang === "bn" ? "নির্বাচিত পণ্যসমূহ" : "Selected Items"}
                    </h3>
                  </div>
                  <span className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-bold">
                    {lang === "bn" ? `${toBnNumber(displayCartItems.length)} পদের গুড়` : `${displayCartItems.length} products`}
                  </span>
                </div>

                {/* TanStack Table Element */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr
                          key={headerGroup.id}
                          className="border-b border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-500 uppercase tracking-wider"
                        >
                          {headerGroup.headers.map((header) => (
                            <th key={header.id} className="pb-2 pr-2">
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="hover:bg-amber-50/50 dark:hover:bg-stone-800/40 transition-colors">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="py-2.5 pr-2">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Price Breakdown & Grand Total Card */}
              <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                  <span className="font-semibold">{lang === "bn" ? "পণ্যের মোট মূল্য:" : "Items Subtotal:"}</span>
                  <span className="font-mono font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base">
                    {formatStorePrice(displaySubtotal, lang)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>
                      {lang === "bn" ? "ডেলিভারি চার্জ:" : "Delivery Charge:"} (
                      {deliveryZone === "inside_dhaka"
                        ? lang === "bn"
                          ? "ঢাকা"
                          : "Dhaka"
                        : lang === "bn"
                          ? "ঢাকার বাইরে"
                          : "Outside Dhaka"}
                      )
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm sm:text-base">
                    {formatStorePrice(deliveryCharge, lang)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-stone-300 dark:border-stone-700 text-base sm:text-lg font-black text-amber-950 dark:text-amber-100">
                  <span>{lang === "bn" ? "সর্বমোট প্রদেয়:" : "Total Payable (COD):"}</span>
                  <span className="font-mono text-base sm:text-xl text-emerald-700 dark:text-emerald-400 font-black">
                    {formatStorePrice(grandTotal, lang)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* When 0 products selected: Helpful direct order prompt */
            <div className="lg:col-span-5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-amber-200/90 dark:border-stone-800 p-4 sm:p-6 shadow-xl shadow-amber-950/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-stone-200 dark:border-stone-800">
                  <ShoppingBag className="w-5 h-5 text-amber-600" />
                  <h3 className="font-black text-base sm:text-lg text-stone-900 dark:text-stone-100">
                    {lang === "bn" ? "সরাসরি ফোন অর্ডার" : "Direct Phone Order"}
                  </h3>
                </div>

                <div className="text-center py-2 sm:py-4 px-1">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-200 to-amber-100 dark:from-stone-800 dark:to-stone-700 flex items-center justify-center text-amber-800 dark:text-amber-200 shadow-md mb-3">
                    <PhoneCall className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <h4 className="font-black text-base sm:text-xl text-amber-950 dark:text-amber-100">
                    {lang === "bn" ? "কোনো পণ্য নির্বাচন করেননি?" : "No products selected yet?"}
                  </h4>
                  <p className="text-sm sm:text-base text-stone-700 dark:text-stone-300 mt-2 leading-relaxed font-medium">
                    {lang === "bn"
                      ? "কোনো সমস্যা নেই! শুধু আপনার মোবাইল নম্বর লিখে নিচের বাটনে চাপ দিন। আমাদের প্রতিনিধি সরাসরি ফোন করে আপনার পছন্দের গুড় ও পরিমাণ জেনে নিবেন।"
                      : "No problem! Just enter your mobile number and submit. Our team will call you to confirm your desired molasses and pack size."}
                  </p>

                  <button
                    type="button"
                    onClick={onScrollToProducts}
                    className="mt-4 inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-amber-900 dark:text-amber-100 font-bold text-xs sm:text-sm py-2.5 px-5 rounded-xl border border-amber-300/80 dark:border-stone-700 transition-all cursor-pointer touch-manipulation"
                  >
                    <ShoppingBag className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                    <span>{lang === "bn" ? "গুড় দেখতে উপরে যান" : "Browse Our Collection"}</span>
                    <ArrowUp className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2 text-xs sm:text-sm text-stone-700 dark:text-stone-300 font-medium">
                <div className="flex items-center justify-between">
                  <span>{lang === "bn" ? "পণ্যের পরিমাণ:" : "Items Quantity:"}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {lang === "bn" ? "ফোনে কথা বলে ঠিক হবে" : "Decided over phone"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{lang === "bn" ? "পেমেন্ট:" : "Payment:"}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {lang === "bn" ? "ক্যাশ অন ডেলিভারি (পণ্য পেয়ে টাকা)" : "Cash on Delivery"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Right Column (7 Cols): Responsive TanStack Checkout Form (Larger Senior-Friendly Typography) */}
          <div className="lg:col-span-7 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-amber-200/90 dark:border-stone-800 p-4 sm:p-6 shadow-xl shadow-amber-950/5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-black text-lg sm:text-xl text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>{lang === "bn" ? "ক্যাশ অন ডেলিভারি অর্ডার ফরম" : "Cash on Delivery Order Form"}</span>
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1 font-medium">
                  {lang === "bn"
                    ? "কোন অগ্রিম টাকা লাগবে না, পার্সেল হাতে পেয়ে গুড় দেখে টাকা পরিশোধ করবেন।"
                    : "No advance payment required. Inspect your order and pay cash upon delivery."}
                </p>
              </div>
            </div>

            {submissionError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                <span>{submissionError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className="space-y-4"
            >
              {/* Name & Mobile Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <form.Field name="customerName">
                  {(field) => (
                    <div>
                      <label
                        htmlFor="customerName"
                        className="block text-sm sm:text-base font-bold text-stone-800 dark:text-stone-200 mb-1.5 flex items-center gap-1.5"
                      >
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400" />
                        <span>{lang === "bn" ? "আপনার নাম (ঐচ্ছিক)" : "Full Name (Optional)"}</span>
                      </label>
                      <input
                        id="customerName"
                        type="text"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder={lang === "bn" ? "উদা: মোঃ আব্দুর রহিম (ঐচ্ছিক)" : "e.g. Md. Abdur Rahim (optional)"}
                        className="w-full bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm sm:text-base font-semibold rounded-2xl border-2 border-stone-300 dark:border-stone-700 px-3.5 sm:px-4 py-3 sm:py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                      />
                      <FormFieldError field={field} />
                    </div>
                  )}
                </form.Field>

                <form.Field
                  name="customerPhone"
                  validators={{
                    onChange: ({ value }) => {
                      const cleaned = (value || "").replace(/[^0-9]/g, "");
                      if (!cleaned || cleaned.length !== 11 || !cleaned.startsWith("01")) {
                        return lang === "bn"
                          ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (উদা: 017XXXXXXXX)।"
                          : "Enter a valid 11-digit mobile number (e.g. 017XXXXXXXX).";
                      }
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div>
                      <label
                        htmlFor="customerPhone"
                        className="block text-sm sm:text-base font-bold text-stone-800 dark:text-stone-200 mb-1.5 flex items-center gap-1.5"
                      >
                        <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400" />
                        <span>{lang === "bn" ? "মোবাইল নম্বর *" : "Mobile Number *"}</span>
                      </label>
                      <input
                        id="customerPhone"
                        type="tel"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="01XXXXXXXXX"
                        className="w-full bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-base sm:text-lg font-bold rounded-2xl border-2 border-stone-300 dark:border-stone-700 px-3.5 sm:px-4 py-3 sm:py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                      />
                      <FormFieldError field={field} />
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Delivery Zone Selection Pills */}
              <div>
                <label className="block text-sm sm:text-base font-bold text-stone-800 dark:text-stone-200 mb-2 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400" />
                  <span>{lang === "bn" ? "ডেলিভারি এলাকা" : "Delivery Area"}</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryZone("inside_dhaka")}
                    className={`p-3 sm:p-3.5 rounded-2xl border-2 text-left transition-all touch-manipulation cursor-pointer flex flex-col justify-between ${deliveryZone === "inside_dhaka"
                      ? "border-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 shadow-sm"
                      : "border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/70 text-stone-700 dark:text-stone-300 hover:bg-stone-100"
                      }`}
                  >
                    <span className="font-extrabold text-sm sm:text-base">
                      {lang === "bn" ? "ঢাকার ভিতরে" : "Inside Dhaka"}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                      {lang === "bn" ? "চার্জ ৳৭০" : "Fee ৳70"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryZone("outside_dhaka")}
                    className={`p-3 sm:p-3.5 rounded-2xl border-2 text-left transition-all touch-manipulation cursor-pointer flex flex-col justify-between ${deliveryZone === "outside_dhaka"
                      ? "border-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 shadow-sm"
                      : "border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/70 text-stone-700 dark:text-stone-300 hover:bg-stone-100"
                      }`}
                  >
                    <span className="font-extrabold text-sm sm:text-base">
                      {lang === "bn" ? "ঢাকার বাইরে" : "Outside Dhaka"}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                      {lang === "bn" ? "চার্জ ৳১৩০" : "Fee ৳130"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Address Line */}
              <form.Field name="addressLine">
                {(field) => (
                  <div>
                    <label
                      htmlFor="addressLine"
                      className="block text-sm sm:text-base font-bold text-stone-800 dark:text-stone-200 mb-1.5 flex items-center gap-1.5"
                    >
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400" />
                      <span>{lang === "bn" ? "সম্পূর্ণ ডেলিভারি ঠিকানা (ঐচ্ছিক)" : "Full Delivery Address (Optional)"}</span>
                    </label>
                    <textarea
                      id="addressLine"
                      rows={2}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={
                        lang === "bn"
                          ? "বাড়ি নং, রোড নং, এলাকা বা থানা ও জেলার নাম (ঐচ্ছিক)..."
                          : "House, Road, Area, Thana or District name (optional)..."
                      }
                      className="w-full bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm sm:text-base font-semibold rounded-2xl border-2 border-stone-300 dark:border-stone-700 px-3.5 sm:px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner resize-none"
                    />
                    <FormFieldError field={field} />
                  </div>
                )}
              </form.Field>

              {/* Customer Note (Optional) */}
              <form.Field name="customerNote">
                {(field) => (
                  <div>
                    <label
                      htmlFor="customerNote"
                      className="block text-sm sm:text-base font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      <span>{lang === "bn" ? "বিশেষ নির্দেশনা (ঐচ্ছিক)" : "Special Note (Optional)"}</span>
                    </label>
                    <input
                      id="customerNote"
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={
                        lang === "bn" ? "উদা: জরুরি ডেলিভারি প্রয়োজন বা কল করার সুবিধাজনক সময়" : "e.g. Preferred delivery time"
                      }
                      className="w-full bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm sm:text-base rounded-2xl border-2 border-stone-300 dark:border-stone-700 px-3.5 sm:px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </form.Field>

              {/* Reassurance Banner */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800 rounded-2xl p-3 flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {lang === "bn"
                    ? "১০০% ক্যাশ অন ডেলিভারি: পার্সেল খুলে গুড় দেখে টাকা পরিশোধের নিশ্চয়তা।"
                    : "100% Cash on Delivery: Inspect your jaggery package before making payment."}
                </span>
              </div>

              {/* Submit Action Button */}
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit]) => (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting || !canSubmit}
                    className="w-full bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-600 hover:from-emerald-700 hover:via-emerald-800 hover:to-emerald-700 disabled:opacity-50 text-white font-black py-4 sm:py-4.5 px-6 rounded-2xl shadow-[0_10px_24px_rgba(5,150,105,0.32)] border-2 border-emerald-400 transition-all flex items-center justify-center gap-2 text-base sm:text-lg touch-manipulation cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{lang === "bn" ? "অর্ডার প্রসেস হচ্ছে..." : "Processing Order..."}</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-2">
                        {cartItems.length > 0 ? (
                          <>
                            <span>
                              {lang === "bn"
                                ? `অর্ডার নিশ্চিত করুন (${formatStorePrice(grandTotal, lang)})`
                                : `Confirm Order (${formatStorePrice(grandTotal, lang)})`}
                            </span>
                            <ArrowRight className="w-5 h-5" />
                          </>
                        ) : (
                          <>
                            <span>
                              {lang === "bn"
                                ? "অর্ডার নিশ্চিত করুন (ক্যাশ অন ডেলিভারি)"
                                : "Confirm Order (Cash on Delivery)"}
                            </span>
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </span>
                    )}
                  </motion.button>
                )}
              </form.Subscribe>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Support Guarantee Note */}
      <div className="relative z-10 w-full text-center py-1 text-[11px] sm:text-xs text-amber-900/70 dark:text-amber-400/70 font-semibold flex items-center justify-center gap-1.5">
        <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          {lang === "bn"
            ? "সরাসরি গাছিদের প্রস্তুত করা খাঁটি খেজুরের গুড় • কোনো কৃত্রিম চিনি বা কেমিক্যাল নেই"
            : "Pure Artisanal Date Jaggery Directly From Village Artisans • No Added Sugar or Chemicals"}
        </span>
      </div>
    </section>
  );
}

