"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  Receipt,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  getAdminPaymentsAction,
  recordManualPaymentAction,
  refundPaymentAction,
  updatePaymentStatusAction,
  TransactionItem,
  PaymentLogItem,
} from "@/actions/payments";

const statusStyles: Record<string, string> = {
  succeeded: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState("all");
  const [methodFilter, setMethodFilter] = React.useState("all");

  // Record payment dialog state
  const [isRecordOpen, setIsRecordOpen] = React.useState(false);
  const [orderNumber, setOrderNumber] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<"bkash" | "nagad" | "bank_transfer" | "card" | "cod">("bkash");
  const [gatewayRef, setGatewayRef] = React.useState("");

  // Refund dialog state
  const [isRefundOpen, setIsRefundOpen] = React.useState(false);
  const [selectedTxnForRefund, setSelectedTxnForRefund] = React.useState<TransactionItem | null>(null);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const res = await getAdminPaymentsAction();
      if (!res.success) throw new Error(res.error || "Failed to load payments");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const transactions = paymentsData?.transactions || [];
  const logs = paymentsData?.logs || [];
  const paymentVolumeData = paymentsData?.volumeData || [];
  const methodShareData = paymentsData?.methodShareData || [];

  const recordMutation = useMutation({
    mutationFn: recordManualPaymentAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Payment recorded successfully");
        queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        setIsRecordOpen(false);
        setOrderNumber("");
        setAmount("");
        setGatewayRef("");
      } else {
        toast.error(res.error || "Failed to record payment");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record payment");
    },
  });

  const refundMutation = useMutation({
    mutationFn: refundPaymentAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Refund processed successfully");
        queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        setIsRefundOpen(false);
        setSelectedTxnForRefund(null);
        setRefundAmount("");
        setRefundReason("");
      } else {
        toast.error(res.error || "Failed to process refund");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process refund");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: updatePaymentStatusAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Payment status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      } else {
        toast.error(res.error || "Failed to update payment status");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update payment status");
    },
  });

  // Calculate dynamic stats
  const totalProcessed = transactions
    .filter((t) => t.kind === "charge" && t.status === "succeeded")
    .reduce((sum, t) => sum + t.amountNumeric, 0);

  const pendingSettlementTotal = transactions
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + t.amountNumeric, 0);

  const pendingSettlementCount = transactions.filter((t) => t.status === "pending").length;

  const totalRefunds = transactions
    .filter((t) => t.kind === "refund")
    .reduce((sum, t) => sum + t.amountNumeric, 0);

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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium text-amber-700 dark:text-amber-400">
          {row.getValue("orderId")}
        </span>
      ),
    },
    {
      accessorKey: "customer",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("customer")}</span>,
    },
    {
      accessorKey: "method",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
      cell: ({ row }) => {
        const m = row.getValue("method") as string;
        return (
          <span className="inline-flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {m}
          </span>
        );
      },
    },
    {
      accessorKey: "kind",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const k = row.getValue("kind") as string;
        return (
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              k === "refund" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {k}
          </span>
        );
      },
    },
    {
      accessorKey: "amount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => {
        const isRefund = row.original.kind === "refund";
        return (
          <span className={`font-mono text-xs font-bold ${isRefund ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
            {isRefund ? `-${row.original.amount}` : row.original.amount}
          </span>
        );
      },
    },
    {
      accessorKey: "gatewayRef",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gateway Ref" />,
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px] inline-block">
          {row.getValue("gatewayRef")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const s = row.getValue("status") as string;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${
              statusStyles[s] || "bg-muted text-muted-foreground border-border"
            }`}
          >
            {s}
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
              <DropdownMenuItem onClick={() => toast.info(`Transaction ${t.id} Gateway Ref: ${t.gatewayRef}`)}>
                <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Verify Gateway
              </DropdownMenuItem>
              {t.kind === "charge" && t.status === "succeeded" && (
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onClick={() => {
                    setSelectedTxnForRefund(t);
                    setRefundAmount(String(t.amountNumeric));
                    setIsRefundOpen(true);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-2" /> Process Refund
                </DropdownMenuItem>
              )}
              {t.status === "pending" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-emerald-600 focus:text-emerald-600"
                    onClick={() => updateStatusMutation.mutate({ transactionId: t.id, status: "succeeded" })}
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
  ], [updateStatusMutation]);

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
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
            onClick={() => setIsRecordOpen(true)}
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Processed</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">
                ৳ {totalProcessed.toLocaleString("en-BD")}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Settled order transactions</p>
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
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">
                ৳ {pendingSettlementTotal.toLocaleString("en-BD")}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{pendingSettlementCount} pending invoices</p>
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
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">
                ৳ {totalRefunds.toLocaleString("en-BD")}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Reconciled adjustments</p>
          </CardContent>
        </Card>

        {/* Courier Balance Card */}
        <SteadfastBalanceCard />
      </motion.div>

      {/* Analytics row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <Card className="lg:col-span-2 border shadow-xs">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold">Weekly Settlement Volume</CardTitle>
            <CardDescription className="text-xs">Incoming revenue by day</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {paymentVolumeData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                No payment volume recorded this week
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={paymentVolumeData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `৳${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val) => [`৳ ${Number(val).toLocaleString()}`, "Settled"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Bar dataKey="amount" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold">Gateway Breakdown</CardTitle>
            <CardDescription className="text-xs">Payment method market share</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col items-center">
            {methodShareData.length === 0 ? (
              <div className="h-[140px] flex items-center justify-center text-sm text-muted-foreground">
                No payment methods recorded yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={methodShareData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2}>
                      {methodShareData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`${val}%`, "Share"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] w-full">
                  {methodShareData.map((m) => (
                    <div key={m.name} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: m.color }} />
                      <span className="text-muted-foreground truncate">{m.name}</span>
                      <span className="ml-auto font-semibold">{m.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs and Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <TabsList className="bg-muted/60 p-1">
              <TabsTrigger value="all" className="text-xs">
                All Transactions <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{transactions.length}</span>
              </TabsTrigger>
              <TabsTrigger value="charges" className="text-xs">
                Charges <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{transactions.filter(t => t.kind === "charge").length}</span>
              </TabsTrigger>
              <TabsTrigger value="refunds" className="text-xs">
                Refunds <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{transactions.filter(t => t.kind === "refund").length}</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs">
                Gateway Logs <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{logs.length}</span>
              </TabsTrigger>
            </TabsList>

            {activeTab !== "logs" && (
              <div className="flex items-center gap-2">
                <Select value={methodFilter} onValueChange={(val) => setMethodFilter(val || "all")}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="All Methods" />
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
              </div>
            )}
          </div>

          <TabsContent value="all" className="m-0">
            <DataTable
              columns={txnColumns}
              data={filteredTransactions}
              searchPlaceholder="Search by ID, order, or customer..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
              bulkActions={(selected, clearSelection) => (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background"
                    onClick={() => {
                      selected.forEach((s) => {
                        updateStatusMutation.mutate({ transactionId: s.id, status: "succeeded" });
                      });
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
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
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
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
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
                  initialPageSize={10}
                  pageSizeOptions={[10, 25, 50]}
                  emptyMessage="No gateway logs found."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Record Payment Dialog */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment received for an order via bank, counter, or mobile wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="orderNumber">Order Number</Label>
              <Input
                id="orderNumber"
                placeholder="e.g. MOL-2610-01001"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount (৳)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="method">Payment Method</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cod">Cash on Delivery</SelectItem>
                  <SelectItem value="card">Card / Visa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="gatewayRef">Transaction / Gateway Reference</Label>
              <Input
                id="gatewayRef"
                placeholder="e.g. TRX12345678 or SCB-CHEQUE-99"
                value={gatewayRef}
                onChange={(e) => setGatewayRef(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecordOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!orderNumber || !amount || recordMutation.isPending}
              onClick={() =>
                recordMutation.mutate({
                  orderNumber: orderNumber.trim(),
                  amount: Number(amount),
                  method,
                  gatewayRef: gatewayRef.trim() || undefined,
                })
              }
            >
              {recordMutation.isPending ? "Recording..." : "Save Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={isRefundOpen} onOpenChange={setIsRefundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Record a refund transaction for {selectedTxnForRefund?.id} ({selectedTxnForRefund?.orderId}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="refundAmount">Refund Amount (৳)</Label>
              <Input
                id="refundAmount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="refundReason">Reason for Refund</Label>
              <Input
                id="refundReason"
                placeholder="e.g. Defective batch return, customer cancellation"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefundOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!refundAmount || refundMutation.isPending}
              onClick={() => {
                if (selectedTxnForRefund) {
                  refundMutation.mutate({
                    transactionId: selectedTxnForRefund.id,
                    amount: Number(refundAmount),
                    reason: refundReason.trim() || undefined,
                  });
                }
              }}
            >
              {refundMutation.isPending ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
