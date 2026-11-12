"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Ban, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateBatchStatusAction } from "@/actions/batch-ops";
import { BatchItem } from "@/actions/inventory";

interface UpdateBatchStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: BatchItem | null;
  onSuccess?: () => void;
}

export function UpdateBatchStatusDialog({
  open,
  onOpenChange,
  batch,
  onSuccess,
}: UpdateBatchStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = React.useState<"quarantine" | "released" | "blocked" | "expired">("released");
  const [reason, setReason] = React.useState<string>("");

  React.useEffect(() => {
    if (open && batch) {
      setStatus(batch.status === "quarantine" ? "released" : batch.status);
      setReason("");
    }
  }, [open, batch]);

  if (!batch) return null;

  const handleUpdate = () => {
    startTransition(async () => {
      const res = await updateBatchStatusAction({
        batchId: batch.id,
        status,
        reason: reason.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(`Lot ${batch.batchNo} status updated to ${status}.`);
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Lot Status Workflow / ব্যাচ অনুমোদন</DialogTitle>
              <DialogDescription className="text-xs">
                Only released lots can be allocated and shipped on customer orders.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="font-mono font-bold text-foreground text-sm tracking-wider">
              {batch.batchNo}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {batch.product} · Current Status:{" "}
              <span className="font-semibold uppercase">{batch.status}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Target Status / নতুন অবস্থা</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as any)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="released" className="text-xs text-emerald-600 font-medium">
                  Released / অনুমোদিত (Eligible for orders)
                </SelectItem>
                <SelectItem value="quarantine" className="text-xs text-amber-600 font-medium">
                  Quarantine / পরীক্ষাাধীন (Pending QA test)
                </SelectItem>
                <SelectItem value="blocked" className="text-xs text-rose-600 font-medium">
                  Blocked / বাতিল (Failed QA or contaminated)
                </SelectItem>
                <SelectItem value="expired" className="text-xs text-muted-foreground font-medium">
                  Expired / মেয়াদোত্তীর্ণ
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reason / Audit Note (Optional)</Label>
            <Textarea
              placeholder="e.g. Lab tests verified Brix at 78.5% and pH at 5.4, approved for packing"
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
            onClick={handleUpdate}
            disabled={isPending || status === batch.status}
            className="text-xs gap-1.5"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Confirm Status Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
