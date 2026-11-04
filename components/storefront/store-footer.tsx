"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  ShieldCheck,
  Truck,
  Sparkles,
  ArrowRight,
  Heart,
  ExternalLink,
  FileText,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";

interface StoreFooterProps {
  lang?: StorefrontLang;
  hotline?: string;
  storeName?: string;
  storeSubtitle?: string;
  address?: string;
  compact?: boolean;
}

export function StoreFooter({
  lang = "bn",
  hotline = "01843557389",
  storeName = "খেজুরের খাঁটি গুড়",
  storeSubtitle,
  address = "বাঘা, রাজশাহী",
  compact = false,
}: StoreFooterProps) {
  const t = STOREFRONT_TEXT[lang];
  const rawPhone = hotline.replace(/[^0-9]/g, "");
  const [currentYear, setCurrentYear] = useState<number>(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const intlPhone = rawPhone.startsWith("88")
    ? rawPhone
    : rawPhone.startsWith("0")
      ? `88${rawPhone}`
      : `880${rawPhone}`;

  const displayName = storeName || t.storeName;

  return (
    <footer className="w-full bg-gradient-to-b from-[#2A1810] via-[#1F120B] to-[#140A06] text-amber-100/90 border-t border-amber-900/40 relative z-20 overflow-hidden select-none">
      {/* Decorative top accent glow */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Trust Badges Strip */}
      <div className="border-b border-amber-900/40 bg-black/20 py-4 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-center sm:text-left">
          <div className="flex items-center gap-2.5 justify-center sm:justify-start">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs sm:text-sm font-bold text-amber-200">
                {lang === "bn" ? "১০০% খাঁটি ও নির্ভেজাল" : "100% Pure & Authentic"}
              </h4>
              <p className="text-[11px] text-amber-200/60 hidden sm:block">
                {lang === "bn" ? "চিনি ও হাইড্রোজ মুক্ত" : "Zero sugar or chemicals"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 justify-center sm:justify-start">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs sm:text-sm font-bold text-amber-200">
                {lang === "bn" ? "সারাদেশে ডেলিভারি" : "Nationwide Delivery"}
              </h4>
              <p className="text-[11px] text-amber-200/60 hidden sm:block">
                {lang === "bn" ? "৬৪ জেলায় কুরিয়ার সার্ভিস" : "Direct to all 64 districts"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 justify-center sm:justify-start">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs sm:text-sm font-bold text-amber-200">
                {lang === "bn" ? "ক্যাশ অন ডেলিভারি" : "Cash on Delivery"}
              </h4>
              <p className="text-[11px] text-amber-200/60 hidden sm:block">
                {lang === "bn" ? "দেখে মূল্য পরিশোধ" : "Inspect before paying"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 justify-center sm:justify-start">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs sm:text-sm font-bold text-amber-200">
                {lang === "bn" ? "সরাসরি ফোন সহায়তা" : "Direct Hotline"}
              </h4>
              <p className="text-[11px] text-amber-200/60 hidden sm:block">
                {lang === "bn" ? "সকাল ৮টা - রাত ১০টা" : "8:00 AM - 10:00 PM"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-amber-950 flex items-center justify-center font-black shadow-md shrink-0">
                <Sparkles className="w-5 h-5 text-amber-950" />
              </div>
              <span className="font-black text-lg text-amber-100 tracking-tight">
                {displayName}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-amber-200/70 leading-relaxed">
              {lang === "bn"
                ? "বাঘা, রাজশাহীর ঐতিহ্যবাহী অভিজ্ঞ গাছিদের ভোরবেলার তাজা রস দিয়ে কাঠখড়ির মৃদু জ্বালে তৈরি ১০০% খাঁটি, প্রাকৃতিক ও নির্ভেজাল খেজুরের গুড়।"
                : "Pure artisanal date palm jaggery, tapped by generational village artisans at dawn and patiently boiled over clay hearths in Bagha, Rajshahi."}
            </p>

            <div className="pt-1 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                {lang === "bn"
                  ? "শতভাগ নির্ভেজাল নিশ্চয়তা ও সহজ রিটার্ন"
                  : "100% Purity Guarantee & Easy Return"}
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-amber-200 uppercase tracking-wider">
              {lang === "bn" ? "প্রয়োজনীয় লিংক" : "Quick Links"}
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link
                  href="/"
                  className="text-amber-200/70 hover:text-amber-100 hover:translate-x-1 inline-flex items-center gap-1.5 transition-all"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                  <span>{lang === "bn" ? "হোমপেইজ" : "Home"}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/products"
                  className="text-amber-200/70 hover:text-amber-100 hover:translate-x-1 inline-flex items-center gap-1.5 transition-all"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                  <span>{lang === "bn" ? "সকল পণ্য ও অর্ডার" : "All Products & Order"}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-amber-200/70 hover:text-amber-100 hover:translate-x-1 inline-flex items-center gap-1.5 transition-all font-medium text-amber-300"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === "bn" ? "যোগাযোগ ও সহায়তা" : "Contact & Support"}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-amber-200/70 hover:text-amber-100 hover:translate-x-1 inline-flex items-center gap-1.5 transition-all font-medium text-amber-300"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === "bn" ? "গোপনীয়তা নীতি (Privacy Policy)" : "Privacy Policy"}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Care & Ordering */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-amber-200 uppercase tracking-wider">
              {lang === "bn" ? "গ্রাহক সেবা ও অর্ডার" : "Customer Care"}
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-amber-200/75">
              <li className="flex items-start gap-2">
                <Truck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <span>
                  {lang === "bn"
                    ? "ঢাকার ভেতরে ৭০ টাকা, বাইরে ১৩০ টাকা কুরিয়ার ডেলিভারি"
                    : "Courier delivery ৳70 inside Dhaka, ৳130 outside Dhaka"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <span>
                  {lang === "bn"
                    ? "ডেলিভারি সময়: ২ থেকে ৩ কার্যদিবস"
                    : "Delivery time: 2 to 3 business days"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  {lang === "bn"
                    ? "অগ্রিম কোনো টাকা দিতে হবে না, পণ্য হাতে পেয়ে দেখে টাকা দিন"
                    : "Zero advance payment. Inspect and pay COD"}
                </span>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Channels */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-amber-200 uppercase tracking-wider">
              {lang === "bn" ? "সরাসরি যোগাযোগ" : "Direct Contact"}
            </h3>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <a
                href={`tel:${rawPhone}`}
                className="flex items-center gap-2.5 text-amber-100 hover:text-white group p-2 rounded-lg bg-amber-950/40 border border-amber-900/60 hover:border-amber-700/80 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div>
                  <span className="block text-[10px] text-amber-300/70 uppercase font-semibold">
                    {lang === "bn" ? "হটলাইন নম্বর" : "Hotline"}
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {hotline}
                  </span>
                </div>
              </a>

              <a
                href={`https://wa.me/${intlPhone}?text=${encodeURIComponent(
                  lang === "bn"
                    ? "আসসালামু আলাইকুম, আমি খাঁটি খেজুরের গুড় অর্ডার করতে চাই।"
                    : "Hello, I want to order pure date palm molasses."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-amber-100 hover:text-white group p-2 rounded-lg bg-amber-950/40 border border-amber-900/60 hover:border-[#25D366]/40 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-[#25D366]/20 text-[#25D366] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="block text-[10px] text-amber-300/70 uppercase font-semibold">
                    WhatsApp
                  </span>
                  <span className="font-semibold text-stone-200">
                    {lang === "bn" ? "মেসেজ পাঠান" : "Chat with us"}
                  </span>
                </div>
              </a>

              <div className="flex items-start gap-2 text-xs text-amber-200/70 pt-1">
                <MapPin className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <span>{address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Policy Links */}
        <div className="mt-8 pt-6 border-t border-amber-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-200/60">
          <p className="text-center sm:text-left">
            © {currentYear} {displayName}। {lang === "bn" ? "সর্বস্বত্ব সংরক্ষিত।" : "All rights reserved."}
          </p>

          <div className="flex items-center flex-wrap justify-center gap-4 text-xs font-medium">
            <Link
              href="/"
              className="hover:text-amber-200 transition-colors"
            >
              {lang === "bn" ? "হোম" : "Home"}
            </Link>
            <span className="text-amber-800">•</span>
            <Link
              href="/contact"
              className="hover:text-amber-200 transition-colors"
            >
              {lang === "bn" ? "যোগাযোগ" : "Contact"}
            </Link>
            <span className="text-amber-800">•</span>
            <Link
              href="/privacy-policy"
              className="hover:text-amber-200 transition-colors"
            >
              {lang === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy"}
            </Link>
          </div>

          <p className="text-[11px] text-amber-300/50 flex items-center gap-1">
            <span>{lang === "bn" ? "ঐতিহ্যবাহী বাঘা, রাজশাহী থেকে প্রস্তুত" : "Crafted in Bagha, Rajshahi"}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default StoreFooter;

