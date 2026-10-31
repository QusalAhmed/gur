"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDateTime } from "@/lib/utils";
import { SteadfastBalanceCard } from "@/components/admin/steadfast-balance-card";

export interface TransactionItem {
  id: string;
  orderId: string;
  customer: string;
  method: "bkash" | "nagad" | "bank_transfer" | "card" | "cod";
  kind: "charge" | "refund";
  amount: string;
  amountNumeric: number;
  gatewayRef: string;
  status: "succeeded" | "pending" | "failed" | "cancelled";
  date: string;
}

export interface PaymentLogItem {
  id: string;
  txnId: string;
  gateway: string;
  event: string;
  status: string;
  time: string;
}

const paymentVolumeData = [
  { day: "Mon", amount: 145000 },
  { day: "Tue", amount: 210000 },
  { day: "Wed", amount: 180000 },
  { day: "Thu", amount: 320000 },
  { day: "Fri", amount: 410000 },
  { day: "Sat", amount: 285000 },
  { day: "Sun", amount: 160000 },
];

const methodShareData = [
  { name: "bKash", value: 38, color: "#e11d48" },
  { name: "Bank Transfer", value: 28, color: "#0ea5e9" },
  { name: "Cash on Delivery", value: 20, color: "#64748b" },
  { name: "Nagad", value: 10, color: "#f97316" },
  { name: "Cards / Visa", value: 4, color: "#8b5cf6" },
];

const initialTransactions: TransactionItem[] = [
  {
    id: "TXN-98421",
    orderId: "MOL-2610-01005",
    customer: "Tareq Rahman",
    method: "cod",
    kind: "charge",
    amount: "৳ 820",
    amountNumeric: 820,
    gatewayRef: "COD-01005",
    status: "pending",
    date: "25 Oct 2026, 13:01",
  },
  {
    id: "TXN-98420",
    orderId: "MOL-2610-01004",
    customer: "Rana",
    method: "cod",
    kind: "charge",
    amount: "৳ 4,768.6",
    amountNumeric: 4768.6,
    gatewayRef: "COD-01004",
    status: "pending",
    date: "25 Oct 2026, 06:45",
  },
  {
    id: "TXN-98419",
    orderId: "MOL-2610-01003",
    customer: "Karim Ullah",
    method: "cod",
    kind: "charge",
    amount: "৳ 820",
    amountNumeric: 820,
    gatewayRef: "COD-01003",
    status: "pending",
    date: "25 Oct 2026, 05:22",
  },
  {
    id: "TXN-98418",
    orderId: "MOL-2610-01002",
    customer: "Qusal Ahmed",
    method: "cod",
    kind: "charge",
    amount: "৳ 440",
    amountNumeric: 440,
    gatewayRef: "COD-01002",
    status: "pending",
    date: "25 Oct 2026, 04:30",
  },
  {
    id: "TXN-98415",
    orderId: "MOL-2610-01075",
    customer: "Bengal Distilleries",
    method: "bank_transfer",
    kind: "charge",
    amount: "৳ 340,000",
    amountNumeric: 340000,
    gatewayRef: "SCB-RTGS-781",
    status: "succeeded",
    date: "22 Oct 2026, 16:30",
  },
  {
    id: "TXN-98414",
    orderId: "MOL-2610-01071",
    customer: "Green Agro Farm",
    method: "cod",
    kind: "charge",
    amount: "৳ 14,800",
    amountNumeric: 14800,
    gatewayRef: "COD-COLLECTED",
    status: "succeeded",
    date: "22 Oct 2026, 10:15",
  },
];

const initialLogs: PaymentLogItem[] = [
  { id: "LOG-5512", txnId: "TXN-98420", gateway: "bKash Tokenized", event: "payment.create.callback", status: "200 OK", time: "25 Oct 2026, 12:35:10" },
  { id: "LOG-5511", txnId: "TXN-98419", gateway: "Nagad API", event: "refund.process.completed", status: "200 OK", time: "25 Oct 2026, 18:10:04" },
  { id: "LOG-5510", txnId: "TXN-98417", gateway: "SSLCommerz", event: "session.validate.success", status: "200 OK", time: "24 Oct 2026, 11:22:45" },
  { id: "LOG-5509", txnId: "TXN-98416", gateway: "System COD", event: "cod.payment.scheduled", status: "200 OK", time: "24 Oct 2026, 09:40:12" },
  { id: "LOG-5508", txnId: "TXN-98415", gateway: "Bank RTGS", event: "settlement.reconciliation", status: "200 OK", time: "23 Oct 2026, 16:30:00" },
];

