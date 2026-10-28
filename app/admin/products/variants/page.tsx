"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, Package, ArrowLeft, MoreHorizontal, Download, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

export interface VariantItem {
  id: string;
  product: string;
  sku: string;
  barcode: string;
  title: string;
  packType: string;
  size: string;
  weight: string;
  costPrice: string;
  retailPrice: string;
  wholesalePrice: string;
  stock: "in_stock" | "low_stock" | "out_of_stock";
  stockQty: number;
  active: boolean;
}

const initialVariants: VariantItem[] = [
  {
    id: "VAR-001",
    product: "Blackstrap Molasses",
    sku: "BSM-200L-DRUM",
    barcode: "89410012001",
    title: "200L Steel Drum",
    packType: "drum",
    size: "200 L",
    weight: "280 kg",
    costPrice: "৳ 18,500",
    retailPrice: "৳ 24,000",
    wholesalePrice: "৳ 21,500",
    stock: "in_stock",
    stockQty: 48,
    active: true,
  },
  {
    id: "VAR-002",
    product: "Blackstrap Molasses",
    sku: "BSM-25KG-JCAN",
    barcode: "89410012002",
    title: "25kg Heavy Jerrycan",
    packType: "jerrycan",
    size: "25 kg",
    weight: "26 kg",
    costPrice: "৳ 2,400",
    retailPrice: "৳ 3,200",
    wholesalePrice: "৳ 2,850",
    stock: "in_stock",
    stockQty: 180,
    active: true,
  },
  {
    id: "VAR-003",
    product: "Food Grade Sugarcane Molasses",
    sku: "FGM-5KG-PAIL",
    barcode: "89410012003",
    title: "5kg Food Grade Pail",
    packType: "pail",
    size: "5 kg",
    weight: "5.2 kg",
    costPrice: "৳ 650",
    retailPrice: "৳ 950",
    wholesalePrice: "৳ 820",
    stock: "in_stock",
    stockQty: 320,
    active: true,
  },
  {
    id: "VAR-004",
    product: "Date Palm Liquid Nolen Gur",
    sku: "DPG-500ML-BOT",
    barcode: "89410012004",
    title: "500ml Glass Bottle",
    packType: "bottle",
    size: "500 ml",
    weight: "0.8 kg",
    costPrice: "৳ 280",
    retailPrice: "৳ 450",
    wholesalePrice: "৳ 380",
    stock: "low_stock",
    stockQty: 14,
    active: true,
  },
  {
    id: "VAR-005",
    product: "Feed Grade Molasses A",
    sku: "FGA-1T-IBC",
    barcode: "89410012005",
    title: "1 Ton IBC Tote",
    packType: "ibc",
    size: "1000 L",
    weight: "1,400 kg",
    costPrice: "৳ 62,000",
    retailPrice: "৳ 78,000",
    wholesalePrice: "৳ 72,000",
    stock: "in_stock",
    stockQty: 12,
    active: true,
  },
  {
    id: "VAR-006",
    product: "Raw Unrefined Cane Jaggery Syrup",
    sku: "JAG-10KG-TUB",
    barcode: "89410012006",
    title: "10kg Food Service Tub",
    packType: "pail",
    size: "10 kg",
    weight: "10.4 kg",
    costPrice: "৳ 1,200",
    retailPrice: "৳ 1,800",
    wholesalePrice: "৳ 1,550",
    stock: "in_stock",
    stockQty: 85,
    active: true,
  },
];

const stockStyles: Record<string, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  low_stock: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  out_of_stock: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

