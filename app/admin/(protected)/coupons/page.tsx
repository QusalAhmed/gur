"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, Tag, Percent, Copy, MoreHorizontal, Users, DollarSign, Download, Trash2, CheckCircle, Ban } from "lucide-react";
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
  DropdownMenuSeparator,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import {
  getAdminCouponsAction,
  createCouponAction,
  toggleCouponActiveAction,
  deleteCouponAction,
  CouponItem,
  RedemptionItem,
} from "@/actions/coupons";

export default function CouponsPage() {
  const queryClient = useQueryClient();

  // Create modal state
  const [isOpen, setIsOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [discountType, setDiscountType] = React.useState<"percentage" | "fixed_amount" | "free_shipping">("percentage");
  const [value, setValue] = React.useState("10");
  const [minOrder, setMinOrder] = React.useState("0");
  const [maxDiscount, setMaxDiscount] = React.useState("");
  const [usageLimit, setUsageLimit] = React.useState("");
  const [businessOnly, setBusinessOnly] = React.useState(false);

  const { data: couponsData, isLoading } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const res = await getAdminCouponsAction();
      if (!res.success) throw new Error(res.error || "Failed to load coupons");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const coupons = couponsData?.coupons || [];
  const redemptions = couponsData?.redemptions || [];

  const createMutation = useMutation({
    mutationFn: createCouponAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Coupon code created");
        queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
        setIsOpen(false);
        setCode("");
        setDescription("");
        setValue("10");
        setMinOrder("0");
        setMaxDiscount("");
        setUsageLimit("");
      } else {
        toast.error(res.error || "Failed to create coupon");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create coupon");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleCouponActiveAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Coupon status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      } else {
        toast.error(res.error || "Failed to update coupon");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update coupon");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCouponAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Coupon deleted");
        queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      } else {
        toast.error(res.error || "Failed to delete coupon");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete coupon");
    },
  });

  const activeCount = coupons.filter((c) => c.status === "active").length;

  const handleExportCouponsCSV = (selected: CouponItem[]) => {
    const list = selected.length > 0 ? selected : coupons;
    const headers = ["ID", "Code", "Type", "Value", "MinOrder", "MaxDiscount", "Usage", "Status", "B2BOnly", "ValidUntil"];
    const rows = list.map((c) => [
      c.id,
      c.code,
      c.type,
      `"${c.value}"`,
      `"${c.minOrder}"`,
      `"${c.maxDiscount}"`,
      c.usage,
      c.status,
      c.b2bOnly,
      formatDate(c.validUntil),
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `coupons_${Date.now()}.csv`;
    link.click();
  };

  const couponColumns = React.useMemo<ColumnDef<CouponItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all coupons"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select coupon"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "code",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Coupon Code" />,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="min-w-[180px]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded border">
                {c.code}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(c.code);
                  toast.success(`Copied code ${c.code}`);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy code"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.description}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "value",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Discount" />,
      cell: ({ row }) => (
        <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
          {row.getValue("value")}
        </span>
      ),
    },
    {
      accessorKey: "minOrder",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Min Spend" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("minOrder")}</span>,
    },
    {
      accessorKey: "usage",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Redeemed / Limit" />,
      cell: ({ row }) => <span className="text-xs font-mono">{row.getValue("usage")}</span>,
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
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 capitalize text-[11px]"
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
        const c = row.original;
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
                onClick={() => toggleMutation.mutate({ id: c.id, isActive: c.status !== "active" })}
              >
                {c.status === "active" ? (
                  <>
                    <Ban className="h-3.5 w-3.5 mr-2" /> Deactivate
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 mr-2" /> Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteMutation.mutate(c.id)}
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
  ], [toggleMutation, deleteMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coupons & Campaigns</h1>
          <p className="text-muted-foreground text-sm">
            Promotional voucher codes, wholesale discounts, and campaign redemptions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            onClick={() => setIsOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Coupon
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Coupons</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Tag className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{activeCount} Codes</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Live for customer checkout</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Redemptions</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{redemptions.length} Uses</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Redeemed across completed orders</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Campaign Codes</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{coupons.length} Vouchers</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">All-time promotional inventory</p>
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
          columns={couponColumns}
          data={coupons}
          searchPlaceholder="Search coupon code or description..."
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
              onClick={() => handleExportCouponsCSV(selected)}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export Selected
            </Button>
          )}
          emptyMessage="No promotional coupons registered in database."
        />
      </motion.div>

      {/* Create Coupon Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Promotional Coupon</DialogTitle>
            <DialogDescription>
              Issue a discount voucher code for retail or wholesale buyers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="cCode">Coupon Code *</Label>
              <Input
                id="cCode"
                placeholder="e.g. SUMMER2026"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cDesc">Description</Label>
              <Input
                id="cDesc"
                placeholder="e.g. 10% discount on 200L drums"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cType">Discount Type</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger id="cType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount (৳)</SelectItem>
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cVal">Discount Value</Label>
                <Input
                  id="cVal"
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cMin">Minimum Order (৳)</Label>
                <Input
                  id="cMin"
                  type="number"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cMax">Max Discount Cap (৳)</Label>
                <Input
                  id="cMax"
                  type="number"
                  placeholder="Optional cap"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!code || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  code,
                  description: description.trim() || undefined,
                  discountType,
                  value: Number(value) || 0,
                  minOrderAmount: Number(minOrder) || 0,
                  maxDiscountAmount: maxDiscount ? Number(maxDiscount) : undefined,
                  businessOnly,
                })
              }
            >
              {createMutation.isPending ? "Creating..." : "Save Coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
