"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  Warehouse,
  MoreHorizontal,
  Download,
  Trash2,
} from "lucide-react";
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
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  getAdminWarehousesAction,
  createWarehouseAction,
  deleteWarehouseAction,
  WarehouseItem,
} from "@/actions/inventory";

export default function WarehousesPage() {
  const queryClient = useQueryClient();

  // Create warehouse modal
  const [isOpen, setIsOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["admin", "warehouses"],
    queryFn: async () => {
      const res = await getAdminWarehousesAction();
      if (!res.success) throw new Error(res.error || "Failed to load warehouses");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createWarehouseAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Storage facility added");
        queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
        setIsOpen(false);
        setCode("");
        setName("");
        setAddress("");
      } else {
        toast.error(res.error || "Failed to create warehouse");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create warehouse");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWarehouseAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Storage facility removed");
        queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      } else {
        toast.error(res.error || "Failed to delete warehouse");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete warehouse");
    },
  });

  const handleExportCSV = (selected: WarehouseItem[]) => {
    const list = selected.length > 0 ? selected : warehouses;
    const headers = ["ID", "Code", "Name", "District", "Manager", "Phone", "CapacityTons", "CurrentStockTons", "Utilization", "Status"];
    const rows = list.map((w) => [
      w.id,
      w.code,
      `"${w.name}"`,
      w.district,
      `"${w.manager}"`,
      w.phone,
      w.capacityTons,
      w.currentStockTons,
      `${w.utilization}%`,
      w.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `warehouses_${Date.now()}.csv`;
    link.click();
  };

  const warehouseColumns = React.useMemo<ColumnDef<WarehouseItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all depots"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select depot"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "code",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Depot Code" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10">
          {row.getValue("code")}
        </Badge>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Warehouse Name" />,
      cell: ({ row }) => {
        const wh = row.original;
        return (
          <div className="min-w-[190px]">
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {wh.name}
            </p>
            <p className="text-xs text-muted-foreground">{wh.address}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Facility Classification" />,
      cell: ({ row }) => <span className="text-xs font-medium text-muted-foreground">{row.getValue("type")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const isActive = row.getValue("status") === "active";
        return (
          <Badge
            variant="outline"
            className={`text-[11px] capitalize ${
              isActive
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {row.getValue("status")}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const wh = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteMutation.mutate(wh.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove Facility
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], [deleteMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Storage Facilities & Warehouses</h1>
          <p className="text-muted-foreground text-sm">
            Central distribution centers, bulk tanker terminals, regional supply depots, and cold store facilities
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            onClick={() => setIsOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Storage Depot
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Facilities</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Warehouse className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{warehouses.length} Depots</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">National distribution network</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Storage Network Capacity</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Warehouse className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">
                {(warehouses.length * 500).toLocaleString()} Tons
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Bulk liquid & containerized capacity</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Hubs</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Warehouse className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">
                {warehouses.filter((w) => w.status === "active").length} Operational
              </p>
            )}
            <p className="text-xs text-emerald-600 font-medium mt-0.5">100% operational uptime</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable
          columns={warehouseColumns}
          data={warehouses}
          searchPlaceholder="Search warehouse name, code, or location..."
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
              onClick={() => handleExportCSV(selected)}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export Selected
            </Button>
          )}
          emptyMessage="No warehouses found in database."
        />
      </motion.div>

      {/* Add Warehouse Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Storage Facility</DialogTitle>
            <DialogDescription>
              Add a new storage warehouse, regional tank farm, or dispatch depot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="wCode">Depot Code *</Label>
              <Input
                id="wCode"
                placeholder="e.g. WH-DHK-02"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wName">Warehouse Name *</Label>
              <Input
                id="wName"
                placeholder="e.g. Gazipur Central Tank Farm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wAddress">Address</Label>
              <Input
                id="wAddress"
                placeholder="Industrial Plot #14, Gazipur"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!code || !name || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  code,
                  name,
                  address: address.trim() || undefined,
                })
              }
            >
              {createMutation.isPending ? "Creating..." : "Save Facility"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
