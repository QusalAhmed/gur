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
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import type { Order } from "@/types/order";

export interface SteadfastFailureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  errorMessage: string;
  fieldErrors?: Record<string, string[]>;
  onForceProcess: () => void;
  onFixDetails: () => void;
  isProcessing?: boolean;
}

export function SteadfastFailureDialog({
  isOpen,
  onClose,
  order,
  errorMessage,
  fieldErrors,
  onForceProcess,
  onFixDetails,
  isProcessing = false,
}: SteadfastFailureDialogProps) {
  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-500">
            <div className="p-2 rounded-full bg-amber-500/10">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Steadfast Booking Failed
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Order <span className="font-mono font-medium text-foreground">{order.id}</span> could not be booked automatically with Steadfast Courier.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-3">
          <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs space-y-1.5">
            <p className="font-semibold">Steadfast API Error:</p>
            <p className="text-destructive/90 leading-relaxed font-mono text-[11px]">
              {errorMessage || "Validation failed on courier booking request."}
            </p>
          </div>

          {fieldErrors && Object.keys(fieldErrors).length > 0 && (
            <div className="p-2.5 rounded-md bg-muted/50 border text-xs space-y-1">
              <span className="font-medium text-muted-foreground">Field details:</span>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-[11px]">
                {Object.entries(fieldErrors).map(([field, errs]) => (
                  <li key={field}>
                    <strong className="text-foreground">{field}:</strong>{" "}
                    {Array.isArray(errs) ? errs.join(", ") : String(errs)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-2.5 rounded-md bg-muted/40 text-[12px] text-muted-foreground leading-relaxed">
            <strong>What would you like to do?</strong>
            <p className="mt-1">
              You can cancel and correct the customer information (phone/address), or force the status to <em>Processing</em> and retry booking with Steadfast later from the order details panel.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onFixDetails}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancel & Correct Order
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onForceProcess}
            disabled={isProcessing}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isProcessing ? "Updating..." : "Force Update Status"}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

