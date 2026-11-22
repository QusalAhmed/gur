"use client";

import * as React from "react";
import Link from "next/link";
import { Printer, AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBDT, formatDhakaDateTime, formatPhoneDisplay } from "@/lib/admin-format";
import { getOrderReprintDiff } from "@/lib/order-reprint";
import type { Order } from "@/types/order";

interface OrdersNeedingReprintCardProps {
  orders: Order[];
}

export function OrdersNeedingReprintCard({ orders }: OrdersNeedingReprintCardProps) {
  if (!orders || orders.length === 0) {
    return null;
  }

  const handleReprintSingle = (orderNumber: string) => {
    window.open(`/admin/orders/print?ids=${encodeURIComponent(orderNumber)}&format=58mm`, "_blank");
  };

  const handleReprintAll = () => {
    const ids = orders.map((o) => o.id).join(",");
    window.open(`/admin/orders/print?ids=${encodeURIComponent(ids)}&format=58mm`, "_blank");
  };

  return (
    <Card id="reprint-orders-card" className="border-amber-400/80 dark:border-amber-700/80 bg-amber-500/[0.03] shadow-xs scroll-mt-20">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 pt-4 px-4 sm:px-6 border-b border-amber-200/60 dark:border-amber-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <CardTitle className="text-base font-bold tracking-tight text-amber-950 dark:text-amber-200 flex items-center gap-2">
              <Printer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Orders Requiring Reprint ({orders.length})
            </CardTitle>
            <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 text-[10px] font-semibold">
              Action Required
            </Badge>
          </div>
          <CardDescription className="text-xs text-amber-900/80 dark:text-amber-300/80">
            Courier details were modified after physical stickers were printed. Reprint labels to ensure correct delivery.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleReprintAll}
            className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Reprint All ({orders.length})
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300">
            <Link href="/orders?reprint_required=true">
              View in Orders
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-amber-500/10 text-amber-900 dark:text-amber-300 border-b border-amber-200/60 dark:border-amber-800/40">
              <tr>
                <th className="py-2 px-4 font-medium">Order #</th>
                <th className="py-2 px-4 font-medium">Customer</th>
                <th className="py-2 px-4 font-medium">Changed Courier Details (Diff)</th>
                <th className="py-2 px-4 font-medium">Printed At</th>
                <th className="py-2 px-4 font-medium text-right">Total</th>
                <th className="py-2 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40 dark:divide-amber-800/30">
              {orders.map((o) => {
                const diffs = getOrderReprintDiff(o);

                return (
                  <tr key={o.id} className="hover:bg-amber-500/5 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                      <Link href={`/admin/orders/${o.id}`} className="hover:underline hover:text-amber-600 flex items-center gap-1">
                        {o.id}
                        <ArrowUpRight className="h-3 w-3 opacity-60" />
                      </Link>
                    </td>

                    <td className="py-2.5 px-4 min-w-[140px]">
                      <p className="font-semibold text-foreground truncate">{o.customer || "Customer"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {formatPhoneDisplay(o.phone)}
                      </p>
                    </td>

                    <td className="py-2.5 px-4 min-w-[240px]">
                      {diffs.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {diffs.map((d, i) => (
                            <div key={i} className="inline-flex items-center gap-1.5 text-[11px]">
                              <span className="font-semibold text-amber-900 dark:text-amber-300">{d.field}:</span>
                              <span className="text-muted-foreground line-through max-w-[120px] truncate">{d.old}</span>
                              <span className="text-amber-600 font-bold">→</span>
                              <span className="font-bold text-foreground max-w-[140px] truncate">{d.new}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Courier details edited</span>
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap text-[11px]">
                      {o.printed_at ? formatDhakaDateTime(o.printed_at, "dd MMM, hh:mm a") : "—"}
                    </td>

                    <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
                      {formatBDT(o.grand_total)}
                    </td>

                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleReprintSingle(o.id)}
                        className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer shadow-2xs"
                      >
                        <Printer className="h-3 w-3" />
                        Reprint
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
