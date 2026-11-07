"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Package,
  AlertTriangle,
  ArrowDownLeft,
  SlidersHorizontal,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Warehouse,
  History,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InventoryItem,
  BatchItem,
  WarehouseItem,
  StockLedgerItem,
  updateReorderPointDirectAction,
  getAdminInventoryAction,
  getAdminStockLedgerAction,
} from "@/actions/inventory";
import { formatBDT, formatDhakaDateTime } from "@/lib/admin-format";
import { exportToCSV } from "@/lib/csv-export";
import { ReceiveStockDialog } from "./receive-stock-dialog";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { WriteOffDialog } from "./write-off-dialog";

interface InventoryViewProps {
  initialInventory: InventoryItem[];
  initialBatches: BatchItem[];
  initialWarehouses: WarehouseItem[];
  initialLedger: StockLedgerItem[];
  initialKpis: {
    totalOnHand: number;
    totalReserved: number;
    totalAvailable: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}

export function InventoryView({
  initialInventory,
  initialBatches,
  initialWarehouses,
  initialLedger,
  initialKpis,
}: InventoryViewProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [batches] = useState<BatchItem[]>(initialBatches);
  const [warehouses] = useState<WarehouseItem[]>(initialWarehouses);
  const [ledger, setLedger] = useState<StockLedgerItem[]>(initialLedger);
  const [kpis, setKpis] = useState(initialKpis);

  const [activeTab, setActiveTab] = useState<string>("levels");
  const [search, setSearch] = useState<string>("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>("all");

  // Dialog states
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Inline reorder point edit state
  const [editingReorderId, setEditingReorderId] = useState<string | null>(null);
  const [reorderValue, setReorderValue] = useState<string>("");
  const [isUpdatingReorder, startUpdatingReorder] = useTransition();

  const handleRefreshData = async () => {
    const [invRes, ledRes] = await Promise.all([
      getAdminInventoryAction(),
      getAdminStockLedgerAction({ movementType: ledgerTypeFilter }),
    ]);

    if (invRes.success) {
      setInventory(invRes.data.inventory);
      setKpis(invRes.data.kpis);
    }
    if (ledRes.success) {
      setLedger(ledRes.data);
    }
  };

  // Inline reorder point save
  const handleSaveReorderPoint = (item: InventoryItem) => {
    const val = Number(reorderValue);
    if (isNaN(val) || val < 0) {
      toast.error("Please enter a valid reorder point (0 or greater).");
      return;
    }

    startUpdatingReorder(async () => {
      const res = await updateReorderPointDirectAction({
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        reorderPoint: val,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update reorder point");
        return;
      }

      toast.success(`Reorder point for ${item.variant} updated to ${val}`);
      setEditingReorderId(null);
      setInventory((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                reorder: val,
                status: i.available <= 0 ? "out_of_stock" : i.available <= val ? "low_stock" : "in_stock",
              }
            : i
        )
      );
    });
  };

  // Filtered inventory levels
  const filteredInventory = inventory.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.variant.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.warehouse.toLowerCase().includes(q);

    const matchesWarehouse = warehouseFilter === "all" || item.warehouseId === warehouseFilter;
    const matchesStatus =
      stockStatusFilter === "all" ||
      (stockStatusFilter === "low_stock" && item.status === "low_stock") ||
      (stockStatusFilter === "out_of_stock" && item.status === "out_of_stock") ||
      (stockStatusFilter === "in_stock" && item.status === "in_stock");

    return matchesSearch && matchesWarehouse && matchesStatus;
  });

