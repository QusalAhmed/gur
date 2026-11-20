"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toZonedTime } from "date-fns-tz";
import {
  subDays,
  subMonths,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
} from "date-fns";
import { DHAKA_TIMEZONE, formatDhakaDate } from "@/lib/admin-format";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type DateRangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "90d"
  | "custom"
  | (string & {});

export interface DateRangePresetOption {
  id: string;
  label: string;
  from: string | null;
  to: string | null;
}

export interface DateRangePickerProps {
  className?: string;
  allowAllTime?: boolean;
  disableFutureDates?: boolean;
  from?: string;
  to?: string;
  onSelect?: (range: { from: string | null; to: string | null }) => void;
  placeholder?: string;
  extraPresets?: DateRangePresetOption[];
}

export function DateRangePicker({
  className,
  allowAllTime = true,
  disableFutureDates = true,
  from,
  to,
  onSelect,
  placeholder,
  extraPresets,
}: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const [open, setOpen] = React.useState(false);

  const isControlled = Boolean(onSelect || from !== undefined || to !== undefined);

  // Read current params (controlled props take precedence over URL query parameters)
  const currentFrom = from !== undefined ? from : searchParams.get("from");
  const currentTo = to !== undefined ? to : searchParams.get("to");

  // Reference date in Dhaka timezone
  const nowInDhaka = React.useMemo(
    () => toZonedTime(new Date(), DHAKA_TIMEZONE),
    []
  );

  // Presets date strings (yyyy-MM-dd)
  const todayStr = format(nowInDhaka, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(nowInDhaka, 1), "yyyy-MM-dd");
  const sevenDaysAgoStr = format(startOfDay(subDays(nowInDhaka, 6)), "yyyy-MM-dd");
  const thirtyDaysAgoStr = format(startOfDay(subDays(nowInDhaka, 29)), "yyyy-MM-dd");
  const ninetyDaysAgoStr = format(startOfDay(subDays(nowInDhaka, 89)), "yyyy-MM-dd");
  const startOfMonthStr = format(startOfMonth(nowInDhaka), "yyyy-MM-dd");
  const lastMonthStartStr = format(startOfMonth(subMonths(nowInDhaka, 1)), "yyyy-MM-dd");
  const lastMonthEndStr = format(endOfMonth(subMonths(nowInDhaka, 1)), "yyyy-MM-dd");

  // Determine active preset
  let activePreset: DateRangePreset = "custom";
  if (!currentFrom && !currentTo) {
    activePreset = isControlled ? "none" : "30d";
  } else if (currentFrom === "all" || currentTo === "all") {
    activePreset = "all";
  } else if (currentFrom === todayStr && currentTo === todayStr) {
    activePreset = "today";
  } else if (currentFrom === yesterdayStr && currentTo === yesterdayStr) {
    activePreset = "yesterday";
  } else if (currentFrom === sevenDaysAgoStr && currentTo === todayStr) {
    activePreset = "7d";
  } else if (currentFrom === thirtyDaysAgoStr && currentTo === todayStr) {
    activePreset = "30d";
  } else if (currentFrom === startOfMonthStr && currentTo === todayStr) {
    activePreset = "this_month";
  } else if (currentFrom === lastMonthStartStr && currentTo === lastMonthEndStr) {
    activePreset = "last_month";
  } else if (currentFrom === ninetyDaysAgoStr && currentTo === todayStr) {
    activePreset = "90d";
  } else if (extraPresets?.some((ep) => ep.from === currentFrom && ep.to === currentTo)) {
    activePreset = extraPresets.find((ep) => ep.from === currentFrom && ep.to === currentTo)!.id;
  }

  // Parse active date range for the calendar draft state
  const getInitialDraftRange = React.useCallback((): DateRange | undefined => {
    if (currentFrom && currentTo && currentFrom !== "all" && currentTo !== "all") {
      try {
        return {
          from: parseISO(currentFrom),
          to: parseISO(currentTo),
        };
      } catch {
        // Fallback
      }
    }
    if (isControlled && (!currentFrom || currentFrom === "all")) {
      return undefined;
    }
    // Default 30 days
    return {
      from: startOfDay(subDays(nowInDhaka, 29)),
      to: endOfDay(nowInDhaka),
    };
  }, [currentFrom, currentTo, nowInDhaka, isControlled]);

  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(
    getInitialDraftRange
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftRange(getInitialDraftRange());
    }
    setOpen(nextOpen);
  };

  const applyRange = (fromStr: string | null, toStr: string | null) => {
    if (onSelect) {
      onSelect({ from: fromStr, to: toStr });
      setOpen(false);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (fromStr && toStr) {
      params.set("from", fromStr);
      params.set("to", toStr);
    } else {
      params.delete("from");
      params.delete("to");
    }
    // Always reset pagination when changing date range
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  const handleSelectPreset = (preset: string) => {
    if (preset === "all") {
      applyRange("all", "all");
    } else if (preset === "today") {
      applyRange(todayStr, todayStr);
    } else if (preset === "yesterday") {
      applyRange(yesterdayStr, yesterdayStr);
    } else if (preset === "7d") {
      applyRange(sevenDaysAgoStr, todayStr);
    } else if (preset === "30d") {
      if (isControlled) {
        applyRange(thirtyDaysAgoStr, todayStr);
      } else {
        // 30d is default in URL mode: clearing from/to resets cleanly
        applyRange(null, null);
      }
    } else if (preset === "this_month") {
      applyRange(startOfMonthStr, todayStr);
    } else if (preset === "last_month") {
      applyRange(lastMonthStartStr, lastMonthEndStr);
    } else if (preset === "90d") {
      applyRange(ninetyDaysAgoStr, todayStr);
    }
  };

  const handleApplyCustom = () => {
    if (!draftRange?.from) return;
    const fromStr = format(draftRange.from, "yyyy-MM-dd");
    // Single-day fallback: if only from is clicked, treat as full single-day range
    const toStr = draftRange.to ? format(draftRange.to, "yyyy-MM-dd") : fromStr;
    applyRange(fromStr, toStr);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    applyRange(null, null);
  };

  // Label display for the trigger button
  let displayLabel = isControlled ? placeholder || "Select date range" : "Last 30 Days";
  if (activePreset === "all") displayLabel = "All Time";
  else if (activePreset === "today") displayLabel = "Today";
  else if (activePreset === "yesterday") displayLabel = "Yesterday";
  else if (activePreset === "7d") displayLabel = "Last 7 Days";
  else if (activePreset === "30d") displayLabel = "Last 30 Days";
  else if (activePreset === "this_month") displayLabel = "This Month";
  else if (activePreset === "last_month") displayLabel = "Last Month";
  else if (activePreset === "90d") displayLabel = "Last 90 Days";
  else if (extraPresets?.some((ep) => ep.id === activePreset)) {
    displayLabel = extraPresets.find((ep) => ep.id === activePreset)!.label;
  } else if (currentFrom && currentTo && currentFrom !== "all") {
    const fromFormatted = formatDhakaDate(currentFrom, "dd MMM yyyy");
    const toFormatted = formatDhakaDate(currentTo, "dd MMM yyyy");
    displayLabel =
      currentFrom === currentTo ? fromFormatted : `${fromFormatted} – ${toFormatted}`;
  } else if (currentFrom && !currentTo) {
    displayLabel = `From ${formatDhakaDate(currentFrom, "dd MMM yyyy")}`;
  } else if (!currentFrom && currentTo) {
    displayLabel = `Until ${formatDhakaDate(currentTo, "dd MMM yyyy")}`;
  }

  const isFiltered = Boolean(
    (currentFrom && currentFrom !== "all") || (currentTo && currentTo !== "all")
  );

  const presets: { id: string; label: string; action: () => void }[] = [
    ...(allowAllTime
      ? [{ id: "all", label: "All Time", action: () => handleSelectPreset("all") }]
      : []),
    ...(extraPresets || []).map((ep) => ({
      id: ep.id,
      label: ep.label,
      action: () => applyRange(ep.from, ep.to),
    })),
    { id: "today", label: "Today", action: () => handleSelectPreset("today") },
    { id: "yesterday", label: "Yesterday", action: () => handleSelectPreset("yesterday") },
    { id: "7d", label: "Last 7 Days", action: () => handleSelectPreset("7d") },
    { id: "30d", label: "Last 30 Days", action: () => handleSelectPreset("30d") },
    { id: "this_month", label: "This Month", action: () => handleSelectPreset("this_month") },
    { id: "last_month", label: "Last Month", action: () => handleSelectPreset("last_month") },
    { id: "90d", label: "Last 90 Days", action: () => handleSelectPreset("90d") },
  ];

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="order-date-range-trigger"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 justify-start text-left font-normal bg-background hover:bg-muted/50 border-input text-xs sm:text-sm cursor-pointer w-full sm:w-auto",
              isFiltered && "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-70 text-amber-600 shrink-0" />
            <span className="truncate flex-1 max-w-[240px]">{displayLabel}</span>
            <ChevronDown className="ml-1.5 h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto p-0 shadow-xl border-border bg-popover overflow-hidden"
          align="start"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-semibold text-foreground">Filter by Date</span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer font-medium underline transition-colors"
              >
                Reset to default
              </button>
            )}
          </div>

          {/* Main Layout: Presets Sidebar + Interactive Calendar */}
          <div className="flex flex-col sm:flex-row">
            {/* Presets Panel */}
            <div className="sm:w-36 shrink-0 border-b sm:border-b-0 sm:border-r border-border p-2 bg-muted/10 flex sm:flex-col flex-wrap gap-1">
              <div className="hidden sm:block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                Presets
              </div>
              {presets.map((preset) => {
                const isActive = activePreset === preset.id;
                return (
                  <Button
                    key={preset.id}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-7 text-xs justify-start px-2 cursor-pointer font-normal transition-colors",
                      isActive
                        ? "bg-amber-600 hover:bg-amber-700 text-white font-medium"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground"
                    )}
                    onClick={preset.action}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>

            {/* Calendar */}
            <div className="p-2 sm:p-3">
              <Calendar
                mode="range"
                captionLayout="dropdown"
                startMonth={new Date(2022, 0)}
                endMonth={
                  disableFutureDates
                    ? nowInDhaka
                    : new Date(nowInDhaka.getFullYear() + 2, 11)
                }
                selected={draftRange}
                onSelect={setDraftRange}
                numberOfMonths={isMobile ? 1 : 2}
                defaultMonth={
                  draftRange?.to
                    ? isMobile
                      ? draftRange.to
                      : subMonths(draftRange.to, 1)
                    : isMobile
                    ? nowInDhaka
                    : subMonths(nowInDhaka, 1)
                }
                disabled={disableFutureDates ? { after: nowInDhaka } : undefined}
              />
            </div>
          </div>

          {/* Footer with Selection Preview and Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border px-3 py-2.5 bg-muted/20">
            <div className="text-[11px] text-muted-foreground truncate">
              {draftRange?.from ? (
                <span>
                  Selected:{" "}
                  <strong className="text-foreground font-semibold">
                    {format(draftRange.from, "dd MMM yyyy")}
                  </strong>
                  {draftRange.to &&
                  draftRange.to.getTime() !== draftRange.from.getTime() ? (
                    <>
                      {" – "}
                      <strong className="text-foreground font-semibold">
                        {format(draftRange.to, "dd MMM yyyy")}
                      </strong>
                    </>
                  ) : null}
                </span>
              ) : (
                <span className="italic">Select a date range on the calendar</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 justify-end shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5 cursor-pointer"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draftRange?.from}
                className="h-7 text-xs px-3 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50"
                onClick={handleApplyCustom}
              >
                Apply Range
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
          title="Clear date filter"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
