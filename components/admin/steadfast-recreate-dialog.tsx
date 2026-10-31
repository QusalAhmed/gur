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
import { AlertTriangle, RefreshCw, Truck, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Order } from "@/types/order";
import type { SteadfastDiffItem } from "@/lib/steadfast";

export interface SteadfastRecreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  diffItems: SteadfastDiffItem[];
  nextInvoice: string;
  onConfirmRecreate: () => Promise<void>;
  onSaveWithoutRecreate: () => Promise<void>;
  isProcessing?: boolean;
}

export function SteadfastRecreateDialog({
  isOpen,
  onClose,
  order,
  diffItems,
  nextInvoice,
  onConfirmRecreate,
  onSaveWithoutRecreate,
  isProcessing = false,
}: SteadfastRecreateDialogProps) {
  if (!order) return null;

  const isShippedOrDelivered =
    order.status === "shipped" ||
    order.status === "delivered" ||
    order.status === "partially_delivered";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <div className="p-2 rounded-full bg-amber-500/10">
              <RefreshCw className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              Recreate Parcel in Steadfast Courier?
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Order <strong className="font-mono text-foreground">#{order.id}</strong> has already been booked with Steadfast
            {order.courier_consignment_id ? ` (Consignment #${order.courier_consignment_id})` : ""}, but delivery details have changed.
          </DialogDescription>
        </DialogHeader>

        {/* Warning if already Shipped or Delivered */}
        {isShippedOrDelivered && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Caution: Order is {order.status.toUpperCase()}</p>
              <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-400">
                This parcel may already be in transit or delivered to the customer. Recreating will book an additional parcel in Steadfast and request return/cancellation of the previous one.
              </p>
            </div>
          </div>
        )}

        {/* Next Invoice Badge */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Truck className="h-3.5 w-3.5 text-primary" />
            <span>New Steadfast Invoice:</span>
          </div>
          <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]">
            {nextInvoice}
          </span>
        </div>

        {/* Changed Information Diff List */}
        <div className="flex-1 overflow-y-auto max-h-[260px] space-y-2 pr-1">
          <p className="text-xs font-semibold text-foreground px-0.5">
            Detected Changes ({diffItems.length}):
          </p>
          {diffItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-0.5">
              No delivery field differences detected.
            </p>
          ) : (
            diffItems.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-border/70 bg-card text-xs space-y-1"
              >
                <span className="font-medium text-foreground block text-[11px]">
                  {item.field}
                </span>
                <div className="grid grid-cols-11 items-center gap-1.5 text-[11px]">
                  <span className="col-span-5 font-mono text-muted-foreground/80 line-through truncate" title={item.oldValue}>
                    {item.oldValue}
                  </span>
                  <ArrowRight className="col-span-1 h-3 w-3 text-muted-foreground mx-auto" />
                  <span className="col-span-5 font-mono text-emerald-600 dark:text-emerald-400 font-medium truncate" title={item.newValue}>
                    {item.newValue}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isProcessing}
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isProcessing}
            onClick={onSaveWithoutRecreate}
            className="text-xs"
          >
            Save Order Only
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isProcessing}
            onClick={onConfirmRecreate}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                Recreating Parcel...
              </>
            ) : (
              <>
                <Truck className="h-3 w-3 mr-1.5" />
                Recreate in Steadfast
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

