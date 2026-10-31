"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Phone,
  MessageCircle,
  MessageSquare,
  MapPin,
  Clock,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";

interface ContactSectionProps {
  lang?: StorefrontLang;
  hotline?: string;
  storeName?: string;
  address?: string;
  onScrollToProducts?: () => void;
}

export function ContactSection({
  lang = "bn",
  hotline = "01843557389",
  storeName,
  address = "বাঘা, রাজশাহী",
  onScrollToProducts,
}: ContactSectionProps) {
  const [copied, setCopied] = useState(false);
  const t = STOREFRONT_TEXT[lang];

  const rawPhone = hotline.replace(/[^0-9]/g, "");
  // International format for WhatsApp & IMO (+880 for BD)
  const intlPhone = rawPhone.startsWith("88")
    ? rawPhone
    : rawPhone.startsWith("0")
      ? `88${rawPhone}`
      : `880${rawPhone}`;

  const displayName = storeName || t.storeName;

  const handleCopyNumber = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(hotline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleScrollDown = () => {
    if (onScrollToProducts) {
      onScrollToProducts();
      return;
    }
    const productEl = document.getElementById("products") || document.querySelector("section:nth-of-type(2)");
    if (productEl) {
      productEl.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
    }
  };

  // Pre-filled greetings
  const whatsappMsg = encodeURIComponent(
    lang === "bn"
      ? "আসসালামু আলাইকুম, আমি খাঁটি গুড় কিনতে চাই এবং বিস্তারিত জানতে চাই।"
      : "Hello, I would like to order pure artisanal jaggery / know more."
  );

  const smsMsg = encodeURIComponent(
    lang === "bn"
      ? "আসসালামু আলাইকুম, আমি গুড় অর্ডার করতে চাই।"
      : "Hello, I would like to order molasses."
  );

  return (
    <section
      id="contact"
      data-section-index="0"
      className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col justify-between pt-3.5 sm:pt-14 pb-18 sm:pb-6 px-3 sm:px-6 md:px-12 relative overflow-y-auto sm:overflow-hidden bg-[#FAF8F5] dark:bg-[#141210] text-stone-900 dark:text-stone-100 select-none"
    >
      {/* Soft Ambient Warm Glow (Clean & Elegant, no noisy dots) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-gradient-to-b from-amber-200/40 via-amber-100/15 to-transparent dark:from-amber-950/25 dark:via-transparent dark:to-transparent pointer-events-none blur-3xl" />

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center my-auto py-2">
        {/* Top Heritage Pill & Title */}
        <div className="text-center mb-3 sm:mb-4 px-2 space-y-1 sm:space-y-1.5">
          <div className="inline-flex items-center gap-1.5 bg-amber-100/90 dark:bg-stone-850 border border-amber-300/80 dark:border-stone-700 px-3.5 py-1 rounded-full text-amber-950 dark:text-amber-200 text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>{displayName}</span>
            <span className="opacity-40">•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{t.authenticityBadge}</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 dark:text-stone-50 tracking-tight leading-tight pt-0.5">
            {lang === "bn" ? "সরাসরি কথা বলে নিশ্চিত অর্ডার করুন" : "Direct Phone Order & Support"}
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
            {lang === "bn"
              ? "গাছিদের সংগ্রহ করা আসল খাঁটি গুড় কিনতে নিচের যেকোনো মাধ্যমে সরাসরি কথা বলুন। কোনো অগ্রিম টাকা নেই।"
              : "Have questions or want to place an order? Call us with 1-tap. No advance payment required."}
          </p>
        </div>

        {/* Contact Cards */}
        <div className="space-y-2 sm:space-y-2.5 px-0.5">
          {/* 1. Hero Direct Calling Card */}
          <div className="bg-white dark:bg-stone-900 border-2 border-emerald-500/90 dark:border-emerald-500/70 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-lg shadow-emerald-950/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-inner">
                <Phone className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    {t.phoneCallTitle}
                  </span>
                  <span className="inline-block bg-emerald-100/90 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-1.5 py-0.2 rounded">
                    {lang === "bn" ? "হটলাইন" : "Hotline"}
                  </span>
                </div>
                <span className="block font-mono text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-50 tracking-wider leading-none mt-1">
                  {hotline}
                </span>
                <span className="block text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  {lang === "bn" ? "প্রতিদিন সকাল ৮:০০টা - রাত ১০:০০টা" : "Daily 8:00 AM - 10:00 PM"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <a
                href={`tel:${rawPhone}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm py-2.5 sm:py-3 px-5 sm:px-6 rounded-xl sm:rounded-2xl shadow-md transition-all touch-manipulation cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>{t.callNowBtn}</span>
              </a>

              <button
                type="button"
                onClick={handleCopyNumber}
                className="inline-flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-stone-700 transition-all touch-manipulation cursor-pointer"
                title={t.copyNumberBtn}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] text-emerald-600 font-bold">{t.numberCopied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="hidden xs:inline text-[11px] font-semibold">{t.copyNumberBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Secondary Channels Grid: WhatsApp, IMO, SMS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/${intlPhone}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2 touch-manipulation"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-5 h-5 fill-current" />
                </div>
                <div className="min-w-0 text-left">
                  <span className="block text-xs font-black text-stone-900 dark:text-stone-100">
                    {t.whatsappTitle}
                  </span>
                  <span className="block text-[11px] text-stone-500 dark:text-stone-400 truncate">
                    {lang === "bn" ? "মেসেজে অর্ডার" : "Chat & Order"}
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[11px] font-bold py-1 px-2.5 rounded-lg shrink-0 shadow-xs sm:w-full sm:justify-center sm:mt-1 group-hover:bg-[#20ba59]">
                <span>{t.whatsappChatBtn}</span>
                <ExternalLink className="w-3 h-3" />
              </span>
            </a>

            {/* IMO */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-sky-500 dark:hover:border-sky-500 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 font-black text-xs">
                  imo
                </div>
                <div className="min-w-0 text-left">
                  <span className="block text-xs font-black text-stone-900 dark:text-stone-100">
                    {t.imoTitle}
                  </span>
                  <span className="block text-[11px] text-stone-500 dark:text-stone-400 truncate">
                    {lang === "bn" ? "ফ্রি কল ও চ্যাট" : "Free Call & Chat"}
                  </span>
                </div>
              </div>
              <a
                href={`imo://call?phone=${intlPhone}`}
                className="inline-flex items-center justify-center gap-1 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-[11px] font-bold py-1 px-2.5 rounded-lg shadow-xs transition-all touch-manipulation sm:w-full sm:mt-1"
              >
                <span>{t.imoLaunchBtn}</span>
              </a>
            </div>

            {/* SMS */}
            <a
              href={`sms:${rawPhone}?body=${smsMsg}`}
              className="group bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-amber-500 dark:hover:border-amber-500 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2 touch-manipulation"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0 text-left">
                  <span className="block text-xs font-black text-stone-900 dark:text-stone-100">
                    {t.smsTitle}
                  </span>
                  <span className="block text-[11px] text-stone-500 dark:text-stone-400 truncate">
                    {lang === "bn" ? "অফলাইন বার্তা" : "Offline SMS"}
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center justify-center gap-1 bg-amber-600 text-white text-[11px] font-bold py-1 px-2.5 rounded-lg shrink-0 shadow-xs sm:w-full sm:justify-center sm:mt-1 group-hover:bg-amber-700">
                <span>{t.smsSendBtn}</span>
              </span>
            </a>
          </div>

          {/* Reassurance Trust Pill Row */}
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-stone-600 dark:text-stone-300">
            <div className="inline-flex items-center gap-1 bg-stone-100/90 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 py-1 px-2.5 rounded-full text-[11px] sm:text-xs font-medium">
              <MapPin className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>{address}</span>
            </div>
            <div className="inline-flex items-center gap-1 bg-stone-100/90 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 py-1 px-2.5 rounded-full text-[11px] sm:text-xs font-medium">
              <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{lang === "bn" ? "ক্যাশ অন ডেলিভারি" : "Cash on Delivery"}</span>
            </div>
            <div className="inline-flex items-center gap-1 bg-stone-100/90 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 py-1 px-2.5 rounded-full text-[11px] sm:text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t.guaranteeBadge}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action: "View Products & Order" */}
      <div className="relative z-10 w-full text-center pt-2 pb-2">
        <button
          type="button"
          onClick={handleScrollDown}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 hover:from-amber-800 hover:to-amber-800 text-white font-extrabold text-xs sm:text-sm py-2.5 sm:py-3 px-6 sm:px-8 rounded-full shadow-lg shadow-amber-900/15 active:scale-95 transition-all touch-manipulation group cursor-pointer"
        >
          <span>{t.viewProductsBtn}</span>
          <ChevronDown className="w-4 h-4 animate-bounce group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );
}

export default ContactSection;
