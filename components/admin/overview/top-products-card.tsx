"use client";

import * as React from "react";
import Link from "next/link";
import { Package, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatBDT } from "@/lib/admin-format";

interface TopProductsCardProps {
  products: Array<{
    product_id: string;
    product_name: string;
    units_sold: number;
    revenue: number;
    order_count: number;
  }>;
}

export function TopProductsCard({ products }: TopProductsCardProps) {
  return (
    <Card className="border-border/80 shadow-xs flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 sm:px-6">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight">Top Products</CardTitle>
          <CardDescription className="text-xs">Highest revenue molasses by sales volume</CardDescription>
        </div>
        <Link
          href="/admin/products"
          className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-0.5 font-medium"
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 pt-1 flex-1">
        {products.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            No product sales recorded in this period.
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((p, idx) => (
              <div key={p.product_id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-mono font-medium text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{p.product_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.units_sold} units sold · {p.order_count} orders
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-semibold text-foreground">{formatBDT(p.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
