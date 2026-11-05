"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ArrowLeft, Layers, Percent, Building2, Download, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { getAdminPriceTiersAction, AdminPriceTierItem } from "@/actions/products";

export default function PriceTiersPage() {
  const { data: tiersRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "price-tiers"],
    queryFn: getAdminPriceTiersAction,
  });

  const tiers = tiersRes?.data || [];

  const handleExportCSV = (selected: AdminPriceTierItem[]) => {
    const list = selected.length > 0 ? selected : tiers;
    if (list.length === 0) {
      toast.info("No price tiers to export");
      return;
    }
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

  const tierColumns = React.useMemo<ColumnDef<AdminPriceTierItem>[]>(() => [
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
      cell: ({ row }) => {
        const id = row.getValue("id") as string;
        return <span className="font-mono text-xs font-semibold text-foreground">PTR-{id.slice(0, 6)}</span>;
      },
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
      cell: ({ row }) => <span className="font-bold text-xs text-foreground">{row.getValue("unitPrice")}</span>,
    },
    {
      accessorKey: "discount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Volume Savings" />,
      cell: ({ row }) => {
        const disc = row.getValue("discount") as string;
        return disc.includes("OFF") ? (
          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] border-emerald-500/30">
            {disc}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{disc}</span>
        );
      },
    },
    {
      accessorKey: "businessType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer Segment" />,
      cell: ({ row }) => <Badge variant="outline" className="text-xs font-normal">{row.getValue("businessType")}</Badge>,
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
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/admin/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Wholesale & Volume Price Tiers</h1>
            <p className="text-muted-foreground text-sm">
              Quantity bracket discounts for cattle feed mills, industrial distilleries, and retail cases
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
            Export Tiers
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Configured Tiers</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{tiers.length} Brackets</p>
            <p className="text-xs text-muted-foreground mt-0.5">Automated volume discounting</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Max Volume Savings</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">Up to 20%</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Bulk truckloads</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">B2B Auto-Applied</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">Applied at checkout & RFQ</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Database Sync</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">PostgreSQL</p>
            <p className="text-xs text-muted-foreground mt-0.5">price_tiers table</p>
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
            columns={tierColumns}
            data={tiers}
            searchPlaceholder="Search product variant, SKU, bracket..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={10}
            pageSizeOptions={[5, 10, 20]}
            emptyMessage="No price tiers configured in database."
          />
        )}
      </motion.div>
    </div>
  );
}
