"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, CheckCircle2, FlaskConical, Beaker, AlertTriangle, MoreHorizontal, Ban, ShieldCheck, Download } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getAdminBatchesAction,
  updateBatchStatusAction,
  BatchItem,
} from "@/actions/inventory";

const statusStyles: Record<string, string> = {
  released: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  quarantine: "bg-amber-100 text-amber-700 dark:text-amber-900/30 dark:text-amber-400",
  blocked: "bg-rose-100 text-rose-700 dark:text-rose-900/30 dark:text-rose-400",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const [tabFilter, setTabFilter] = React.useState<string>("all");

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["admin", "batches"],
    queryFn: async () => {
      const res = await getAdminBatchesAction();
      if (!res.success) throw new Error(res.error || "Failed to load batches");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateBatchStatusAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Lot status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "batches"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      } else {
        toast.error(res.error || "Failed to update batch");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update batch");
    },
  });

  const filteredBatches = React.useMemo(() => {
    if (tabFilter === "all") return batches;
    if (tabFilter === "blocked") return batches.filter((b) => b.status === "blocked" || b.status === "expired");
    return batches.filter((b) => b.status === tabFilter);
  }, [batches, tabFilter]);

  const releasedCount = batches.filter((b) => b.status === "released").length;
  const quarantineCount = batches.filter((b) => b.status === "quarantine").length;
  const blockedCount = batches.filter((b) => b.status === "blocked" || b.status === "expired").length;

  const brixLots = batches.filter((b) => b.brix !== null);
  const avgBrix = brixLots.length > 0 ? (brixLots.reduce((acc, b) => acc + (b.brix || 0), 0) / brixLots.length).toFixed(1) : "–";

  const columns: ColumnDef<BatchItem>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "batchNo",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Lot Number & Product" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div>
              <p className="font-mono font-bold text-xs text-foreground">{b.batchNo}</p>
              <p className="text-xs text-muted-foreground">{b.product}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "supplier",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sugar Mill / Source" />
        ),
        cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("supplier")}</span>,
      },
      {
        accessorKey: "mfgDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Production & Expiry" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="text-xs space-y-0.5">
              <p className="text-foreground">Prod: {formatDate(b.mfgDate)}</p>
              <p className="text-muted-foreground">Exp: {formatDate(b.expDate)}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "brix",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Brix (%)" />
        ),
        cell: ({ row }) => {
          const brix = row.getValue("brix");
          return brix ? (
            <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
              {String(brix)}° Brix
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">–</span>
          );
        },
      },
      {
        accessorKey: "ph",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="pH Level" />
        ),
        cell: ({ row }) => {
          const ph = row.getValue("ph");
          return ph ? <span className="font-mono text-xs">{String(ph)}</span> : <span className="text-xs text-muted-foreground">–</span>;
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const s = row.original.status;
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[s] || ""}`}
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
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {b.status !== "released" && (
                  <DropdownMenuItem
                    className="text-emerald-600 focus:text-emerald-600"
                    onClick={() => updateStatusMutation.mutate({ id: b.id, status: "released" })}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" /> Release Lot
                  </DropdownMenuItem>
                )}
                {b.status !== "quarantine" && (
                  <DropdownMenuItem
                    className="text-amber-600 focus:text-amber-600"
                    onClick={() => updateStatusMutation.mutate({ id: b.id, status: "quarantine" })}
                  >
                    <FlaskConical className="h-4 w-4 mr-2" /> Quarantine
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {b.status !== "blocked" && (
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600"
                    onClick={() => updateStatusMutation.mutate({ id: b.id, status: "blocked" })}
                  >
                    <Ban className="h-4 w-4 mr-2" /> Block Lot
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [updateStatusMutation]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Production Batches & QC Lots</h1>
          <p className="text-muted-foreground text-sm">
            Brix density assays, sugar percentage, laboratory release authorizations, and quarantine holds
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Released Batches</p>
              <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-2" />
            ) : (
              <p className="text-2xl font-bold mt-2">{releasedCount} Lots</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Available for sale & dispatch</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">In Lab Quarantine</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <FlaskConical className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-2" />
            ) : (
              <p className="text-2xl font-bold mt-2">{quarantineCount} Lots</p>
            )}
            <p className="text-xs text-amber-600 font-medium mt-1">Awaiting Brix & microbiology report</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Average Brix Level</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Beaker className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded my-2" />
            ) : (
              <p className="text-2xl font-bold mt-2">{avgBrix}° Brix</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Target range: 79.0° – 84.0° Brix</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Blocked / Failed</p>
              <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-2" />
            ) : (
              <p className="text-2xl font-bold mt-2">{blockedCount} Lots</p>
            )}
            <p className="text-xs text-rose-600 font-medium mt-1">Non-compliant density holds</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs and Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <Tabs value={tabFilter} onValueChange={setTabFilter}>
          <TabsList>
            <TabsTrigger value="all">All Batches ({batches.length})</TabsTrigger>
            <TabsTrigger value="released">Released ({releasedCount})</TabsTrigger>
            <TabsTrigger value="quarantine">Quarantine ({quarantineCount})</TabsTrigger>
            <TabsTrigger value="blocked">Blocked / Expired ({blockedCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4">
          <DataTable
            columns={columns}
            data={filteredBatches}
            searchPlaceholder="Search lot number, mill, product..."
            enableRowSelection
            enableColumnVisibility
            enableSorting
            enablePagination
            initialPageSize={10}
            pageSizeOptions={[10, 25, 50]}
            emptyMessage="No QC production batches found in database."
          />
        </Card>
      </motion.div>
    </div>
  );
}
