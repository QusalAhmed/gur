"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, Clock, ShieldCheck, DollarSign, MoreHorizontal, AlertCircle } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface BusinessAccount {
  id: string;
  company: string;
  type: string;
  district: string;
  tradeLicense: string;
  tin: string;
  bin: string;
  contactPerson: string;
  phone: string;
  email: string;
  creditLimit: string;
  terms: string;
  status: "approved" | "pending" | "suspended";
  totalOrders: string;
  appliedDate: string;
}

const businesses: BusinessAccount[] = [
  {
    id: "BIZ-001",
    company: "Rahman Dairy & Cattle Feed",
    type: "Feed Mill & Livestock",
    district: "Gazipur",
    tradeLicense: "TRAD-GZP-2025-9921",
    tin: "TIN-889104712",
    bin: "BIN-002910481-0101",
    contactPerson: "Alhaj M. A. Rahman",
    phone: "+8801711234567",
    email: "procure@rahmandairy.com",
    creditLimit: "৳ 500,000",
    terms: "Net 30 Days",
    status: "approved",
    totalOrders: "৳ 1,240,000",
    appliedDate: "14 Aug 2026",
  },
  {
    id: "BIZ-002",
    company: "Dhaka Feed Mills Ltd",
    type: "Commercial Feed Production",
    district: "Narayanganj",
    tradeLicense: "TRAD-NRG-2026-0182",
    tin: "TIN-991204812",
    bin: "BIN-003819204-0202",
    contactPerson: "Kazi Ashfaqur Rahman",
    phone: "+8801912345678",
    email: "commercial@dhakafeed.com",
    creditLimit: "৳ 1,500,000",
    terms: "Net 45 Days",
    status: "approved",
    totalOrders: "৳ 4,890,000",
    appliedDate: "20 Jul 2026",
  },
  {
    id: "BIZ-003",
    company: "Bengal Distilleries & Bio-Ethanol",
    type: "Industrial Distillery",
    district: "Chattogram",
    tradeLicense: "TRAD-CTG-2026-4401",
    tin: "TIN-119284710",
    bin: "BIN-004928103-0301",
    contactPerson: "Dr. Parvez Mahmud",
    phone: "+8801812891022",
    email: "supply@bengaldistilleries.com",
    creditLimit: "৳ 3,000,000",
    terms: "Net 60 Days",
    status: "approved",
    totalOrders: "৳ 8,450,000",
    appliedDate: "11 May 2026",
  },
  {
    id: "BIZ-004",
    company: "Sonar Bangla Bakery & Confectionery",
    type: "Commercial Food & Baking",
    district: "Dhaka",
    tradeLicense: "TRAD-DSCC-2026-19283",
    tin: "TIN-774019283",
    bin: "BIN-001928374-0102",
    contactPerson: "Tanvir Ahmed",
    phone: "+8801712445566",
    email: "bakery@sonarbanglabd.com",
    creditLimit: "৳ 200,000",
    terms: "Net 15 Days",
    status: "pending",
    totalOrders: "৳ 0",
    appliedDate: "23 Oct 2026",
  },
  {
    id: "BIZ-005",
    company: "Chittagong Poultry Alliance",
    type: "Poultry Farming",
    district: "Chattogram",
    tradeLicense: "TRAD-CCC-2026-88192",
    tin: "TIN-662910481",
    bin: "BIN-005819203-0104",
    contactPerson: "Mohammad Jahangir",
    phone: "+8801814991122",
    email: "procurement@cpa-bd.org",
    creditLimit: "৳ 350,000",
    terms: "Net 30 Days",
    status: "pending",
    totalOrders: "৳ 0",
    appliedDate: "22 Oct 2026",
  },
  {
    id: "BIZ-006",
    company: "Sylhet Bio-Agro Fertilizers",
    type: "Soil Conditioner & Bio-Fertilizer",
    district: "Sylhet",
    tradeLicense: "TRAD-SYL-2026-00412",
    tin: "TIN-551029384",
    bin: "BIN-008192837-0201",
    contactPerson: "Shabbir Hossain",
    phone: "+8801511883344",
    email: "agro@sylhetbio.com",
    creditLimit: "৳ 400,000",
    terms: "Net 30 Days",
    status: "pending",
    totalOrders: "৳ 0",
    appliedDate: "21 Oct 2026",
  },
  {
    id: "BIZ-007",
    company: "Padma Chemical Intermediates",
    type: "Chemical Processing",
    district: "Faridpur",
    tradeLicense: "TRAD-FRP-2025-00129",
    tin: "TIN-441029381",
    bin: "BIN-009182736-0101",
    contactPerson: "A. K. Azad",
    phone: "+8801911776655",
    email: "azad@padmachem.com",
    creditLimit: "৳ 0",
    terms: "Prepaid COD",
    status: "suspended",
    totalOrders: "৳ 380,000",
    appliedDate: "18 Feb 2026",
  },
];

