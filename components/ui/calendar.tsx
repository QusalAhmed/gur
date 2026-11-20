"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 sm:p-3 select-none", className)}
      classNames={{
        root: "rdp-root",
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "w-[260px] sm:w-[280px] space-y-3",
        month_caption: "flex justify-center items-center h-7 relative px-8 mb-2",
        caption_label: "flex items-center gap-1 text-xs sm:text-sm font-semibold text-foreground",
        dropdowns: "flex items-center justify-center gap-1 z-10",
        dropdown_root:
          "relative inline-flex items-center rounded-md border border-border bg-background/70 hover:bg-muted/80 px-1.5 py-0.5 text-xs font-medium transition-colors cursor-pointer text-foreground focus-within:ring-1 focus-within:ring-ring shadow-2xs",
        dropdown:
          "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none bg-transparent",
        months_dropdown: "",
        years_dropdown: "",
        nav: "flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 absolute left-1 top-0 cursor-pointer border-border z-20"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 absolute right-1 top-0 cursor-pointer border-border z-20"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between w-full px-0.5",
        weekday: "text-muted-foreground rounded-md w-8 font-medium text-[0.75rem] text-center",
        weeks: "mt-1 space-y-1",
        week: "flex justify-between w-full px-0.5",
        day: "h-8 w-8 text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal hover:bg-muted rounded-md transition-colors cursor-pointer text-xs"
        ),
        range_start:
          "bg-amber-600 text-white rounded-l-md [&>button]:bg-amber-600 [&>button]:text-white [&>button]:hover:bg-amber-700 font-semibold",
        range_end:
          "bg-amber-600 text-white rounded-r-md [&>button]:bg-amber-600 [&>button]:text-white [&>button]:hover:bg-amber-700 font-semibold",
        range_middle:
          "bg-amber-500/15 text-amber-900 dark:text-amber-200 [&>button]:bg-transparent [&>button]:text-amber-900 dark:[&>button]:text-amber-200 [&>button]:hover:bg-amber-500/25",
        selected:
          "bg-amber-600 text-white [&>button]:bg-amber-600 [&>button]:text-white",
        today:
          "[&>button]:font-bold [&>button]:border [&>button]:border-amber-500/60",
        outside: "text-muted-foreground opacity-35 [&>button]:opacity-35",
        disabled:
          "text-muted-foreground opacity-25 cursor-not-allowed [&>button]:cursor-not-allowed [&>button]:opacity-25 [&>button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                className={cn("h-4 w-4", chevronClassName)}
                {...chevronProps}
              />
            );
          }
          if (orientation === "right") {
            return (
              <ChevronRight
                className={cn("h-4 w-4", chevronClassName)}
                {...chevronProps}
              />
            );
          }
          return (
            <ChevronDown
              className={cn("h-3 w-3 opacity-60 ml-0.5 shrink-0", chevronClassName)}
              {...chevronProps}
            />
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
