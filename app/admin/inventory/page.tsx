"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  MoreHorizontal,
  Package,
  Download,
  ArrowRightLeft,
  ShieldCheck,
  Ban,
  Trash2,
  FileCheck,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

export interface InventoryItem {
  id: string;
  variant: string;
  sku: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
  reorder: number;
  status: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  batch: string;
}

export interface BatchItem {
  id: string;
  lot: string;
  product: string;
  supplier: string;
  status: "released" | "quarantine" | "blocked" | "expired";
  received: string;
  bestBefore: string;
  brix: number | null;
  ph: number | null;
}

const stockTrend = [
  { week: "W1", total: 42000, reserved: 8200 },
  { week: "W2", total: 38000, reserved: 9100 },
  { week: "W3", total: 35500, reserved: 7800 },
  { week: "W4", total: 41200, reserved: 8900 },
];

const initialInventory: InventoryItem[] = [
  { id: "1", variant: "Blackstrap 200L Drum", sku: "BLK-200L-DRUM", warehouse: "Dhaka HQ", onHand: 142, reserved: 28, available: 114, reorder: 20, status: "in_stock", batch: "LOT-2610-001" },
  { id: "2", variant: "Food Grade 5kg Jar", sku: "FG-5KG-JAR", warehouse: "Dhaka HQ", onHand: 380, reserved: 45, available: 335, reorder: 50, status: "in_stock", batch: "LOT-2610-002" },
  { id: "3", variant: "Feed Grade A 1t Bulk", sku: "FGA-1T-BULK", warehouse: "Chittagong", onHand: 12, reserved: 10, available: 2, reorder: 20, status: "low_stock", batch: "LOT-2610-003" },
  { id: "4", variant: "Date Palm 500ml Bottle", sku: "DP-500ML-BTL", warehouse: "Dhaka HQ", onHand: 0, reserved: 0, available: 0, reorder: 30, status: "out_of_stock", batch: "–" },
  { id: "5", variant: "Blackstrap 20L Pail", sku: "BLK-20L-PAIL", warehouse: "Dhaka HQ", onHand: 84, reserved: 12, available: 72, reorder: 15, status: "in_stock", batch: "LOT-2610-001" },
  { id: "6", variant: "Industrial 1000L IBC", sku: "IND-1000L-IBC", warehouse: "Chittagong", onHand: 4, reserved: 4, available: 0, reorder: 5, status: "low_stock", batch: "LOT-2610-005" },
  { id: "7", variant: "Bakery Molasses 25kg Tub", sku: "BKR-25KG-TUB", warehouse: "Dhaka HQ", onHand: 62, reserved: 8, available: 54, reorder: 10, status: "in_stock", batch: "LOT-2610-006" },
  { id: "8", variant: "Patali Gur 1kg Box", sku: "PAT-1KG-BOX", warehouse: "Dhaka HQ", onHand: 210, reserved: 30, available: 180, reorder: 40, status: "in_stock", batch: "LOT-2610-007" },
];

const initialBatches: BatchItem[] = [
  { id: "1", lot: "LOT-2610-001", product: "Blackstrap Molasses", supplier: "Rangpur Sugar Mill", status: "released", received: "1 Oct 2026", bestBefore: "1 Oct 2027", brix: 79.5, ph: 5.4 },
  { id: "2", lot: "LOT-2610-002", product: "Food Grade Molasses", supplier: "Rajshahi Sugar Mill", status: "released", received: "5 Oct 2026", bestBefore: "5 Oct 2027", brix: 82.1, ph: 5.2 },
  { id: "3", lot: "LOT-2610-003", product: "Feed Grade Molasses A", supplier: "Comilla Sugar Mill", status: "released", received: "20 Sep 2026", bestBefore: "20 Sep 2027", brix: 76.3, ph: 5.8 },
  { id: "4", lot: "LOT-2610-004", product: "Date Palm Molasses", supplier: "Khulna Co-op", status: "quarantine", received: "20 Oct 2026", bestBefore: "20 Apr 2027", brix: null, ph: null },
  { id: "5", lot: "LOT-2610-005", product: "Industrial Molasses", supplier: "Rangpur Sugar Mill", status: "released", received: "10 Oct 2026", bestBefore: "10 Apr 2027", brix: 71.0, ph: 6.1 },
  { id: "6", lot: "LOT-2610-006", product: "Bakery Grade Liquid", supplier: "Kushtia Agro Mills", status: "released", received: "15 Oct 2026", bestBefore: "15 Oct 2027", brix: 80.2, ph: 5.3 },
  { id: "7", lot: "LOT-2610-007", product: "Traditional Patali Gur", supplier: "Jessore Date Producers", status: "quarantine", received: "22 Oct 2026", bestBefore: "22 Apr 2027", brix: 84.0, ph: 5.6 },
];

