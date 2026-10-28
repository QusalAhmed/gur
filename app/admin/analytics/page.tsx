"use client";

import { motion } from "motion/react";
import { Plus, Search, MoreHorizontal, TrendingUp, BarChart3, PieChart as PieChartIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart,
} from "recharts";

const monthlyRevenue = [
  { month: "Jan", revenue: 280000, orders: 22, newCustomers: 18 },
  { month: "Feb", revenue: 320000, orders: 28, newCustomers: 24 },
  { month: "Mar", revenue: 410000, orders: 35, newCustomers: 31 },
  { month: "Apr", revenue: 380000, orders: 32, newCustomers: 27 },
  { month: "May", revenue: 420000, orders: 38, newCustomers: 29 },
  { month: "Jun", revenue: 580000, orders: 52, newCustomers: 45 },
  { month: "Jul", revenue: 510000, orders: 45, newCustomers: 38 },
  { month: "Aug", revenue: 670000, orders: 61, newCustomers: 52 },
  { month: "Sep", revenue: 730000, orders: 70, newCustomers: 61 },
  { month: "Oct", revenue: 890000, orders: 84, newCustomers: 70 },
];

const channelData = [
  { name: "Web", value: 42, color: "#3b82f6" },
  { name: "Phone", value: 22, color: "#8b5cf6" },
  { name: "WhatsApp", value: 18, color: "#22c55e" },
  { name: "Admin", value: 12, color: "#d97706" },
  { name: "Facebook", value: 6, color: "#ef4444" },
];

const paymentMethodData = [
  { name: "Cash on Delivery", value: 38, color: "#64748b" },
  { name: "bKash", value: 26, color: "#e11d48" },
  { name: "Bank Transfer", value: 18, color: "#0ea5e9" },
  { name: "Nagad", value: 10, color: "#f97316" },
  { name: "Credit Terms", value: 8, color: "#8b5cf6" },
];

const productPerformance = [
  { product: "Blackstrap 200L", revenue: 312000, units: 142 },
  { product: "Food Grade 5kg", revenue: 196000, units: 98 },
  { product: "Feed Grade A 1t", revenue: 287000, units: 87 },
  { product: "Sugar Beet 5kg", revenue: 128000, units: 64 },
  { product: "Date Palm 500ml", revenue: 76500, units: 51 },
];

const retentionData = [
  { month: "May", new: 29, returning: 9 },
  { month: "Jun", new: 45, returning: 7 },
  { month: "Jul", new: 38, returning: 7 },
  { month: "Aug", new: 52, returning: 9 },
  { month: "Sep", new: 61, returning: 9 },
  { month: "Oct", new: 70, returning: 14 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">Business insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="ytd">
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">This Month</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="last30">Last 30 Days</SelectItem>
              <SelectItem value="last90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">Export Report</Button>
        </div>
      </motion.div>

      {/* KPI Row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Revenue (YTD)", value: "৳ 51,90,000", delta: "+38%", positive: true },
          { label: "Total Orders (YTD)", value: "467", delta: "+31%", positive: true },
          { label: "Avg. Order Value", value: "৳ 11,112", delta: "+5.4%", positive: true },
          { label: "Customer LTV Avg.", value: "৳ 4,168", delta: "-2.1%", positive: false },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className={`text-xs mt-0.5 ${s.positive ? "text-green-600" : "text-red-600"}`}>{s.delta} vs last year</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Main revenue chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue & Order Volume</CardTitle>
            <CardDescription>Monthly breakdown for 2026</CardDescription>
          </CardHeader>
          <CardContent>
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
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
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
                  <span className="font-semibold">{c.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment methods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
            <CardDescription>How customers pay</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={paymentMethodData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`${v}%`, "Share"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                {paymentMethodData.map((entry, i) => (
                  <Bar key={i} dataKey="value" fill={entry.color} radius={[0, 4, 4, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="product" tick={{ fontSize: 9 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar yAxisId="left" dataKey="revenue" fill="#d97706" radius={[4, 4, 0, 0]} name="Revenue (৳)" />
                <Bar yAxisId="right" dataKey="units" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Units" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Customer retention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Acquisition</CardTitle>
            <CardDescription>New vs returning customers per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={retentionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="new" fill="#22c55e" radius={[4, 4, 0, 0]} name="New" stackId="a" />
                <Bar dataKey="returning" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Returning" stackId="a" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
