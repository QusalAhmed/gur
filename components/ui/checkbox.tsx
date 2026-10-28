"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "checked" | "onCheckedChange"> {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const isIndeterminate = checked === "indeterminate";
    const isChecked = checked === true;

    return (
      <CheckboxPrimitive.Root
        ref={ref}
        data-slot="checkbox"
        checked={isIndeterminate ? false : isChecked}
        indeterminate={isIndeterminate}
        onCheckedChange={(val) => {
          onCheckedChange?.(val);
        }}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer flex items-center justify-center",
          isChecked || isIndeterminate
            ? "bg-amber-600 border-amber-600 text-white"
            : "bg-background hover:border-amber-500",
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
          {isIndeterminate ? (
            <Minus className="h-3 w-3 stroke-[3]" />
          ) : (
            <Check className="h-3 w-3 stroke-[3]" />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  }
);
Checkbox.displayName = "Checkbox";
