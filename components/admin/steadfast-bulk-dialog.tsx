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
import { CheckCircle2, XCircle, ExternalLink, Truck } from "lucide-react";
import type { BulkBookSteadfastResult } from "@/actions/steadfast";

export interface SteadfastBulkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: BulkBookSteadfastResult | null;
}

export function SteadfastBulkDialog({
  isOpen,
  onClose,
  result,
}: SteadfastBulkDialogProps) {
  if (!result) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2 text-primary">
            <div className="p-2 rounded-full bg-primary/10">
              <Truck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Steadfast Bulk Parcel Dispatch
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Processed {result.totalRequested} orders with Steadfast Courier.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-muted/50 border text-xs">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            <span>{result.successfulCount} Booked Successfully</span>
          </div>
          {result.failedCount > 0 && (
            <div className="flex items-center gap-1.5 text-destructive font-medium">
              <XCircle className="h-4 w-4" />
              <span>{result.failedCount} Failed</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto max-h-[340px] pr-1 space-y-2 text-xs">
          {result.results.map((res) => (
            <div
              key={res.orderId}
              className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                res.success
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-destructive/5 border-destructive/20"
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground">
                    {res.orderId}
                  </span>
                  {res.success ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium">
                      CID: #{res.consignmentId || "Assigned"}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium">
                      Failed
                    </span>
                  )}
                </div>

                {res.success ? (
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Tracking: {res.trackingCode || "N/A"}
                    </p>
                    {res.itemDescription && (
                      <p className="text-[10.5px] text-muted-foreground font-mono truncate max-w-[280px] sm:max-w-md" title={res.itemDescription}>
                        Items: {res.itemDescription}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-destructive leading-snug">
                    {res.error || "Booking failed"}
                  </p>
                )}
              </div>

              {res.success && res.trackingLink && (
                <a
                  href={res.trackingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline shrink-0"
                >
                  Track
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