  // Filtered stock ledger
  const filteredLedger = ledger.filter((entry) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      entry.variantTitle.toLowerCase().includes(q) ||
      entry.sku.toLowerCase().includes(q) ||
      (entry.lotCode && entry.lotCode.toLowerCase().includes(q)) ||
      (entry.note && entry.note.toLowerCase().includes(q));

    const matchesType = ledgerTypeFilter === "all" || entry.movementType === ledgerTypeFilter;

    return matchesSearch && matchesType;
  });

  // CSV Exports
  const handleExportInventoryCSV = () => {
    exportToCSV(
      filteredInventory.map((i) => ({
        Variant: i.variant,
        SKU: i.sku,
        Warehouse: i.warehouse,
        "On Hand": i.onHand,
        Reserved: i.reserved,
        Available: i.available,
        "Reorder Point": i.reorder,
        Status: i.status,
      })),
      `inventory-levels-${new Date().toISOString().split("T")[0]}`
    );
  };

  const handleExportLedgerCSV = () => {
    exportToCSV(
      filteredLedger.map((m) => ({
        ID: m.id,
        Date: formatDhakaDateTime(m.createdAt),
        Type: m.movementType,
        "Quantity Delta": m.quantityDelta,
        Variant: m.variantTitle,
        SKU: m.sku,
        "Lot Code": m.lotCode || "N/A",
        Warehouse: m.warehouseName,
        Note: m.note || "",
      })),
      `stock-ledger-${new Date().toISOString().split("T")[0]}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="size-6 text-primary" />
            Inventory & Stock Ledger / ইনভেন্টরি
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor real-time warehouse stock levels, configure reorder points, and inspect immutable audit movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setReceiveOpen(true)}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
          >
            <ArrowDownLeft className="size-3.5" />
            Receive Stock / স্টক গ্রহণ
          </Button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">Total On Hand</div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono">
            {kpis.totalOnHand.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">In all warehouses</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">Available to Sell</div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-emerald-600 dark:text-emerald-400">
            {kpis.totalAvailable.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Unreserved stock</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">Reserved in Orders</div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-amber-600 dark:text-amber-400">
            {kpis.totalReserved.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Pending dispatch</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="size-3 text-amber-500" />
            Low Stock SKUs
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-amber-600 dark:text-amber-400">
            {kpis.lowStockCount}
          </div>
          <span className="text-[10px] text-muted-foreground">Below reorder point</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs col-span-2 lg:col-span-1">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <TrendingDown className="size-3 text-destructive" />
            Out of Stock
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-destructive">
            {kpis.outOfStockCount}
          </div>
          <span className="text-[10px] text-muted-foreground">Zero available</span>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
          <TabsList className="h-9 bg-muted/60 p-1">
            <TabsTrigger value="levels" className="text-xs px-3 gap-1.5">
              <Warehouse className="size-3.5" />
              Stock Levels ({inventory.length})
            </TabsTrigger>
            <TabsTrigger value="ledger" className="text-xs px-3 gap-1.5">
              <History className="size-3.5" />
              Stock Ledger / লেজার
            </TabsTrigger>
          </TabsList>

          {/* Search and filters bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search variant, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {activeTab === "levels" ? (
              <>
                <Select value={warehouseFilter} onValueChange={(val) => setWarehouseFilter(val ?? "all")}>
                  <SelectTrigger className="h-8 text-xs w-[130px]">
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Warehouses</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id} className="text-xs">
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={stockStatusFilter} onValueChange={(val) => setStockStatusFilter(val ?? "all")}>
                  <SelectTrigger className="h-8 text-xs w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="in_stock" className="text-xs">In Stock</SelectItem>
                    <SelectItem value="low_stock" className="text-xs">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock" className="text-xs">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportInventoryCSV}
                  className="h-8 text-xs gap-1"
                >
                  <Download className="size-3.5" />
                  CSV
                </Button>
              </>
            ) : (
              <>
                <Select
                  value={ledgerTypeFilter}
                  onValueChange={async (val) => {
                    const nextVal = val ?? "all";
                    setLedgerTypeFilter(nextVal);
                    const res = await getAdminStockLedgerAction({ movementType: nextVal });
                    if (res.success) setLedger(res.data);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-[140px]">
                    <SelectValue placeholder="Movement Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Movements</SelectItem>
                    <SelectItem value="receipt" className="text-xs">Receipts (+)</SelectItem>
                    <SelectItem value="sale" className="text-xs">Sales (-)</SelectItem>
                    <SelectItem value="adjustment" className="text-xs">Adjustments (±)</SelectItem>
                    <SelectItem value="write_off" className="text-xs">Write-Offs (-)</SelectItem>
                    <SelectItem value="return" className="text-xs">Returns (+)</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportLedgerCSV}
                  className="h-8 text-xs gap-1"
                >
                  <Download className="size-3.5" />
                  CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Stock Levels */}
        <TabsContent value="levels" className="m-0">
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 px-3">Variant / Product</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3 text-right">On Hand</th>
                    <th className="py-2.5 px-3 text-right">Reserved</th>
                    <th className="py-2.5 px-3 text-right">Available</th>
                    <th className="py-2.5 px-3 text-right">Reorder Point</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                        No inventory levels found matching the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => {
                      const isLow = item.status === "low_stock";
                      const isOut = item.status === "out_of_stock";
                      const isEditingReorder = editingReorderId === item.id;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            isOut
                              ? "bg-destructive/5"
                              : isLow
                              ? "bg-amber-500/5 dark:bg-amber-900/10"
                              : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            <div>{item.variant}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                            {item.sku}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{item.warehouse}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            {item.onHand.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {item.reserved > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                {item.reserved.toLocaleString()}
                              </span>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span
                              className={
                                isOut
                                  ? "text-destructive"
                                  : isLow
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }
                            >
                              {item.available.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isEditingReorder ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  value={reorderValue}
                                  onChange={(e) => setReorderValue(e.target.value)}
                                  className="h-6 w-16 text-right text-xs font-mono p-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveReorderPoint(item);
                                    if (e.key === "Escape") setEditingReorderId(null);
                                  }}
                                />
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => handleSaveReorderPoint(item)}
                                  disabled={isUpdatingReorder}
                                  className="size-6 text-emerald-600"
                                >
                                  ✓
                                </Button>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => setEditingReorderId(null)}
                                  className="size-6 text-muted-foreground"
                                >
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReorderId(item.id);
                                  setReorderValue(String(item.reorder));
                                }}
                                className="font-mono text-xs text-muted-foreground hover:text-foreground underline decoration-dotted decoration-muted-foreground/50 hover:decoration-foreground cursor-pointer"
                                title="Click to edit reorder point"
                              >
                                {item.reorder}
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isOut ? (
                              <Badge variant="destructive" className="text-[10px] uppercase font-mono px-1.5 py-0">
                                Out of Stock
                              </Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-[10px] uppercase font-mono px-1.5 py-0">
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-mono px-1.5 py-0">
                                In Stock
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setAdjustOpen(true);
                                }}
                                className="h-7 px-2 text-[11px] gap-1 hover:bg-muted"
                                title="Adjust physical inventory"
                              >
                                <SlidersHorizontal className="size-3 text-amber-600" />
                                Adjust
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setWriteOffOpen(true);
                                }}
                                className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 gap-1"
                                title="Write off spoiled/damaged stock"
                              >
                                <Trash2 className="size-3" />
                                Write Off
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Stock Ledger */}
        <TabsContent value="ledger" className="m-0">
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Delta / পরিমাণ</th>
                    <th className="py-2.5 px-3">Variant</th>
                    <th className="py-2.5 px-3">Lot Code</th>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3">Reference / Order</th>
                    <th className="py-2.5 px-3">Note / বিবরণ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                        No stock movement ledger records found.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((m) => {
                      const isPositive = m.quantityDelta > 0;
                      return (
                        <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDhakaDateTime(m.createdAt)}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono px-1.5 py-0 ${
                                m.movementType === "receipt"
                                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                                  : m.movementType === "sale"
                                  ? "border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                                  : m.movementType === "write_off"
                                  ? "border-rose-500/30 text-rose-600 bg-rose-50/50 dark:bg-rose-950/20"
                                  : m.movementType === "adjustment"
                                  ? "border-amber-500/30 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {m.movementType}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                              {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            <div>{m.variantTitle}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{m.sku}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {m.lotCode ? (
                              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-xs font-semibold">
                                {m.lotCode}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{m.warehouseName}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {m.orderId ? (
                              <a
                                href={`/admin/orders/${m.orderId}`}
                                className="text-primary hover:underline"
                              >
                                View Order
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate" title={m.note || ""}>
                            {m.note || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ReceiveStockDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        inventory={inventory}
        batches={batches}
        warehouses={warehouses}
        onSuccess={handleRefreshData}
      />

      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        item={selectedItem}
        onSuccess={handleRefreshData}
      />

      <WriteOffDialog
        open={writeOffOpen}
        onOpenChange={setWriteOffOpen}
        item={selectedItem}
        onSuccess={handleRefreshData}
      />
    </div>
  );
}