const statusStyles: Record<string, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  suspended: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function BusinessAccountsPage() {
  const [tabFilter, setTabFilter] = React.useState<string>("all");

  const filteredBusinesses = React.useMemo(() => {
    if (tabFilter === "all") return businesses;
    return businesses.filter((b) => b.status === tabFilter);
  }, [tabFilter]);

  const columns: ColumnDef<BusinessAccount>[] = React.useMemo(
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
        accessorKey: "company",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Company & Industry" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div>
              <p className="font-semibold text-sm">{b.company}</p>
              <p className="text-xs text-muted-foreground">{b.type}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "district",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Location" />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.getValue("district")}</span>
        ),
      },
      {
        accessorKey: "tradeLicense",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Trade License & BIN" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="text-[11px] font-mono text-muted-foreground space-y-0.5">
              <p className="text-foreground">{b.tradeLicense}</p>
              <p>{b.bin}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "contactPerson",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Contact Officer" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="text-xs space-y-0.5">
              <p className="font-medium text-foreground">{b.contactPerson}</p>
              <p className="font-mono text-muted-foreground">{b.phone}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "creditLimit",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Credit Limit" />
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm text-amber-700 dark:text-amber-400">
            {row.getValue("creditLimit")}
          </span>
        ),
      },
      {
        accessorKey: "terms",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Terms" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs font-normal">
            {row.getValue("terms")}
          </Badge>
        ),
      },
      {
        accessorKey: "totalOrders",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total Invoiced" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-xs">{row.getValue("totalOrders")}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[status] || ""}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: "actions",
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Review KYC Documents</DropdownMenuItem>
              <DropdownMenuItem>Approve Application</DropdownMenuItem>
              <DropdownMenuItem>Adjust Credit Limit</DropdownMenuItem>
              <DropdownMenuItem>View Order History</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Suspend Account</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">B2B Wholesale Accounts</h1>
          <p className="text-muted-foreground text-sm">
            Review corporate verification applications, Trade License / BIN KYC, and credit line allocations
          </p>
        </div>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Onboard B2B Client
        </Button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">3 Accounts</p>
            <p className="text-xs text-amber-600 font-medium mt-1">Requires Trade License & BIN check</p>
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
            <p className="text-2xl font-bold mt-2">৳ 5.2M</p>
            <p className="text-xs text-muted-foreground mt-1">Extended across 32 approved firms</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">B2B Order Volume (YTD)</p>
              <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">৳ 14.8M</p>
            <p className="text-xs text-muted-foreground mt-1">72% of company total turnover</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Default / Overdue Risk</p>
              <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">0.4%</p>
            <p className="text-xs text-green-600 font-medium mt-1">Strict Net-30 credit policy</p>
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
            <TabsTrigger value="all">All Accounts (7)</TabsTrigger>
            <TabsTrigger value="pending">Pending KYC (3)</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4">
          <DataTable
            columns={columns}
            data={filteredBusinesses}
            searchKey="company"
            searchPlaceholder="Search company, license, contact..."
            enableRowSelection
            enableColumnVisibility
            enableSorting
            enablePagination
            pageSize={10}
          />
        </Card>
      </motion.div>
    </div>
  );
}
