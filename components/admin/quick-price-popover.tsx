"use client";

import * as React from "react";
import Link from "next/link";
import { Edit2, Loader2, Tag, Check, AlertCircle, ArrowUpRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Taka } from "@/components/ui/taka";
import { cn } from "@/lib/utils";

export interface QuickPricePopoverProps {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  currentPrice: number;
  currentCompareAtPrice?: number | null;
  hasPriceTiers?: boolean;
  onSave: (payload: {
    variantId: string;
    price: number;
    compareAtPrice?: number | null;
  }) => Promise<void>;
  isLoading?: boolean;
  children?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function QuickPricePopover({
  variantId,
  productId,
  productName,
  variantName,
  currentPrice,
  currentCompareAtPrice,
  hasPriceTiers,
  onSave,
  isLoading = false,
  children,
  align = "end",
  side = "bottom",
  className,
}: QuickPricePopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [price, setPrice] = React.useState<string>(String(currentPrice));
  const [compareAtPrice, setCompareAtPrice] = React.useState<string>(
    currentCompareAtPrice ? String(currentCompareAtPrice) : ""
  );
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const priceInputRef = React.useRef<HTMLInputElement>(null);

  // Sync state whenever popover opens or prop values change
  React.useEffect(() => {
    if (open) {
      setPrice(String(currentPrice));
      setCompareAtPrice(currentCompareAtPrice ? String(currentCompareAtPrice) : "");
      setValidationError(null);
      // Autofocus price input after opening
      setTimeout(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      }, 50);
    }
  }, [open, currentPrice, currentCompareAtPrice]);

  const numPrice = parseFloat(price);
  const numCompare = compareAtPrice.trim() !== "" ? parseFloat(compareAtPrice) : null;

  // Real-time discount calculation
  const hasDiscount =
    !isNaN(numPrice) &&
    numCompare !== null &&
    !isNaN(numCompare) &&
    numCompare > numPrice &&
    numPrice > 0;

  const discountAmount = hasDiscount && numCompare !== null ? numCompare - numPrice : 0;
  const discountPercent =
    hasDiscount && numCompare !== null ? Math.round((discountAmount / numCompare) * 100) : 0;

  const isInvalidCompare =
    !isNaN(numPrice) &&
    numCompare !== null &&
    !isNaN(numCompare) &&
    numCompare <= numPrice &&
    numCompare > 0;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);

    if (isNaN(numPrice) || numPrice < 0) {
      setValidationError("Please enter a valid price (>= 0).");
      return;
    }

    if (isInvalidCompare) {
      setValidationError("Original strike-through price must be strictly greater than selling price.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        variantId,
        price: numPrice,
        compareAtPrice: numCompare && numCompare > numPrice ? numCompare : null,
      });
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update price";
      setValidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const activeLoading = isLoading || isSubmitting;
  const hasExistingDiscount =
    Boolean(currentCompareAtPrice) && Number(currentCompareAtPrice) > currentPrice;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ? (
          children
        ) : (
          <button
            type="button"
            className={cn(
              "group/price inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-all",
              "hover:bg-amber-500/10 hover:ring-1 hover:ring-amber-500/30 dark:hover:bg-amber-500/15",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
              className
            )}
            title={`Quick edit price for ${variantName}`}
          >
            <div className="flex items-center gap-1.5 tabular-nums">
              <span className="font-bold text-foreground group-hover/price:text-amber-700 dark:group-hover/price:text-amber-400 transition-colors inline-flex items-center">
                <Taka className="text-foreground group-hover/price:text-amber-700 dark:group-hover/price:text-amber-400" />
                <span>{currentPrice.toLocaleString()}</span>
              </span>
              {hasExistingDiscount && (
                <span className="text-[11px] text-muted-foreground line-through inline-flex items-center">
                  <Taka size="xs" weight="medium" className="opacity-70" />
                  <span>{currentCompareAtPrice!.toLocaleString()}</span>
                </span>
              )}
            </div>
            <Edit2 className="h-3 w-3 text-muted-foreground/50 group-hover/price:text-amber-600 group-hover/price:opacity-100 transition-all opacity-0 group-hover/price:scale-105" />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        className="w-80 p-3.5 shadow-xl border border-border/80 bg-background/95 backdrop-blur-md rounded-xl z-50 text-foreground"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Tag className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">Quick Price Change</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {productName} • <span className="font-medium text-foreground/80">{variantName}</span>
              </p>
            </div>
            {hasDiscount && (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0.2 shrink-0 font-semibold"
              >
                {discountPercent}% OFF
              </Badge>
            )}
          </div>

          {/* Price Inputs */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor={`price-${variantId}`} className="text-[11px] font-medium text-foreground flex items-center justify-between">
                <span>Selling Price</span>
                <span className="text-[10px] text-muted-foreground font-normal">BDT</span>
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground">
                  <Taka size="sm" weight="medium" className="text-foreground/70" />
                </span>
                <Input
                  ref={priceInputRef}
                  id={`price-${variantId}`}
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setValidationError(null);
                  }}
                  disabled={activeLoading}
                  placeholder="0"
                  className="pl-6 h-8 text-xs font-semibold tabular-nums rounded-lg border-border/70 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`compare-${variantId}`} className="text-[11px] font-medium text-foreground flex items-center justify-between">
                <span>Strike-through</span>
                <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground">
                  <Taka size="sm" weight="medium" className="text-foreground/70" />
                </span>
                <Input
                  id={`compare-${variantId}`}
                  type="number"
                  min="0"
                  step="1"
                  value={compareAtPrice}
                  onChange={(e) => {
                    setCompareAtPrice(e.target.value);
                    setValidationError(null);
                  }}
                  disabled={activeLoading}
                  placeholder="e.g. 600"
                  className={cn(
                    "pl-6 h-8 text-xs tabular-nums rounded-lg border-border/70 focus-visible:ring-amber-500",
                    isInvalidCompare && "border-rose-500 focus-visible:ring-rose-500 text-rose-600"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Validation or Calculation Feedback */}
          {validationError && (
            <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] leading-tight">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {isInvalidCompare && !validationError && (
            <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] leading-tight">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Strike-through price must exceed <Taka size="xs" />{numPrice || 0}.</span>
            </div>
          )}

          {hasDiscount && !isInvalidCompare && !validationError && (
            <div className="flex items-center justify-between px-2 py-1 bg-muted/40 rounded-md text-[11px]">
              <span className="text-muted-foreground">Customer Saves:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums inline-flex items-center">
                <Taka size="xs" weight="bold" className="text-emerald-600 dark:text-emerald-400 mr-0.5" />
                <span>{discountAmount.toLocaleString()} ({discountPercent}% discount)</span>
              </span>
            </div>
          )}

          {/* Wholesale tiers notice */}
          {hasPriceTiers && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/20 px-2 py-1 rounded border border-border/50">
              <span>Has wholesale volume tiers</span>
              <Link
                href="/admin/products/price-tiers"
                target="_blank"
                className="text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5 font-medium"
              >
                View tiers <ArrowUpRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
            <span className="text-[10px] text-muted-foreground">
              Press <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[9px]">Enter ↵</kbd> to save
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={activeLoading}
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={activeLoading || isInvalidCompare}
                className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-xs"
              >
                {activeLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" /> Save Price
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
