"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Copy,
  Check,
  Phone,
  MessageSquare,
  ShoppingBag,
  ArrowLeft,
  Truck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";

function OrderConfirmedContent() {
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);

  const orderNumber = searchParams.get("orderNumber") || "GUR-ORDER";
  const grandTotal = Number(searchParams.get("total")) || 0;
  const customerName = searchParams.get("name") || "সম্মানিত গ্রাহক";
  const customerPhone = searchParams.get("phone") || "";
  const deliveryZone = searchParams.get("zone") || "inside_dhaka";
  const hotline = "01843557389";
  const rawHotline = hotline.replace(/[^0-9]/g, "");

  const handleCopyOrderNumber = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `আসসালামু আলাইকুম, আমি খাঁটি গুড় অর্ডার করেছি। আমার অর্ডার নম্বর: ${orderNumber}`
  );

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 flex flex-col justify-between p-4 sm:p-8 select-none">
      {/* Background Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-xl mx-auto w-full flex items-center justify-between pb-4 border-b border-amber-200/80 dark:border-stone-800">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold hover:text-amber-700 transition-colors text-xs sm:text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>দোকানে ফিরে যান</span>
        </Link>

        <div className="flex items-center gap-1.5 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-700/60 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-950 dark:text-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span>খাঁটি খেজুরের গুড়</span>
        </div>
      </header>

      {/* Center Receipt Card */}
      <div className="relative z-10 max-w-xl mx-auto w-full my-auto py-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border border-amber-200/90 dark:border-stone-800 shadow-2xl shadow-amber-950/10 p-5 sm:p-8 text-center space-y-5"
        >
          {/* Animated Success Badge */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg ring-8 ring-emerald-50 dark:ring-emerald-900/30">
              <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.5]" />
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-3xl font-black text-amber-950 dark:text-amber-100 tracking-tight leading-tight flex items-center justify-center gap-2">
              <span>ধন্যবাদ! আপনার অর্ডারটি গ্রহণ করা হয়েছে</span>
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400 shrink-0" />
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-1.5 max-w-md mx-auto leading-relaxed">
              প্রিয় <span className="font-bold text-stone-900 dark:text-stone-100">{customerName}</span>, আমাদের প্রতিনিধি অল্প কিছুক্ষণের মধ্যেই আপনার নম্বরে (<span className="font-mono font-bold">{customerPhone}</span>) কল করে ডেলিভারি ও ঠিকানা নিশ্চিত করবেন।
            </p>
          </div>

          {/* Order Details Receipt Box */}
          <div className="bg-amber-50/70 dark:bg-stone-800/60 rounded-2xl border border-amber-200/80 dark:border-stone-700/80 p-4 text-left space-y-2.5">
            {/* Order Number Row */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-amber-200/60 dark:border-stone-700/60">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                অর্ডার নম্বর:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                  {orderNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopyOrderNumber}
                  className="p-1 rounded-lg hover:bg-amber-200/60 dark:hover:bg-stone-700 transition-colors text-amber-900 dark:text-amber-300 cursor-pointer"
                  title="অর্ডার নম্বর কপি করুন"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Delivery Area */}
            <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                <span>ডেলিভারি এলাকা:</span>
              </span>
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                {deliveryZone === "inside_dhaka" ? "ঢাকার ভিতরে (হোম ডেলিভারি)" : "ঢাকার বাইরে (কুরিয়ার হোম ডেলিভারি)"}
              </span>
            </div>

            {/* Total Payable COD */}
            <div className="flex items-center justify-between pt-2 border-t border-dashed border-amber-300/80 dark:border-stone-700">
              <div>
                <span className="block text-xs font-bold text-stone-700 dark:text-stone-300 leading-tight">
                  ক্যাশ অন ডেলিভারি মোট প্রদেয়:
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  পণ্য হাতে পেয়ে দেখে টাকা দিন
                </span>
              </div>
              <span className="font-mono font-black text-lg sm:text-xl text-emerald-700 dark:text-emerald-400">
                {formatStorePrice(grandTotal, "bn")}
              </span>
            </div>
          </div>

          {/* Cash on Delivery Reassurance Notice */}
          <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800 rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>কোন অগ্রিম টাকা দেওয়া লাগবে না। পার্সেল খুলে পরীক্ষা করার পর ডেলিভারিম্যানকে টাকা দিন।</span>
          </div>

          {/* Quick Direct Communication Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <a
              href={`tel:${rawHotline}`}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm"
            >
              <Phone className="w-4 h-4" />
              <span>সরাসরি ফোনে কথা বলুন</span>
            </a>

            <a
              href={`https://wa.me/88${rawHotline}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs sm:text-sm"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp চ্যাট করুন</span>
            </a>
          </div>

          {/* Return to Shop Button */}
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold text-xs sm:text-sm transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>আরও গুড় দেখতে দোকানে ফিরে যান</span>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-xl mx-auto w-full text-center pt-4 border-t border-amber-200/80 dark:border-stone-800 text-[11px] text-stone-500">
        © {new Date().getFullYear()} খেজুরের খাঁটি গুড় • ঐতিহ্যবাহী নির্ভেজাল গুড়ের বিশ্বস্ত ঠিকানা
      </footer>
    </main>
  );
}

export default function OrderConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#fdfbf7] dark:bg-stone-950">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-stone-600 dark:text-stone-300">
              অর্ডার তথ্য লোড হচ্ছে...
            </p>
          </div>
        </div>
      }
    >
      <OrderConfirmedContent />
    </Suspense>
  );
}

