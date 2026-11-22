"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  detectInAppBrowser,
  sanitizeRedirectTarget,
  buildAndroidIntentUrl,
  tryEscapeAndroidInAppBrowser,
  InAppBrowserInfo,
} from "@/lib/in-app-browser";
import { ExternalLink, Copy, Check, Compass, ArrowUpRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function OpenRedirectClient() {
  const searchParams = useSearchParams();
  const [browserInfo, setBrowserInfo] = useState<InAppBrowserInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [redirectAttempted, setRedirectAttempted] = useState(false);

  // Compute final destination URL with preserved query parameters
  const destinationUrl = useMemo(() => {
    const rawTarget = searchParams.get("url") || "/";
    const sanitized = sanitizeRedirectTarget(rawTarget, "/");

    // Reattach any additional tracking parameters passed to /open (e.g., utm_*, fbclid)
    try {
      const isRelative = sanitized.startsWith("/");
      const dummyOrigin = "https://khatikhejurgur.shop";
      const targetObj = new URL(isRelative ? `${dummyOrigin}${sanitized}` : sanitized);

      searchParams.forEach((val, key) => {
        if (key !== "url" && !targetObj.searchParams.has(key)) {
          targetObj.searchParams.set(key, val);
        }
      });

      return isRelative
        ? `${targetObj.pathname}${targetObj.search}${targetObj.hash}`
        : targetObj.toString();
    } catch {
      return sanitized;
    }
  }, [searchParams]);

  useEffect(() => {
    const info = detectInAppBrowser();
    setBrowserInfo(info);

    if (!info.isInApp) {
      // Not in an in-app browser (normal Chrome/Safari/Desktop): navigate immediately
      window.location.replace(destinationUrl);
      return;
    }

    if (info.isAndroid) {
      // On Android: attempt automatic escape to Chrome/default browser
      const dispatched = tryEscapeAndroidInAppBrowser(destinationUrl, { forceChrome: true });
      setRedirectAttempted(dispatched);
    }
  }, [destinationUrl]);

  const handleCopyLink = async () => {
    try {
      let fullUrl = destinationUrl;
      if (fullUrl.startsWith("/")) {
        fullUrl = `${window.location.origin}${fullUrl}`;
      }
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("লিংক কপি করা হয়েছে! ব্রাউজারে পেস্ট করুন।");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("লিংক কপি করতে ব্যর্থ হয়েছে।");
    }
  };

  const handleManualAndroidOpen = () => {
    const intentUrl = buildAndroidIntentUrl(destinationUrl, { forceChrome: true });
    window.location.href = intentUrl;
  };

  const handleDirectContinue = () => {
    window.location.href = destinationUrl;
  };

  // If still detecting or immediately redirecting on standard browser
  if (!browserInfo || !browserInfo.isInApp) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="w-12 h-12 rounded-full border-4 border-amber-600 border-t-transparent animate-spin" />
          <h2 className="text-stone-800 font-medium text-lg">পেজ লোড হচ্ছে...</h2>
          <p className="text-stone-500 text-sm">আপনাকে ওয়েবসাইটে নিয়ে যাওয়া হচ্ছে</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 via-white to-stone-50 text-stone-900 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Banner / Indicator */}
      <div className="w-full max-w-md mx-auto pt-2">
        <div className="flex items-center justify-between pb-4 border-b border-amber-100">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-amber-100/80 rounded-xl text-amber-800">
              <Compass className="w-5 h-5" />
            </span>
            <span className="font-semibold text-stone-800 tracking-tight text-sm">
              খাঁটি খেজুর গুড়
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            {browserInfo.browserName} এ আছেন
          </span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xs border border-stone-200/90 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-amber-500/10 rounded-2xl text-amber-800 mb-1">
              <ExternalLink className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              ব্রাউজারে ওপেন করুন
            </h1>
            <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
              দ্রুত অর্ডার, সেভ করা পাসওয়ার্ড ও পেমেন্টের সুবিধার জন্য আপনার ফোনের আসল ব্রাউজার (Chrome / Safari) ব্যবহার করুন।
            </p>
          </div>

          {browserInfo.isIOS ? (
            /* iOS Instruction Guide */
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                সহজ ২ ধাপ:
              </div>
              <div className="space-y-3 text-sm text-stone-700">
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                    ১
                  </span>
                  <p className="pt-0.5 leading-snug">
                    উপরে ডানদিকের <span className="font-bold text-stone-900">•••</span> (থ্রি-ডট) আইকনটিতে চাপ দিন।
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                    ২
                  </span>
                  <p className="pt-0.5 leading-snug">
                    <span className="font-semibold text-stone-900">&quot;Open in Safari&quot;</span> অথবা{" "}
                    <span className="font-semibold text-stone-900">&quot;Open in System Browser&quot;</span> চাপুন।
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Android Intent Card */
            <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-4 text-center space-y-3">
              <div className="text-sm font-medium text-amber-950">
                {redirectAttempted
                  ? "স্বয়ংক্রিয়ভাবে Chrome এ ওপেন না হলে নিচের বাটনে চাপ দিন"
                  : "Google Chrome বা ডিফল্ট ব্রাউজারে খুলুন"}
              </div>
              <button
                type="button"
                onClick={handleManualAndroidOpen}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <span>Chrome এ খুলুন</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 font-medium rounded-xl transition-colors flex items-center justify-center space-x-2 text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">লিংক কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-stone-600" />
                  <span>লিংক কপি করুন</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDirectContinue}
              className="w-full py-2 px-4 text-stone-500 hover:text-stone-800 text-xs font-medium transition-colors text-center block"
            >
              এই ব্রাউজারেই সরাসরি ঢুকতে চান? এখানে চাপুন &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Footer Assurance */}
      <div className="w-full max-w-md mx-auto text-center pb-2 text-xs text-stone-400 flex items-center justify-center space-x-1.5">
        <ShieldCheck className="w-4 h-4 text-stone-400" />
        <span>১০০% নিরাপদ ও সুরক্ষিত ব্রাউজিং</span>
      </div>
    </div>
  );
}
