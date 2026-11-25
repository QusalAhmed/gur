"use client";

import * as React from "react";
import {
  CalendarClock,
  Flame,
  PauseCircle,
  PlayCircle,
  Loader2,
  X,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { DHAKA_TIMEZONE } from "@/lib/admin-format";
import {
  formatSendingDateDisplay,
  getDhakaTodayIsoDate,
  normalizeSendingDate,
} from "@/lib/order-dispatch";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DispatchScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  orderNumbers: string[];
  initialPaused?: boolean;
  initialSendingDate?: string | null;
  initialPauseReason?: string | null;
  initialUrgent?: boolean;
  isSubmitting?: boolean;
  onConfirm: (values: {
    isPaused: boolean;
    sendingDate: string | null;
    pauseReason: string | null;
    isUrgent: boolean;
  }) => Promise<void> | void;
}

const PAUSE_REASON_PRESETS = [
  "Customer requested later date",
  "Customer out of town",
  "Awaiting customer confirmation",
  "Awaiting stock / fresh batch",
] as const;

export function DispatchScheduleDialog({
  open,
  onOpenChange,
  title,
  description,
  orderNumbers,
  initialPaused = false,
  initialSendingDate = null,
  initialPauseReason = "",
  initialUrgent = false,
  isSubmitting = false,
  onConfirm,
}: DispatchScheduleDialogProps) {
  const [isPaused, setIsPaused] = React.useState(initialPaused);
  const [sendingDate, setSendingDate] = React.useState<string>(
    normalizeSendingDate(initialSendingDate) || ""
  );
  const [pauseReason, setPauseReason] = React.useState(initialPauseReason || "");
  const [isUrgent, setIsUrgent] = React.useState(initialUrgent);

  React.useEffect(() => {
    if (open) {
      setIsPaused(Boolean(initialPaused));
      setSendingDate(normalizeSendingDate(initialSendingDate) || "");
      setPauseReason(initialPauseReason || "");
      setIsUrgent(Boolean(initialUrgent));
    }
  }, [open, initialPaused, initialSendingDate, initialPauseReason, initialUrgent]);

  const todayKey = React.useMemo(() => getDhakaTodayIsoDate(), []);
  const tomorrowKey = React.useMemo(() => {
    const nowDhaka = toZonedTime(new Date(), DHAKA_TIMEZONE);
    return format(addDays(nowDhaka, 1), "yyyy-MM-dd");
  }, []);
  const plusThreeDaysKey = React.useMemo(() => {
    const nowDhaka = toZonedTime(new Date(), DHAKA_TIMEZONE);
    return format(addDays(nowDhaka, 3), "yyyy-MM-dd");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({
      isPaused,
      sendingDate: normalizeSendingDate(sendingDate),
      pauseReason: pauseReason.trim() || null,
      isUrgent,
    });
  };

  const normalizedSend = normalizeSendingDate(sendingDate);
  const isFutureDate = Boolean(normalizedSend && normalizedSend > todayKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-600" />
            {title ||
              (orderNumbers.length > 1
                ? `Schedule & Priority (${orderNumbers.length} Orders)`
                : `Schedule & Priority (${orderNumbers[0] || "Order"})`)}
          </DialogTitle>
          <DialogDescription>
            {description ||
              "Pause an order for a customer-requested sending date, or mark parcels as Urgent so they print first."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {orderNumbers.length > 1 && (
            <div className="p-2.5 rounded-lg bg-muted/40 border text-xs">
              <p className="font-semibold text-foreground mb-0.5">
                Selected Orders ({orderNumbers.length}):
              </p>
              <p className="font-mono text-[11px] text-muted-foreground break-words">
                {orderNumbers.join(", ")}
              </p>
            </div>
          )}

          {/* Priority selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Dispatch Priority</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsUrgent(false)}
                className={cn(
                  "p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer",
                  !isUrgent
                    ? "border-amber-600 bg-amber-50/60 dark:bg-amber-950/30 ring-1 ring-amber-600/30"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <p className="font-semibold text-foreground">Normal Parcel</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Prints after urgent parcels (oldest first)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIsUrgent(true)}
                className={cn(
                  "p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer",
                  isUrgent
                    ? "border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 ring-1 ring-rose-600/40"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <p className="font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-rose-600" />
                  Urgent Parcel
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Prints first with URGENT badge on sticker
                </p>
              </button>
            </div>
          </div>

          {/* Pause / Hold toggle */}
          <div className="space-y-2 p-3 rounded-xl border bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  {isPaused ? (
                    <PauseCircle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <PlayCircle className="h-4 w-4 text-emerald-600" />
                  )}
                  Order Hold Status
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isPaused
                    ? normalizedSend
                      ? `Held until sending date (${formatSendingDateDisplay(normalizedSend)}) arrives`
                      : "Held indefinitely until manually resumed"
                    : "Active — eligible to print and dispatch immediately"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={isPaused ? "default" : "outline"}
                onClick={() => setIsPaused((prev) => !prev)}
                className={cn(
                  "h-8 text-xs cursor-pointer shrink-0",
                  isPaused
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50"
                )}
              >
                {isPaused ? "Paused (Click to Resume)" : "Pause Order"}
              </Button>
            </div>

            {/* Specific Sending Date */}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="dispatch_sending_date" className="text-xs font-semibold">
                  Specific Sending Date (Optional)
                </Label>
                {sendingDate && (
                  <button
                    type="button"
                    onClick={() => setSendingDate("")}
                    className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                    Clear date
                  </button>
                )}
              </div>

              <Input
                id="dispatch_sending_date"
                type="date"
                value={sendingDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setSendingDate(val);
                  if (val && val > todayKey) {
                    setIsPaused(true);
                  }
                }}
                className="h-9 text-xs font-mono bg-background"
              />

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setSendingDate(todayKey)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-md border cursor-pointer transition-colors",
                    sendingDate === todayKey
                      ? "bg-amber-600 text-white border-amber-600 font-semibold"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSendingDate(tomorrowKey);
                    setIsPaused(true);
                  }}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-md border cursor-pointer transition-colors",
                    sendingDate === tomorrowKey
                      ? "bg-amber-600 text-white border-amber-600 font-semibold"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSendingDate(plusThreeDaysKey);
                    setIsPaused(true);
                  }}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-md border cursor-pointer transition-colors",
                    sendingDate === plusThreeDaysKey
                      ? "bg-amber-600 text-white border-amber-600 font-semibold"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  +3 Days
                </button>
              </div>

              {isFutureDate && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-400"
                  >
                    Auto-prints on {formatSendingDateDisplay(normalizedSend)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Optional Pause Reason */}
            {isPaused && (
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label htmlFor="dispatch_pause_reason" className="text-xs font-semibold">
                  Pause Note / Customer Request (Optional)
                </Label>
                <div className="flex flex-wrap gap-1 pb-0.5">
                  {PAUSE_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPauseReason(preset)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors",
                        pauseReason === preset
                          ? "bg-amber-100 text-amber-900 border-amber-400 font-semibold dark:bg-amber-950/60 dark:text-amber-200"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <Textarea
                  id="dispatch_pause_reason"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g. Customer asked to send after Friday..."
                  rows={2}
                  className="text-xs bg-background"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Schedule & Priority"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
