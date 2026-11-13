"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toZonedTime } from "date-fns-tz";
import { subDays, startOfDay, endOfDay, startOfMonth, format } from "date-fns";
import { DHAKA_TIMEZONE } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

export type DateRangePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "this_month" | "custom";

export interface DateRangePickerProps {
  className?: string;
  allowAllTime?: boolean;
}

export function DateRangePicker({
  className,
  allowAllTime = true,
}: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(false);

  // Read current params
  const currentFrom = searchParams.get("from");
  const currentTo = searchParams.get("to");

  // Local state for custom dates
  const nowInDhaka = toZonedTime(new Date(), DHAKA_TIMEZONE);
  const defaultFrom = format(startOfDay(subDays(nowInDhaka, 29)), "yyyy-MM-dd");
  const defaultTo = format(endOfDay(nowInDhaka), "yyyy-MM-dd");

  const [customStart, setCustomStart] = React.useState(currentFrom || defaultFrom);
  const [customEnd, setCustomEnd] = React.useState(currentTo || defaultTo);

  // Sync state if URL changes externally
  React.useEffect(() => {
    if (currentFrom) setCustomStart(currentFrom);
    if (currentTo) setCustomEnd(currentTo);
  }, [currentFrom, currentTo]);

  // Determine active preset
  const todayStr = format(nowInDhaka, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(nowInDhaka, 1), "yyyy-MM-dd");
  const sevenDaysAgoStr = format(startOfDay(subDays(nowInDhaka, 6)), "yyyy-MM-dd");
  const thirtyDaysAgoStr = format(startOfDay(subDays(nowInDhaka, 29)), "yyyy-MM-dd");
  const startOfMonthStr = format(startOfMonth(nowInDhaka), "yyyy-MM-dd");

  let activePreset: DateRangePreset = "custom";

  if (!currentFrom && !currentTo) {
    activePreset = allowAllTime ? "all" : "30d";
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
  }

  const applyRange = (fromStr: string | null, toStr: string | null) => {
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

  const handleSelectPreset = (preset: DateRangePreset) => {
    const today = format(nowInDhaka, "yyyy-MM-dd");
    if (preset === "all") {
      applyRange(null, null);
    } else if (preset === "today") {
      applyRange(today, today);
    } else if (preset === "yesterday") {
      applyRange(yesterdayStr, yesterdayStr);
    } else if (preset === "7d") {
      applyRange(sevenDaysAgoStr, today);
    } else if (preset === "30d") {
      applyRange(thirtyDaysAgoStr, today);
    } else if (preset === "this_month") {
      applyRange(startOfMonthStr, today);
    }
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      applyRange(customStart, customEnd);
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    applyRange(null, null);
  };

  // Label display
  let displayLabel = allowAllTime ? "All Time" : "Last 30 Days";
  if (activePreset === "all") displayLabel = "All Time";
  else if (activePreset === "today") displayLabel = "Today";
  else if (activePreset === "yesterday") displayLabel = "Yesterday";
  else if (activePreset === "7d") displayLabel = "Last 7 Days";
  else if (activePreset === "30d") displayLabel = "Last 30 Days";
  else if (activePreset === "this_month") displayLabel = "This Month";
  else if (currentFrom && currentTo) {
    displayLabel = currentFrom === currentTo ? currentFrom : `${currentFrom} - ${currentTo}`;
  }

  const isFiltered = Boolean(currentFrom || currentTo);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="order-date-range-trigger"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 justify-start text-left font-normal bg-background hover:bg-muted/50 border-input text-xs sm:text-sm cursor-pointer",
              isFiltered && "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-70 text-amber-600" />
            <span className="truncate max-w-[140px] sm:max-w-[180px]">{displayLabel}</span>
            <ChevronDown className="ml-1.5 h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-3 shadow-md" align="end">
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
              <span>Filter by Order Date</span>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer font-normal underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 border-b pb-3">
              {allowAllTime && (
                <Button
                  variant={activePreset === "all" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => handleSelectPreset("all")}
                >
                  All Time
                </Button>
              )}
              <Button
                variant={activePreset === "today" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => handleSelectPreset("today")}
              >
                Today
              </Button>
              <Button
                variant={activePreset === "yesterday" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => handleSelectPreset("yesterday")}
              >
                Yesterday
              </Button>
              <Button
                variant={activePreset === "7d" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => handleSelectPreset("7d")}
              >
                Last 7d
              </Button>
              <Button
                variant={activePreset === "30d" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => handleSelectPreset("30d")}
              >
                Last 30d
              </Button>
              <Button
                variant={activePreset === "this_month" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => handleSelectPreset("this_month")}
              >
                This Month
              </Button>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-xs font-medium text-muted-foreground">Custom Date Range (Asia/Dhaka)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full h-7 text-xs mt-1 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
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
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          title="Clear date filter"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
