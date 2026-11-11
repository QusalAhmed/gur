"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, Clock, ShieldCheck, DollarSign, MoreHorizontal, AlertCircle, Ban, Trash2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getAdminCustomersAction,
  createBusinessAccountAction,
  updateBusinessStatusAction,
  deleteBusinessAccountAction,
  BusinessItem,
} from "@/actions/customers";

const statusStyles: Record<string, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  suspended: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function BusinessAccountsPage() {
  const queryClient = useQueryClient();
  const [tabFilter, setTabFilter] = React.useState<string>("all");

  // Create modal state
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [company, setCompany] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [tradeLicense, setTradeLicense] = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [creditLimit, setCreditLimit] = React.useState("500000");
  const [terms, setTerms] = React.useState("30");

  const { data: customerData, isLoading } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const res = await getAdminCustomersAction();
      if (!res.success) throw new Error(res.error || "Failed to load business accounts");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const businesses = customerData?.businesses || [];

  const updateStatusMutation = useMutation({
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
        toast.success("B2B firm registered successfully");
        queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        setIsAddOpen(false);
        setCompany("");
        setIndustry("");
        setTradeLicense("");
        setContactPerson("");
        setPhone("");
      } else {
        toast.error(res.error || "Failed to register firm");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to register firm");
    },
  });

  const deleteBizMutation = useMutation({
    mutationFn: deleteBusinessAccountAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("B2B firm removed");
        queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      } else {
        toast.error(res.error || "Failed to delete firm");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete firm");
    },
  });

  const filteredBusinesses = React.useMemo(() => {
    if (tabFilter === "all") return businesses;
    return businesses.filter((b) => b.status === tabFilter);
  }, [businesses, tabFilter]);

  const pendingCount = businesses.filter((b) => b.status === "pending").length;
  const approvedCount = businesses.filter((b) => b.status === "approved").length;
  const totalCreditLimit = businesses
    .filter((b) => b.status === "approved")
    .reduce((sum, b) => sum + b.creditLimitNumeric, 0);

  const columns: ColumnDef<BusinessItem>[] = React.useMemo(
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
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Company & Industry" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div>
              <p className="font-semibold text-sm">{b.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{b.industry.replace(/_/g, " ")}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "trade",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Trade License & Tax" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="text-[11px] font-mono text-muted-foreground space-y-0.5">
              <p className="text-foreground">{b.trade}</p>
              {b.bin && <p>BIN: {b.bin}</p>}
            </div>
          );
        },
      },
      {
        accessorKey: "contact",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Contact Officer" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div>
              <p className="text-xs font-medium">{b.contact}</p>
              <p className="text-[11px] text-muted-foreground">{b.phone || "No phone registered"}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "creditLimit",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Credit Limit & Terms" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div>
              <p className="font-mono text-xs font-bold">{b.creditLimit}</p>
              <p className="text-[11px] text-muted-foreground">Net {b.terms} Days</p>
            </div>
          );
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
              <DropdownMenuContent align="end" className="w-44">
                {b.status === "pending" && (
                  <DropdownMenuItem
                    className="text-emerald-600 focus:text-emerald-600"
                    onClick={() => updateStatusMutation.mutate({ id: b.id, status: "approved" })}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" /> Approve Account
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() =>
                    updateStatusMutation.mutate({
                      id: b.id,
                      status: b.status === "suspended" ? "approved" : "suspended",
                    })
                  }
                >
                  <Ban className="h-4 w-4 mr-2" />
                  {b.status === "suspended" ? "Reactivate" : "Suspend Account"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => deleteBizMutation.mutate(b.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [updateStatusMutation, deleteBizMutation]
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
          <h1 className="text-2xl font-bold tracking-tight">B2B Business Accounts</h1>
          <p className="text-muted-foreground text-sm">
            Institutional buyers, distilleries, poultry federations, and wholesale credit lines
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Register B2B Firm
          </Button>
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
              <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-2" />
            ) : (
              <p className="text-2xl font-bold mt-2">{pendingCount} Accounts</p>
            )}
            <p className="text-xs text-amber-600 font-medium mt-1">Awaiting Trade License review</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Approved Firms</p>
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-2" />
            ) : (
              <p className="text-2xl font-bold mt-2">{approvedCount} Accounts</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Verified commercial partners</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Active Credit Limit</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded my-2" />
            ) : (
              <p className="text-2xl font-bold mt-2">৳ {totalCreditLimit.toLocaleString("en-BD")}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Authorized wholesale revolving terms</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Registered</p>
              <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-2" />
            ) : (
              <p className="text-2xl font-bold mt-2">{businesses.length} Total</p>
            )}
            <p className="text-xs text-green-600 font-medium mt-1">Institutional buyer network</p>
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
            <TabsTrigger value="all">All Accounts ({businesses.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending KYC ({pendingCount})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
            <TabsTrigger value="suspended">Suspended ({businesses.filter(b => b.status === "suspended").length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4">
          <DataTable
            columns={columns}
            data={filteredBusinesses}
            searchPlaceholder="Search company, trade license, contact..."
            enableRowSelection
            enableColumnVisibility
            enableSorting
            enablePagination
            initialPageSize={10}
            pageSizeOptions={[10, 25, 50]}
            emptyMessage="No B2B accounts found matching criteria."
          />
        </Card>
      </motion.div>

      {/* Add B2B Account Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register B2B Account</DialogTitle>
            <DialogDescription>
              Register institutional client with commercial KYC and credit line.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="bCompany">Company Name *</Label>
              <Input
                id="bCompany"
                placeholder="e.g. Meghna Cattle & Feed Mills Ltd"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bIndustry">Industry</Label>
                <Input
                  id="bIndustry"
                  placeholder="e.g. feed_mill, distillery"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bTrade">Trade License</Label>
                <Input
                  id="bTrade"
                  placeholder="TRAD-2026-001"
                  value={tradeLicense}
                  onChange={(e) => setTradeLicense(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bContact">Contact Officer *</Label>
                <Input
                  id="bContact"
                  placeholder="Full name"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bPhone">Phone *</Label>
                <Input
                  id="bPhone"
                  placeholder="+8801700000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bCredit">Credit Limit (৳)</Label>
                <Input
                  id="bCredit"
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bTerms">Payment Terms (Days)</Label>
                <Input
                  id="bTerms"
                  type="number"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!company || !contactPerson || !phone || createBizMutation.isPending}
              onClick={() =>
                createBizMutation.mutate({
                  name: company,
                  industry,
                  tradeLicenseNo: tradeLicense,
                  contactName: contactPerson,
                  contactPhone: phone,
                  creditLimit: Number(creditLimit) || 0,
                  paymentTermsDays: Number(terms) || 0,
                })
              }
            >
              {createBizMutation.isPending ? "Registering..." : "Confirm Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
