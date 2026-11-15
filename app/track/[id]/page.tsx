import React, { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, PackageX, Sparkles, Phone, ShoppingBag } from "lucide-react";
import { getParcelTrackingAction } from "@/actions/tracking";
import { ParcelTrackingView } from "@/components/storefront/tracking/parcel-tracking-view";

export const instant = false;

const HOTLINE_NUMBER = "01843557389";

interface TrackPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TrackPageProps): Promise<Metadata> {
  void params;
  return {
    title: `পার্সেল ট্র্যাকিং • খেজুরের খাঁটি গুড়`,
    description: `আপনার খেজুরের গুড়ের পার্সেল ট্র্যাকিং ও ডেলিভারি স্ট্যাটাস চেক করুন।`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

function TrackSkeleton() {
  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 flex flex-col justify-between p-4 sm:p-8 select-none">
      <div className="fixed inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] -z-10" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-4xl mx-auto w-full flex items-center justify-between pb-4 border-b border-amber-200/80 dark:border-stone-800">
        <div className="h-4 w-28 bg-amber-200/60 dark:bg-stone-700/60 rounded animate-pulse" />
        <div className="h-6 w-32 bg-amber-200/60 dark:bg-stone-700/60 rounded-full animate-pulse" />
      </header>

      {/* Main Skeleton */}
      <div className="relative z-10 max-w-4xl mx-auto w-full my-6 space-y-6">
        {/* Hero Card Skeleton */}
        <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border border-amber-200/90 dark:border-stone-800 p-6 sm:p-7 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-200/60 dark:bg-stone-700/60 animate-pulse shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-28 bg-amber-200/50 dark:bg-stone-700/50 rounded-full animate-pulse" />
              <div className="h-6 w-64 bg-amber-200/60 dark:bg-stone-700/60 rounded-md animate-pulse" />
            </div>
          </div>
          <div className="h-14 bg-amber-100/50 dark:bg-stone-800/50 rounded-2xl animate-pulse" />
          <div className="h-10 bg-amber-100/40 dark:bg-stone-800/40 rounded-xl animate-pulse" />
        </div>

        {/* 2-Column Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-7 space-y-5">
            <div className="h-48 bg-white/90 dark:bg-stone-900/90 rounded-3xl border border-amber-200/90 dark:border-stone-800 animate-pulse p-6" />
            <div className="h-40 bg-white/90 dark:bg-stone-900/90 rounded-3xl border border-amber-200/90 dark:border-stone-800 animate-pulse p-6" />
          </div>
          <div className="lg:col-span-5 space-y-5">
            <div className="h-32 bg-white/90 dark:bg-stone-900/90 rounded-3xl border border-amber-200/90 dark:border-stone-800 animate-pulse p-6" />
            <div className="h-40 bg-white/90 dark:bg-stone-900/90 rounded-3xl border border-amber-200/90 dark:border-stone-800 animate-pulse p-6" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-4xl mx-auto w-full text-center pt-4 border-t border-amber-200/80 dark:border-stone-800 text-[11px] text-stone-500">
        © 2026 খেজুরের খাঁটি গুড় • ঐতিহ্যবাহী নির্ভেজাল গুড়ের বিশ্বস্ত ঠিকানা
      </footer>
    </main>
  );
}

async function TrackContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = await paramsPromise;
  const trackingResult = await getParcelTrackingAction(id);

  if (!trackingResult.success || !trackingResult.data) {
    return (
      <main className="min-h-screen w-full bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 flex flex-col justify-between p-4 sm:p-8 select-none">
        {/* Background Texture */}
        <div className="fixed inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] -z-10" />

        {/* Header */}
        <header className="relative z-10 max-w-2xl mx-auto w-full flex items-center justify-between pb-4 border-b border-amber-200/80 dark:border-stone-800">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-950 dark:text-amber-300 font-bold hover:text-amber-700 transition-colors text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>দোকানে ফিরে যান</span>
          </Link>

          <div className="flex items-center gap-1.5 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-700/60 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-950 dark:text-amber-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>খাঁটি খেজুরের গুড়</span>
          </div>
        </header>

        {/* Not Found Body Card */}
        <div className="relative z-10 max-w-md mx-auto w-full my-auto py-8">
          <div className="bg-white/95 dark:bg-stone-900/90 backdrop-blur-xl rounded-3xl border border-amber-200/90 dark:border-stone-800 shadow-2xl shadow-amber-950/10 p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-400 flex items-center justify-center mx-auto shadow-md ring-8 ring-amber-50 dark:ring-amber-900/20">
              <PackageX className="w-8 h-8 stroke-[2]" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-100 tracking-tight">
                পার্সেল খুঁজে পাওয়া যায়নি
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                আপনার দেওয়া ট্র্যাকিং লিংকটি সঠিক নয় অথবা মেয়াদোত্তীর্ণ হয়েছে। অনুগ্রহ করে আপনার এসএমএস (SMS) চেক করুন অথবা আমাদের হেল্পলাইনে যোগাযোগ করুন।
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <a
                href={`tel:${HOTLINE_NUMBER}`}
                className="w-full inline-flex items-center justify-center gap-2 bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl shadow-md transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>সরাসরি হেল্পলাইনে কল করুন ({HOTLINE_NUMBER})</span>
              </a>

              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 bg-amber-100/80 hover:bg-amber-200/80 text-amber-950 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition-colors border border-amber-300/80 dark:border-stone-700"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>দোকানে ফিরে যান</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 max-w-2xl mx-auto w-full text-center pt-4 border-t border-amber-200/80 dark:border-stone-800 text-[11px] text-stone-500">
          © 2026 খেজুরের খাঁটি গুড় • ঐতিহ্যবাহী নির্ভেজাল গুড়ের বিশ্বস্ত ঠিকানা
        </footer>
      </main>
    );
  }

  return <ParcelTrackingView initialData={trackingResult.data} />;
}

export default function ParcelTrackPage({ params }: TrackPageProps) {
  return (
    <Suspense fallback={<TrackSkeleton />}>
      <TrackContent paramsPromise={params} />
    </Suspense>
  );
}
