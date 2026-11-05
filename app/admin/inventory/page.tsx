"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  MoreHorizontal,
  Package,
  Download,
  ShieldCheck,
  Ban,
  Trash2,
  FileCheck,
  Edit,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  getAdminInventoryAction,
  getAdminBatchesAction,
  adjustStockAction,
  updateBatchStatusAction,
  InventoryItem,
  BatchItem,
} from "@/actions/inventory";

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
  const queryClient = useQueryClient();

  // Stock adjustment dialog
  const [isAdjustOpen, setIsAdjustOpen] = React.useState(false);
  const [selectedStock, setSelectedStock] = React.useState<InventoryItem | null>(null);
  const [onHandInput, setOnHandInput] = React.useState("");
  const [reorderInput, setReorderInput] = React.useState("");

  const { data: invData, isLoading: isInvLoading } = useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: async () => {
      const res = await getAdminInventoryAction();
      if (!res.success) throw new Error(res.error || "Failed to load inventory");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const { data: batches = [], isLoading: isBatchesLoading } = useQuery({
    queryKey: ["admin", "batches"],
    queryFn: async () => {
      const res = await getAdminBatchesAction();
      if (!res.success) throw new Error(res.error || "Failed to load batches");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const inventory = invData?.inventory || [];
  const kpis = invData?.kpis || {
    totalOnHand: 0,
    totalReserved: 0,
    totalAvailable: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  };

  const adjustMutation = useMutation({
    mutationFn: adjustStockAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Stock level updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        setIsAdjustOpen(false);
        setSelectedStock(null);
      } else {
        toast.error(res.error || "Failed to adjust stock");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to adjust stock");
    },
  });

  const updateBatchMutation = useMutation({
    mutationFn: updateBatchStatusAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Batch status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "batches"] });
      } else {
        toast.error(res.error || "Failed to update batch");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update batch");
    },
  });

  const handleExportStockCSV = (selected: InventoryItem[]) => {
    const list = selected.length > 0 ? selected : inventory;
    const headers = ["ID", "Variant", "SKU", "Warehouse", "OnHand", "Reserved", "Available", "ReorderPoint", "Status"];
    const rows = list.map((i) => [
      i.id,
      `"${i.variant}"`,
      i.sku,
      `"${i.warehouse}"`,
      i.onHand,
      i.reserved,
      i.available,
      i.reorder,
      i.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `inventory_${Date.now()}.csv`;
    link.click();
  };

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
            <p className="text-xs text-muted-foreground">{item.sku}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "warehouse",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Warehouse" />,
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("warehouse")}</span>,
    },
    {
      accessorKey: "onHand",
      header: ({ column }) => <DataTableColumnHeader column={column} title="On Hand" />,
      cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.getValue("onHand")}</span>,
    },
    {
      accessorKey: "reserved",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reserved" />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue("reserved")}</span>,
    },
    {
      accessorKey: "available",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Available" />,
      cell: ({ row }) => {
        const avail = Number(row.getValue("available"));
        return (
          <span className={`font-mono text-xs font-bold ${avail <= 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {avail}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${stockStatusStyle[s]}`}
          >
            {s.replace(/_/g, " ")}
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
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="text-amber-600 focus:text-amber-600"
                onClick={() => {
                  setSelectedStock(item);
                  setOnHandInput(String(item.onHand));
                  setReorderInput(String(item.reorder));
                  setIsAdjustOpen(true);
                }}
              >
                <Edit className="h-3.5 w-3.5 mr-2" /> Adjust Stock
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
      accessorKey: "batchNo",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lot Number" />,
      cell: ({ row }) => <span className="font-mono text-xs font-bold text-foreground">{row.getValue("batchNo")}</span>,
    },
    {
      accessorKey: "product",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("product")}</span>,
    },
    {
      accessorKey: "supplier",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Source Mill" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("supplier")}</span>,
    },
    {
      accessorKey: "brix",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brix (%)" />,
      cell: ({ row }) => {
        const b = row.getValue("brix");
        return b ? <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">{String(b)}°</span> : <span className="text-xs text-muted-foreground">–</span>;
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Quality Status" />,
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
            <DropdownMenuContent align="end" className="w-40">
              {b.status !== "released" && (
                <DropdownMenuItem
                  className="text-emerald-600 focus:text-emerald-600"
                  onClick={() => updateBatchMutation.mutate({ id: b.id, status: "released" })}
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Release Lot
                </DropdownMenuItem>
              )}
              {b.status !== "quarantine" && (
                <DropdownMenuItem
                  className="text-amber-600 focus:text-amber-600"
                  onClick={() => updateBatchMutation.mutate({ id: b.id, status: "quarantine" })}
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
  ], [updateBatchMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Inventory & QA Lots</h1>
          <p className="text-muted-foreground text-sm">
            Warehouse on-hand quantities, reserved allocations, safety buffers, and Brix quality lots
          </p>
        </div>
      </motion.div>

      {/* KPI Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase font-medium text-muted-foreground">Total On-Hand</p>
            {isInvLoading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{kpis.totalOnHand.toLocaleString()} Units</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Across all storage facilities</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase font-medium text-muted-foreground">Reserved Orders</p>
            {isInvLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{kpis.totalReserved.toLocaleString()} Units</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Pending fulfillment dispatch</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase font-medium text-muted-foreground">Available to Ship</p>
            {isInvLoading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {kpis.totalAvailable.toLocaleString()} Units
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Ready for new customer orders</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase font-medium text-muted-foreground">Low / Out of Stock</p>
            {isInvLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {kpis.lowStockCount + kpis.outOfStockCount} SKUs
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Below safety reorder point</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs and Data Tables */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue="levels" className="w-full">
          <TabsList className="mb-4 bg-muted/60 p-1">
            <TabsTrigger value="levels" className="text-xs">
              Stock Levels <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{inventory.length}</span>
            </TabsTrigger>
            <TabsTrigger value="batches" className="text-xs">
              Quality Batches & Lots <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{batches.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="levels">
            <DataTable
              columns={inventoryColumns}
              data={inventory}
              searchPlaceholder="Search variant name, SKU, or warehouse..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
              bulkActions={(selected, clearSelection) => (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background"
                  onClick={() => handleExportStockCSV(selected)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export Selected
                </Button>
              )}
              emptyMessage="No inventory levels registered in database."
            />
          </TabsContent>

          <TabsContent value="batches">
            <DataTable
              columns={batchColumns}
              data={batches}
              searchPlaceholder="Search lot code, product, or supplier..."
              enableRowSelection={false}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
              emptyMessage="No production batches registered in database."
            />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock Level</DialogTitle>
            <DialogDescription>
              Update physical on-hand quantity for {selectedStock?.variant} ({selectedStock?.warehouse}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="onHand">On Hand Quantity *</Label>
              <Input
                id="onHand"
                type="number"
                value={onHandInput}
                onChange={(e) => setOnHandInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reorder">Reorder Threshold Point</Label>
              <Input
                id="reorder"
                type="number"
                value={reorderInput}
                onChange={(e) => setReorderInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!onHandInput || adjustMutation.isPending}
              onClick={() => {
                if (selectedStock) {
                  adjustMutation.mutate({
                    variantId: selectedStock.variantId,
                    warehouseId: selectedStock.warehouseId,
                    onHand: Number(onHandInput),
                    reorderPoint: Number(reorderInput) || 10,
                  });
                }
              }}
            >
              {adjustMutation.isPending ? "Saving..." : "Update Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
