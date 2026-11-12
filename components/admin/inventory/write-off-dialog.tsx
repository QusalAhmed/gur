"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Loader2, AlertOctagon } from "lucide-react";
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
import { writeOffStockAction } from "@/actions/inventory-ops";
import { InventoryItem } from "@/actions/inventory";

interface WriteOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  onSuccess?: () => void;
}

export function WriteOffDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: WriteOffDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [quantity, setQuantity] = React.useState<string>("");
  const [reason, setReason] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setQuantity("");
      setReason("");
    }
  }, [open]);

  if (!item) return null;

  const handleWriteOff = () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid write-off quantity greater than zero.");
      return;
    }
    if (qty > item.onHand) {
      toast.error(`Cannot write off ${qty} units. Current on-hand is ${item.onHand}.`);
      return;
    }
    if (!reason.trim()) {
      toast.error("A detailed reason is strictly required to write off stock.");
      return;
    }

    startTransition(async () => {
      const res = await writeOffStockAction({
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        quantity: qty,
        reason: reason.trim(),
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(`Successfully written off ${qty} units of ${item.variant}.`);
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertOctagon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Write Off Stock / নষ্ট স্টক বাতিল</DialogTitle>
              <DialogDescription className="text-xs">
                Permanently decrement inventory for breakage, leakage, crystallization, or lab rejection.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="rounded-lg border bg-destructive/5 border-destructive/20 p-3 space-y-1">
            <div className="font-semibold text-foreground text-sm">{item.variant}</div>
            <div className="text-[11px] text-muted-foreground font-mono">
              SKU: {item.sku} · On Hand: {item.onHand} {item.uom || "units"}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Write-Off Quantity / বাতিলের পরিমাণ <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min="0.01"
              max={item.onHand}
              step="any"
              placeholder={`Max: ${item.onHand}`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Reason / বাতিলের সুনির্দিষ্ট কারণ <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="e.g. 2 glass jars cracked during transit from Jashore, molasses leaked"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
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
            variant="destructive"
            size="sm"
            onClick={handleWriteOff}
            disabled={isPending || !quantity || !reason.trim()}
            className="text-xs gap-1.5"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Confirm Write-Off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
