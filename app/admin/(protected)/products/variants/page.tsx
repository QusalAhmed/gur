"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, Package, ArrowLeft, MoreHorizontal, Download, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { getAdminVariantsAction, AdminVariantItem } from "@/actions/products";

const stockStyles: Record<string, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  low_stock: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  out_of_stock: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

export default function VariantsPage() {
  const [packFilter, setPackFilter] = React.useState("all");

  const { data: variantsRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "variants"],
    queryFn: getAdminVariantsAction,
  });

  const variants = variantsRes?.data || [];

  const filteredVariants = React.useMemo(() => {
    return variants.filter((v) => {
      if (packFilter !== "all" && v.packType !== packFilter) return false;
      return true;
    });
  }, [variants, packFilter]);

  const handleExportCSV = (selected: AdminVariantItem[]) => {
    const list = selected.length > 0 ? selected : filteredVariants;
    if (list.length === 0) {
      toast.info("No variants to export");
      return;
    }
    const headers = ["SKU", "Barcode", "Product", "Title", "PackType", "Size", "Weight", "Cost", "Wholesale", "Retail", "StockQty", "Status"];
    const rows = list.map((v) => [
      v.sku,
      v.barcode,
      `"${v.product}"`,
      `"${v.title}"`,
      v.packType,
      v.size,
      v.weight,
      `"${v.costPrice}"`,
      `"${v.wholesalePrice}"`,
      `"${v.retailPrice}"`,
      v.stockQty,
      v.stock,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `product_variants_${Date.now()}.csv`;
    link.click();
  };

  const variantColumns = React.useMemo<ColumnDef<AdminVariantItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all variants"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select variant"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "sku",
      header: ({ column }) => <DataTableColumnHeader column={column} title="SKU & Barcode" />,
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div>
            <p className="font-mono text-xs font-semibold text-foreground">{v.sku}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{v.barcode}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "product",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Master Product & Title" />,
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="min-w-[190px]">
            <p className="text-xs text-muted-foreground">{v.product}</p>
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {v.title}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "packType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Packaging Type" />,
      cell: ({ row }) => {
        const pack = row.getValue("packType") as string;
        return <Badge variant="outline" className="capitalize text-xs font-normal">{pack}</Badge>;
      },
    },
    {
      accessorKey: "size",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Pack Size" />,
      cell: ({ row }) => <span className="font-mono text-xs font-medium text-foreground">{row.getValue("size")}</span>,
    },
    {
      accessorKey: "weight",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Freight Weight" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("weight")}</span>,
    },
    {
      accessorKey: "retailPrice",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Retail Price" />,
      cell: ({ row }) => <span className="font-bold text-xs text-foreground">{row.getValue("retailPrice")}</span>,
    },
    {
      accessorKey: "stock",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Inventory State" />,
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] capitalize border ${stockStyles[v.stock]}`}
            >
              {v.stock.replace("_", " ")}
            </span>
            <span className="font-mono text-xs text-muted-foreground">({v.stockQty})</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const v = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => toast.info(`Viewing variant ${v.sku}`)}>
                View SKU Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const inStockCount = variants.filter((v) => v.stock === "in_stock").length;
  const lowStockCount = variants.filter((v) => v.stock === "low_stock").length;
  const outOfStockCount = variants.filter((v) => v.stock === "out_of_stock").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/admin/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Product SKUs & Packaging Variants</h1>
            <p className="text-muted-foreground text-sm">
              Manage glass bottles, pails, 200L steel drums, 1-ton totes, barcode labels, and pricing
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => handleExportCSV([])}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total SKU Count</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{variants.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Active across catalog</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">In Stock</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{inStockCount}</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Ready for dispatch</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Low Stock Warning</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{lowStockCount}</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">Below reorder trigger</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Depleted Stock</p>
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{outOfStockCount}</p>
            <p className="text-xs text-rose-600 font-medium mt-0.5">Requires replenishment</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* TanStack Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {isLoading ? (
          <div className="h-48 flex items-center justify-center border rounded-lg bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
        ) : (
          <DataTable
            columns={variantColumns}
            data={filteredVariants}
            searchPlaceholder="Search SKU, barcode, title, product name..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={10}
            pageSizeOptions={[5, 10, 20]}
            toolbarPrefix={
              <div className="flex items-center gap-2">
                <Select value={packFilter} onValueChange={(v) => setPackFilter(v || "all")}>
                  <SelectTrigger className="w-40 h-9 text-xs">
                    <SelectValue placeholder="Packaging Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Packaging</SelectItem>
                    <SelectItem value="jar">Jar</SelectItem>
                    <SelectItem value="foil">Foil</SelectItem>
                    <SelectItem value="bottle">Bottle</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                  </SelectContent>
                </Select>
                {packFilter !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPackFilter("all")}
                    className="h-9 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear filter
                  </Button>
                )}
              </div>
            }
            emptyMessage="No product variants found in database."
          />
        )}
      </motion.div>
    </div>
  );
}