export default function VariantsPage() {
  const [variants, setVariants] = React.useState<VariantItem[]>(initialVariants);
  const [packFilter, setPackFilter] = React.useState("all");

  const filteredVariants = React.useMemo(() => {
    return variants.filter((v) => {
      if (packFilter !== "all" && v.packType !== packFilter) return false;
      return true;
    });
  }, [variants, packFilter]);

  const handleExportCSV = (selected: VariantItem[]) => {
    const list = selected.length > 0 ? selected : filteredVariants;
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

  const variantColumns = React.useMemo<ColumnDef<VariantItem>[]>(() => [
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product & Pack Title" />,
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="min-w-[180px]">
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {v.product}
            </p>
            <p className="text-xs text-muted-foreground">{v.title}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "packType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Pack & Size" />,
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div>
            <Badge variant="outline" className="capitalize text-xs font-normal">
              {v.packType}
            </Badge>
            <p className="text-[11px] text-muted-foreground mt-0.5">{v.size}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "weight",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gross Wt" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground font-mono">{row.getValue("weight")}</span>,
    },
    {
      accessorKey: "wholesalePrice",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Wholesale" />,
      cell: ({ row }) => (
        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
          {row.getValue("wholesalePrice")}
        </span>
      ),
    },
    {
      accessorKey: "retailPrice",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Retail" />,
      cell: ({ row }) => (
        <span className="text-xs font-bold text-foreground">
          {row.getValue("retailPrice")}
        </span>
      ),
    },
    {
      accessorKey: "stockQty",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Stock Qty" />,
      cell: ({ row }) => (
        <div className="text-xs">
          <span className="font-bold">{row.getValue("stockQty")}</span>
          <span className="text-muted-foreground"> units</span>
        </div>
      ),
    },
    {
      accessorKey: "stock",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const s = row.original.stock;
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${stockStyles[s]}`}>
            {s.replace("_", " ")}
          </span>
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
              <DropdownMenuItem onClick={() => alert(`Edit ${v.sku}`)}>
                <Edit className="h-3.5 w-3.5 mr-2" /> Edit Variant
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setVariants((prev) => prev.filter((item) => item.id !== v.id))}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Product Variants & Packaging</h1>
            <p className="text-muted-foreground text-sm">
              Manage SKUs, drum sizes, bottles, jerrycans, barcodes, and tier margins
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
            onClick={() => {
              const newVar: VariantItem = {
                id: `VAR-00${variants.length + 1}`,
                product: "Artisanal Date Palm Molasses",
                sku: `DPM-1KG-JAR`,
                barcode: `8941001200${variants.length + 1}`,
                title: "1kg Premium Hex Glass Jar",
                packType: "jar",
                size: "1 kg",
                weight: "1.4 kg",
                costPrice: "৳ 420",
                retailPrice: "৳ 680",
                wholesalePrice: "৳ 590",
                stock: "in_stock",
                stockQty: 90,
                active: true,
              };
              setVariants((prev) => [newVar, ...prev]);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Variant
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-4"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase font-medium text-muted-foreground">Total SKUs</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{variants.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Configured variations</p>
          </CardContent>
        </Card>
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase font-medium text-muted-foreground">Bulk Pack Types</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {variants.filter((v) => v.packType === "drum" || v.packType === "ibc").length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Drums & IBC Totes</p>
          </CardContent>
        </Card>
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase font-medium text-muted-foreground">Retail Packs</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {variants.filter((v) => v.packType !== "drum" && v.packType !== "ibc").length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Bottles, jars & pails</p>
          </CardContent>
        </Card>
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase font-medium text-muted-foreground">Gross Margins</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">29.4%</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Healthy unit economics</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* TanStack Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable
          columns={variantColumns}
          data={filteredVariants}
          searchPlaceholder="Search SKU, barcode, product name..."
          enableRowSelection={true}
          enableSorting={true}
          enablePagination={true}
          initialPageSize={5}
          pageSizeOptions={[5, 10, 20]}
          toolbarPrefix={
            <div className="flex items-center gap-2">
              <Select value={packFilter} onValueChange={(v) => setPackFilter(v || "all")}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Pack Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packs</SelectItem>
                  <SelectItem value="drum">Drums</SelectItem>
                  <SelectItem value="ibc">IBC Totes</SelectItem>
                  <SelectItem value="jerrycan">Jerrycans</SelectItem>
                  <SelectItem value="pail">Pails</SelectItem>
                  <SelectItem value="bottle">Bottles</SelectItem>
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
          bulkActions={(selected, clearSelection) => (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-background"
                onClick={() => handleExportCSV(selected)}
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
                  setVariants((prev) => prev.filter((v) => !ids.has(v.id)));
                  clearSelection();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Selected
              </Button>
            </>
          )}
          emptyMessage="No variants found matching your search."
        />
      </motion.div>
    </div>
  );
}
