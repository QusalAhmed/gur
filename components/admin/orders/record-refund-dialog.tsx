"use client";

import * as React from "react";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordRefundAction } from "@/actions/payment-ops";
import { formatBDT } from "@/lib/admin-format";

interface RecordRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  amountPaid: number;
}

export function RecordRefundDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  amountPaid,
}: RecordRefundDialogProps) {
  const [amount, setAmount] = React.useState(amountPaid);
  const [reason, setReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAmount(amountPaid);
      setReason("");
    }
  }, [open, amountPaid]);

  const handleSubmit = async () => {
    if (amount <= 0 || amount > amountPaid) {
      toast.error(`Refund amount must be between ৳1 and ${formatBDT(amountPaid)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await recordRefundAction({
        orderId,
        amount,
        reason: reason.trim() || undefined,
      });

      if (res.ok) {
        toast.success(`Refund of ${formatBDT(amount)} recorded!`);
        onOpenChange(false);
      } else {
        toast.error(res.message || "Failed to record refund");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Issue Refund · {orderNumber}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Total paid by customer: <span className="font-mono font-semibold text-foreground">{formatBDT(amountPaid)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">Refund Amount / রিফান্ড পরিমাণ (৳)</Label>
            <Input
              type="number"
              min={1}
              max={amountPaid}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="h-8 text-sm font-mono font-semibold"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reason for Refund / কারণ</Label>
            <Textarea
              placeholder="e.g. Return of damaged jar, cancelled order refund"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || amount <= 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm Refund"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
