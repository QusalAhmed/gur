"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  MoreHorizontal,
  Users2,
  Building2,
  CheckCircle,
  Clock,
  Download,
  Mail,
  ShieldCheck,
  Ban,
  Trash2,
  ExternalLink,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import {
  getAdminCustomersAction,
  createBusinessAccountAction,
  updateBusinessStatusAction,
  deleteCustomerAction,
  deleteBusinessAccountAction,
  CustomerItem,
  BusinessItem,
} from "@/actions/customers";

const bizStatusStyle: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function CustomersPage() {
  const queryClient = useQueryClient();

  // Create B2B modal state
  const [isAddBizOpen, setIsAddBizOpen] = React.useState(false);
  const [bizName, setBizName] = React.useState("");
  const [bizIndustry, setBizIndustry] = React.useState("");
  const [bizTradeLicense, setBizTradeLicense] = React.useState("");
  const [bizContactName, setBizContactName] = React.useState("");
  const [bizPhone, setBizPhone] = React.useState("");
  const [bizEmail, setBizEmail] = React.useState("");
  const [bizCreditLimit, setBizCreditLimit] = React.useState("0");
  const [bizTerms, setBizTerms] = React.useState("30");

  const { data: customerData, isLoading } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const res = await getAdminCustomersAction();
      if (!res.success) throw new Error(res.error || "Failed to load customer directory");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const customers = customerData?.customers || [];
  const businesses = customerData?.businesses || [];

  const updateBizMutation = useMutation({
    mutationFn: updateBusinessStatusAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Business account status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      } else {
        toast.error(res.error || "Failed to update business status");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update business status");
    },
  });

  const createBizMutation = useMutation({
    mutationFn: createBusinessAccountAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("B2B account created successfully");
        queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        setIsAddBizOpen(false);
        setBizName("");
        setBizIndustry("");
        setBizTradeLicense("");
        setBizContactName("");
        setBizPhone("");
        setBizEmail("");
      } else {
        toast.error(res.error || "Failed to create business account");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create business account");
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: deleteCustomerAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Customer removed");
        queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      } else {
        toast.error(res.error || "Failed to delete customer");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete customer");
    },
  });

  const deleteBizMutation = useMutation({
    mutationFn: deleteBusinessAccountAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Business account removed");
        queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      } else {
        toast.error(res.error || "Failed to delete business account");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete business account");
    },
  });

  const handleExportCustomersCSV = (selected: CustomerItem[]) => {
    const list = selected.length > 0 ? selected : customers;
    const headers = ["ID", "Name", "Email", "Phone", "Type", "Orders", "Spent", "Joined", "LastOrder", "FBLink"];
    const rows = list.map((c) => [
      c.id,
      `"${c.name}"`,
      c.email,
      c.phone,
      c.type,
      c.orders,
      `"${c.spent}"`,
      formatDate(c.joined),
      formatDate(c.lastOrder),
      c.fbLink ? `"${c.fbLink}"` : "",
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `customers_${Date.now()}.csv`;
    link.click();
  };

  const handleExportBusinessesCSV = (selected: BusinessItem[]) => {
    const list = selected.length > 0 ? selected : businesses;
    const headers = ["ID", "Company", "Contact", "Industry", "TradeLic", "Status", "Members", "CreditLimit", "Terms"];
    const rows = list.map((b) => [
      b.id,
      `"${b.name}"`,
      `"${b.contact}"`,
      b.industry,
      b.trade,
      b.status,
      b.members,
      `"${b.creditLimit}"`,
      b.terms,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `b2b_businesses_${Date.now()}.csv`;
    link.click();
  };

  const customerColumns = React.useMemo<ColumnDef<CustomerItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all customers"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select customer"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-3 min-w-[200px]">
            <Avatar className="h-8 w-8 ring-1 ring-border">
              <AvatarFallback className="bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                {c.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
                  {c.name}
                </p>
                {c.fbLink && (
                  <a
                    href={c.fbLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:text-blue-700 transition-colors p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                    title="Open Facebook Profile"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{c.phone}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Account" />,
      cell: ({ row }) => {
        const isBiz = row.getValue("type") === "business";
        return (
          <Badge
            variant="outline"
            className={`text-[11px] font-medium capitalize ${
              isBiz
                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {row.getValue("type")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("phone")}</span>,
    },
    {
      accessorKey: "orders",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Orders" />,
      cell: ({ row }) => (
        <div className="text-left font-semibold text-xs text-foreground">
          {row.getValue("orders")}
        </div>
      ),
    },
    {
      accessorKey: "spent",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total Spent" />,
      cell: ({ row }) => (
        <div className="text-left font-bold font-mono text-xs text-amber-700 dark:text-amber-400">
          {row.getValue("spent")}
        </div>
      ),
    },
    {
      accessorKey: "lastOrder",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Activity" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.getValue("lastOrder"))}</span>,
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
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => toast.info(`Customer ${c.name} (${c.phone})`)}>
                <Users2 className="h-3.5 w-3.5 mr-2" /> View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteCustomerMutation.mutate(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], [deleteCustomerMutation]);

  const businessColumns = React.useMemo<ColumnDef<BusinessItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all businesses"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select business"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div>
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {b.name}
            </p>
            <p className="text-xs text-muted-foreground">{b.contact} {b.phone ? `· ${b.phone}` : ""}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "industry",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sector" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[11px] capitalize bg-muted/50 border-border">
          {String(row.getValue("industry")).replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "trade",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Trade License" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("trade")}</span>,
    },
    {
      accessorKey: "creditLimit",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Credit Limit" />,
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-xs font-bold text-foreground">{row.getValue("creditLimit")}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.terms} days terms</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${bizStatusStyle[s]}`}
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
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {b.status === "pending" && (
                <DropdownMenuItem
                  className="text-emerald-600 focus:text-emerald-600"
                  onClick={() => updateBizMutation.mutate({ id: b.id, status: "approved" })}
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Approve Account
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  updateBizMutation.mutate({
                    id: b.id,
                    status: b.status === "suspended" ? "approved" : "suspended",
                  })
                }
              >
                <Ban className="h-3.5 w-3.5 mr-2" />
                {b.status === "suspended" ? "Reactivate" : "Suspend"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteBizMutation.mutate(b.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], [updateBizMutation, deleteBizMutation]);

  const totalCust = customers.length;
  const b2bTotal = businesses.length;
  const b2bApproved = businesses.filter((b) => b.status === "approved").length;
  const b2bPending = businesses.filter((b) => b.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Directory</h1>
          <p className="text-muted-foreground text-sm">
            Retail buyers, wholesalers, and verified B2B commercial accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
            onClick={() => setIsAddBizOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add B2B Account
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: "Total Customers", value: totalCust.toLocaleString(), icon: Users2, color: "bg-blue-500/10 text-blue-600" },
          { label: "B2B Accounts", value: b2bTotal.toString(), icon: Building2, color: "bg-purple-500/10 text-purple-600" },
          { label: "B2B Approved", value: b2bApproved.toString(), icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-600" },
          { label: "Pending Approval", value: b2bPending.toString(), icon: Clock, color: "bg-amber-500/10 text-amber-600" },
        ].map((s, i) => (
          <Card key={i} className="border shadow-xs">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-medium text-muted-foreground">{s.label}</p>
                  {isLoading ? (
                    <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
                  )}
                </div>
                <div className={`rounded-xl p-2.5 ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Tabs with TanStack Tables */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4 bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs">
              All Customers <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{customers.length}</span>
            </TabsTrigger>
            <TabsTrigger value="individual" className="text-xs">
              Direct Retail <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{customers.filter(c => c.type === "individual").length}</span>
            </TabsTrigger>
            <TabsTrigger value="business" className="text-xs">
              B2B Accounts <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{businesses.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="m-0">
            <DataTable
              columns={customerColumns}
              data={customers}
              searchPlaceholder="Search customers by name or phone..."
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
                  onClick={() => handleExportCustomersCSV(selected)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export Selected
                </Button>
              )}
              emptyMessage="No customers found in database."
            />
          </TabsContent>

          <TabsContent value="individual" className="m-0">
            <DataTable
              columns={customerColumns}
              data={customers.filter((c) => c.type === "individual")}
              searchPlaceholder="Search individual retail buyers..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
              emptyMessage="No individual buyers registered."
            />
          </TabsContent>

          <TabsContent value="business" className="m-0">
            <DataTable
              columns={businessColumns}
              data={businesses}
              searchPlaceholder="Search B2B enterprises..."
              enableRowSelection={true}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
              bulkActions={(selected, clearSelection) => (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background"
                    onClick={() => {
                      selected.forEach((b) => updateBizMutation.mutate({ id: b.id, status: "approved" }));
                      clearSelection();
                    }}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Approve Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background"
                    onClick={() => handleExportBusinessesCSV(selected)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export Selected
                  </Button>
                </>
              )}
              emptyMessage="No B2B commercial accounts registered yet."
            />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Add B2B Account Dialog */}
      <Dialog open={isAddBizOpen} onOpenChange={setIsAddBizOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register B2B Account</DialogTitle>
            <DialogDescription>
              Create a wholesale business account with credit limits and net payment terms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="bizName">Company Name *</Label>
              <Input
                id="bizName"
                placeholder="e.g. Meghna Cattle & Feed Mills Ltd"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bizIndustry">Industry / Sector</Label>
                <Input
                  id="bizIndustry"
                  placeholder="e.g. feed_mill, dairy_farm"
                  value={bizIndustry}
                  onChange={(e) => setBizIndustry(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bizTrade">Trade License No</Label>
                <Input
                  id="bizTrade"
                  placeholder="e.g. TL-2026-98124"
                  value={bizTradeLicense}
                  onChange={(e) => setBizTradeLicense(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bizContact">Contact Person *</Label>
                <Input
                  id="bizContact"
                  placeholder="Full name"
                  value={bizContactName}
                  onChange={(e) => setBizContactName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bizPhone">Phone *</Label>
                <Input
                  id="bizPhone"
                  placeholder="+8801700000000"
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bizCredit">Credit Limit (৳)</Label>
                <Input
                  id="bizCredit"
                  type="number"
                  placeholder="500000"
                  value={bizCreditLimit}
                  onChange={(e) => setBizCreditLimit(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bizTerms">Terms (Days)</Label>
                <Input
                  id="bizTerms"
                  type="number"
                  placeholder="30"
                  value={bizTerms}
                  onChange={(e) => setBizTerms(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddBizOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!bizName || !bizContactName || !bizPhone || createBizMutation.isPending}
              onClick={() =>
                createBizMutation.mutate({
                  name: bizName,
                  industry: bizIndustry,
                  tradeLicenseNo: bizTradeLicense,
                  contactName: bizContactName,
                  contactPhone: bizPhone,
                  contactEmail: bizEmail || undefined,
                  creditLimit: Number(bizCreditLimit) || 0,
                  paymentTermsDays: Number(bizTerms) || 0,
                })
              }
            >
              {createBizMutation.isPending ? "Creating..." : "Save Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
