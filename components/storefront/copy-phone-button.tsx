"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { StorefrontLang } from "@/lib/storefront-i18n";

export interface CopyPhoneButtonProps {
  phone: string;
  lang?: StorefrontLang;
  label?: string;
  copiedLabel?: string;
  variant?: "default" | "compact" | "icon" | "pill";
  showFloatingTooltip?: boolean;
  className?: string;
  onCopy?: () => void;
}

export function CopyPhoneButton({
  phone,
  lang = "bn",
  label,
  copiedLabel,
  variant = "default",
  showFloatingTooltip = true,
  className = "",
  onCopy,
}: CopyPhoneButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const defaultLabel = label ?? (lang === "bn" ? "নম্বর কপি করুন" : "Copy Number");
  const defaultCopiedLabel = copiedLabel ?? (lang === "bn" ? "নম্বর কপি হয়েছে!" : "Number Copied!");
  const tooltipText = lang === "bn" ? "নম্বরটি কপি হয়েছে!" : "Phone copied!";
  const ariaLabel = copied
    ? lang === "bn"
      ? "হটলাইন নম্বর কপি হয়েছে"
      : "Phone number copied"
    : lang === "bn"
      ? "হটলাইন নম্বর কপি করুন"
      : "Copy phone number";

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(phone);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setCopied(true);
      toast.success(
        lang === "bn"
          ? `হটলাইন নম্বর কপি হয়েছে: ${phone}`
          : `Phone number copied: ${phone}`,
        { duration: 2500 }
      );

      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2200);

      if (onCopy) {
        try {
          onCopy();
        } catch (cbErr) {
          console.error("Error in onCopy callback:", cbErr);
        }
      }
    } catch {
      toast.error(
        lang === "bn"
          ? "নম্বর কপি করা সম্ভব হয়নি"
          : "Could not copy phone number"
      );
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "compact":
        return "py-2 px-3 rounded-xl text-xs";
      case "icon":
        return "p-2.5 rounded-xl text-xs";
      case "pill":
        return "py-1.5 px-3.5 rounded-full text-xs";
      case "default":
      default:
        return "py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs font-bold";
    }
  };

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.93 }}
      onClick={handleCopy}
      aria-label={ariaLabel}
      title={defaultLabel}
      className={`relative inline-flex items-center justify-center gap-1.5 border transition-all duration-200 touch-manipulation cursor-pointer select-none ${getVariantStyles()} ${
        copied
          ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-500/70 dark:border-emerald-500/60 shadow-sm ring-2 ring-emerald-500/25"
          : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700"
      } ${className}`}
    >
      {/* Animated Ripple Pulse Ring */}
      {copied && (
        <motion.span
          initial={{ scale: 0.85, opacity: 0.85 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 rounded-[inherit] border-2 border-emerald-500 dark:border-emerald-400 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Floating Animated Popover Tooltip */}
      {showFloatingTooltip && (
        <AnimatePresence>
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: -44, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              className="absolute -top-1 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap drop-shadow-lg"
            >
              <div className="bg-stone-900/95 dark:bg-stone-100 text-stone-50 dark:text-stone-900 text-[11px] font-bold py-1 px-3 rounded-full flex items-center gap-1.5 border border-emerald-500/40 backdrop-blur-xs">
                <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600 stroke-[2.5]" />
                <span>{tooltipText}</span>
              </div>
              <div className="w-2 h-2 bg-stone-900/95 dark:bg-stone-100 rotate-45 mx-auto -mt-1" />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Morphing Icon and Text Transition */}
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
            animate={{ scale: [0.5, 1.25, 1], rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 20 }}
            className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold"
          >
            <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            {variant !== "icon" && (
              <span className="text-[11px]">{defaultCopiedLabel}</span>
            )}
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1.5"
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            {variant !== "icon" && (
              <span className="hidden xs:inline text-[11px] font-semibold">
                {defaultLabel}
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>

      <span className="sr-only" aria-live="polite">
        {copied
          ? lang === "bn"
            ? "হটলাইন নম্বর ক্লিপবোর্ডে কপি হয়েছে"
            : "Hotline number copied to clipboard"
          : ""}
      </span>
    </motion.button>
  );
}

export default CopyPhoneButton;
