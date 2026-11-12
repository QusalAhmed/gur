"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { SlidersHorizontal, Loader2, Check } from "lucide-react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjustStockAction } from "@/actions/inventory-ops";
import { InventoryItem } from "@/actions/inventory";

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  onSuccess?: () => void;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: AdjustStockDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = React.useState<"delta" | "target">("delta");
  const [deltaValue, setDeltaValue] = React.useState<string>("");
  const [targetValue, setTargetValue] = React.useState<string>("");
  const [reason, setReason] = React.useState<string>("");

  React.useEffect(() => {
    if (open && item) {
      setMode("delta");
      setDeltaValue("");
      setTargetValue(String(item.onHand));
      setReason("");
    }
  }, [open, item]);

  if (!item) return null;

  const calculatedDelta =
    mode === "delta"
      ? Number(deltaValue) || 0
      : (Number(targetValue) || 0) - item.onHand;

  const resultingOnHand = item.onHand + calculatedDelta;

  const handleAdjust = () => {
    if (calculatedDelta === 0) {
      toast.error("Please enter a non-zero adjustment.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is strictly required for stock adjustment.");
      return;
    }

    startTransition(async () => {
      const res = await adjustStockAction({
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        quantityDelta: calculatedDelta,
        reason: reason.trim(),
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(
        `Adjusted ${item.variant} by ${calculatedDelta > 0 ? `+${calculatedDelta}` : calculatedDelta}. New stock: ${resultingOnHand}`
      );
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Stock Adjustment / স্টক সমন্বয়</DialogTitle>
              <DialogDescription className="text-xs">
                Log an audit correction to reconcile ledger with physical counts.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-foreground text-sm">{item.variant}</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  SKU: {item.sku} · Warehouse: {item.warehouse}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center text-xs">
              <div>
                <span className="text-muted-foreground text-[10px] block">Current On Hand</span>
                <span className="font-semibold">{item.onHand}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] block">Reserved</span>
                <span className="font-semibold">{item.reserved}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] block">Available</span>
                <span className="font-semibold">{item.available}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Adjustment Method</Label>
              <div className="flex rounded-md border p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setMode("delta")}
                  className={`px-2.5 py-0.5 rounded-xs transition-colors ${
                    mode === "delta" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  By Delta (+/-)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("target")}
                  className={`px-2.5 py-0.5 rounded-xs transition-colors ${
                    mode === "target" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  New Count
                </button>
              </div>
            </div>

            {mode === "delta" ? (
              <div className="space-y-1">
                <Label className="text-xs">Quantity Delta (e.g. +5 or -3)</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. +5 or -3"
                  value={deltaValue}
                  onChange={(e) => setDeltaValue(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">New Physical Count</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 45"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}

            {calculatedDelta !== 0 && (
              <div className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-xs">
                <span>Resulting On-Hand:</span>
                <span className="font-semibold">
                  {resultingOnHand} ({calculatedDelta > 0 ? `+${calculatedDelta}` : calculatedDelta})
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Reason / কারণ <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="e.g. Monthly physical inventory count variance, batch consolidation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAdjust}
            disabled={isPending || calculatedDelta === 0 || !reason.trim()}
            className="text-xs gap-1.5"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Confirm Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
