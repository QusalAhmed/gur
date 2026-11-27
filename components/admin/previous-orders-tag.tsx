"use client";

import * as React from "react";
import { ArrowUpRight, ChevronDown, Clock, History } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, formatDateTime } from "@/lib/utils";
import {
  getOtherOrderInsight,
  summarizeOtherOrders,
  type Order,
} from "@/types/order";

export interface PreviousOrdersTagProps {
  otherOrders: Order[];
  onSelectOrder: (order: Order) => void;
  className?: string;
}

/**
 * Compact semantic summary pill for customer's previous/other orders in the Orders Table,
 * opening an interactive Popover with full status breakdown and click-to-inspect rows.
 */
export function PreviousOrdersTag({
  otherOrders,
  onSelectOrder,
  className,
}: PreviousOrdersTagProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!otherOrders || otherOrders.length === 0) {
    return null;
  }

  const summary = summarizeOtherOrders(otherOrders);

  return (
    <div className={cn("pt-0.5", className)} onClick={(e) => e.stopPropagation()}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            title={`${summary.count} previous ${summary.count === 1 ? "order" : "orders"} (${summary.fullBreakdownText}) — Click to inspect`}
            aria-label={`View ${summary.count} previous ${summary.count === 1 ? "order" : "orders"}: ${summary.fullBreakdownText}`}
            className={cn(
              "inline-flex items-center gap-1.5 max-w-full rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer select-none shadow-2xs hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              summary.primaryInsight.badgeStyle
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                summary.primaryInsight.dotColor
              )}
            />
            <History className="h-3 w-3 shrink-0 opacity-80" />
            <span className="truncate">{summary.triggerLabel}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 opacity-65 transition-transform duration-150",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          className="w-80 p-0 shadow-xl rounded-xl border bg-popover text-popover-foreground z-50 text-xs overflow-hidden"
        >
          {/* Summary Header */}
          <div className="px-3.5 py-2.5 border-b bg-muted/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <History className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Previous Orders ({summary.count})</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Click row to open
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {summary.breakdown.map((item) => (
                <span
                  key={item.status}
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold",
                    item.insight.badgeStyle
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      item.insight.dotColor
                    )}
                  />
                  <span>
                    {item.count} {item.insight.shortLabel}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Order List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
            {otherOrders.map((other) => {
              const insight = getOtherOrderInsight(other.status);
              const totalVal = Number(other.grand_total) || 0;
              return (
                <button
                  key={other.uuid || other.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onSelectOrder(other);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none transition-colors flex flex-col gap-1 cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          insight.dotColor
                        )}
                      />
                      <span className="font-mono font-bold text-xs text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 truncate">
                        {other.id}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0 rounded border text-[10px] font-semibold shrink-0",
                          insight.badgeStyle
                        )}
                      >
                        {insight.shortLabel}
                      </span>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pl-3.5">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Clock className="h-3 w-3 shrink-0 opacity-70" />
                      <span className="truncate">
                        {other.date ? formatDateTime(other.date) : "Date unavailable"}
                      </span>
                    </span>
                    {totalVal > 0 && (
                      <span className="font-mono font-semibold text-foreground shrink-0">
                        ৳ {totalVal.toLocaleString()}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
