"use client";

import * as React from "react";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordPaymentAction } from "@/actions/payment-ops";
import { formatBDT } from "@/lib/admin-format";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  balanceDue: number;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  balanceDue,
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = React.useState(balanceDue > 0 ? balanceDue : 0);
  const [method, setMethod] = React.useState<"cash" | "bkash" | "nagad" | "rocket" | "card" | "bank_transfer">("cash");
  const [transactionId, setTransactionId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAmount(balanceDue > 0 ? balanceDue : 0);
      setTransactionId("");
      setNotes("");
    }
  }, [open, balanceDue]);

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await recordPaymentAction({
        orderId,
        amount,
        method,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.ok) {
        toast.success(`Payment of ${formatBDT(amount)} recorded successfully!`);
        onOpenChange(false);
      } else {
        toast.error(res.message || "Failed to record payment");
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
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Record Payment · {orderNumber}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Outstanding balance: <span className="font-mono font-semibold text-foreground">{formatBDT(balanceDue)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">Amount / টাকার পরিমাণ (৳)</Label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="h-8 text-sm font-mono font-semibold"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Payment Method / মাধ্যম</Label>
            <Select value={method} onValueChange={(val: any) => setMethod(val)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash" className="text-xs">Cash on Delivery / Walk-in Cash</SelectItem>
                <SelectItem value="bkash" className="text-xs">bKash Manual / MFS</SelectItem>
                <SelectItem value="nagad" className="text-xs">Nagad Manual</SelectItem>
                <SelectItem value="rocket" className="text-xs">Rocket Manual</SelectItem>
                <SelectItem value="bank_transfer" className="text-xs">Bank Transfer / EFT</SelectItem>
                <SelectItem value="card" className="text-xs">Card / POS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Trx ID / Bank Reference (Optional)</Label>
            <Input
              placeholder="e.g. 9J28A7DF..."
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes / মন্তব্য (Optional)</Label>
            <Input
              placeholder="e.g. Paid at store counter"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSubmit}
            disabled={isSubmitting || amount <= 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Confirm Payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
