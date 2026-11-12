"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Banknote,
  BookOpen,
  Building2,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { ConfirmReasonDialog } from "@/components/admin/confirm-reason-dialog";
import {
  getSupplierHubDataAction,
  HubPayment,
  HubPurchase,
  HubSupplier,
  SupplierHubData,
  voidSupplierPaymentAction,
  voidSupplierPurchaseAction,
} from "@/actions/supplier-ops";
import { formatBDT } from "@/lib/admin-format";
import {
  getBalanceStatus,
  PurchaseSettlementStatus,
  roundMoney,
  SUPPLIER_TYPE_LABELS,
} from "@/lib/supplier-ledger";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { PurchaseDialog } from "./purchase-dialog";
import { PaymentDialog } from "./payment-dialog";
import { SupplierKhataDrawer } from "./supplier-khata-drawer";

const EMPTY_HUB_DATA: SupplierHubData = {
  canManage: false,
  suppliers: [],
  purchases: [],
  payments: [],
  products: [],
};

export function SuppliersHub() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState("suppliers");

  // Filters
  const [balanceFilter, setBalanceFilter] = React.useState<"all" | "due" | "advance" | "settled">("all");
  const [supplierFilter, setSupplierFilter] = React.useState("all");
  const [purchaseStatusFilter, setPurchaseStatusFilter] = React.useState<
    PurchaseSettlementStatus | "all"
  >("active");
  const [paymentStatusFilter, setPaymentStatusFilter] = React.useState<"active" | "voided" | "all">(
    "active"
  );

  // Dialog & drawer states
  const [supplierDialogOpen, setSupplierDialogOpen] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<HubSupplier | null>(null);

  const [purchaseDialogOpen, setPurchaseDialogOpen] = React.useState(false);
  const [editingPurchase, setEditingPurchase] = React.useState<HubPurchase | null>(null);
  const [defaultPurchaseSupplierId, setDefaultPurchaseSupplierId] = React.useState<string | undefined>();

  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState<HubPayment | null>(null);
  const [defaultPaymentSupplierId, setDefaultPaymentSupplierId] = React.useState<string | undefined>();
  const [defaultPaymentPurchaseId, setDefaultPaymentPurchaseId] = React.useState<string | undefined>();
  const [defaultPaymentAmount, setDefaultPaymentAmount] = React.useState<number | undefined>();

  const [khataSupplierId, setKhataSupplierId] = React.useState<string | null>(null);
  const [voidTarget, setVoidTarget] = React.useState<{
    kind: "purchase" | "payment";
    id: string;
    label: string;
  } | null>(null);

  const {
    data: hub = EMPTY_HUB_DATA,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "supplier-hub"],
    queryFn: async () => {
      const res = await getSupplierHubDataAction();
      if (!res.success) {
        throw new Error(res.error || "Failed to load supplier ledger");
      }
      return res.data;
    },
  });

  const khataSupplier = React.useMemo(
    () => hub.suppliers.find((s) => s.id === khataSupplierId) || null,
    [hub.suppliers, khataSupplierId]
  );

  // Summary metrics (from active purchases & payments)
  const summary = React.useMemo(() => {
    const totalPurchased = roundMoney(
      hub.suppliers.reduce((sum, s) => sum + s.totalPurchased, 0)
    );
    const totalPaid = roundMoney(
      hub.suppliers.reduce((sum, s) => sum + s.totalPaid, 0)
    );
    const totalDue = roundMoney(
      hub.suppliers.reduce((sum, s) => sum + Math.max(0, s.netBalance), 0)
    );
    const activeCount = hub.suppliers.filter((s) => s.isActive).length;
    const dueCount = hub.suppliers.filter((s) => s.netBalance > 0.01).length;
    return { totalPurchased, totalPaid, totalDue, activeCount, dueCount };
  }, [hub.suppliers]);

  const activePurchaseCount = React.useMemo(
    () => hub.purchases.filter((p) => p.settlementStatus === "active").length,
    [hub.purchases]
  );

  const paidPurchaseCount = React.useMemo(
    () => hub.purchases.filter((p) => p.settlementStatus === "paid").length,
    [hub.purchases]
  );

  const voidedPurchaseCount = React.useMemo(
    () => hub.purchases.filter((p) => p.settlementStatus === "voided").length,
    [hub.purchases]
  );

  const activePaymentCount = React.useMemo(
    () => hub.payments.filter((p) => p.status === "active").length,
    [hub.payments]
  );

  const filteredSuppliers = React.useMemo(() => {
    return hub.suppliers.filter((s) => {
      if (balanceFilter === "all") return true;
      return getBalanceStatus(s.netBalance) === balanceFilter;
    });
  }, [hub.suppliers, balanceFilter]);

  const filteredPurchases = React.useMemo(() => {
    return hub.purchases.filter((p) => {
      if (supplierFilter !== "all" && p.supplierId !== supplierFilter) return false;
      if (purchaseStatusFilter !== "all" && p.settlementStatus !== purchaseStatusFilter) {
        return false;
      }
      return true;
    });
  }, [hub.purchases, supplierFilter, purchaseStatusFilter]);

  const filteredPayments = React.useMemo(() => {
    return hub.payments.filter((pay) => {
      if (supplierFilter !== "all" && pay.supplierId !== supplierFilter) return false;
      if (paymentStatusFilter !== "all" && pay.status !== paymentStatusFilter) return false;
      return true;
    });
  }, [hub.payments, supplierFilter, paymentStatusFilter]);

  const filteredPurchaseTotal = React.useMemo(
    () =>
      roundMoney(
        filteredPurchases
          .filter((p) => p.status === "active")
          .reduce((sum, p) => sum + p.totalAmount, 0)
      ),
    [filteredPurchases]
  );

  const filteredPurchaseDueTotal = React.useMemo(
    () =>
      roundMoney(
        filteredPurchases
          .filter((p) => p.settlementStatus === "active")
          .reduce((sum, p) => sum + p.remainingDue, 0)
      ),
    [filteredPurchases]
  );

  const filteredPaymentTotal = React.useMemo(
    () =>
      roundMoney(
        filteredPayments
          .filter((pay) => pay.status === "active")
          .reduce((sum, pay) => sum + pay.amount, 0)
      ),
    [filteredPayments]
  );

  const hasPurchaseFilters = supplierFilter !== "all" || purchaseStatusFilter !== "active";
  const hasPaymentFilters = supplierFilter !== "all" || paymentStatusFilter !== "active";

  const openPurchaseFor = (supplierId?: string) => {
    setEditingPurchase(null);
    setDefaultPurchaseSupplierId(supplierId);
    setPurchaseDialogOpen(true);
  };

  const openPaymentFor = (
    supplierId?: string,
    opts?: { purchaseId?: string; amount?: number }
  ) => {
    setEditingPayment(null);
    setDefaultPaymentSupplierId(supplierId);
    setDefaultPaymentPurchaseId(opts?.purchaseId);
    setDefaultPaymentAmount(opts?.amount);
    setPaymentDialogOpen(true);
  };

  const voidMutation = useMutation({
    mutationFn: async ({
      target,
      reason,
    }: {
      target: { kind: "purchase" | "payment"; id: string; label: string };
      reason: string;
    }) => {
      const res =
        target.kind === "purchase"
          ? await voidSupplierPurchaseAction({ id: target.id, reason })
          : await voidSupplierPaymentAction({ id: target.id, reason });
      if (!res.ok) {
        throw new Error(res.message || "Could not void entry.");
      }
      return target;
    },
    onSuccess: async (target) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "supplier-hub"] });
      toast.success(`${target.label} voided.`);
    },
  });

  const handleConfirmVoid = async (reason: string) => {
    if (!voidTarget) return;
    await voidMutation.mutateAsync({ target: voidTarget, reason });
  };

  // Columns: Suppliers
  const supplierColumns = React.useMemo<ColumnDef<HubSupplier>[]>(() => {
    const cols: ColumnDef<HubSupplier>[] = [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier / Gachi" />,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="min-w-[190px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{s.name}</span>
                {!s.isActive && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Inactive
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span className="text-[11px] px-1.5 py-0 rounded bg-muted/60 text-foreground/80">
                  {SUPPLIER_TYPE_LABELS[s.supplierType].en}
                </span>
                {s.address && <span>{s.address}</span>}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="min-w-[115px] text-xs whitespace-nowrap">
              {s.contactName && <p className="font-medium text-foreground">{s.contactName}</p>}
              {s.phone ? (
                <p className="text-muted-foreground inline-flex items-center gap-1 font-mono">
                  <Phone className="h-3 w-3" /> {s.phone}
                </p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          );
        },
      },
    ];

    if (!hub.canManage) return cols;

    cols.push(
      {
        accessorKey: "totalPurchased",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Purchased" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="min-w-[90px] whitespace-nowrap text-right font-mono tabular-nums text-xs">
            <div>{formatBDT(row.original.totalPurchased)}</div>
            {row.original.openingBalance !== 0 && (
              <div className="text-[11px] text-muted-foreground">
                Open: {formatBDT(row.original.openingBalance)}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "totalPaid",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cash Paid" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="min-w-[90px] whitespace-nowrap text-right font-mono tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
            {formatBDT(row.original.totalPaid)}
          </div>
        ),
      },
      {
        accessorKey: "netBalance",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Balance" className="justify-end" />
        ),
        cell: ({ row }) => {
          const bal = row.original.netBalance;
          const state = getBalanceStatus(bal);
          return (
            <div className="min-w-[105px] whitespace-nowrap text-right font-mono tabular-nums text-xs">
              {state === "due" && (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                  Due {formatBDT(bal)}
                </span>
              )}
              {state === "advance" && (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Adv {formatBDT(Math.abs(bal))}
                </span>
              )}
              {state === "settled" && (
                <span className="text-muted-foreground">Settled</span>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => openPurchaseFor(s.id)}
              >
                Buy
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px] text-emerald-700 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-500/10"
                onClick={() => openPaymentFor(s.id)}
              >
                Pay
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Supplier actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setKhataSupplierId(s.id)}>
                    <BookOpen className="h-3.5 w-3.5 mr-2" /> View Khata
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingSupplier(s);
                      setSupplierDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Supplier
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
      }
    );

    return cols;
  }, [hub.canManage]);

  // Columns: Purchases
  const purchaseColumns = React.useMemo<ColumnDef<HubPurchase>[]>(
    () => [
      {
        accessorKey: "purchaseDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date & Ref" />,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className={cn("min-w-[100px] whitespace-nowrap", p.status === "voided" && "opacity-50 line-through")}>
              <div className="font-mono text-xs font-medium">{p.purchaseDate}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{p.purchaseNumber}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "supplierName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
        cell: ({ row }) => (
          <span className="inline-block min-w-[120px] whitespace-nowrap text-xs font-semibold text-foreground">
            {row.original.supplierName}
          </span>
        ),
      },
      {
        id: "items",
        header: "Products (kg × Rate)",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className={`min-w-[200px] space-y-0.5 text-xs ${p.status === "voided" ? "opacity-50" : ""}`}>
              {p.items.map((it) => (
                <div key={it.id} className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-medium text-foreground">{it.itemName}</span>
                  <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                    {it.quantity} {it.unit || "kg"} × {formatBDT(it.unitPrice)}/{it.unit || "kg"} ={" "}
                    {formatBDT(it.lineTotal)}
                  </span>
                </div>
              ))}
              {(p.extraCharges > 0 || p.discountAmount > 0) && (
                <div className="text-[11px] text-muted-foreground font-mono">
                  {p.extraCharges > 0 && `+ Extra ${formatBDT(p.extraCharges)} `}
                  {p.discountAmount > 0 && `- Disc ${formatBDT(p.discountAmount)}`}
                </div>
              )}
              {p.notes && <p className="text-[11px] text-muted-foreground">{p.notes}</p>}
              {p.status === "voided" && (
                <p className="text-[11px] text-destructive">Voided: {p.voidReason}</p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total" className="justify-end" />
        ),
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div
              className={`min-w-[85px] whitespace-nowrap text-right font-mono tabular-nums text-xs font-semibold ${
                p.status === "voided" ? "opacity-50 line-through" : ""
              }`}
            >
              {formatBDT(p.totalAmount)}
            </div>
          );
        },
      },
      {
        accessorKey: "settlementStatus",
        header: "Payment",
        cell: ({ row }) => {
          const p = row.original;
          if (p.settlementStatus === "voided") {
            return (
              <Badge variant="outline" className="text-[11px] text-destructive">
                Voided
              </Badge>
            );
          }
          if (p.settlementStatus === "paid") {
            return (
              <Badge
                variant="outline"
                className="whitespace-nowrap text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                Paid
              </Badge>
            );
          }
          return (
            <div className="min-w-[105px] whitespace-nowrap">
              {p.paidAmount > 0 ? (
                <>
                  <Badge
                    variant="outline"
                    className="text-[11px] border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  >
                    Due {formatBDT(p.remainingDue)}
                  </Badge>
                  <div className="mt-0.5 font-mono tabular-nums text-[10px] text-muted-foreground">
                    Paid {formatBDT(p.paidAmount)}
                  </div>
                </>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[11px] border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                >
                  Active
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const p = row.original;
          if (p.status === "voided") {
            return null;
          }
          return (
            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
              {p.settlementStatus === "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-emerald-700 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-500/10"
                  onClick={() =>
                    openPaymentFor(p.supplierId, {
                      purchaseId: p.id,
                      amount: p.remainingDue,
                    })
                  }
                >
                  Mark Paid
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Purchase actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingPurchase(p);
                      setDefaultPurchaseSupplierId(undefined);
                      setPurchaseDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Purchase
                  </DropdownMenuItem>
                  {p.settlementStatus === "active" ? (
                    <DropdownMenuItem
                      onClick={() =>
                        openPaymentFor(p.supplierId, {
                          purchaseId: p.id,
                          amount: p.remainingDue,
                        })
                      }
                    >
                      <Banknote className="h-3.5 w-3.5 mr-2" /> Pay / Partial
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => openPaymentFor(p.supplierId)}>
                      <Banknote className="h-3.5 w-3.5 mr-2" /> Pay Supplier
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      setVoidTarget({
                        kind: "purchase",
                        id: p.id,
                        label: p.purchaseNumber,
                      })
                    }
                  >
                    <Ban className="h-3.5 w-3.5 mr-2" /> Void Purchase
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    []
  );

  // Columns: Cash Payments
  const paymentColumns = React.useMemo<ColumnDef<HubPayment>[]>(
    () => [
      {
        accessorKey: "paymentDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date & Ref" />,
        cell: ({ row }) => {
          const pay = row.original;
          return (
            <div className={cn("min-w-[100px] whitespace-nowrap", pay.status === "voided" && "opacity-50 line-through")}>
              <div className="font-mono text-xs font-medium">{pay.paymentDate}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{pay.paymentNumber}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "supplierName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
        cell: ({ row }) => (
          <span className="inline-block min-w-[120px] whitespace-nowrap text-xs font-semibold text-foreground">
            {row.original.supplierName}
          </span>
        ),
      },
      {
        id: "details",
        header: "Payment Details",
        cell: ({ row }) => {
          const pay = row.original;
          return (
            <div className={`min-w-[190px] text-xs space-y-0.5 ${pay.status === "voided" ? "opacity-50" : ""}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[11px] capitalize">
                  {pay.paymentMethod.replace("_", " ")}
                </Badge>
                {pay.paidBy && (
                  <span className="text-muted-foreground">by {pay.paidBy}</span>
                )}
                {pay.purchaseNumber ? (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    for {pay.purchaseNumber}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    General / Advance
                  </span>
                )}
              </div>
              {pay.reference && (
                <p className="font-mono text-[11px] text-muted-foreground">
                  Ref: {pay.reference}
                </p>
              )}
              {pay.notes && <p className="text-[11px] text-muted-foreground">{pay.notes}</p>}
              {pay.status === "voided" && (
                <p className="text-[11px] text-destructive">Voided: {pay.voidReason}</p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cash Paid" className="justify-end" />
        ),
        cell: ({ row }) => {
          const pay = row.original;
          return (
            <div
              className={`min-w-[85px] whitespace-nowrap text-right font-mono tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400 ${
                pay.status === "voided" ? "opacity-50 line-through" : ""
              }`}
            >
              {formatBDT(pay.amount)}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const pay = row.original;
          if (pay.status === "voided") {
            return (
              <Badge variant="outline" className="text-[10px] text-destructive">
                Voided
              </Badge>
            );
          }
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Payment actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingPayment(pay);
                    setDefaultPaymentSupplierId(undefined);
                    setDefaultPaymentPurchaseId(undefined);
                    setDefaultPaymentAmount(undefined);
                    setPaymentDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Payment
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() =>
                    setVoidTarget({
                      kind: "payment",
                      id: pay.id,
                      label: pay.paymentNumber,
                    })
                  }
                >
                  <Ban className="h-3.5 w-3.5 mr-2" /> Void Payment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="h-10 w-56 sm:w-64 rounded-lg bg-muted/60" />
        <div className="h-28 sm:h-24 rounded-xl bg-muted/50" />
        <div className="h-96 rounded-xl bg-muted/40" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6 text-center space-y-3">
        <p className="text-sm font-semibold text-destructive">
          Could not load supplier ledger
        </p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "An unexpected error occurred."}
        </p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {hub.canManage
              ? "Supplier Ledger & Cash Payments"
              : "Supplier Directory"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {hub.canManage
              ? "Track gachi & mill purchases (product, qty, price, date) alongside cash payouts and running balances."
              : "Registered gachis, sugar mills, and raw material suppliers."}
          </p>
        </div>

        {hub.canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh supplier ledger"
              className="shrink-0 sm:border-transparent sm:bg-transparent sm:hover:bg-accent"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => {
                setEditingSupplier(null);
                setSupplierDialogOpen(true);
              }}
            >
              <Building2 className="h-4 w-4 mr-1.5" />
              Add Supplier
            </Button>
            <Button
              size="sm"
              className="basis-[calc(50%-0.25rem)] sm:basis-auto flex-1 sm:flex-none bg-amber-700 hover:bg-amber-800 text-white"
              onClick={() => openPurchaseFor()}
              disabled={hub.suppliers.length === 0}
            >
              <ShoppingBag className="h-4 w-4 mr-1.5" />
              Record Purchase
            </Button>
            <Button
              size="sm"
              className="basis-[calc(50%-0.25rem)] sm:basis-auto flex-1 sm:flex-none bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={() => openPaymentFor()}
              disabled={hub.suppliers.length === 0}
            >
              <Banknote className="h-4 w-4 mr-1.5" />
              Pay Cash
            </Button>
          </div>
        )}
      </div>

      {/* Role Notice or Ledger Summary Strip */}
      {!hub.canManage ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Purchase prices and cash payout ledgers are restricted to Owner, Admin, and Manager roles.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border bg-card overflow-hidden [&>*]:p-3 [&>*]:sm:p-4 [&>*:nth-child(odd)]:border-r [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 lg:[&>*:not(:last-child)]:border-r">
          <div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Total Purchased</p>
            <p className="text-base sm:text-xl font-bold font-mono tabular-nums mt-1 text-foreground">
              {formatBDT(summary.totalPurchased)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hub.purchases.filter((p) => p.status === "active").length} active deliveries
            </p>
          </div>

          <div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Cash Paid</p>
            <p className="text-base sm:text-xl font-bold font-mono tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
              {formatBDT(summary.totalPaid)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hub.payments.filter((p) => p.status === "active").length} cash payouts
            </p>
          </div>

          <div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Total Payable Due</p>
            <p
              className={`text-base sm:text-xl font-bold font-mono tabular-nums mt-1 ${
                summary.totalDue > 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-foreground"
              }`}
            >
              {formatBDT(summary.totalDue)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Suppliers with balance due
            </p>
          </div>

          <div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Active Suppliers</p>
            <p className="text-base sm:text-xl font-bold font-mono tabular-nums mt-1 text-foreground">
              {summary.activeCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hub.suppliers.length} total registered
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!hub.canManage ? (
        <DataTable
          columns={supplierColumns}
          data={hub.suppliers}
          searchPlaceholder="Search supplier name, phone, address..."
          emptyMessage="No suppliers registered yet."
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-col gap-2 border-b border-border lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full overflow-x-auto overflow-y-hidden lg:w-auto">
              <TabsList
                variant="line"
                aria-label="Supplier ledger sections"
                className="h-auto min-h-12 w-max min-w-full justify-start gap-1 sm:gap-2 p-0 bg-transparent"
              >
                <TabsTrigger
                  value="suppliers"
                  className="flex-none h-auto min-h-12 px-3.5 py-3 rounded-none text-xs sm:text-sm group-data-horizontal/tabs:after:bottom-0"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>Suppliers &amp; Balances</span>
                  <span
                    className={cn(
                      "ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-mono font-medium tabular-nums transition-colors",
                      activeTab === "suppliers"
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {hub.suppliers.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="purchases"
                  className="flex-none h-auto min-h-12 px-3.5 py-3 rounded-none text-xs sm:text-sm group-data-horizontal/tabs:after:bottom-0"
                >
                  <ShoppingBag
                    className={cn(
                      "h-4 w-4",
                      activeTab === "purchases"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    )}
                  />
                  <span>Purchases</span>
                  <span
                    className={cn(
                      "ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-mono font-medium tabular-nums transition-colors",
                      activeTab === "purchases"
                        ? "bg-amber-700 text-white dark:bg-amber-500 dark:text-stone-950"
                        : activePurchaseCount > 0
                          ? "bg-muted text-foreground"
                          : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {activePurchaseCount}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="payments"
                  className="flex-none h-auto min-h-12 px-3.5 py-3 rounded-none text-xs sm:text-sm group-data-horizontal/tabs:after:bottom-0"
                >
                  <Banknote
                    className={cn(
                      "h-4 w-4",
                      activeTab === "payments"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground"
                    )}
                  />
                  <span>Cash Payments</span>
                  <span
                    className={cn(
                      "ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-mono font-medium tabular-nums transition-colors",
                      activeTab === "payments"
                        ? "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-stone-950"
                        : activePaymentCount > 0
                          ? "bg-muted text-foreground"
                          : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {activePaymentCount}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="hidden lg:flex items-center gap-2 pb-2.5 text-xs text-muted-foreground whitespace-nowrap">
              {activeTab === "suppliers" && (
                <span>
                  {summary.dueCount > 0 ? (
                    <>
                      <strong className="font-mono tabular-nums text-rose-700 dark:text-rose-400">
                        {summary.dueCount}
                      </strong>{" "}
                      {summary.dueCount === 1 ? "supplier" : "suppliers"} with payable due
                    </>
                  ) : (
                    "All supplier balances settled"
                  )}
                </span>
              )}
              {activeTab === "purchases" && (
                <span>
                  Showing{" "}
                  <strong className="font-mono tabular-nums text-foreground">
                    {filteredPurchases.length}
                  </strong>{" "}
                  {filteredPurchases.length === 1 ? "entry" : "entries"} ·{" "}
                  <strong className="font-mono tabular-nums text-foreground">
                    {formatBDT(filteredPurchaseTotal)}
                  </strong>
                  {filteredPurchaseDueTotal > 0 && (
                    <>
                      {" "}
                      · Due{" "}
                      <strong className="font-mono tabular-nums text-rose-700 dark:text-rose-400">
                        {formatBDT(filteredPurchaseDueTotal)}
                      </strong>
                    </>
                  )}
                </span>
              )}
              {activeTab === "payments" && (
                <span>
                  Showing{" "}
                  <strong className="font-mono tabular-nums text-foreground">
                    {filteredPayments.length}
                  </strong>{" "}
                  {filteredPayments.length === 1 ? "payout" : "payouts"} ·{" "}
                  <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatBDT(filteredPaymentTotal)}
                  </strong>
                </span>
              )}
            </div>
          </div>

          <TabsContent value="suppliers" className="mt-0">
            <DataTable
              columns={supplierColumns}
              data={filteredSuppliers}
              searchPlaceholder="Search supplier name, phone, area..."
              onRowClick={(s) => setKhataSupplierId(s.id)}
              toolbarPrefix={
                hub.suppliers.length > 0 ? (
                  <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
                    <Select
                      value={balanceFilter}
                      onValueChange={(v) =>
                        setBalanceFilter((v as "all" | "due" | "advance" | "settled") || "all")
                      }
                    >
                      <SelectTrigger className="h-8 flex-1 sm:flex-none sm:w-40 text-xs" aria-label="Filter by balance status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Balances</SelectItem>
                        <SelectItem value="due" className="text-xs">Payable Due</SelectItem>
                        <SelectItem value="advance" className="text-xs">Advance Paid</SelectItem>
                        <SelectItem value="settled" className="text-xs">Settled</SelectItem>
                      </SelectContent>
                    </Select>

                    {balanceFilter !== "all" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-muted-foreground"
                        onClick={() => setBalanceFilter("all")}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                      </Button>
                    )}
                  </div>
                ) : null
              }
              emptyMessage={
                balanceFilter !== "all"
                  ? "No suppliers match this balance filter."
                  : "No suppliers registered yet. Add a supplier to start recording purchases and cash payments."
              }
            />
          </TabsContent>

          <TabsContent value="purchases" className="mt-0">
            {hub.purchases.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  No supplier purchases recorded yet
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                  Log deliveries with product, quantity, unit price, transport/extra charges, and optional warehouse stock receipt.
                </p>
                <div className="mt-4 flex justify-center">
                  {hub.suppliers.length === 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSupplier(null);
                        setSupplierDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1.5" /> Add a Supplier First
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-amber-700 hover:bg-amber-800 text-white"
                      onClick={() => openPurchaseFor()}
                    >
                      <ShoppingBag className="h-4 w-4 mr-1.5" /> Record First Purchase
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <DataTable
                columns={purchaseColumns}
                data={filteredPurchases}
                searchPlaceholder="Search purchase #, supplier, notes..."
                toolbarPrefix={
                  <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
                    <Select
                      value={supplierFilter}
                      onValueChange={(v) => setSupplierFilter(v || "all")}
                    >
                      <SelectTrigger className="h-8 flex-1 min-w-[140px] sm:flex-none sm:w-44 text-xs" aria-label="Filter purchases by supplier">
                        <SelectValue placeholder="All suppliers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Suppliers</SelectItem>
                        {hub.suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div
                      role="group"
                      aria-label="Filter purchases by payment status"
                      className="inline-flex max-w-full overflow-x-auto items-center rounded-lg border bg-muted/40 p-0.5 gap-0.5"
                    >
                      {(
                        [
                          { value: "active", label: "Active", count: activePurchaseCount },
                          { value: "paid", label: "Paid", count: paidPurchaseCount },
                          { value: "voided", label: "Voided", count: voidedPurchaseCount },
                          { value: "all", label: "All", count: hub.purchases.length },
                        ] as const
                      ).map((opt) => {
                        const isSelected = purchaseStatusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPurchaseStatusFilter(opt.value)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors cursor-pointer",
                              isSelected
                                ? "bg-background text-foreground shadow-xs font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <span>{opt.label}</span>
                            <span className="font-mono tabular-nums text-[10px] opacity-75">
                              ({opt.count})
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {hasPurchaseFilters && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-muted-foreground"
                        onClick={() => {
                          setSupplierFilter("all");
                          setPurchaseStatusFilter("active");
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                      </Button>
                    )}
                  </div>
                }
                emptyMessage="No purchases match the selected supplier or status filter."
              />
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-0">
            {hub.payments.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Banknote className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  No cash payments recorded yet
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                  Record cash, bKash/Nagad, or bank payouts against a specific purchase or as a general running-balance advance.
                </p>
                <div className="mt-4 flex justify-center">
                  {hub.suppliers.length === 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSupplier(null);
                        setSupplierDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1.5" /> Add a Supplier First
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800 text-white"
                      onClick={() => openPaymentFor()}
                    >
                      <Banknote className="h-4 w-4 mr-1.5" /> Record First Cash Payment
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <DataTable
                columns={paymentColumns}
                data={filteredPayments}
                searchPlaceholder="Search payment #, supplier, notes..."
                toolbarPrefix={
                  <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
                    <Select
                      value={supplierFilter}
                      onValueChange={(v) => setSupplierFilter(v || "all")}
                    >
                      <SelectTrigger className="h-8 flex-1 min-w-[140px] sm:flex-none sm:w-44 text-xs" aria-label="Filter payments by supplier">
                        <SelectValue placeholder="All suppliers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Suppliers</SelectItem>
                        {hub.suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={paymentStatusFilter}
                      onValueChange={(v) =>
                        setPaymentStatusFilter((v as "active" | "voided" | "all") || "active")
                      }
                    >
                      <SelectTrigger className="h-8 w-28 sm:w-32 text-xs" aria-label="Filter payments by status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active" className="text-xs">Active</SelectItem>
                        <SelectItem value="voided" className="text-xs">Voided</SelectItem>
                        <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasPaymentFilters && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-muted-foreground"
                        onClick={() => {
                          setSupplierFilter("all");
                          setPaymentStatusFilter("active");
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                      </Button>
                    )}
                  </div>
                }
                emptyMessage="No cash payments match the selected supplier or status filter."
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs & Khata Drawer */}
      {hub.canManage && (
        <>
          <SupplierFormDialog
            open={supplierDialogOpen}
            onOpenChange={setSupplierDialogOpen}
            supplier={editingSupplier}
            onSuccess={(newId) => {
              if (purchaseDialogOpen && newId) {
                setDefaultPurchaseSupplierId(newId);
              }
            }}
          />

          <PurchaseDialog
            open={purchaseDialogOpen}
            onOpenChange={setPurchaseDialogOpen}
            suppliers={hub.suppliers}
            products={hub.products}
            defaultSupplierId={defaultPurchaseSupplierId}
            purchase={editingPurchase}
            onRequestNewSupplier={() => {
              setEditingSupplier(null);
              setSupplierDialogOpen(true);
            }}
          />

          <PaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            suppliers={hub.suppliers}
            purchases={hub.purchases}
            defaultSupplierId={defaultPaymentSupplierId}
            defaultPurchaseId={defaultPaymentPurchaseId}
            defaultAmount={defaultPaymentAmount}
            payment={editingPayment}
          />

          <SupplierKhataDrawer
            open={Boolean(khataSupplierId)}
            onOpenChange={(v) => !v && setKhataSupplierId(null)}
            supplier={khataSupplier}
            purchases={hub.purchases}
            payments={hub.payments}
            onRecordPurchase={(id) => openPurchaseFor(id)}
            onRecordPayment={(id) => openPaymentFor(id)}
            onEditSupplier={(s) => {
              setEditingSupplier(s);
              setSupplierDialogOpen(true);
            }}
          />

          <ConfirmReasonDialog
            open={Boolean(voidTarget)}
            onOpenChange={(v) => !v && setVoidTarget(null)}
            title={`Void ${voidTarget?.label || "Entry"}`}
            description="Voiding removes this entry from the supplier's active balance while keeping a traceable audit record."
            reasonLabel="Void Reason / বাতিলের কারণ"
            reasonPlaceholder="e.g. Duplicate entry, wrong supplier selected..."
            confirmLabel="Void Entry"
            onConfirm={handleConfirmVoid}
          />
        </>
      )}
    </div>
  );
}
