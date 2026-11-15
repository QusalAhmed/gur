"use client";

import React from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { ShoppingBag, Truck, ShieldCheck, Sparkles, Package } from "lucide-react";
import type { ParcelTrackingData } from "@/types/tracking";
import { formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { cn } from "@/lib/utils";

interface OrderCartDetailsCardProps {
  data: ParcelTrackingData;
  lang: "bn" | "en";
  className?: string;
}

export function OrderCartDetailsCard({
  data,
  lang,
  className,
}: OrderCartDetailsCardProps) {
  const items = data.items || [];
  const displaySubtotal = data.subtotal || items.reduce((acc, it) => acc + it.lineTotal, 0);
  const displayShipping = data.shippingTotal || 0;
  const displayGrandTotal = data.grandTotal || displaySubtotal + displayShipping;
  const displayTotalWeightKg = data.totalWeightKg || 1;
  const displayCodPayable = data.codPayable;

  return (
    <div
      className={cn(
        "bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-amber-200/90 dark:border-stone-800 p-3.5 sm:p-5 shadow-xl shadow-amber-950/5 flex flex-col justify-between",
        className
      )}
    >
      <div>
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            <h3 className="font-black text-base sm:text-lg text-stone-900 dark:text-stone-100">
              {lang === "bn" ? "নির্বাচিত পণ্যসমূহ (অর্ডার বিবরণ)" : "Selected Items & Details"}
            </h3>
          </div>
          <span className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-bold">
            {lang === "bn" ? `${toBnNumber(items.length)} পদের গুড়` : `${items.length} products`}
          </span>
        </div>

        {/* Storefront Items Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                <th className="pb-2 pr-2">
                  <span>{lang === "bn" ? "পণ্যের বিবরণ ও পরিমাণ" : "Item & Quantity"}</span>
                </th>
                <th className="pb-2 pl-2 text-right">
                  <span>{lang === "bn" ? "মোট মূল্য" : "Total Price"}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
              {items.map((item, idx) => {
                const total = item.lineTotal || item.unitPrice * item.quantity;
                const wKg =
                  typeof item.weightKg === "number" && item.weightKg > 0
                    ? item.weightKg
                    : typeof item.weightGrams === "number" && item.weightGrams > 0
                    ? item.weightGrams / 1000
                    : 1;
                const lineWeightKg = wKg * item.quantity;

                return (
                  <motion.tr
                    key={item.id || idx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.04 }}
                    className="hover:bg-amber-50/50 dark:hover:bg-stone-800/40 transition-colors"
                  >
                    {/* Left Column: Image, Title, Variant, Unit Price, Quantity Pill */}
                    <td className="py-2.5 pr-2">
                      <div className="flex items-start gap-2.5 sm:gap-3.5">
                        {/* Thumbnail */}
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-amber-100 dark:bg-stone-800 shrink-0 border border-amber-300/80 dark:border-stone-700 shadow-xs">
                          <Image
                            src={item.image || "/images/products/date-palm-patali.jpg"}
                            alt={item.productName}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 56px, 64px"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Title & Variant Badge */}
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 leading-tight">
                              {item.productName}
                            </span>
                            {item.variantName && (
                              <span className="inline-block bg-amber-100/90 dark:bg-stone-800 text-amber-900 dark:text-amber-300 font-bold text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md border border-amber-200/80 dark:border-stone-700">
                                {item.variantName}
                              </span>
                            )}
                          </div>

                          {/* 1-Line Description */}
                          <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 line-clamp-1 leading-relaxed">
                            {item.description ||
                              (lang === "bn"
                                ? "গাছিদের সংগ্রহ করা তাজা ও নির্ভেজাল ঐতিহ্যবাহী খাঁটি গুড়।"
                                : "Authentic artisanal pure handcrafted date jaggery.")}
                          </p>

                          {/* Unit Price */}
                          <div className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-400 font-semibold">
                            <span>{lang === "bn" ? "দর: " : "Unit: "}</span>
                            <span className="font-mono font-bold text-stone-900 dark:text-stone-200">
                              {formatStorePrice(item.unitPrice, lang)}
                            </span>
                            <span className="text-[10px] text-stone-500"> / {lang === "bn" ? "প্যাক" : "pack"}</span>
                          </div>

                          {/* Quantity Pill */}
                          <div className="pt-0.5">
                            <span className="inline-flex items-center gap-1 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 font-bold text-[11px]">
                              <span>{lang === "bn" ? "পরিমাণ:" : "Qty:"}</span>
                              <span className="font-mono font-black text-amber-950 dark:text-amber-200">
                                {lang === "bn" ? toBnNumber(item.quantity) : item.quantity}
                              </span>
                              <span className="text-[10px] text-stone-500 font-normal">
                                {lang === "bn" ? "প্যাক" : "pack"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Right Column: Total Price with Weight Badge & Calculation Subtitle */}
                    <td className="py-2.5 pl-2 text-right align-top whitespace-nowrap">
                      <span className="block font-mono text-xs sm:text-sm md:text-base font-black text-amber-950 dark:text-amber-100 leading-tight">
                        {formatStorePrice(total, lang)}
                      </span>
                      <span className="inline-block font-mono text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40 mt-1 whitespace-nowrap">
                        {lang === "bn"
                          ? `মোট ${toBnNumber(lineWeightKg)} কেজি`
                          : `Total ${lineWeightKg} kg`}
                      </span>
                      <span className="block font-mono text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 whitespace-nowrap">
                        ({formatStorePrice(item.unitPrice, lang)} × {lang === "bn" ? toBnNumber(item.quantity) : item.quantity})
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Section: Price Breakdown & Grand Total Card */}
      <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2 text-xs sm:text-sm">
        {/* Items Subtotal */}
        <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
          <span className="font-semibold">
            {lang === "bn" ? "পণ্যের মোট মূল্য:" : "Items Subtotal:"}
          </span>
          <span className="font-mono font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base">
            {formatStorePrice(displaySubtotal, lang)}
          </span>
        </div>

        {/* Total Parcel Weight */}
        <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
          <span className="font-semibold">
            {lang === "bn" ? "মোট পার্সেল ওজন:" : "Total Parcel Weight:"}
          </span>
          <span className="font-mono font-bold text-amber-900 dark:text-amber-200 text-sm sm:text-base">
            {lang === "bn"
              ? `${toBnNumber(displayTotalWeightKg)} কেজি`
              : `${displayTotalWeightKg} kg`}
          </span>
        </div>

        {/* Delivery Charge */}
        <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
          <div className="flex items-center gap-1.5 font-semibold">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>
              {lang === "bn" ? "ডেলিভারি চার্জ:" : "Delivery Charge:"} (
              {data.destinationDistrict || (lang === "bn" ? "হোম ডেলিভারি" : "Home Delivery")})
            </span>
          </div>
          {displayShipping === 0 ? (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full text-xs border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-sans shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === "bn" ? "ফ্রি ডেলিভারি" : "Free Delivery"}</span>
            </span>
          ) : (
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm sm:text-base">
              {formatStorePrice(displayShipping, lang)}
            </span>
          )}
        </div>

        {/* Advance Paid (if any) */}
        {data.amountPaid > 0 && (
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-400 pt-1 border-t border-dashed border-stone-200 dark:border-stone-700">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {lang === "bn" ? "অগ্রিম পরিশোধিত:" : "Advance Paid:"}
            </span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
              {formatStorePrice(data.amountPaid, lang)}
            </span>
          </div>
        )}

        {/* Total Payable / COD Grand Total */}
        <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-stone-300 dark:border-stone-700 text-base sm:text-lg font-black text-amber-950 dark:text-amber-100">
          <span>
            {lang === "bn" ? "সর্বমোট প্রদেয় (ক্যাশ অন ডেলিভারি):" : "Total Payable (COD):"}
          </span>
          <span className="font-mono text-base sm:text-xl text-emerald-700 dark:text-emerald-400 font-black">
            {formatStorePrice(displayCodPayable, lang)}
          </span>
        </div>

        {/* Reassurance Callout Badge */}
        <div className="text-[11px] text-amber-900/90 dark:text-amber-300/90 text-center font-medium bg-amber-100/70 dark:bg-stone-800/80 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 mt-2 border border-amber-200/80 dark:border-stone-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {lang === "bn"
              ? "কোন অগ্রিম টাকা লাগবে না, পার্সেল হাতে পেয়ে দেখে টাকা দিন।"
              : "No advance payment required. Inspect parcel upon delivery and pay cash."}
          </span>
        </div>
      </div>
    </div>
  );
}
