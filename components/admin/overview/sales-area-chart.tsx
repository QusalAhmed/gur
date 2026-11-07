"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBDT } from "@/lib/admin-format";

interface SalesAreaChartProps {
  series: Array<{
    bucket_time: string;
    bucket_label: string;
    orders_count: number;
    revenue: number;
    collected: number;
  }>;
}

export function SalesAreaChart({ series }: SalesAreaChartProps) {
  const [metric, setMetric] = React.useState<"revenue" | "orders">("revenue");

  const totalRev = series.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const totalOrders = series.reduce((sum, item) => sum + Number(item.orders_count || 0), 0);

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 sm:px-6">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold tracking-tight">
            Sales & Orders Velocity
          </CardTitle>
          <CardDescription className="text-xs">
            {metric === "revenue"
              ? `Total revenue: ${formatBDT(totalRev)}`
              : `Total volume: ${totalOrders} orders`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
          <Button
            variant={metric === "revenue" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setMetric("revenue")}
          >
            Revenue (৳)
          </Button>
          <Button
            variant={metric === "orders" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setMetric("orders")}
          >
            Orders Count
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6 pb-4 pt-2">
        <div className="h-[260px] sm:h-[280px] w-full">
          {series.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No sales data recorded in this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.6)" />
                <XAxis
                  dataKey="bucket_label"
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={5}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (metric === "revenue" ? `৳${val >= 1000 ? `${Math.round(val / 1000)}k` : val}` : String(val))}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover p-2.5 shadow-md">
                          <p className="text-xs font-semibold text-foreground mb-1">
                            {data.bucket_label}
                          </p>
                          <div className="space-y-0.5 text-xs">
                            <p className="text-amber-600 dark:text-amber-400 font-mono font-medium">
                              Revenue: {formatBDT(data.revenue)}
                            </p>
                            <p className="text-muted-foreground font-mono">
                              Orders: {data.orders_count}
                            </p>
                            {data.collected > 0 && (
                              <p className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">
                                Collected: {formatBDT(data.collected)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={metric === "revenue" ? "revenue" : "orders_count"}
                  stroke={metric === "revenue" ? "#d97706" : "#2563eb"}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={metric === "revenue" ? "url(#amberGradient)" : "url(#blueGradient)"}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
