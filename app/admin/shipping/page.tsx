"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Truck,
  DollarSign,
  Clock,
  Globe,
  MoreHorizontal,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  getAdminShippingMethodsAction,
  toggleShippingMethodActiveAction,
  ShippingMethodItem,
} from "@/actions/shipping";

export default function ShippingMethodsPage() {
  const queryClient = useQueryClient();

  const { data: methodsRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "shipping-methods"],
    queryFn: getAdminShippingMethodsAction,
  });

  const methods = methodsRes?.data || [];

  const toggleMutation = useMutation({
    mutationFn: toggleShippingMethodActiveAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Shipping method updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "shipping-methods"] });
      } else {
        toast.error(res.error || "Failed to update shipping method");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update shipping method");
    },
  });

  const activeCount = methods.filter((m) => m.status === "active").length;

  const handleExportCSV = (selected: ShippingMethodItem[]) => {
    const list = selected.length > 0 ? selected : methods;
    if (list.length === 0) {
      toast.info("No shipping methods to export");
      return;
    }
    const headers = ["ID", "Code", "Name", "Carrier", "Type", "BaseCost", "PerKgCost", "FreeAbove", "TransitDays", "Status"];
    const rows = list.map((m) => [
      m.id,
      m.code,
      `"${m.name}"`,
      `"${m.carrier}"`,
      m.type,
      `"${m.baseCost}"`,
      `"${m.perKgCost}"`,
      `"${m.freeAbove}"`,
      `"${m.transitDays}"`,
      m.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `shipping_methods_${Date.now()}.csv`;
    link.click();
  };

  const methodColumns = React.useMemo<ColumnDef<ShippingMethodItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all methods"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select method"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Method & Service" />,
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="min-w-[190px]">
            <Badge variant="outline" className="font-mono text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10">
              {m.code}
            </Badge>
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors mt-0.5">
              {m.name}
            </p>
            {m.nameBn && <p className="text-xs text-muted-foreground">{m.nameBn}</p>}
          </div>
        );
      },
    },
    {
      accessorKey: "carrier",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Service Carrier" />,
      cell: ({ row }) => <span className="text-xs font-medium text-foreground">{row.getValue("carrier")}</span>,
    },
    {
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Target Parcel Type" />,
      cell: ({ row }) => <Badge variant="secondary" className="text-xs font-normal">{row.getValue("type")}</Badge>,
    },
    {
      accessorKey: "baseCost",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Base Charge" />,
      cell: ({ row }) => <span className="font-bold text-xs text-foreground">{row.getValue("baseCost")}</span>,
    },
    {
      accessorKey: "perKgCost",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Weight Increment" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("perKgCost")}</span>,
    },
    {
      accessorKey: "freeAbove",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Free Shipping Over" />,
      cell: ({ row }) => <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{row.getValue("freeAbove")}</span>,
    },
    {
      accessorKey: "transitDays",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Est. Transit" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("transitDays")}</span>,
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
        const m = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() =>
                  toggleMutation.mutate({ id: m.id, isActive: m.status !== "active" })
                }
              >
                {m.status === "active" ? (
                  <>
                    <XCircle className="h-3.5 w-3.5 mr-2 text-rose-500" /> Disable Method
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Enable Method
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], [toggleMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shipping Methods & Freight Rules</h1>
          <p className="text-muted-foreground text-sm">
            Courier API connections, per-kg weight calculation bands, and bulk freight options
          </p>
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
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9"
          >
            <Link href="/admin/shipping/zones">
              <Globe className="h-4 w-4 mr-2" />
              Manage Zones
            </Link>
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Methods</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{activeCount} Configured</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ready at checkout</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Services</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{methods.length} Methods</p>
            <p className="text-xs text-muted-foreground mt-0.5">Stored in database</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Free Shipping Rule</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">৳ 2,000+</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Threshold enabled</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Coverage Area</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">64 Districts</p>
            <p className="text-xs text-muted-foreground mt-0.5">All 8 administrative divisions</p>
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
            columns={methodColumns}
            data={methods}
            searchPlaceholder="Search method name, code, carrier..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={10}
            pageSizeOptions={[5, 10, 20]}
            emptyMessage="No shipping methods configured in database."
          />
        )}
      </motion.div>
    </div>
  );
}
