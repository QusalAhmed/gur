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
        return "py-2 px-3 rounded-lg text-xs font-medium";
      case "icon":
        return "p-2 rounded-lg text-xs font-medium";
      case "pill":
        return "py-1.5 px-3 rounded-md text-xs font-medium";
      case "default":
      default:
        return "py-2.5 px-3 sm:px-4 rounded-xl text-xs font-medium";
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      title={defaultLabel}
      className={`relative inline-flex items-center justify-center gap-1.5 border transition-colors duration-150 touch-manipulation cursor-pointer select-none ${getVariantStyles()} ${
        copied
          ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs"
          : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700"
      } ${className}`}
    >
      {/* Floating Animated Popover Tooltip */}
      {showFloatingTooltip && (
        <AnimatePresence>
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: -40 }}
              exit={{ opacity: 0, y: -44 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute -top-1 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap"
            >
              <div className="bg-stone-900 text-stone-50 text-[11px] font-medium py-1 px-2.5 rounded-md flex items-center gap-1.5 border border-stone-700 shadow-md">
                <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                <span>{tooltipText}</span>
              </div>
              <div className="w-2 h-2 bg-stone-900 rotate-45 mx-auto -mt-1" />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Morphing Icon and Text Transition */}
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
            {variant !== "icon" && (
              <span className="text-[11px]">{defaultCopiedLabel}</span>
            )}
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            {variant !== "icon" && (
              <span className="text-[11px]">{defaultLabel}</span>
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
    </button>
  );
}

export default CopyPhoneButton;
