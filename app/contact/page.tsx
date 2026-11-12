import type { Metadata } from "next";
import Link from "next/link";
import {
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  Sparkles,
  ShieldCheck,
  Truck,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Send,
  MessageCircle,
} from "lucide-react";
import { StoreHeader } from "@/components/storefront/store-header";
import { PhoneHelpForm } from "@/components/storefront/phone-help-form";
import { CopyPhoneButton } from "@/components/storefront/copy-phone-button";
import { getStorefrontProductsAction } from "@/actions/storefront-products";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildPageSeoMetadata,
  getCachedSeoSettings,
} from "@/lib/seo-settings";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoSettings();
  const title = seo.contactTitle;
  const description = seo.contactDescription;

  return buildPageSeoMetadata(seo, {
    title,
    ogTitle: title,
    description,
    canonicalPath: "/contact",
    url: `${seo.siteUrl}/contact`,
  });
}

export default async function ContactPage() {
  const [seo, storefrontData] = await Promise.all([
    getCachedSeoSettings(),
    getStorefrontProductsAction().catch(() => ({
      hotline: "",
      storeName: "",
      storeSubtitle: "",
      products: [],
    })),
  ]);

  const hotline = storefrontData.hotline || seo.supportPhone || "01843557389";
  const storeName = storefrontData.storeName || seo.storeName || "খেজুরের খাঁটি গুড়";
  const rawPhone = hotline.replace(/[^0-9]/g, "");

  const contactFaqs = [
    {
      question: "আমি কীভাবে নিশ্চিত হব যে গুড় খাঁটি?",
      answer:
        "আমাদের গুড় সরাসরি বাঘা, রাজশাহীর বিশ্বস্ত গাছিদের দ্বারা রস সংগ্রহ করে কোনো ধরনের চিনি, হাইড্রোজ বা কৃত্রিম রং না মিশিয়ে তৈরি। ডেলিভারিম্যান পার্সেল নিয়ে এলে আপনি নিজে দেখে, ঘ্রাণ নিয়ে ও স্বাদ পরীক্ষা করে শতভাগ নিশ্চিত হয়ে মূল্য পরিশোধ করতে পারবেন।",
    },
    {
      question: "ডেলিভারি পেতে কতদিন সময় লাগবে?",
      answer:
        "ঢাকার ভেতরের ঠিকানায় সাধারণত ১ থেকে ২ দিনের মধ্যে এবং ঢাকার বাইরের জেলাগুলোতে ২ থেকে ৩ দিনের মধ্যে কুরিয়ারের মাধ্যমে সুরক্ষিতভাবে হোম ডেলিভারি পৌঁছে দেওয়া হয়।",
    },
    {
      question: "অগ্রিম কোনো টাকা দিতে হবে কি?",
      answer:
        "না, কোনো ধরনের অগ্রিম পেমেন্টের প্রয়োজন নেই। আমাদের প্রতিটি অর্ডারে ক্যাশ অন ডেলিভারি (Cash on Delivery) সুবিধা রয়েছে। পণ্য হাতে পেয়ে সম্পূর্ণ দেখে মূল্য পরিশোধ করবেন।",
    },
    {
      question: "পাইকারি বা বড় অর্ডারের সুবিধা আছে কি?",
      answer: `হ্যাঁ, বিয়ে, পারিবারিক অনুষ্ঠান বা ব্যবসায়িক উদ্দেশ্যে বড় পরিমাণে খাঁটি ঝোলা বা পাটালি গুড়ের জন্য আমাদের হটলাইন নম্বরে (${hotline}) সরাসরি কল করে বিশেষ পাইকারি মূল্য জেনে নিতে পারেন।`,
    },
  ];
  const faqJsonLd = buildFaqPageJsonLd(contactFaqs);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(seo.siteUrl, [
    { name: "হোম", path: "/" },
    { name: "যোগাযোগ", path: "/contact" },
  ]);

  const intlPhone = rawPhone.startsWith("88")
    ? rawPhone
    : rawPhone.startsWith("0")
      ? `88${rawPhone}`
      : `880${rawPhone}`;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#FAF8F5] via-[#FFFDF9] to-[#F5EEDB] dark:from-[#141210] dark:via-[#181512] dark:to-[#1e1711] text-stone-900 dark:text-stone-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* Top Header */}
      <StoreHeader storeName={storeName} hotline={hotline} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 space-y-10 sm:space-y-14">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-200/80 dark:bg-stone-800 text-amber-900 dark:text-amber-200 text-xs font-bold border border-amber-300 dark:border-stone-700 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>২৪/৭ গ্রাহক সেবা ও সরাসরি অর্ডার</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-amber-950 dark:text-amber-100 tracking-tight leading-tight">
            আমাদের সাথে যোগাযোগ করুন
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-normal">
            বাঘা, রাজশাহীর ঐতিহ্যবাহী তাজা খেজুরের গুড় কিনতে বা যেকোনো তথ্যে নিচের যেকোনো মাধ্যমে সরাসরি কথা বলুন। কোনো অনলাইন ঝামেলা ছাড়াই অর্ডার করতে পারেন।
          </p>
        </div>

        {/* 4-Grid of Direct Contact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* 1. Direct Phone Call */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900/90 border-2 border-emerald-500/30 hover:border-emerald-500 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold shadow-xs">
                <Phone className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  সরাসরি ফোন কল
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  ১-ট্যাপে সরাসরি কথা বলে দ্রুত অর্ডার নিশ্চিত করুন
                </p>
              </div>
              <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base">
                {hotline}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <a
                href={`tel:${rawPhone}`}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-2.5 px-3 rounded-xl shadow-sm transition-all"
              >
                <Phone className="w-4 h-4" />
                <span>এখনই কল করুন</span>
              </a>
              <CopyPhoneButton phone={hotline} lang="bn" variant="compact" />
            </div>
          </div>

          {/* 2. WhatsApp Chat */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900/90 border-2 border-amber-300/60 dark:border-stone-800 hover:border-[#25D366] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center font-bold shadow-xs">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  WhatsApp চ্যাট
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  গুড়ের ছবি ও ভিডিও দেখতে বা টেক্সট মেসেজে অর্ডার করতে
                </p>
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                সহজ চ্যাটিং সুবিধা
              </div>
            </div>

            <a
              href={`https://wa.me/${intlPhone}?text=${encodeURIComponent(
                "আসসালামু আলাইকুম, আমি খাঁটি খেজুরের গুড় কিনতে চাই।"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp মেসেজ</span>
            </a>
          </div>

          {/* 3. Facebook Messenger */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900/90 border-2 border-amber-300/60 dark:border-stone-800 hover:border-[#0084FF] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#0084FF]/15 text-[#0084FF] flex items-center justify-center font-bold shadow-xs">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  Facebook মেসেঞ্জার
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  ফেসবুক পেজে ইনবক্স করে বিস্তারিত জানুন
                </p>
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                ইনবক্সে সার্বক্ষণিক সহায়তা
              </div>
            </div>

            <a
              href={process.env.NEXT_PUBLIC_MESSENGER_URL || "https://m.me/"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 bg-[#0084FF] hover:bg-[#0072db] text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>মেসেঞ্জারে চ্যাট</span>
            </a>
          </div>

          {/* 4. SMS Booking */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900/90 border-2 border-amber-300/60 dark:border-stone-800 hover:border-amber-600 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  মোবাইল SMS
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  ইন্টারনেট সংযোগ না থাকলেও সরাসরি এসএমএস পাঠিয়ে অর্ডার করুন
                </p>
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                অফলাইন এসএমএস সুবিধা
              </div>
            </div>

            <a
              href={`sms:${rawPhone}?body=${encodeURIComponent(
                "নাম: \nঠিকানা: \nগুড়ের পরিমাণ: "
              )}`}
              className="mt-4 inline-flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all"
            >
              <Send className="w-4 h-4" />
              <span>এসএমএস পাঠান</span>
            </a>
          </div>
        </div>

        {/* Origin & Production Hub Info Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-100/90 via-amber-50 to-amber-100/90 dark:from-stone-900 dark:via-stone-900 dark:to-stone-850 border border-amber-300/70 dark:border-stone-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">
                উৎপাদন ও সংগ্রহ কেন্দ্র
              </span>
              <h2 className="text-lg sm:text-xl font-black text-amber-950 dark:text-amber-100">
                বাঘা, রাজশাহী (ঐতিহ্যবাহী খাঁটি খেজুরের গুড়ের অঞ্চল)
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-xl">
                শত বছরের ঐতিহ্যবাহী বাঘার গাছিদের নিজ হাতে সংগ্রহ করা নির্ভেজাল রস থেকে খাঁটি গুড় উৎপাদন ও প্রস্তুত করে সরাসরি সারাদেশে গ্রাহকের দ্বারে সরবরাহ করা হয়।
              </p>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-white/80 dark:bg-stone-800/80 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-stone-700">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>প্রতিদিন সকাল ৮:০০ - রাত ১০:০০</span>
            </div>
            <Link
              href="/products"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs sm:text-sm py-2.5 px-5 rounded-xl shadow-sm transition-all"
            >
              <span>পণ্য দেখুন ও অর্ডার করুন</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Callback Help Form Section */}
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-100">
              অনলাইনে অর্ডার করতে সমস্যা? শুধু নম্বর দিন!
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
              নিচে আপনার মোবাইল নম্বর লিখে দিন, আমাদের প্রতিনিধি আপনাকে সরাসরি কল করে অর্ডার লিখে নিবেন।
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <PhoneHelpForm
              lang="bn"
              hotline={hotline}
              storeName={storeName}
            />
          </div>
        </div>

        {/* Frequently Asked Questions (FAQ) Section */}
        <div className="space-y-6 pt-4 border-t border-amber-300/60 dark:border-stone-800">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
              <HelpCircle className="w-4 h-4" />
              <span>সাধারণ প্রশ্নোত্তর</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-100">
              সচরাচর জিজ্ঞাসিত প্রশ্ন
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 space-y-2">
              <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>আমি কীভাবে নিশ্চিত হব যে গুড় খাঁটি?</span>
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                আমাদের গুড় সরাসরি বাঘা, রাজশাহীর বিশ্বস্ত গাছিদের দ্বারা রস সংগ্রহ করে কোনো ধরনের চিনি, হাইড্রোজ বা কৃত্রিম রং না মিশিয়ে তৈরি। ডেলিভারিম্যান পার্সেল নিয়ে এলে আপনি নিজে দেখে, ঘ্রাণ নিয়ে ও স্বাদ পরীক্ষা করে শতভাগ নিশ্চিত হয়ে মূল্য পরিশোধ করতে পারবেন।
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 space-y-2">
              <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ডেলিভারি পেতে কতদিন সময় লাগবে?</span>
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                ঢাকার ভেতরের ঠিকানায় সাধারণত ১ থেকে ২ দিনের মধ্যে এবং ঢাকার বাইরের জেলাগুলোতে ২ থেকে ৩ দিনের মধ্যে কুরিয়ারের মাধ্যমে সুরক্ষিতভাবে হোম ডেলিভারি পৌঁছে দেওয়া হয়।
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 space-y-2">
              <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>অগ্রিম কোনো টাকা দিতে হবে কি?</span>
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                না, কোনো ধরনের অগ্রিম পেমেন্টের প্রয়োজন নেই। আমাদের প্রতিটি অর্ডারে ক্যাশ অন ডেলিভারি (Cash on Delivery) সুবিধা রয়েছে। পণ্য হাতে পেয়ে সম্পূর্ণ দেখে মূল্য পরিশোধ করবেন।
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 space-y-2">
              <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>পাইকারি বা বড় অর্ডারের সুবিধা আছে কি?</span>
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                হ্যাঁ, বিয়ে, পারিবারিক অনুষ্ঠান বা ব্যবসায়িক উদ্দেশ্যে বড় পরিমাণে খাঁটি ঝোলা বা পাটালি গুড়ের জন্য আমাদের হটলাইন নম্বরে ({hotline}) সরাসরি কল করে বিশেষ পাইকারি মূল্য জেনে নিতে পারেন।
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
