"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  CreditCard,
  ShieldAlert,
  FileQuestion,
  Star,
  ArrowRight,
  ShoppingCart,
} from "lucide-react";
import { NeedsAttentionItem } from "@/lib/admin-overview-data";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SEVERITY_CONFIG = {
  urgent: {
    bg: "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/15",
    badge: "bg-rose-500 text-white font-bold",
    icon: AlertCircle,
  },
  warning: {
    bg: "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-400 hover:bg-amber-500/15",
    badge: "bg-amber-600 text-white font-bold",
    icon: Clock,
  },
  info: {
    bg: "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-400 hover:bg-blue-500/15",
    badge: "bg-blue-600 text-white font-bold",
    icon: FileQuestion,
  },
};

const ITEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending_orders: ShoppingCart,
  pending_old: ShoppingCart,
  incomplete_orders: Clock,
  payments_unreconciled: CreditCard,
  quarantined_lots: ShieldAlert,
  new_quotes: FileQuestion,
  pending_reviews: Star,
};

export function NeedsAttentionStrip({ items }: { items: NeedsAttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-400">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        <span className="font-semibold">All operations clear:</span> No pending orders, incomplete checkouts, payments, quarantined lots, or RFQs awaiting action.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Needs Attention · দ্রুত করণীয়
        </h3>
        <span className="text-[11px] text-muted-foreground">{items.length} items flagged</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
        {items.map((item) => {
          const cfg = SEVERITY_CONFIG[item.severity];
          const Icon = ITEM_ICONS[item.id] || cfg.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border transition-all text-xs group",
                cfg.bg
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.title}</p>
                  <p className="text-[11px] opacity-80 truncate">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <Badge className={cn("h-5 px-1.5 rounded-full text-[11px]", cfg.badge)}>
                  {item.count}
                </Badge>
                <ArrowRight className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
