"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileQuestion,
  Building2,
  Star,
  Clock,
  Calendar,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/use-site-settings";
import {
  AreaChart,
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
} from "recharts";

// ─── Mock data ────────────────────────────────────────────────────────────────

const weeklyData = [
  { day: "Mon", orders: 14 },
  { day: "Tue", orders: 18 },
  { day: "Wed", orders: 9 },
  { day: "Thu", orders: 22 },
  { day: "Fri", orders: 31 },
  { day: "Sat", orders: 27 },
  { day: "Sun", orders: 11 },
];

const revenueData = [
  { month: "May", revenue: 420000, orders: 38 },
  { month: "Jun", revenue: 580000, orders: 52 },
  { month: "Jul", revenue: 510000, orders: 45 },
  { month: "Aug", revenue: 670000, orders: 61 },
  { month: "Sep", revenue: 730000, orders: 70 },
  { month: "Oct", revenue: 890000, orders: 84 },
];

const orderStatusData = [
  { name: "Delivered", value: 312, color: "#22c55e" },
  { name: "Processing", value: 48, color: "#3b82f6" },
  { name: "Shipped", value: 29, color: "#8b5cf6" },
  { name: "Pending", value: 21, color: "#f59e0b" },
  { name: "Cancelled", value: 14, color: "#ef4444" },
];

const topProductsData = [
  { name: "Blackstrap 200L", sales: 142 },
  { name: "Food Grade Jar", sales: 98 },
  { name: "Feed Grade Drum", sales: 87 },
  { name: "Sugar Beet 5kg", sales: 64 },
  { name: "Date Palm Bulk", sales: 51 },
];

const recentOrders = [
  {
    id: "MOL-2610-01005",
    customer: "Tareq Rahman",
    status: "pending",
    payment: "unpaid",
    amount: "৳ 820",
    time: "25 Oct 2026, 13:01",
    channel: "web",
  },
  {
    id: "MOL-2610-01004",
    customer: "Rana",
    status: "pending",
    payment: "unpaid",
    amount: "৳ 4,768.6",
    time: "25 Oct 2026, 06:45",
    channel: "web",
  },
  {
    id: "MOL-2610-01003",
    customer: "Karim Ullah",
    status: "pending",
    payment: "unpaid",
    amount: "৳ 820",
    time: "25 Oct 2026, 05:22",
    channel: "web",
  },
  {
    id: "MOL-2610-01002",
    customer: "Qusal Ahmed",
    status: "pending",
    payment: "unpaid",
    amount: "৳ 440",
    time: "25 Oct 2026, 04:30",
    channel: "web",
  },
];

const statusColors: Record<string, string> = {
  incomplete_order: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  partially_delivered: "bg-teal-100 text-teal-700",
  cancelled: "bg-red-100 text-red-700",
  returned: "bg-orange-100 text-orange-700",
};

const paymentColors: Record<string, string> = {
  unpaid: "bg-red-100 text-red-700",
  partially_paid: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  refunded: "bg-gray-100 text-gray-700",
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  delta,
  icon: Icon,
  iconColor,
  delay = 0,
}: {
  title: string;
  value: string;
  delta: string;
  icon: React.ElementType;
  iconColor: string;
  delay?: number;
}) {
  const isPositive = delta.startsWith("+");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <div className="flex items-center gap-1 text-xs">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={isPositive ? "text-green-600" : "text-red-600"}>
                  {delta}
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </div>
            <div className={`rounded-lg p-2.5 ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Recent Order Columns ──────────────────────────────────────────────────────

type RecentOrderItem = typeof recentOrders[0];

const recentOrderColumns: ColumnDef<RecentOrderItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select order"
        className="translate-y-[2px]"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-xs font-semibold text-foreground">{row.original.id}</p>
        <p className="text-[11px] text-muted-foreground">{formatDate(row.original.time)}</p>
      </div>
    ),
  },
  {
    accessorKey: "customer",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
    cell: ({ row }) => <span className="text-xs font-medium text-foreground">{row.original.customer}</span>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusColors[row.original.status]}`}>
        {row.original.status}
      </span>
    ),
  },
  {
    accessorKey: "payment",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payment" />,
    cell: ({ row }) => (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${paymentColors[row.original.payment]}`}>
        {row.original.payment}
      </span>
    ),
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => <span className="font-semibold text-xs text-foreground">{row.original.amount}</span>,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const { storeName } = useSiteSettings();

  return (
    <div className="space-y-6">
      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview and real-time operations performance for {storeName}
          </p>
        </div>
      </motion.div>

      {/* Alert banner */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>3 items</strong> are low on stock · <strong>5 quote requests</strong> awaiting reply · <strong>3 B2B accounts</strong> pending approval
          </p>
          <Button size="sm" variant="outline" className="ml-auto border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0 cursor-pointer">
            Review
          </Button>
        </div>
      </motion.div>

      {/* KPI stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Revenue (Oct)" value="৳ 8,90,000" delta="+21.9%" icon={TrendingUp} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30" delay={0.1} />
        <StatCard title="Orders" value="84" delta="+20%" icon={ShoppingCart} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30" delay={0.15} />
        <StatCard title="Active Products" value="47" delta="+4" icon={Package} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30" delay={0.2} />
        <StatCard title="New Customers" value="138" delta="-5.4%" icon={Users} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30" delay={0.25} />
      </div>

      {/* Second row stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pending Orders" value="21" delta="+3" icon={Clock} iconColor="bg-red-100 text-red-600 dark:bg-red-900/30" delay={0.3} />
        <StatCard title="Quote Requests" value="5" delta="+5" icon={FileQuestion} iconColor="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30" delay={0.35} />
        <StatCard title="B2B Accounts" value="12" delta="+3" icon={Building2} iconColor="bg-teal-100 text-teal-600 dark:bg-teal-900/30" delay={0.4} />
        <StatCard title="Pending Reviews" value="8" delta="+8" icon={Star} iconColor="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30" delay={0.45} />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Revenue & Orders</CardTitle>
              <CardDescription>Last 6 months performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "revenue" ? [`৳ ${Number(value).toLocaleString()}`, "Revenue"] : [value, "Orders"]
                    }
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#d97706" fill="url(#colorRevenue)" strokeWidth={2} />
                  <Area yAxisId="right" type="monotone" dataKey="orders" stroke="#3b82f6" fill="url(#colorOrders)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Order status pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Order Status</CardTitle>
              <CardDescription>All time distribution</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {orderStatusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs w-full">
                {orderStatusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="ml-auto font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Weekly Dispatch & Order Volume */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.58 }}
      >
        <Card id="weekly-dispatch-card">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                Weekly Dispatch & Order Volume
              </CardTitle>
              <CardDescription>
                Daily fulfillment & dispatch metrics for the current week
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600 inline-block" />
                Dispatched Orders
              </span>
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 font-mono text-xs">
                132 Total Dispatches
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Peak: Friday (31)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(value) => [`${value} Orders Dispatched`, "Volume"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="orders" fill="#d97706" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Orders</CardTitle>
                <CardDescription>Latest 5 orders</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/orders">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <DataTable
                columns={recentOrderColumns}
                data={recentOrders}
                searchPlaceholder="Search recent orders..."
                enableRowSelection={true}
                enableSorting={true}
                enablePagination={true}
                initialPageSize={5}
                pageSizeOptions={[5, 10]}
                onRowClick={(order) => router.push(`/admin/orders?search=${order.id}`)}
                emptyMessage="No recent orders found."
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Top products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.65 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Top Products</CardTitle>
              <CardDescription>By units sold this month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProductsData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Bar dataKey="sales" fill="#d97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
