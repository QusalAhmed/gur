"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Phone,
  MessageCircle,
  Send,
  MessageSquare,
  MapPin,
  Clock,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, toBnNumber } from "@/lib/storefront-i18n";

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
      className="h-[100dvh] max-h-[100dvh] w-full snap-start snap-always shrink-0 flex flex-col justify-between pt-3.5 sm:pt-18 pb-20 sm:pb-6 px-3 sm:px-6 md:px-12 relative overflow-y-auto sm:overflow-hidden bg-gradient-to-b from-[#fdfbf7] via-[#fcf5e8] to-[#f6ecda] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 select-none"
    >
      {/* Rustic Honeycomb / Grid Subtle Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center my-2 sm:my-3">
        {/* Title and Introduction */}
        <div className="text-center mb-3 sm:mb-4 px-2">
          <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-[#451a03] dark:text-amber-100 tracking-tight leading-tight">
            {t.contactSectionTitle}
          </h1>
        </div>

        {/* Contact Cards Grid: Phone, WhatsApp, IMO, Messenger, SMS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 px-1">
          {/* 1. Direct Phone Call (Primary - High Visibility) */}
          <div className="sm:col-span-2 bg-white/95 dark:bg-stone-850/95 border-2 border-emerald-500/80 dark:border-emerald-600/70 rounded-2xl p-2.5 sm:p-3.5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
                <Phone className="w-6 h-6 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">
                  {t.phoneCallTitle}
                </span>
                <span className="block font-mono text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 tracking-wider">
                  {hotline}
                </span>
                <span className="block text-[11px] text-stone-500 dark:text-stone-400">
                  {t.phoneCallSub}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <a
                href={`tel:${rawPhone}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm py-2 sm:py-2.5 px-4 rounded-xl shadow-md transition-all touch-manipulation"
              >
                <Phone className="w-4 h-4" />
                <span>{t.callNowBtn}</span>
              </a>

              <button
                type="button"
                onClick={handleCopyNumber}
                className="inline-flex items-center justify-center gap-1 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 text-xs font-bold py-2 sm:py-2.5 px-2.5 rounded-xl border border-stone-300 dark:border-stone-600 transition-all touch-manipulation"
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
                    <span className="hidden xs:inline text-[11px]">{t.copyNumberBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. WhatsApp Chat */}
          <a
            href={`https://wa.me/${intlPhone}?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white/90 dark:bg-stone-850/90 border-2 border-emerald-300 dark:border-emerald-700/60 hover:border-[#25D366] rounded-2xl p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-2.5 touch-manipulation"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-5 h-5 fill-current" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-[#128C7E] dark:text-[#25D366]">
                  {t.whatsappTitle}
                </span>
                <span className="block text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  {t.whatsappSub}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[11px] sm:text-xs font-bold py-1.5 px-2.5 rounded-lg shrink-0 shadow-xs group-hover:bg-[#20ba59]">
              <span>{t.whatsappChatBtn}</span>
              <ExternalLink className="w-3 h-3" />
            </span>
          </a>

          {/* 3. IMO Chat & Call */}
          <div className="bg-white/90 dark:bg-stone-850/90 border-2 border-sky-300 dark:border-sky-700/60 rounded-2xl p-2.5 sm:p-3 shadow-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 font-black text-sm">
                imo
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-sky-700 dark:text-sky-400">
                  {t.imoTitle}
                </span>
                <span className="block text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  {t.imoSub}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`imo://call?phone=${intlPhone}`}
                className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-[11px] sm:text-xs font-bold py-1.5 px-2.5 rounded-lg shadow-xs transition-all touch-manipulation"
              >
                <span>{t.imoLaunchBtn}</span>
              </a>
              <button
                type="button"
                onClick={handleCopyNumber}
                className="p-1.5 rounded-lg border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950 transition-all touch-manipulation"
                title={t.copyNumberBtn}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 4. Facebook Messenger */}
          <a
            href="https://m.me"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white/90 dark:bg-stone-850/90 border-2 border-blue-300 dark:border-blue-700/60 hover:border-blue-500 rounded-2xl p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-2.5 touch-manipulation"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                <Send className="w-4 h-4 fill-white -rotate-12" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-blue-700 dark:text-blue-400">
                  {t.messengerTitle}
                </span>
                <span className="block text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  {t.messengerSub}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] sm:text-xs font-bold py-1.5 px-2.5 rounded-lg shrink-0 shadow-xs">
              <span>{t.messengerChatBtn}</span>
              <ExternalLink className="w-3 h-3" />
            </span>
          </a>

          {/* 5. Direct SMS */}
          <a
            href={`sms:${rawPhone}?body=${smsMsg}`}
            className="group bg-white/90 dark:bg-stone-850/90 border-2 border-amber-300 dark:border-stone-700 hover:border-amber-500 rounded-2xl p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-2.5 touch-manipulation"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-amber-800 dark:text-amber-300">
                  {t.smsTitle}
                </span>
                <span className="block text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  {t.smsSub}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 bg-amber-600 text-white text-[11px] sm:text-xs font-bold py-1.5 px-2.5 rounded-lg shrink-0 shadow-xs group-hover:bg-amber-700">
              <span>{t.smsSendBtn}</span>
            </span>
          </a>
        </div>

        {/* Location & Support Schedule Pill Badges */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-stone-700 dark:text-stone-300 px-2">
          <div className="inline-flex items-center gap-1.5 bg-amber-100/70 dark:bg-stone-800/80 border border-amber-200 dark:border-stone-700 py-1 px-2.5 rounded-full">
            <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="font-semibold">{t.locationHeading}:</span>
            <span>{address}</span>
          </div>
        </div>
      </div>

      {/* Bottom Action: "View Products & Order ↓" */}
      <div className="relative z-10 w-full text-center pt-1 pb-1">
        <button
          type="button"
          onClick={handleScrollDown}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 hover:from-amber-800 hover:to-amber-800 text-white font-extrabold text-xs sm:text-sm py-2.5 px-5 sm:px-6 rounded-full shadow-lg shadow-amber-900/20 active:scale-95 transition-all touch-manipulation group"
        >
          <span>{t.viewProductsBtn}</span>
          <ChevronDown className="w-4 h-4 animate-bounce group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );
}

export default ContactSection;

