import * as React from "react";
import { cn } from "@/lib/utils";

export interface TakaProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  weight?: "normal" | "medium" | "semibold" | "bold" | "extrabold";
}

/**
 * High-visibility Bangladeshi Taka (৳) symbol component.
 * Solves the issue where system font fallback (e.g. Windows Segoe UI) renders ৳ as an ultra-thin hairline.
 * Enforces Bengali font family (Noto Serif Bengali), normal numeric variance, and crisp text-stroke bolding.
 */
export function Taka({
  className,
  size,
  weight = "semibold",
  ...props
}: TakaProps) {
  return (
    <span
      className={cn(
        "font-bangla inline-block select-none leading-none mr-0.5 align-baseline shrink-0",
        "[font-variant-numeric:normal]",
        "text-[1.08em] [transform:scaleY(1.16)] [transform-origin:bottom]",
        weight === "normal" && "font-normal",
        weight === "medium" && "font-medium [-webkit-text-stroke:0.12px_currentColor]",
        weight === "semibold" && "font-semibold [-webkit-text-stroke:0.18px_currentColor]",
        weight === "bold" && "font-semibold [-webkit-text-stroke:0.25px_currentColor]",
        weight === "extrabold" && "font-bold [-webkit-text-stroke:0.35px_currentColor]",
        size === "xs" && "text-[11px]",
        size === "sm" && "text-[12.5px]",
        size === "md" && "text-[14.5px]",
        size === "lg" && "text-[16.5px]",
        size === "xl" && "text-[19px]",
        className
      )}
      aria-hidden="true"
      {...props}
    >
      ৳
    </span>
  );
}

export const TakaSymbol = Taka;
