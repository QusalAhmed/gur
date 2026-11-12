import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  UserCheck,
  Server,
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { StoreHeader } from "@/components/storefront/store-header";
import { getStorefrontProductsAction } from "@/actions/storefront-products";
import { buildBreadcrumbJsonLd, getCachedSeoSettings } from "@/lib/seo-settings";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoSettings();
  const title = seo.privacyTitle;
  const description = seo.privacyDescription;
  const ogImages = seo.ogImageUrl
    ? [{ url: seo.ogImageUrl, width: 1200, height: 630, alt: title }]
    : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: "/privacy-policy",
    },
    openGraph: {
      title,
      description,
      url: `${seo.siteUrl}/privacy-policy`,
      type: "website",
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: ogImages ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImages ? { images: [seo.ogImageUrl] } : {}),
    },
  };
}

export default async function PrivacyPolicyPage() {
  const [seo, storefrontData] = await Promise.all([
    getCachedSeoSettings(),
    getStorefrontProductsAction().catch(() => ({
      hotline: "01843557389",
      storeName: "খেজুরের খাঁটি গুড়",
      storeSubtitle: "আমার নিজের বাসায় তৈরী খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়",
      products: [],
    })),
  ]);

  const hotline = storefrontData.hotline || seo.supportPhone || "01843557389";
  const storeName = storefrontData.storeName || seo.storeName || "খেজুরের খাঁটি গুড়";
  const rawPhone = hotline.replace(/[^0-9]/g, "");
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(seo.siteUrl, [
    { name: "হোম", path: "/" },
    { name: "গোপনীয়তা নীতি", path: "/privacy-policy" },
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#FAF8F5] via-[#FFFDF9] to-[#F5EEDB] dark:from-[#141210] dark:via-[#181512] dark:to-[#1e1711] text-stone-900 dark:text-stone-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* Top Header */}
      <StoreHeader storeName={storeName} hotline={hotline} />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>গ্রাহক তথ্যের সর্বোচ্চ সুরক্ষা ও গোপনীয়তা</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-amber-950 dark:text-amber-100 tracking-tight leading-tight">
            গোপনীয়তা নীতি (Privacy Policy)
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-normal">
            &quot;{storeName}&quot; এ আপনার গোপনীয়তা ও ব্যক্তিগত তথ্যের সুরক্ষা নিশ্চিত করতে আমরা প্রতিশ্রুতিবদ্ধ। আমাদের ওয়েবসাইট ব্যবহারের মাধ্যমে আপনার তথ্য কীভাবে সংগৃহীত, ব্যবহৃত ও সুরক্ষিত রাখা হয় তা নিচে বিস্তারিত তুলে ধরা হলো।
          </p>

          <div className="pt-1 text-[11px] text-stone-500 dark:text-stone-400">
            সর্বশেষ পরিমার্জন: নভেম্বর ২০২৬
          </div>
        </div>

        {/* Quick Trust Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                তথ্য বিক্রি করা হয় না
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                কোনো তৃতীয় পক্ষের কাছে তথ্য শেয়ার নয়
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                নিরাপদ ক্যাশ অন ডেলিভারি
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                কোনো কার্ড বা ব্যাংক তথ্য চাওয়া হয় না
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                গ্রাহকের তথ্যের নিয়ন্ত্রণ
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                যেকোনো সময় তথ্য মোছার অনুরোধের সুযোগ
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Policy Content Sections */}
        <div className="space-y-6 sm:space-y-8 bg-white dark:bg-stone-900/90 p-6 sm:p-10 rounded-3xl border border-amber-200/80 dark:border-stone-800 shadow-xs">
          {/* Section 1 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-stone-800 text-amber-900 dark:text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                ১
              </span>
              <span>ভূমিকা ও আমাদের মূল অঙ্গীকার</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed pl-8">
              &quot;{storeName}&quot; শুধুমাত্র খাঁটি ও নির্ভেজাল খেজুরের গুড় সরবরাহের জন্যই নয়, বরং গ্রাহকদের সাথে একটি বিশ্বস্ত ও স্থায়ী সম্পর্কের অঙ্গীকার করে। আমরা আপনার ব্যক্তিগত তথ্যের গোপনীয়তাকে অত্যন্ত গুরুত্বের সাথে দেখি এবং তা নিরাপদে রক্ষা করার সর্বাত্মক ব্যবস্থা গ্রহণ করি।
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-stone-800 text-amber-900 dark:text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                ২
              </span>
              <span>কী কী তথ্য আমরা সংগ্রহ করি</span>
            </h2>
            <div className="pl-8 space-y-2.5 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              <p>অর্ডার প্রক্রিয়াকরণ এবং উন্নত সেবা প্রদানের জন্য আমরা সীমিত কিছু তথ্য সংগ্রহ করি:</p>
              <ul className="space-y-2 list-disc list-inside text-stone-700 dark:text-stone-300">
                <li>
                  <strong className="text-stone-900 dark:text-stone-100">যোগাযোগ ও ডেলিভারি তথ্য:</strong> আপনার নাম, মোবাইল ফোন নম্বর, সম্পূর্ণ ডেলিভারি ঠিকানা (জেলা, থানা, এলাকা ও বাড়ি/রোড)।
                </li>
                <li>
                  <strong className="text-stone-900 dark:text-stone-100">অর্ডারের বিবরণ:</strong> নির্বাচিত পণ্যের নাম, পরিমাণ, ও অর্ডারের তারিখ।
                </li>
                <li>
                  <strong className="text-stone-900 dark:text-stone-100">প্রযুক্তিগত তথ্য ও মেটা পিক্সেল:</strong> সাইটের কার্যকারিতা পরীক্ষা এবং প্রাসঙ্গিক বিজ্ঞাপন প্রদর্শনের জন্য আইপি অ্যাড্রেস, ব্রাউজার ও ডিভাইসের ধরন এবং ফেসবুক মেটা পিক্সেল ইভেন্ট ডেটা (যেমন: পেজভিউ, কার্ট আপডেট)।
                </li>
              </ul>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-stone-800/60 border border-amber-200/80 dark:border-stone-700 text-amber-900 dark:text-amber-200 text-xs">
                <strong>গুরুত্বপূর্ণ:</strong> আমরা কোনো ধরনের ক্রেডিট কার্ড, ডেবিট কার্ড, ব্যাংক একাউন্ট নম্বর বা বিকাশ/নগদ পিন নম্বর সংগ্রহ কিংবা সংরক্ষণ করি না। আমাদের সকল লেনদেন সম্পূর্ণ ক্যাশ অন ডেলিভারি (COD)।
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-stone-800 text-amber-900 dark:text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                ৩
              </span>
              <span>সংগৃহীত তথ্যের ব্যবহার</span>
            </h2>
            <div className="pl-8 space-y-2 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              <p>সংগৃহীত তথ্য কেবল নিচের নির্দিষ্ট উদ্দেশ্যগুলোতে ব্যবহৃত হয়:</p>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>অর্ডার চূড়ান্ত করা ও পার্সেল প্রস্তুতকরণ।</li>
                <li>কুরিয়ার সার্ভিসের মাধ্যমে আপনার ঠিকানায় পণ্য পৌঁছে দেওয়া।</li>
                <li>ফোনে কল বা এসএমএসের মাধ্যমে ডেলিভারি সংক্রান্ত আপডেট জানানো।</li>
                <li>অর্ডার সংক্রান্ত কোনো সমস্যায় দ্রুত গ্রাহক সেবা প্রদান করা।</li>
                <li>প্রতারণামূলক বা ফেক অর্ডার শনাক্ত ও প্রতিরোধ করা।</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-stone-800 text-amber-900 dark:text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                ৪
              </span>
              <span>তৃতীয় পক্ষের সাথে তথ্য শেয়ারিং ও কুরিয়ার পার্টনার</span>
            </h2>
            <div className="pl-8 space-y-2 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              <p>
                আমরা কোনো অবস্থাতেই আপনার ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রয়, ভাড়া বা অপব্যবহার করি না। তবে ডেলিভারি কার্যক্রম সম্পাদনের স্বার্থে শুধুমাত্র অনুমোদিত কুরিয়ার সার্ভিস (যেমন: Steadfast Courier, Pathao Courier) এর সাথে আপনার নাম, মোবাইল নম্বর ও ডেলিভারি ঠিকানা শেয়ার করা হয়।
              </p>
              <p>
                এছাড়াও বিজ্ঞাপনের মানোন্নয়নের জন্য মেটা (Facebook) প্ল্যাটফর্মের সিকিউর কনভার্সন এপিআই (CAPI) এর সাথে স্ট্যান্ডার্ড ই-কমার্স ইভেন্ট ডেটা সংরক্ষিত উপায়ে পরিমাপ করা হয়।
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-stone-800 text-amber-900 dark:text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                ৫
              </span>
              <span>তথ্যের নিরাপত্তা ব্যবস্থা</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed pl-8">
              আপনার তথ্যের সুরক্ষায় আমাদের ওয়েবসাইট স্ট্যান্ডার্ড SSL (Secure Sockets Layer) এনক্রিপশন প্রযুক্তির মাধ্যমে সুরক্ষিত। আপনার জমা দেওয়া সকল তথ্য এনক্রিপ্টেড ডাটাবেজে অত্যন্ত নিরাপদে সংরক্ষিত থাকে যা অননুমোদিত অ্যাক্সেস থেকে সুরক্ষিত।
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-stone-800 text-amber-900 dark:text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                ৬
              </span>
              <span>গ্রাহকের অধিকার</span>
            </h2>
            <div className="pl-8 space-y-1.5 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              <p>গ্রাহক হিসেবে আপনার অধিকার রয়েছে:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>আমাদের কাছে আপনার সংরক্ষিত তথ্য সম্পর্কে জানার।</li>
                <li>যেকোনো ভুল বা পরিবর্তিত তথ্য সংশোধন বা আপডেট করার।</li>
                <li>আমাদের ডাটাবেজ থেকে আপনার তথ্য স্থায়ীভাবে মুছে ফেলার অনুরোধ জানানোর।</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pt-2">
            <h2 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-stone-800 text-amber-900 dark:text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                ৭
              </span>
              <span>গোপনীয়তা বিষয়ক যোগাযোগ ও অভিযোগ</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed pl-8">
              আমাদের এই গোপনীয়তা নীতি বা আপনার ব্যক্তিগত তথ্যের ব্যবস্থাপনা সম্পর্কে যেকোনো প্রশ্ন, মতামত বা তথ্য মোছার অনুরোধের জন্য সরাসরি যোগাযোগ করুন:
            </p>
            <div className="pl-8 pt-1 flex flex-wrap items-center gap-3">
              <a
                href={`tel:${rawPhone}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 dark:bg-stone-800 hover:bg-amber-200 text-amber-950 dark:text-amber-200 font-bold text-xs sm:text-sm transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>হটলাইন: {hotline}</span>
              </a>

              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-2xs"
              >
                <span>যোগাযোগ পাতা</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        </div>

        {/* Back to Products / Shop Callout */}
        <div className="p-6 rounded-3xl bg-amber-100/70 dark:bg-stone-900/80 border border-amber-300/60 dark:border-stone-800 text-center space-y-3">
          <h3 className="font-extrabold text-base sm:text-lg text-amber-950 dark:text-amber-100">
            খাঁটি খেজুরের গুড় কিনতে প্রস্তুত?
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            গ্রামের গাছিদের তৈরি আসল নির্ভেজাল পাটালি ও ঝোলা গুড়ের সেরা কালেকশন দেখুন এবং ক্যাশ অন ডেলিভারিতে অর্ডার করুন।
          </p>
          <div className="pt-1">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 hover:from-amber-800 hover:to-amber-800 text-white font-bold text-xs sm:text-sm py-2.5 px-6 rounded-full shadow-md transition-all"
            >
              <span>পণ্যসমূহ দেখুন ও অর্ডার করুন</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
