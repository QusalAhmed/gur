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
  Eye,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

export interface CustomerItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "individual" | "business";
  orders: number;
  spent: string;
  spentNumeric: number;
  joined: string;
  lastOrder: string;
}

export interface BusinessItem {
  id: string;
  name: string;
  industry: string;
  trade: string;
  status: "approved" | "pending" | "suspended";
  members: number;
  creditLimit: string;
  terms: number;
  contact: string;
}

const initialCustomers: CustomerItem[] = [
  { id: "1", name: "Rahman Dairy Farm", email: "rahman@dairy.bd", phone: "+8801711234567", type: "business", orders: 18, spent: "৳ 4,12,000", spentNumeric: 412000, joined: "15 Mar 2026", lastOrder: "24 Oct 2026" },
  { id: "2", name: "Karim Khan", email: "karim.khan@gmail.com", phone: "+8801812345678", type: "individual", orders: 5, spent: "৳ 22,400", spentNumeric: 22400, joined: "1 Jul 2026", lastOrder: "24 Oct 2026" },
  { id: "3", name: "Nadia Begum", email: "nadia.b@yahoo.com", phone: "+8801612345678", type: "individual", orders: 12, spent: "৳ 67,800", spentNumeric: 67800, joined: "20 May 2026", lastOrder: "24 Oct 2026" },
  { id: "4", name: "Dhaka Feed Mills Ltd", email: "admin@dhakafeed.bd", phone: "+8801912345678", type: "business", orders: 34, spent: "৳ 12,34,000", spentNumeric: 1234000, joined: "10 Jan 2026", lastOrder: "24 Oct 2026" },
  { id: "5", name: "Sylhet Yeast Co.", email: "info@syly.bd", phone: "+8801511234567", type: "business", orders: 7, spent: "৳ 3,22,000", spentNumeric: 322000, joined: "5 Jun 2026", lastOrder: "23 Oct 2026" },
  { id: "6", name: "Fatema Khatun", email: "fatema.k@gmail.com", phone: "+8801411234567", type: "individual", orders: 3, spent: "৳ 14,500", spentNumeric: 14500, joined: "12 Sep 2026", lastOrder: "23 Oct 2026" },
  { id: "7", name: "Barisal Fisheries Agro", email: "sales@barisalfish.bd", phone: "+8801722334455", type: "business", orders: 15, spent: "৳ 5,40,000", spentNumeric: 540000, joined: "11 Apr 2026", lastOrder: "21 Oct 2026" },
  { id: "8", name: "Tariqul Islam", email: "tariq.islam@gmail.com", phone: "+8801833445566", type: "individual", orders: 2, spent: "৳ 8,900", spentNumeric: 8900, joined: "19 Aug 2026", lastOrder: "18 Oct 2026" },
  { id: "9", name: "Chittagong Cattle Care", email: "contact@chittagongcattle.bd", phone: "+8801944556677", type: "business", orders: 22, spent: "৳ 7,85,000", spentNumeric: 785000, joined: "14 Feb 2026", lastOrder: "20 Oct 2026" },
];

const initialBusinesses: BusinessItem[] = [
  { id: "1", name: "Rahman Dairy Farm", industry: "dairy_farm", trade: "TL-2021-456789", status: "approved", members: 2, creditLimit: "৳ 5,00,000", terms: 30, contact: "Rahim Rahman" },
  { id: "2", name: "Dhaka Feed Mills Ltd", industry: "feed_mill", trade: "TL-2019-123456", status: "approved", members: 5, creditLimit: "৳ 20,00,000", terms: 45, contact: "Arif Hossain" },
  { id: "3", name: "Sylhet Yeast Co.", industry: "yeast", trade: "TL-2022-789012", status: "approved", members: 3, creditLimit: "৳ 8,00,000", terms: 15, contact: "Sumon Ahmed" },
  { id: "4", name: "AgroTech BD", industry: "agricultural", trade: "TL-2023-345678", status: "pending", members: 1, creditLimit: "৳ 0", terms: 0, contact: "Nasrin Islam" },
  { id: "5", name: "Chittagong Distillery", industry: "distillery", trade: "TL-2020-901234", status: "pending", members: 2, creditLimit: "৳ 0", terms: 0, contact: "Jamal Uddin" },
  { id: "6", name: "Comilla Cosmetics Ltd", industry: "cosmetic", trade: "TL-2024-567890", status: "pending", members: 1, creditLimit: "৳ 0", terms: 0, contact: "Rina Akter" },
  { id: "7", name: "Khulna Poultry Solutions", industry: "feed_mill", trade: "TL-2023-998877", status: "approved", members: 4, creditLimit: "৳ 10,00,000", terms: 30, contact: "Hasibul Hassan" },
];

