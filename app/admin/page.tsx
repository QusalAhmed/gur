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
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { getAdminDashboardStatsAction } from "@/actions/dashboard";
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
} from "recharts";

const statusColors: Record<string, string> = {
  incomplete_order: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  partially_delivered: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  returned: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

const paymentColors: Record<string, string> = {
  unpaid: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  partially_paid: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  refunded: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  delta,
  icon: Icon,
  iconColor,
  delay = 0,
  isLoading = false,
}: {
  title: string;
  value: string;
  delta: string;
  icon: React.ElementType;
  iconColor: string;
  delay?: number;
  isLoading?: boolean;
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
              {isLoading ? (
                <div className="h-8 w-24 bg-muted animate-pulse rounded my-1" />
              ) : (
                <p className="text-2xl font-bold tracking-tight">{value}</p>
              )}
              <div className="flex items-center gap-1 text-xs">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
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

interface RecentOrderItem {
  id: string;
  customer: string;
  status: string;
  payment: string;
  amount: string;
  time: string;
  channel: string;
}

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
        <p className="font-mono text-sm font-semibold text-foreground">{row.original.id}</p>
        <p className="text-xs text-muted-foreground">{formatDate(row.original.time)}</p>
      </div>
    ),
  },
  {
    accessorKey: "customer",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
    cell: ({ row }) => <span className="text-sm font-medium text-foreground">{row.original.customer}</span>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const s = row.original.status;
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
            statusColors[s] || "bg-slate-100 text-slate-700"
          }`}
        >
          {s.replace(/_/g, " ")}
        </span>
      );
    },
  },
  {
    accessorKey: "payment",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payment" />,
    cell: ({ row }) => {
      const p = row.original.payment;
      return (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
            paymentColors[p] || "bg-gray-100 text-gray-700"
          }`}
        >
          {p.replace(/_/g, " ")}
        </span>
      );
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => <span className="font-semibold text-sm font-mono text-foreground">{row.original.amount}</span>,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const { storeName } = useSiteSettings();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: dashboardRes, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const res = await getAdminDashboardStatsAction();
      if (!res.success) {
        throw new Error(res.error || "Failed to load dashboard data");
      }
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const stats = dashboardRes;
  const currentMonthName = new Date().toLocaleString("en-US", { month: "short" });
  const displayStoreName = mounted ? storeName : "GUR";

  const revenueData = stats?.revenueTrends || [];
  const orderStatusData = stats?.orderStatusDistribution || [];
  const weeklyData = stats?.weeklyDispatch || [];
  const recentOrders = stats?.recentOrders || [];
  const topProductsData = stats?.topProducts || [];

  const totalWeeklyDispatches = weeklyData.reduce((acc, curr) => acc + curr.orders, 0);
  const peakDay = weeklyData.reduce((max, curr) => (curr.orders > max.orders ? curr : max), { day: "-", orders: 0 });

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
          <p className="text-muted-foreground text-sm" suppressHydrationWarning>
            Overview and real-time operations performance for {displayStoreName}
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
            <strong>{stats?.alerts.lowStockCount ?? 0} items</strong> are low on stock ·{" "}
            <strong>{stats?.alerts.pendingQuotesCount ?? 0} quote requests</strong> awaiting reply ·{" "}
            <strong>{stats?.alerts.pendingB2bCount ?? 0} B2B accounts</strong> pending approval
          </p>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0 cursor-pointer"
            onClick={() => router.push("/admin/inventory")}
          >
            Review
          </Button>
        </div>
      </motion.div>

      {/* KPI stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`Revenue (${currentMonthName})`}
          value={`৳ ${Number(stats?.kpis.monthlyRevenue || 0).toLocaleString("en-BD")}`}
          delta={stats?.kpis.monthlyRevenueDelta || "+0%"}
          icon={TrendingUp}
          iconColor="bg-green-100 text-green-600 dark:bg-green-900/30"
          delay={0.1}
          isLoading={isLoading}
        />
        <StatCard
          title="Orders"
          value={String(stats?.kpis.monthlyOrders || 0)}
          delta={stats?.kpis.monthlyOrdersDelta || "+0%"}
          icon={ShoppingCart}
          iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30"
          delay={0.15}
          isLoading={isLoading}
        />
        <StatCard
          title="Active Products"
          value={String(stats?.kpis.activeProducts || 0)}
          delta={stats?.kpis.activeProductsDelta || "+0"}
          icon={Package}
          iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30"
          delay={0.2}
          isLoading={isLoading}
        />
        <StatCard
          title="New Customers"
          value={String(stats?.kpis.newCustomers || 0)}
          delta={stats?.kpis.newCustomersDelta || "+0%"}
          icon={Users}
          iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30"
          delay={0.25}
          isLoading={isLoading}
        />
      </div>

      {/* Second row stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Orders"
          value={String(stats?.kpis.pendingOrders || 0)}
          delta={stats?.kpis.pendingOrdersDelta || "+0"}
          icon={Clock}
          iconColor="bg-red-100 text-red-600 dark:bg-red-900/30"
          delay={0.3}
          isLoading={isLoading}
        />
        <StatCard
          title="Quote Requests"
          value={String(stats?.kpis.quoteRequests || 0)}
          delta={stats?.kpis.quoteRequestsDelta || "+0"}
          icon={FileQuestion}
          iconColor="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30"
          delay={0.35}
          isLoading={isLoading}
        />
        <StatCard
          title="B2B Accounts"
          value={String(stats?.kpis.b2bAccounts || 0)}
          delta={stats?.kpis.b2bAccountsDelta || "+0"}
          icon={Building2}
          iconColor="bg-teal-100 text-teal-600 dark:bg-teal-900/30"
          delay={0.4}
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Reviews"
          value={String(stats?.kpis.pendingReviews || 0)}
          delta={stats?.kpis.pendingReviewsDelta || "+0"}
          icon={Star}
          iconColor="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
          delay={0.45}
          isLoading={isLoading}
        />
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
              {revenueData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                  No revenue history recorded yet
                </div>
              ) : (
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
              )}
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
              <CardDescription>Recent distribution</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {orderStatusData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  No orders recorded yet
                </div>
              ) : (
                <>
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
                </>
              )}
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
                {totalWeeklyDispatches} Total Dispatches
              </Badge>
              {peakDay.orders > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Peak: {peakDay.day} ({peakDay.orders})
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
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
                <CardDescription>Latest 5 orders from database</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/orders">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <DataTable
                columns={recentOrderColumns}
                data={recentOrders}
                cellClassName="text-sm py-3"
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
              {topProductsData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  No product sales recorded yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topProductsData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Bar dataKey="sales" fill="#d97706" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
