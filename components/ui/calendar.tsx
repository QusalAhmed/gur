"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, Dropdown } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

type DropdownProps = React.ComponentProps<typeof Dropdown>;

function CalendarDropdown({
  value,
  onChange,
  options,
  disabled,
  "aria-label": ariaLabel,
}: DropdownProps) {
  const selected = options?.find((option) => option.value === Number(value));
  const isMonth = options && options.length === 12 && options[0]?.value === 0;

  const handleValueChange = (newValue: string | null) => {
    if (newValue === null || newValue === undefined) return;
    if (onChange) {
      const syntheticEvent = {
        target: { value: newValue },
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <Select
      value={value !== undefined ? String(value) : undefined}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className={cn(
          "h-7 text-xs font-medium px-2 py-0 gap-1 bg-background/80 hover:bg-muted border-border cursor-pointer shadow-2xs focus-visible:ring-1 focus-visible:ring-ring [&_svg]:size-3",
          isMonth ? "min-w-[92px]" : "min-w-[72px]"
        )}
      >
        <SelectValue>
          {selected?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="center"
        className="z-[70] min-w-[100px] max-h-56 overflow-y-auto"
      >
        {options?.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            disabled={option.disabled}
            className="text-xs cursor-pointer"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Calendar({
  className,
  classNames,
  components,
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
        dropdowns: "flex items-center justify-center gap-1.5 z-10",
        dropdown_root: "relative inline-flex items-center",
        dropdown: "hidden",
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
        Dropdown: CalendarDropdown,
        ...components,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
