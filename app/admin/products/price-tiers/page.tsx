"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, ArrowLeft, MoreHorizontal, Layers, Percent, Building2, Download, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

export interface PriceTierItem {
  id: string;
  product: string;
  sku: string;
  tierRange: string;
  minQty: number;
  unitPrice: string;
  discount: string;
  businessType: string;
  status: "active" | "inactive";
}

const initialTiers: PriceTierItem[] = [
  {
    id: "PTR-001",
    product: "Blackstrap Molasses (200L Steel Drum)",
    sku: "BSM-200L-DRUM",
    tierRange: "1 – 4 drums",
    minQty: 1,
    unitPrice: "৳ 24,000",
    discount: "Base Retail Price",
    businessType: "All Accounts",
    status: "active",
  },
  {
    id: "PTR-002",
    product: "Blackstrap Molasses (200L Steel Drum)",
    sku: "BSM-200L-DRUM",
    tierRange: "5 – 19 drums",
    minQty: 5,
    unitPrice: "৳ 21,500",
    discount: "10.4% OFF",
    businessType: "General B2B",
    status: "active",
  },
  {
    id: "PTR-003",
    product: "Blackstrap Molasses (200L Steel Drum)",
    sku: "BSM-200L-DRUM",
    tierRange: "20+ drums (Truckload)",
    minQty: 20,
    unitPrice: "৳ 19,800",
    discount: "17.5% OFF",
    businessType: "Feed Mills & Distilleries",
    status: "active",
  },
  {
    id: "PTR-004",
    product: "Feed Grade Molasses A (1 Ton IBC Tote)",
    sku: "FGA-1T-IBC",
    tierRange: "1 – 4 totes (1-4 Tons)",
    minQty: 1,
    unitPrice: "৳ 87,000",
    discount: "Base B2B Price",
    businessType: "All Verified B2B",
    status: "active",
  },
  {
    id: "PTR-005",
    product: "Feed Grade Molasses A (1 Ton IBC Tote)",
    sku: "FGA-1T-IBC",
    tierRange: "5 – 14 totes (5-14 Tons)",
    minQty: 5,
    unitPrice: "৳ 79,500",
    discount: "8.6% OFF",
    businessType: "Feed Mills",
    status: "active",
  },
  {
    id: "PTR-006",
    product: "Feed Grade Molasses A (1 Ton IBC Tote)",
    sku: "FGA-1T-IBC",
    tierRange: "15+ totes (Bulk Contract)",
    minQty: 15,
    unitPrice: "৳ 72,000",
    discount: "17.2% OFF",
    businessType: "Contract Buyers",
    status: "active",
  },
  {
    id: "PTR-007",
    product: "Date Palm Liquid Nolen Gur (500ml Bottle)",
    sku: "DPG-500ML-BOT",
    tierRange: "12 – 48 bottles",
    minQty: 12,
    unitPrice: "৳ 410",
    discount: "8.8% OFF",
    businessType: "Retailers & Cafes",
    status: "active",
  },
  {
    id: "PTR-008",
    product: "Date Palm Liquid Nolen Gur (500ml Bottle)",
    sku: "DPG-500ML-BOT",
    tierRange: "50+ bottles (Case)",
    minQty: 50,
    unitPrice: "৳ 380",
    discount: "15.5% OFF",
    businessType: "Wholesale Supermarkets",
    status: "active",
  },
];

export default function PriceTiersPage() {
  const [tiers, setTiers] = React.useState<PriceTierItem[]>(initialTiers);

  const handleExportCSV = (selected: PriceTierItem[]) => {
    const list = selected.length > 0 ? selected : tiers;
    const headers = ["ID", "Product", "SKU", "Bracket", "MinQty", "UnitPrice", "Discount", "BusinessType", "Status"];
    const rows = list.map((t) => [
      t.id,
      `"${t.product}"`,
      t.sku,
      `"${t.tierRange}"`,
      t.minQty,
      `"${t.unitPrice}"`,
      `"${t.discount}"`,
      `"${t.businessType}"`,
      t.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `price_tiers_${Date.now()}.csv`;
    link.click();
  };

  const tierColumns = React.useMemo<ColumnDef<PriceTierItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all tiers"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select tier"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tier ID" />,
      cell: ({ row }) => <span className="font-mono text-xs font-semibold text-foreground">{row.getValue("id")}</span>,
    },
    {
      accessorKey: "product",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product Variant" />,
      cell: ({ row }) => (
        <span className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
          {row.getValue("product")}
        </span>
      ),
    },
    {
      accessorKey: "sku",
      header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-amber-700 dark:text-amber-400 font-medium">
          {row.getValue("sku")}
        </span>
      ),
    },
    {
      accessorKey: "tierRange",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Quantity Bracket" />,
      cell: ({ row }) => <span className="text-xs font-semibold">{row.getValue("tierRange")}</span>,
    },
    {
      accessorKey: "unitPrice",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tier Unit Price" />,
      cell: ({ row }) => (
        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
          {row.getValue("unitPrice")}
        </span>
      ),
    },
    {
      accessorKey: "discount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Savings / Discount" />,
      cell: ({ row }) => (
        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-medium border-emerald-500/30">
          {row.getValue("discount")}
        </Badge>
      ),
    },
    {
      accessorKey: "businessType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Target Account Type" />,
      cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.getValue("businessType")}</Badge>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <Badge
            variant="secondary"
            className={
              s === "active"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 capitalize text-[11px] border-emerald-500/30"
                : "bg-muted text-muted-foreground capitalize text-[11px]"
            }
          >
            {s}
          </Badge>
        );
      },
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
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => alert(`Edit ${t.id}`)}>
                <Edit className="h-3.5 w-3.5 mr-2" /> Edit Tier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setTiers((prev) => prev.filter((item) => item.id !== t.id))}
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
            <h1 className="text-2xl font-bold tracking-tight">Wholesale & Volume Price Tiers</h1>
            <p className="text-muted-foreground text-sm">
              Quantity breaks, commercial contract rates, and B2B client tier discounts
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
          onClick={() => {
            const newTier: PriceTierItem = {
              id: `PTR-00${tiers.length + 1}`,
              product: "Artisanal Date Palm Molasses",
              sku: "DPM-1KG-JAR",
              tierRange: "24 – 96 jars",
              minQty: 24,
              unitPrice: "৳ 610",
              discount: "10.3% OFF",
              businessType: "Wholesale Supermarkets",
              status: "active",
            };
            setTiers((prev) => [newTier, ...prev]);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Price Tier
        </Button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Configured Tiers</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{tiers.length} Tiers</p>
            <p className="text-xs text-muted-foreground mt-0.5">Across commercial SKUs</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Max Volume Discount</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">17.5%</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">For full truckload & bulk contract</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Eligible B2B Accounts</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">32 Approved</p>
            <p className="text-xs text-muted-foreground mt-0.5">Applied at checkout and invoicing</p>
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
          columns={tierColumns}
          data={tiers}
          searchPlaceholder="Search product variant, SKU or account type..."
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
                  setTiers((prev) => prev.filter((t) => !ids.has(t.id)));
                  clearSelection();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Selected
              </Button>
            </>
          )}
          emptyMessage="No price tiers match your search."
        />
      </motion.div>
    </div>
  );
}
