"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toZonedTime, format as formatZoned } from "date-fns-tz";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { DHAKA_TIMEZONE } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

export type DateRangePreset = "today" | "7d" | "30d" | "custom";

export function DateRangePicker({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(false);

  // Read current params or default to 30 days
  const currentFrom = searchParams.get("from");
  const currentTo = searchParams.get("to");

  // Local state for custom dates
  const nowInDhaka = toZonedTime(new Date(), DHAKA_TIMEZONE);
  const defaultFrom = format(startOfDay(subDays(nowInDhaka, 29)), "yyyy-MM-dd");
  const defaultTo = format(endOfDay(nowInDhaka), "yyyy-MM-dd");

  const [customStart, setCustomStart] = React.useState(currentFrom || defaultFrom);
  const [customEnd, setCustomEnd] = React.useState(currentTo || defaultTo);

  // Determine active preset label
  let activePreset: DateRangePreset = "custom";
  const todayStr = format(nowInDhaka, "yyyy-MM-dd");
  const sevenDaysAgoStr = format(startOfDay(subDays(nowInDhaka, 6)), "yyyy-MM-dd");
  const thirtyDaysAgoStr = format(startOfDay(subDays(nowInDhaka, 29)), "yyyy-MM-dd");

  if (!currentFrom && !currentTo) {
    activePreset = "30d";
  } else if (currentFrom === todayStr && currentTo === todayStr) {
    activePreset = "today";
  } else if (currentFrom === sevenDaysAgoStr && currentTo === todayStr) {
    activePreset = "7d";
  } else if (currentFrom === thirtyDaysAgoStr && currentTo === todayStr) {
    activePreset = "30d";
  }

  const applyRange = (fromStr: string, toStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", fromStr);
    params.set("to", toStr);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  const handleSelectPreset = (preset: DateRangePreset) => {
    const today = format(nowInDhaka, "yyyy-MM-dd");
    if (preset === "today") {
      applyRange(today, today);
    } else if (preset === "7d") {
      applyRange(sevenDaysAgoStr, today);
    } else if (preset === "30d") {
      applyRange(thirtyDaysAgoStr, today);
    }
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      applyRange(customStart, customEnd);
    }
  };

  // Label display
  let displayLabel = "Last 30 Days";
  if (activePreset === "today") displayLabel = "Today";
  else if (activePreset === "7d") displayLabel = "Last 7 Days";
  else if (activePreset === "30d") displayLabel = "Last 30 Days";
  else if (currentFrom && currentTo) {
    displayLabel = `${currentFrom} to ${currentTo}`;
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            size="sm"
            className="h-8 justify-start text-left font-normal bg-background/50 hover:bg-background border-border/80 text-xs sm:text-sm"
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-70" />
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <div className="space-y-3">
            <div className="flex gap-1.5 border-b pb-2">
              <Button
                variant={activePreset === "today" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleSelectPreset("today")}
              >
                Today
              </Button>
              <Button
                variant={activePreset === "7d" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleSelectPreset("7d")}
              >
                7 Days
              </Button>
              <Button
                variant={activePreset === "30d" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleSelectPreset("30d")}
              >
                30 Days
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
                className="w-full h-7 text-xs mt-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleApplyCustom}
              >
                Apply Range
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
