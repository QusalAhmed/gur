"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  Building2,
  MoreHorizontal,
  Download,
  Trash2,
  Phone,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  getAdminSuppliersAction,
  createSupplierAction,
  deleteSupplierAction,
  SupplierItem,
} from "@/actions/inventory";

export default function SuppliersPage() {
  const queryClient = useQueryClient();

  // Create modal state
  const [isOpen, setIsOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: async () => {
      const res = await getAdminSuppliersAction();
      if (!res.success) throw new Error(res.error || "Failed to load suppliers");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createSupplierAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Sugar mill supplier registered");
        queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
        setIsOpen(false);
        setName("");
        setContactName("");
        setPhone("");
        setAddress("");
      } else {
        toast.error(res.error || "Failed to register supplier");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to register supplier");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplierAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Supplier removed");
        queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      } else {
        toast.error(res.error || "Failed to delete supplier");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete supplier");
    },
  });

  const handleExportCSV = (selected: SupplierItem[]) => {
    const list = selected.length > 0 ? selected : suppliers;
    const headers = ["ID", "Code", "Name", "Contact", "Phone", "District", "Status"];
    const rows = list.map((s) => [
      s.id,
      s.code,
      `"${s.name}"`,
      `"${s.contact}"`,
      s.phone,
      s.district,
      s.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `suppliers_${Date.now()}.csv`;
    link.click();
  };

  const supplierColumns = React.useMemo<ColumnDef<SupplierItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all suppliers"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select supplier"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sugar Mill / Producer" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="min-w-[190px]">
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {s.name}
            </p>
            <p className="text-xs text-muted-foreground">{s.address}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "contact",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Representative" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div>
            <p className="text-xs font-medium text-foreground">{s.contact}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3 text-muted-foreground" />
              {s.phone}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "suppliedProducts",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplied Category" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[11px] capitalize bg-muted/40">
          {row.getValue("suppliedProducts")}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const isActive = row.getValue("status") === "active";
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${
              isActive
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {row.getValue("status")}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const s = row.original;
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
                className="text-destructive focus:text-destructive"
                onClick={() => deleteMutation.mutate(s.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Supplier
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
          <h1 className="text-2xl font-bold tracking-tight">Raw Material Suppliers & Sugar Mills</h1>
          <p className="text-muted-foreground text-sm">
            State sugar mills, organic farmer alliances, date palm cooperatives, and contracted logistics partners
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            onClick={() => setIsOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Producer
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Contracted Mills</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{suppliers.length} Mills</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Primary procurement pipeline</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Operations</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">
                {suppliers.filter((s) => s.status === "active").length} Mills
              </p>
            )}
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Active crushing & delivery contracts</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Quality Assured</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">100% Verified</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Lab tested at intake</p>
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
          columns={supplierColumns}
          data={suppliers}
          searchPlaceholder="Search supplier name, representative, district..."
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
          emptyMessage="No suppliers registered in database."
        />
      </motion.div>

      {/* Add Supplier Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Sugar Mill / Producer</DialogTitle>
            <DialogDescription>
              Add a state or cooperative sugar mill source for raw molasses batches.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="sName">Producer / Mill Name *</Label>
              <Input
                id="sName"
                placeholder="e.g. Carew & Co (Bangladesh) Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sContact">Representative Contact Person</Label>
              <Input
                id="sContact"
                placeholder="e.g. Engr. Shamsul Alam"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sPhone">Phone</Label>
              <Input
                id="sPhone"
                placeholder="+8801700000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sAddress">Factory / Mill Location</Label>
              <Input
                id="sAddress"
                placeholder="e.g. Darsana, Chuadanga"
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
              disabled={!name || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name,
                  contactName: contactName.trim() || undefined,
                  phone: phone.trim() || undefined,
                  address: address.trim() || undefined,
                })
              }
            >
              {createMutation.isPending ? "Registering..." : "Save Producer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