const statusStyles: Record<string, string> = {
  succeeded: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function PaymentsPage() {
  const [transactions, setTransactions] = React.useState<TransactionItem[]>(initialTransactions);
  const [logs, setLogs] = React.useState<PaymentLogItem[]>(initialLogs);
  const [activeTab, setActiveTab] = React.useState("all");
  const [methodFilter, setMethodFilter] = React.useState("all");

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((t) => {
      if (activeTab === "charges" && t.kind !== "charge") return false;
      if (activeTab === "refunds" && t.kind !== "refund") return false;
      if (methodFilter !== "all" && t.method !== methodFilter) return false;
      return true;
    });
  }, [transactions, activeTab, methodFilter]);

  const handleExportCSV = (selected: TransactionItem[]) => {
    const list = selected.length > 0 ? selected : filteredTransactions;
    const headers = ["TxnID", "OrderID", "Customer", "Method", "Kind", "Amount", "GatewayRef", "Status", "Date"];
    const rows = list.map((t) => [
      t.id,
      t.orderId,
      `"${t.customer}"`,
      t.method,
      t.kind,
      `"${t.amount}"`,
      t.gatewayRef,
      t.status,
      formatDateTime(t.date),
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `transactions_${Date.now()}.csv`;
    link.click();
  };

  const txnColumns = React.useMemo<ColumnDef<TransactionItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all transactions"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select transaction"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Transaction" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {row.getValue("id")}
        </span>
      ),
    },
    {
      accessorKey: "orderId",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-amber-700 dark:text-amber-400 font-medium">
          {row.getValue("orderId")}
        </span>
      ),
    },
    {
      accessorKey: "customer",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <span className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
          {row.getValue("customer")}
        </span>
      ),
    },
    {
      accessorKey: "method",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
      cell: ({ row }) => {
        const method = String(row.getValue("method")).replace("_", " ");
        return (
          <Badge variant="outline" className="capitalize text-xs font-normal">
            {method}
          </Badge>
        );
      },
    },
    {
      accessorKey: "gatewayRef",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gateway Ref" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.getValue("gatewayRef")}</span>
      ),
    },
    {
      accessorKey: "kind",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const kind = row.original.kind;
        return (
          <span
            className={`inline-flex items-center text-xs font-medium capitalize ${
              kind === "refund" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {kind === "refund" ? (
              <ArrowDownLeft className="h-3 w-3 mr-1" />
            ) : (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            )}
            {kind}
          </span>
        );
      },
    },
    {
      accessorKey: "amountNumeric",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => (
        <span className="font-bold text-sm text-foreground">{row.original.amount}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${statusStyles[status]}`}
          >
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: "date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date & Time" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(row.getValue("date"))}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => alert(`View receipt for ${t.id}`)}>
                <Receipt className="h-3.5 w-3.5 mr-2" /> View Receipt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Gateway ping: ${t.gatewayRef} is verified OK`)}>
                <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Verify Gateway
              </DropdownMenuItem>
              {t.status === "pending" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-emerald-600 focus:text-emerald-600"
                    onClick={() =>
                      setTransactions((prev) =>
                        prev.map((item) => (item.id === t.id ? { ...item, status: "succeeded" } : item))
                      )
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark Settled
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const logColumns = React.useMemo<ColumnDef<PaymentLogItem>[]>(() => [
    {
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Log ID" />,
      cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.getValue("id")}</span>,
    },
    {
      accessorKey: "txnId",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Txn Ref" />,
      cell: ({ row }) => <span className="font-mono text-xs text-amber-700 dark:text-amber-400">{row.getValue("txnId")}</span>,
    },
    {
      accessorKey: "gateway",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gateway" />,
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("gateway")}</span>,
    },
    {
      accessorKey: "event",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Event Webhook" />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue("event")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Response Status" />,
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          {row.getValue("status")}
        </span>
      ),
    },
    {
      accessorKey: "time",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.getValue("time"))}</span>,
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments & Ledger</h1>
          <p className="text-muted-foreground text-sm">
            Monitor transactions, payment gateways, bKash/Nagad logs, and settlements
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => handleExportCSV([])}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Statement
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
            onClick={() => {
              const newTxn: TransactionItem = {
                id: `TXN-${Math.floor(98422 + Math.random() * 1000)}`,
                orderId: `MOL-2610-0${Math.floor(1085 + Math.random() * 50)}`,
                customer: "Direct Counter Sale",
                method: "bkash",
                kind: "charge",
                amount: "৳ 6,500",
                amountNumeric: 6500,
                gatewayRef: `BK-${Date.now().toString().slice(-7)}`,
                status: "succeeded",
                date: "24 Oct 2026, 15:40",
              };
              setTransactions((prev) => [newTxn, ...prev]);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Processed (30d)</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">৳ 4,892,500</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">+14.2% from last month</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Pending Settlements</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">৳ 184,200</p>
            <p className="text-xs text-muted-foreground mt-0.5">14 COD & bank invoices</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Refunds Issued</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">৳ 41,000</p>
            <p className="text-xs text-muted-foreground mt-0.5">1 batch quality adjustment</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Success Rate</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">99.1%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Gateway uptimes optimal</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Courier Remittance & Merchant Balance */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <SteadfastBalanceCard />
        </div>
      </motion.div>

      {/* Analytics Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid gap-4 lg:grid-cols-3"
      >
        <Card className="lg:col-span-2 border shadow-xs">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold">Payment Volume Trend (Past 7 Days)</CardTitle>
            <CardDescription className="text-xs">Gross collections across all channels</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `৳${(val / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val) => [`৳ ${Number(val).toLocaleString()}`, "Volume"]} />
                  <Bar dataKey="amount" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold">Gateway Distribution</CardTitle>
            <CardDescription className="text-xs">Volume share by payment channel</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodShareData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={58}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {methodShareData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val}%`, "Share"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] mt-2">
              {methodShareData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name} ({item.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs & Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList className="bg-muted/60 p-1">
              <TabsTrigger value="all" className="text-xs">
                All Transactions <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{transactions.length}</span>
              </TabsTrigger>
              <TabsTrigger value="charges" className="text-xs">
                Charges
              </TabsTrigger>
              <TabsTrigger value="refunds" className="text-xs">
                Refunds
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs">
                Gateway Webhook Logs <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{logs.length}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="m-0">
            <DataTable
              columns={txnColumns}
              data={filteredTransactions}
              searchPlaceholder="Search txn ID, order ID, customer..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={5}
              pageSizeOptions={[5, 10, 20]}
              toolbarPrefix={
                <div className="flex items-center gap-2">
                  <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v || "all")}>
                    <SelectTrigger className="w-36 h-9 text-xs">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="bkash">bKash</SelectItem>
                      <SelectItem value="nagad">Nagad</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="card">Cards / Visa</SelectItem>
                      <SelectItem value="cod">Cash on Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                  {methodFilter !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMethodFilter("all")}
                      className="h-9 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              }
              bulkActions={(selected, clearSelection) => (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background text-emerald-700 dark:text-emerald-400"
                    onClick={() => {
                      const ids = new Set(selected.map((s) => s.id));
                      setTransactions((prev) =>
                        prev.map((t) => (ids.has(t.id) ? { ...t, status: "succeeded" as const } : t))
                      );
                      clearSelection();
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Mark Settled
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background"
                    onClick={() => handleExportCSV(selected)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export Selected
                  </Button>
                </>
              )}
              emptyMessage="No transactions match your search or filter criteria."
            />
          </TabsContent>

          <TabsContent value="charges" className="m-0">
            <DataTable
              columns={txnColumns}
              data={filteredTransactions}
              searchPlaceholder="Search charges..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={5}
              pageSizeOptions={[5, 10, 20]}
              emptyMessage="No charge records found."
            />
          </TabsContent>

          <TabsContent value="refunds" className="m-0">
            <DataTable
              columns={txnColumns}
              data={filteredTransactions}
              searchPlaceholder="Search refunds..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={5}
              pageSizeOptions={[5, 10, 20]}
              emptyMessage="No refund records found."
            />
          </TabsContent>

          <TabsContent value="logs" className="m-0">
            <Card className="border shadow-xs">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-base font-semibold">Gateway Event Logs</CardTitle>
                <CardDescription className="text-xs">Real-time webhook and API callback records</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <DataTable
                  columns={logColumns}
                  data={logs}
                  searchPlaceholder="Search webhook logs..."
                  enableRowSelection={false}
                  enableSorting={true}
                  enablePagination={true}
                  initialPageSize={5}
                  pageSizeOptions={[5, 10, 20]}
                  emptyMessage="No gateway logs found."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
