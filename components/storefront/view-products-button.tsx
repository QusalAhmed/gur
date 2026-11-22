"use client";

import React from "react";
import { ChevronDown, ShoppingBag } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT } from "@/lib/storefront-i18n";

export interface ViewProductsButtonProps {
  onClick: () => void;
  lang?: StorefrontLang;
  label?: string;
  className?: string;
  size?: "default" | "compact";
  ariaLabel?: string;
}

/**
 * Artisanal "View Products & Order" CTA button
 * Grounded warm-earthen styling with tactile feedback and clean contrast.
 */
export function ViewProductsButton({
  onClick,
  lang = "bn",
  label,
  className = "",
  size = "default",
  ariaLabel,
}: ViewProductsButtonProps) {
  const t = STOREFRONT_TEXT[lang] || STOREFRONT_TEXT.bn;
  const displayLabel = label || t.viewProductsBtn;
  const defaultAriaLabel =
    lang === "bn" ? "পণ্য দেখুন ও অর্ডার করুন" : "View products and order";

  const sizeClasses =
    size === "compact"
      ? "py-2.5 px-5 text-sm"
      : "py-3.5 px-7 text-base";

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || defaultAriaLabel}
        className={`inline-flex items-center justify-center gap-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-semibold tracking-normal shadow-sm hover:shadow transition-colors duration-150 ease-out touch-manipulation cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 ${sizeClasses}`}
      >
        <ShoppingBag className="w-4 h-4 text-amber-200 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">{displayLabel}</span>
        <ChevronDown
          className="w-4 h-4 text-amber-200 shrink-0 transition-transform duration-150 group-hover:translate-y-0.5"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

export default ViewProductsButton;
