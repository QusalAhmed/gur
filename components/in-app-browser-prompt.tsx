"use client";

import React, { useEffect, useState } from "react";
import {
  detectInAppBrowser,
  buildAndroidIntentUrl,
  InAppBrowserInfo,
} from "@/lib/in-app-browser";
import { ExternalLink, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface InAppBrowserPromptProps {
  /**
   * If true, on Android devices inside Facebook/Instagram, it will attempt
   * automatic breakout on initial page load (default: false).
   */
  autoEscapeAndroid?: boolean;
}

export function InAppBrowserPrompt({ autoEscapeAndroid = false }: InAppBrowserPromptProps) {
  const [info, setInfo] = useState<InAppBrowserInfo | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    try {
      if (sessionStorage.getItem("gur_iab_prompt_dismissed") === "1") {
        return;
      }
    } catch {}

    const detected = detectInAppBrowser();
    if (!detected.isInApp) return;

    setInfo(detected);
    setDismissed(false);

    if (autoEscapeAndroid && detected.isAndroid) {
      const intentUrl = buildAndroidIntentUrl(window.location.href, { forceChrome: true });
      window.location.href = intentUrl;
    }
  }, [autoEscapeAndroid]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("gur_iab_prompt_dismissed", "1");
    } catch {}
  };

  const handleAndroidOpen = () => {
    if (typeof window === "undefined") return;
    const intentUrl = buildAndroidIntentUrl(window.location.href, { forceChrome: true });
    window.location.href = intentUrl;
  };

  const handleCopyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("লিংক কপি হয়েছে!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("লিংক কপি করা যায়নি।");
    }
  };

  if (!info || dismissed || !info.isInApp) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Browser switch banner"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="bg-stone-900/95 text-stone-100 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-stone-800 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <ExternalLink className="w-4 h-4" />
            </span>
            <div className="text-xs font-semibold text-stone-100">
              {info.browserName} এ আছেন
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close banner"
            className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stone-300 leading-snug">
          {info.isIOS ? (
            <>
              দ্রুত ব্রাউজিং ও পেমেন্টের সুবিধার জন্য উপরে ডানদিকের <span className="text-amber-400 font-bold">•••</span> চেপে <span className="font-semibold text-white">&quot;Open in Safari&quot;</span> সিলেক্ট করুন।
            </>
          ) : (
            <>
              অর্ডার ও ব্রাউজিং আরও দ্রুত করতে <span className="text-amber-400 font-semibold">Chrome</span> বা আসল ব্রাউজারে খুলুন।
            </>
          )}
        </p>

        <div className="flex items-center gap-2 pt-0.5">
          {info.isAndroid && (
            <button
              type="button"
              onClick={handleAndroidOpen}
              className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Chrome এ খুলুন</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-1 py-1.5 px-3 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-200 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">কপি হয়েছে</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-stone-400" />
                <span>লিংক কপি করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
