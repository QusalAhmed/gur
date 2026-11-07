"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  required?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function ConfirmReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel = "Reason / কারণ",
  reasonPlaceholder = "Please provide the reason for this action...",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  required = true,
  onConfirm,
}: ConfirmReasonDialogProps) {
  const [reason, setReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (required && !reason.trim()) {
      setError("Please provide a reason before proceeding.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Failed to complete action.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            {variant === "destructive" && <AlertTriangle className="h-5 w-5 shrink-0" />}
            <DialogTitle className="text-foreground">{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-1 text-sm">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="action-reason" className="text-xs font-medium">
            {reasonLabel} {required && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="action-reason"
            rows={3}
            placeholder={reasonPlaceholder}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            className="text-sm resize-none"
            disabled={isSubmitting}
          />
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant}
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting || (required && !reason.trim())}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
