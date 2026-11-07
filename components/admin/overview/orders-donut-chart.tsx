"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatBDT } from "@/lib/admin-format";

interface OrdersDonutChartProps {
  data: Array<{
    dimension_key: string;
    dimension_label: string;
    orders_count: number;
    revenue: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  incomplete_order: "#64748b", // slate
  pending: "#d97706", // amber
  confirmed: "#2563eb", // blue
  processing: "#4f46e5", // indigo
  shipped: "#9333ea", // purple
  delivered: "#10b981", // emerald
  cancelled: "#e11d48", // rose
  returned: "#f97316", // orange
};

export function OrdersDonutChart({ data }: OrdersDonutChartProps) {
  const chartData = data.filter((d) => Number(d.orders_count) > 0);
  const totalOrders = chartData.reduce((acc, curr) => acc + Number(curr.orders_count || 0), 0);

  return (
    <Card className="border-border/80 shadow-xs flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
        <CardTitle className="text-base font-semibold tracking-tight">
          Orders by Status
        </CardTitle>
        <CardDescription className="text-xs">
          Lifecycle breakdown of all recorded orders
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1 flex-1 flex flex-col justify-between">
        <div className="h-[180px] w-full relative">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No orders to display.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="orders_count"
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`cell-${entry.dimension_key}`}
                        fill={STATUS_COLORS[entry.dimension_key] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        const pct = totalOrders > 0 ? Math.round((item.orders_count / totalOrders) * 100) : 0;
                        return (
                          <div className="rounded-lg border border-border bg-popover p-2 shadow-md text-xs">
                            <p className="font-semibold text-foreground mb-0.5">{item.dimension_label}</p>
                            <p className="text-muted-foreground">
                              {item.orders_count} orders ({pct}%)
                            </p>
                            <p className="text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                              {formatBDT(item.revenue)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold font-mono">{totalOrders}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Orders</span>
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-2 border-t border-border/60 text-xs">
          {chartData.slice(0, 6).map((item) => (
            <div key={item.dimension_key} className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[item.dimension_key] || "#94a3b8" }}
                />
                <span className="truncate text-muted-foreground text-[11px]">{item.dimension_label}</span>
              </div>
              <span className="font-mono text-[11px] font-medium pl-1">{item.orders_count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