const bizStatusStyle: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<CustomerItem[]>(initialCustomers);
  const [businesses, setBusinesses] = React.useState<BusinessItem[]>(initialBusinesses);

  // Bulk actions for customers
  const handleBulkCustomerDelete = (selected: CustomerItem[], clearSelection: () => void) => {
    const ids = new Set(selected.map((c) => c.id));
    setCustomers((prev) => prev.filter((c) => !ids.has(c.id)));
    clearSelection();
  };

  const handleExportCustomersCSV = (selected: CustomerItem[]) => {
    const list = selected.length > 0 ? selected : customers;
    const headers = ["ID", "Name", "Email", "Phone", "Type", "Orders", "Spent", "Joined", "LastOrder"];
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
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `customers_${Date.now()}.csv`;
    link.click();
  };

  // Bulk actions for businesses
  const handleBulkBusinessApprove = (selected: BusinessItem[], clearSelection: () => void) => {
    const ids = new Set(selected.map((b) => b.id));
    setBusinesses((prev) =>
      prev.map((b) => (ids.has(b.id) ? { ...b, status: "approved" as const } : b))
    );
    clearSelection();
  };

  const handleBulkBusinessSuspend = (selected: BusinessItem[], clearSelection: () => void) => {
    const ids = new Set(selected.map((b) => b.id));
    setBusinesses((prev) =>
      prev.map((b) => (ids.has(b.id) ? { ...b, status: "suspended" as const } : b))
    );
    clearSelection();
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
              <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
                {c.name}
              </p>
              <p className="text-xs text-muted-foreground">{c.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("phone")}</span>,
    },
    {
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const type = row.original.type;
        return (
          <Badge
            variant={type === "business" ? "default" : "outline"}
            className="capitalize text-[11px] font-medium"
          >
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "orders",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Orders" />,
      cell: ({ row }) => (
        <span className="font-semibold text-xs">{row.getValue("orders")}</span>
      ),
    },
    {
      accessorKey: "spentNumeric",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total Spent" />,
      cell: ({ row }) => (
        <span className="font-semibold text-xs text-foreground">{row.original.spent}</span>
      ),
    },
    {
      accessorKey: "joined",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.getValue("joined"))}</span>
      ),
    },
    {
      accessorKey: "lastOrder",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Order" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.getValue("lastOrder"))}</span>
      ),
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
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => alert(`View Profile for ${c.name}`)}>
                <Eye className="h-3.5 w-3.5 mr-2" /> View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Send direct email to ${c.email}`)}>
                <Mail className="h-3.5 w-3.5 mr-2" /> Send Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setCustomers((prev) => prev.filter((item) => item.id !== c.id))}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Customer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Business" />,
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="min-w-[190px]">
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {b.name}
            </p>
            <p className="text-xs text-muted-foreground">Contact: {b.contact}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "industry",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Industry" />,
      cell: ({ row }) => {
        const ind = String(row.getValue("industry")).replace("_", " ");
        return <span className="capitalize text-xs text-muted-foreground">{ind}</span>;
      },
    },
    {
      accessorKey: "trade",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Trade License" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("trade")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${bizStatusStyle[status]}`}
          >
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: "members",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Members" />,
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("members")}</span>,
    },
    {
      accessorKey: "creditLimit",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Credit Limit" />,
      cell: ({ row }) => <span className="font-semibold text-xs">{row.getValue("creditLimit")}</span>,
    },
    {
      accessorKey: "terms",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Terms (Days)" />,
      cell: ({ row }) => {
        const terms = Number(row.getValue("terms"));
        return <span className="text-xs text-muted-foreground">{terms > 0 ? `Net ${terms}` : "–"}</span>;
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
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => alert(`View details for ${b.name}`)}>
                <Eye className="h-3.5 w-3.5 mr-2" /> View Details
              </DropdownMenuItem>
              {b.status === "pending" && (
                <DropdownMenuItem
                  className="text-emerald-600 focus:text-emerald-600"
                  onClick={() =>
                    setBusinesses((prev) =>
                      prev.map((item) => (item.id === b.id ? { ...item, status: "approved" } : item))
                    )
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Approve Account
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  setBusinesses((prev) =>
                    prev.map((item) =>
                      item.id === b.id
                        ? { ...item, status: item.status === "suspended" ? "approved" : "suspended" }
                        : item
                    )
                  )
                }
              >
                <Ban className="h-3.5 w-3.5 mr-2" />
                {b.status === "suspended" ? "Reactivate" : "Suspend"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

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
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
            onClick={() => {
              const newCust: CustomerItem = {
                id: String(Date.now()),
                name: "New Enterprise Client",
                email: "buyer@enterprise.bd",
                phone: "+8801799887766",
                type: "business",
                orders: 1,
                spent: "৳ 50,000",
                spentNumeric: 50000,
                joined: "24 Oct 2026",
                lastOrder: "24 Oct 2026",
              };
              setCustomers((prev) => [newCust, ...prev]);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
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
                  <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
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
        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="mb-4 bg-muted/60 p-1">
            <TabsTrigger value="customers" className="text-xs">
              All Customers <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{totalCust}</span>
            </TabsTrigger>
            <TabsTrigger value="businesses" className="text-xs">
              B2B Accounts{" "}
              {b2bPending > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[10px]">
                  {b2bPending} pending
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <DataTable
              columns={customerColumns}
              data={customers}
              searchPlaceholder="Search customers by name, email, or phone..."
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
                    onClick={() => handleExportCustomersCSV(selected)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => handleBulkCustomerDelete(selected, clearSelection)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete Selected
                  </Button>
                </>
              )}
              emptyMessage="No customers match your search query."
            />
          </TabsContent>

          <TabsContent value="businesses">
            <DataTable
              columns={businessColumns}
              data={businesses}
              searchPlaceholder="Search B2B accounts by company name or trade licence..."
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
                    className="h-7 text-xs bg-background text-emerald-700 dark:text-emerald-400"
                    onClick={() => handleBulkBusinessApprove(selected, clearSelection)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    Approve Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-background"
                    onClick={() => handleExportBusinessesCSV(selected)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => handleBulkBusinessSuspend(selected, clearSelection)}
                  >
                    <Ban className="h-3.5 w-3.5 mr-1" />
                    Suspend Selected
                  </Button>
                </>
              )}
              emptyMessage="No B2B accounts match your search query."
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
