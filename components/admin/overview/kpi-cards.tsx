"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  AlertTriangle,
  Users,
  CreditCard,
  ShoppingBag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatBDT, formatDelta } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  kpis: {
    orders_count: number;
    revenue: number;
    average_order: number;
    amount_collected: number;
    new_customers: number;
    checkouts_started: number;
    conversion_rate: number;
    low_stock_count: number;
  };
  deltas: {
    orders: number;
    revenue: number;
    average_order: number;
    collected: number;
    checkouts: number;
    conversion: number;
  };
}

export function KpiCards({ kpis, deltas }: KpiCardsProps) {
  const cards = [
    {
      title: "Revenue",
      titleBn: "মোট বিক্রয়",
      value: formatBDT(kpis.revenue),
      delta: deltas.revenue,
      deltaLabel: "vs prev period",
      icon: DollarSign,
      iconColor: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
    },
    {
      title: "Orders Placed",
      titleBn: "অর্ডার সংখ্যা",
      value: kpis.orders_count.toLocaleString(),
      delta: deltas.orders,
      deltaLabel: "vs prev period",
      icon: ShoppingCart,
      iconColor: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
    },
    {
      title: "Average Order Value",
      titleBn: "গড় অর্ডার মূল্য",
      value: formatBDT(kpis.average_order),
      delta: deltas.average_order,
      deltaLabel: "vs prev period",
      icon: ShoppingBag,
      iconColor: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      title: "Cash Collected",
      titleBn: "আদায়কৃত অর্থ",
      value: formatBDT(kpis.amount_collected),
      delta: deltas.collected,
      deltaLabel: "succeeded txns",
      icon: CreditCard,
      iconColor: "text-purple-600 bg-purple-500/10 dark:text-purple-400",
    },
    {
      title: "Checkout Conversion",
      titleBn: "চেকআউট কনভার্সন",
      value: `${kpis.conversion_rate}%`,
      delta: deltas.conversion,
      deltaLabel: `${kpis.checkouts_started} started`,
      icon: Percent,
      iconColor: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400",
    },
    {
      title: "Low Stock Alert",
      titleBn: "কম স্টক সতর্কবার্তা",
      value: kpis.low_stock_count.toString(),
      href: "/inventory?filter=low_stock",
      icon: AlertTriangle,
      iconColor:
        kpis.low_stock_count > 0
          ? "text-rose-600 bg-rose-500/10 dark:text-rose-400"
          : "text-zinc-500 bg-zinc-500/10",
      isAlert: kpis.low_stock_count > 0,
      customNote: kpis.low_stock_count > 0 ? "Variants need reorder" : "All variants healthy",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const isDeltaPositive = (card.delta || 0) >= 0;

        const content = (
          <Card
            key={card.title}
            className={cn(
              "border-border/80 shadow-xs hover:border-border transition-all",
              card.isAlert && "border-rose-500/40 bg-rose-500/[0.02]"
            )}
          >
            <CardContent className="p-3.5 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground truncate">
                  {card.title}
                </span>
                <div className={cn("p-1.5 rounded-lg shrink-0", card.iconColor)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                  {card.value}
                </p>

                {card.delta !== undefined ? (
                  <div className="flex items-center gap-1 text-[11px]">
                    <span
                      className={cn(
                        "inline-flex items-center font-semibold",
                        isDeltaPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {isDeltaPositive ? (
                        <TrendingUp className="h-3 w-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-0.5" />
                      )}
                      {formatDelta(card.delta)}
                    </span>
                    <span className="text-muted-foreground truncate">{card.deltaLabel}</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {card.customNote}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );

        if (card.href) {
          return (
            <Link key={card.title} href={card.href} className="block transition-transform hover:-translate-y-0.5">
              {content}
            </Link>
          );
        }

        return content;
      })}
    </div>
  );
}
