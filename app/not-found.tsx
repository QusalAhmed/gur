import Link from "next/link";
import Image from "next/image";
import { Home, ShoppingBag, PhoneCall, Sparkles, ShieldCheck, HelpCircle } from "lucide-react";
import { StoreHeader } from "@/components/storefront/store-header";
import { getStorefrontProductsAction } from "@/actions/storefront-products";
import { getCachedSeoSettings } from "@/lib/seo-settings";

export default async function NotFound() {
  const [seo, storefrontData] = await Promise.all([
    getCachedSeoSettings().catch(() => null),
    getStorefrontProductsAction().catch(() => null),
  ]);

  const storeName = storefrontData?.storeName || seo?.storeName || "গ্রামায়ন (Gramayon)";
  const hotline = storefrontData?.hotline || seo?.supportPhone || "01843557389";
  const logoUrl = storefrontData?.logoUrl || seo?.logoUrl;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col selection:bg-amber-500 selection:text-white">
      {/* Store Header */}
      <StoreHeader
        storeName={storeName}
        logoUrl={logoUrl}
        hotline={hotline}
        showBackToHome={true}
      />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-16">
        <div className="w-full max-w-2xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Canva-Generated 404 Illustration Card */}
          <div className="relative mx-auto max-w-lg rounded-2xl sm:rounded-3xl overflow-hidden border border-amber-200/80 dark:border-amber-900/40 shadow-xl shadow-amber-950/5 dark:shadow-black/40 bg-gradient-to-b from-amber-50/50 to-white dark:from-stone-900 dark:to-stone-950 p-2 sm:p-3 group">
            <div className="relative aspect-[16/9] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-amber-100/40 dark:bg-stone-900">
              <Image
                src="/images/404-canva.png"
                alt="404 - পৃষ্ঠাটি পাওয়া যায়নি (Page Not Found)"
                fill
                priority
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 512px, 640px"
                className="object-cover transition-transform duration-500 group-hover:scale-102"
              />
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-3 px-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>৪০৪ ত্রুটি • 404 Error</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-amber-950 dark:text-amber-100 tracking-tight font-serif">
              পৃষ্ঠাটি খুঁজে পাওয়া যায়নি
            </h1>

            <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
              আপনি যে লিঙ্কটিতে প্রবেশ করেছেন তা ভুল হতে পারে অথবা পৃষ্ঠাটি মিষ্টির রাজ্যে হারিয়ে গেছে! নিচে থেকে পছন্দের জায়গায় যেতে পারেন:
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-98 text-white font-semibold text-sm shadow-md shadow-amber-900/20 transition-all"
            >
              <Home className="w-4 h-4" />
              <span>হোমে ফিরে যান</span>
            </Link>

            <Link
              href="/products"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-amber-950 dark:text-amber-200 border border-amber-200 dark:border-stone-700 font-semibold text-sm transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>সকল গুড়ের পণ্য দেখুন</span>
            </Link>

            <Link
              href="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl hover:bg-amber-50 dark:hover:bg-stone-900 text-stone-700 dark:text-stone-300 font-medium text-sm transition-all"
            >
              <HelpCircle className="w-4 h-4" />
              <span>যোগাযোগ ও সহায়তা</span>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="pt-6 sm:pt-8 border-t border-amber-100 dark:border-stone-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-stone-600 dark:text-stone-400">
            <div className="flex items-center justify-center gap-1.5 py-1">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>১০০% খাঁটি পণ্য</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-1">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>বাঘা, রাজশাহীর গুড়</span>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-1">
              <PhoneCall className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>সরাসরি ফোন সাপোর্ট</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