const stockStatusStyle: Record<string, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  low_stock: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  out_of_stock: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  backorder: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

const batchStatusStyle: Record<string, string> = {
  quarantine: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  released: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  blocked: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
};

export default function InventoryPage() {
  const [inventory, setInventory] = React.useState<InventoryItem[]>(initialInventory);
  const [batches, setBatches] = React.useState<BatchItem[]>(initialBatches);

  const inventoryColumns = React.useMemo<ColumnDef<InventoryItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all stock items"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select item"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "variant",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Variant" />,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="min-w-[190px]">
            <p className="text-sm font-semibold text-foreground hover:text-amber-600 transition-colors">
              {item.variant}
            </p>
            <p className="text-xs text-muted-foreground">Lot: {item.batch}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "sku",
      header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue("sku")}</span>,
    },
    {
      accessorKey: "warehouse",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Warehouse" />,
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("warehouse")}</span>,
    },
    {
      accessorKey: "onHand",
      header: ({ column }) => <DataTableColumnHeader column={column} title="On Hand" />,
      cell: ({ row }) => (
        <span className="text-xs font-semibold">{Number(row.getValue("onHand")).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "reserved",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reserved" />,
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
          {Number(row.getValue("reserved")).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "available",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Available" />,
      cell: ({ row }) => (
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {Number(row.getValue("available")).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "reorder",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reorder At" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.getValue("reorder")}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${stockStatusStyle[status]}`}
          >
            {status.replace("_", " ")}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => alert(`Adjust Stock for ${item.variant}`)}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Adjust Stock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Transfer ${item.variant}`)}>
                <Package className="h-3.5 w-3.5 mr-2" /> Warehouse Transfer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setInventory((prev) => prev.filter((i) => i.id !== item.id))}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove Item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const batchColumns = React.useMemo<ColumnDef<BatchItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all batches"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select batch"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "lot",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lot Code" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">{row.getValue("lot")}</span>
      ),
    },
    {
      accessorKey: "product",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("product")}</span>,
    },
    {
      accessorKey: "supplier",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("supplier")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${batchStatusStyle[s]}`}
          >
            {s}
          </span>
        );
      },
    },
    {
      accessorKey: "received",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Received" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.getValue("received"))}</span>,
    },
    {
      accessorKey: "bestBefore",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Best Before" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.getValue("bestBefore"))}</span>,
    },
    {
      accessorKey: "brix",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brix (%)" />,
      cell: ({ row }) => {
        const val = row.getValue("brix");
        return <span className="text-xs font-mono">{val !== null && val !== undefined ? `${val}%` : "–"}</span>;
      },
    },
    {
      accessorKey: "ph",
      header: ({ column }) => <DataTableColumnHeader column={column} title="pH Level" />,
      cell: ({ row }) => {
        const val = row.getValue("ph");
        return <span className="text-xs font-mono">{val !== null && val !== undefined ? String(val) : "–"}</span>;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const b = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => alert(`View CoA & QA test data for ${b.lot}`)}>
                <FileCheck className="h-3.5 w-3.5 mr-2" /> View CoA
              </DropdownMenuItem>
              {b.status === "quarantine" ? (
                <DropdownMenuItem
                  className="text-emerald-600 focus:text-emerald-600"
                  onClick={() =>
                    setBatches((prev) =>
                      prev.map((item) => (item.id === b.id ? { ...item, status: "released" } : item))
                    )
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Release Batch
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-amber-600 focus:text-amber-600"
                  onClick={() =>
                    setBatches((prev) =>
                      prev.map((item) => (item.id === b.id ? { ...item, status: "quarantine" } : item))
                    )
                  }
                >
                  <Ban className="h-3.5 w-3.5 mr-2" /> Quarantine
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const handleExportStockCSV = (selected: InventoryItem[]) => {
    const list = selected.length > 0 ? selected : inventory;
    const headers = ["SKU", "Variant", "Warehouse", "OnHand", "Reserved", "Available", "Status", "Lot"];
    const rows = list.map((i) => [
      i.sku,
      `"${i.variant}"`,
      `"${i.warehouse}"`,
      i.onHand,
      i.reserved,
      i.available,
      i.status,
      i.batch,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `inventory_stock_${Date.now()}.csv`;
    link.click();
  };

  const handleExportBatchesCSV = (selected: BatchItem[]) => {
    const list = selected.length > 0 ? selected : batches;
    const headers = ["Lot", "Product", "Supplier", "Status", "Received", "BestBefore", "Brix", "pH"];
    const rows = list.map((b) => [
      b.lot,
      `"${b.product}"`,
      `"${b.supplier}"`,
      b.status,
      formatDate(b.received),
      formatDate(b.bestBefore),
      b.brix ?? "",
      b.ph ?? "",
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `batches_${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory & Batches</h1>
          <p className="text-muted-foreground text-sm">
            Stock levels, batch traceability, and warehouse ledger
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
            onClick={() => {
              const newBatch: BatchItem = {
                id: String(Date.now()),
                lot: `LOT-${Date.now().toString().slice(-4)}`,
                product: "Sugarcane Blackstrap Molasses",
                supplier: "Kushtia Agro Mills",
                status: "quarantine",
                received: "24 Oct 2026",
                bestBefore: "24 Oct 2027",
                brix: 81.5,
                ph: 5.3,
              };
              setBatches((prev) => [newBatch, ...prev]);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Batch
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
        {[
          { label: "Total On-Hand (kg)", value: "62,820", sub: "across 2 warehouses" },
          { label: "Reserved", value: "15,640", sub: "pending fulfillment" },
          { label: "Available", value: "47,180", sub: "ready to ship" },
          { label: "Low / Out of Stock", value: "4 SKUs", sub: "needs replenishment" },
        ].map((s, i) => (
          <Card key={i} className="border shadow-xs">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase font-medium text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Stock Trend Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border shadow-xs">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold">Stock Trend (4 weeks)</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={stockTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                />
                <Line type="monotone" dataKey="total" stroke="#d97706" strokeWidth={2} dot={{ fill: "#d97706" }} name="Total (kg)" />
                <Line type="monotone" dataKey="reserved" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} name="Reserved (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs with TanStack Tables */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Tabs defaultValue="levels" className="w-full">
          <TabsList className="mb-4 bg-muted/60 p-1">
            <TabsTrigger value="levels" className="text-xs">
              Stock Levels <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{inventory.length}</span>
            </TabsTrigger>
            <TabsTrigger value="batches" className="text-xs">
              Batches & Lots <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{batches.length}</span>
            </TabsTrigger>
            <TabsTrigger value="movements" className="text-xs">
              Stock Movements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="levels">
            <DataTable
              columns={inventoryColumns}
              data={inventory}
              searchPlaceholder="Search by variant name, SKU or warehouse..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={5}
              pageSizeOptions={[5, 10, 20]}
              bulkActions={(selected, clearSelection) => (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background"
                    onClick={() => handleExportStockCSV(selected)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => {
                      const ids = new Set(selected.map((s) => s.id));
                      setInventory((prev) => prev.filter((i) => !ids.has(i.id)));
                      clearSelection();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete Selected
                  </Button>
                </>
              )}
              emptyMessage="No inventory items match your search query."
            />
          </TabsContent>

          <TabsContent value="batches">
            <DataTable
              columns={batchColumns}
              data={batches}
              searchPlaceholder="Search lots by lot code, product or supplier..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={5}
              pageSizeOptions={[5, 10, 20]}
              bulkActions={(selected, clearSelection) => (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background text-emerald-700 dark:text-emerald-400"
                    onClick={() => {
                      const ids = new Set(selected.map((s) => s.id));
                      setBatches((prev) =>
                        prev.map((b) => (ids.has(b.id) ? { ...b, status: "released" as const } : b))
                      );
                      clearSelection();
                    }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    Release Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background text-amber-700 dark:text-amber-400"
                    onClick={() => {
                      const ids = new Set(selected.map((s) => s.id));
                      setBatches((prev) =>
                        prev.map((b) => (ids.has(b.id) ? { ...b, status: "quarantine" as const } : b))
                      );
                      clearSelection();
                    }}
                  >
                    <Ban className="h-3.5 w-3.5 mr-1" />
                    Quarantine Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background"
                    onClick={() => handleExportBatchesCSV(selected)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export CSV
                  </Button>
                </>
              )}
              emptyMessage="No batches found matching your search query."
            />
          </TabsContent>

          <TabsContent value="movements">
            <Card className="border shadow-xs">
              <CardContent className="pt-10 pb-10 text-center">
                <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Stock movement ledger — immutable audit trail of all receipts, sales dispatches, transfers, and adjustments.
                </p>
                <Button className="mt-4" variant="outline" size="sm">
                  Load Full Movement History
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
