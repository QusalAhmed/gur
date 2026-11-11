"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
} from "recharts";
import { getAdminAnalyticsAction, AnalyticsTimeRange } from "@/actions/analytics";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = React.useState<AnalyticsTimeRange>("ytd");

  const { data: analyticsRes, isLoading } = useQuery({
    queryKey: ["admin", "analytics", timeRange],
    queryFn: async () => {
      const res = await getAdminAnalyticsAction(timeRange);
      if (!res.success) {
        throw new Error(res.error || "Failed to load analytics");
      }
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const analytics = analyticsRes;
  const monthlyRevenue = analytics?.monthlyRevenue || [];
  const channelData = analytics?.channelData || [];
  const paymentMethodData = analytics?.paymentMethodData || [];
  const productPerformance = analytics?.productPerformance || [];
  const retentionData = analytics?.retentionData || [];

  const timeRangeLabels: Record<AnalyticsTimeRange, string> = {
    mtd: "This Month",
    ytd: "Year to Date",
    last30: "Last 30 Days",
    last90: "Last 90 Days",
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">Business insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as AnalyticsTimeRange)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">This Month</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="last30">Last 30 Days</SelectItem>
              <SelectItem value="last90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()}>Export Report</Button>
        </div>
      </motion.div>

      {/* KPI Row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: `Total Revenue (${timeRangeLabels[timeRange]})`,
            value: `৳ ${Number(analytics?.kpis.totalRevenue || 0).toLocaleString("en-BD")}`,
            delta: analytics?.kpis.totalRevenueDelta || "+0%",
            positive: true,
          },
          {
            label: `Total Orders (${timeRangeLabels[timeRange]})`,
            value: String(analytics?.kpis.totalOrders || 0),
            delta: analytics?.kpis.totalOrdersDelta || "+0%",
            positive: true,
          },
          {
            label: "Avg. Order Value",
            value: `৳ ${Number(analytics?.kpis.avgOrderValue || 0).toLocaleString("en-BD")}`,
            delta: analytics?.kpis.avgOrderValueDelta || "+0%",
            positive: true,
          },
          {
            label: "Unique Customers",
            value: String(analytics?.kpis.uniqueCustomers || 0),
            delta: analytics?.kpis.uniqueCustomersDelta || "+0%",
            positive: true,
          },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              {isLoading ? (
                <div className="h-8 w-24 bg-muted animate-pulse rounded my-1" />
              ) : (
                <p className="text-2xl font-bold">{s.value}</p>
              )}
              <p className={`text-xs mt-0.5 ${s.positive ? "text-green-600" : "text-red-600"}`}>{s.delta} vs prev period</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Main revenue chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue & Order Volume</CardTitle>
            <CardDescription>Monthly breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyRevenue.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                No revenue or orders recorded in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyRevenue}>
                  <defs>
                    <linearGradient id="analyticRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "revenue" ? [`৳ ${Number(value).toLocaleString()}`, "Revenue"] : [value, name === "orders" ? "Orders" : "New Customers"]
                    }
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#analyticRevenue)" stroke="#d97706" strokeWidth={2} name="revenue" />
                  <Bar yAxisId="right" dataKey="orders" fill="#3b82f6" opacity={0.7} radius={[3, 3, 0, 0]} name="orders" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Second row charts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid gap-6 lg:grid-cols-2">
        {/* Channel distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by Channel</CardTitle>
            <CardDescription>Sales channel breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-6 items-center">
            {channelData.length === 0 ? (
              <div className="h-[180px] w-full flex items-center justify-center text-sm text-muted-foreground">
                No channel data available
              </div>
            ) : (
              <>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={channelData} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={2}>
                      {channelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {channelData.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="flex-1 text-muted-foreground">{c.name}</span>
                      <span className="font-semibold">{c.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment methods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
            <CardDescription>How customers pay</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentMethodData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No payment methods recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={paymentMethodData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`${v} orders`, "Count"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Bar dataKey="value" fill="#d97706" radius={[0, 4, 4, 0]}>
                    {paymentMethodData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Third row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid gap-6 lg:grid-cols-2">
        {/* Top products by revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Performance</CardTitle>
            <CardDescription>Revenue vs units sold</CardDescription>
          </CardHeader>
          <CardContent>
            {productPerformance.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No product sales in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="product" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Bar yAxisId="left" dataKey="revenue" fill="#d97706" radius={[4, 4, 0, 0]} name="Revenue (৳)" />
                  <Bar yAxisId="right" dataKey="units" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Units" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Customer retention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Acquisition</CardTitle>
            <CardDescription>New vs returning customers per month</CardDescription>
          </CardHeader>
          <CardContent>
            {retentionData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No customer activity in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={retentionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Bar dataKey="new" fill="#22c55e" radius={[4, 4, 0, 0]} name="New" stackId="a" />
                  <Bar dataKey="returning" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Returning" stackId="a" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
