"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, Tag, Percent, Copy, MoreHorizontal, Users, DollarSign, Download, Trash2, CheckCircle, Ban } from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

export interface CouponItem {
  id: string;
  code: string;
  description: string;
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: string;
  minOrder: string;
  maxDiscount: string;
  usage: string;
  status: "active" | "inactive" | "expired";
  b2bOnly: boolean;
  validUntil: string;
}

export interface RedemptionItem {
  id: string;
  coupon: string;
  orderId: string;
  customer: string;
  discount: string;
  date: string;
}

const initialCoupons: CouponItem[] = [
  {
    id: "CPN-001",
    code: "RAMADAN2026",
    description: "Special festive discount on Date Palm & Sugarcane Gur",
    type: "percentage",
    value: "15%",
    minOrder: "৳ 2,000",
    maxDiscount: "৳ 1,000",
    usage: "218 / 500",
    status: "active",
    b2bOnly: false,
    validUntil: "15 Nov 2026",
  },
  {
    id: "CPN-002",
    code: "BULKFEED100",
    description: "Animal Feed Grade molasses B2B seasonal discount",
    type: "fixed_amount",
    value: "৳ 5,000",
    minOrder: "৳ 50,000",
    maxDiscount: "৳ 5,000",
    usage: "42 / 100",
    status: "active",
    b2bOnly: true,
    validUntil: "31 Dec 2026",
  },
  {
    id: "CPN-003",
    code: "FREESHIPDHAKA",
    description: "Free shipping for retail orders within Dhaka Metro",
    type: "free_shipping",
    value: "Free Ship",
    minOrder: "৳ 1,500",
    maxDiscount: "৳ 120",
    usage: "389 / 1000",
    status: "active",
    b2bOnly: false,
    validUntil: "30 Nov 2026",
  },
  {
    id: "CPN-004",
    code: "NEWGUR10",
    description: "First purchase coupon for newly registered customers",
    type: "percentage",
    value: "10%",
    minOrder: "৳ 1,000",
    maxDiscount: "৳ 500",
    usage: "640 / 1000",
    status: "active",
    b2bOnly: false,
    validUntil: "31 Dec 2026",
  },
  {
    id: "CPN-005",
    code: "EXPOWINTER",
    description: "Agro Tech Expo 2026 promo voucher",
    type: "percentage",
    value: "20%",
    minOrder: "৳ 5,000",
    maxDiscount: "৳ 2,000",
    usage: "50 / 50",
    status: "expired",
    b2bOnly: false,
    validUntil: "15 Oct 2026",
  },
];

const initialRedemptions: RedemptionItem[] = [
  { id: "RED-1084", coupon: "RAMADAN2026", orderId: "MOL-2610-01084", customer: "Rahman Dairy Farm", discount: "৳ 1,000", date: "24 Oct 2026" },
  { id: "RED-1081", coupon: "FREESHIPDHAKA", orderId: "MOL-2610-01081", customer: "Nadia Begum", discount: "৳ 120", date: "24 Oct 2026" },
  { id: "RED-1078", coupon: "BULKFEED100", orderId: "MOL-2610-01078", customer: "AgroTech BD", discount: "৳ 5,000", date: "23 Oct 2026" },
  { id: "RED-1077", coupon: "NEWGUR10", orderId: "MOL-2610-01072", customer: "Jamal Uddin", discount: "৳ 240", date: "23 Oct 2026" },
  { id: "RED-1076", coupon: "RAMADAN2026", orderId: "MOL-2610-01069", customer: "Karim Khan", discount: "৳ 600", date: "22 Oct 2026" },
];

export default function CouponsPage() {
  const [coupons, setCoupons] = React.useState<CouponItem[]>(initialCoupons);
  const [redemptions, setRedemptions] = React.useState<RedemptionItem[]>(initialRedemptions);

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
                  alert(`Copied ${c.code}`);
                }}
                className="text-muted-foreground hover:text-foreground"
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
      accessorKey: "validUntil",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Valid Until" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.getValue("validUntil"))}</span>,
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
              <DropdownMenuItem onClick={() => alert(`Edit ${c.code}`)}>
                Edit Coupon
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setCoupons((prev) =>
                    prev.map((item) =>
                      item.id === c.id
                        ? { ...item, status: item.status === "active" ? "inactive" : "active" }
                        : item
                    )
                  )
                }
              >
                {c.status === "active" ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setCoupons((prev) => prev.filter((item) => item.id !== c.id))}
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
  ], []);

  const redemptionColumns = React.useMemo<ColumnDef<RedemptionItem>[]>(() => [
    {
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Redemption ID" />,
      cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.getValue("id")}</span>,
    },
    {
      accessorKey: "coupon",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Coupon Used" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
          {row.getValue("coupon")}
        </span>
      ),
    },
    {
      accessorKey: "orderId",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order ID" />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue("orderId")}</span>,
    },
    {
      accessorKey: "customer",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => <span className="font-medium text-xs text-foreground">{row.getValue("customer")}</span>,
    },
    {
      accessorKey: "discount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Discount Amount" />,
      cell: ({ row }) => (
        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
          {row.getValue("discount")}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.getValue("date"))}</span>,
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coupons & Discounts</h1>
          <p className="text-muted-foreground text-sm">
            Manage promotional codes, B2B wholesale vouchers, and monitor redemptions
          </p>
        </div>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
          onClick={() => {
            const newCpn: CouponItem = {
              id: `CPN-00${coupons.length + 1}`,
              code: `FESTIVE${Math.floor(10 + Math.random() * 90)}`,
              description: "New seasonal promotional campaign",
              type: "percentage",
              value: "10%",
              minOrder: "৳ 1,500",
              maxDiscount: "৳ 500",
              usage: "0 / 200",
              status: "active",
              b2bOnly: false,
              validUntil: "31 Dec 2026",
            };
            setCoupons((prev) => [newCpn, ...prev]);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Coupon
        </Button>
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Coupons</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Tag className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {coupons.filter((c) => c.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Campaigns live</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Discount Given</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">৳ 384,600</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Generated ৳ 3.8M in sales</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Redemptions</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">1,339</p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg ৳ 287 per redemption</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">B2B Exclusive Codes</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {coupons.filter((c) => c.b2bOnly).length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Commercial wholesale deals</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4 bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs">
              All Coupons <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{coupons.length}</span>
            </TabsTrigger>
            <TabsTrigger value="redemptions" className="text-xs">
              Recent Redemptions <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{redemptions.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <DataTable
              columns={couponColumns}
              data={coupons}
              searchPlaceholder="Search coupon code or description..."
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
                    onClick={() => handleExportCouponsCSV(selected)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => {
                      const ids = new Set(selected.map((s) => s.id));
                      setCoupons((prev) => prev.filter((c) => !ids.has(c.id)));
                      clearSelection();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete Selected
                  </Button>
                </>
              )}
              emptyMessage="No coupons match your search query."
            />
          </TabsContent>

          <TabsContent value="redemptions">
            <DataTable
              columns={redemptionColumns}
              data={redemptions}
              searchPlaceholder="Search redemption order or coupon..."
              enableRowSelection={false}
              enableSorting={true}
              enablePagination={true}
              initialPageSize={5}
              pageSizeOptions={[5, 10, 20]}
              emptyMessage="No redemptions found."
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
