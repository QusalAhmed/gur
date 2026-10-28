"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  Building2,
  FileCheck,
  MoreHorizontal,
  CheckCircle2,
  Download,
  Trash2,
  Eye,
  FileText,
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
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

export interface SupplierItem {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  district: string;
  address: string;
  tradeLicense: string;
  tin: string;
  suppliedProducts: string;
  totalSuppliedTons: number;
  status: "active" | "inactive";
}

const initialSuppliers: SupplierItem[] = [
  {
    id: "SUP-001",
    code: "SUP-CRW-01",
    name: "Carew & Co (Bangladesh) Ltd",
    contact: "Engr. Shamsul Alam (GM Milling)",
    phone: "+8801711334455",
    email: "procurement@carew.gov.bd",
    district: "Chuadanga",
    address: "Darsana, Chuadanga-7200",
    tradeLicense: "TRAD/CHU/2026/00142",
    tin: "TIN-8910471201",
    suppliedProducts: "Heavy Sugarcane Molasses, Industrial Spirits",
    totalSuppliedTons: 1850,
    status: "active",
  },
  {
    id: "SUP-002",
    code: "SUP-RAJ-02",
    name: "Rajshahi Sugar Mills Cooperative",
    contact: "Md. Rafiqul Islam",
    phone: "+8801812667788",
    email: "supply@rajshahisugarmills.com",
    district: "Rajshahi",
    address: "Harian Industrial Estate, Rajshahi",
    tradeLicense: "TRAD/RAJ/2025/11902",
    tin: "TIN-4401823901",
    suppliedProducts: "Feed Grade Molasses A, Sugarcane Raw",
    totalSuppliedTons: 2400,
    status: "active",
  },
  {
    id: "SUP-003",
    code: "SUP-JSH-03",
    name: "Jashore Date Palm Farmers Alliance",
    contact: "Alhaj Anisur Rahman",
    phone: "+8801913445566",
    email: "info@jashoregurfarmers.org",
    district: "Jashore",
    address: "Khajura Road, Jashore Sadar",
    tradeLicense: "TRAD/JSH/2026/05411",
    tin: "TIN-7710294812",
    suppliedProducts: "Organic Liquid Nolen Gur, Patali Block Gur",
    totalSuppliedTons: 320,
    status: "active",
  },
  {
    id: "SUP-004",
    code: "SUP-NAT-04",
    name: "Natore Agro By-Products Ltd",
    contact: "Zahid Hasan",
    phone: "+8801614778899",
    email: "contact@natoreagro.com",
    district: "Natore",
    address: "Station Road, Natore",
    tradeLicense: "TRAD/NAT/2026/03120",
    tin: "TIN-3390124810",
    suppliedProducts: "Animal Feed Grade Molasses B",
    totalSuppliedTons: 890,
    status: "active",
  },
  {
    id: "SUP-005",
    code: "SUP-KUS-05",
    name: "Kushtia Organic Sugar Producers",
    contact: "Dr. Farhana Yasmin",
    phone: "+8801511223344",
    email: "procure@kushtiaorganic.com",
    district: "Kushtia",
    address: "Gorai Bridge Industrial Belt, Kushtia",
    tradeLicense: "TRAD/KUS/2025/08719",
    tin: "TIN-5501928471",
    suppliedProducts: "Export Grade Food Cane Molasses",
    totalSuppliedTons: 640,
    status: "active",
  },
  {
    id: "SUP-006",
    code: "SUP-RNG-06",
    name: "Rangpur Sugar Mills Agro Division",
    contact: "Habibur Rahman",
    phone: "+8801718990011",
    email: "supply@rangpursugar.bd",
    district: "Rangpur",
    address: "Mahimaganj, Gaibandha",
    tradeLicense: "TRAD/RNG/2026/01192",
    tin: "TIN-6629104821",
    suppliedProducts: "Industrial & Feed Grade Molasses",
    totalSuppliedTons: 1120,
    status: "active",
  },
];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = React.useState<SupplierItem[]>(initialSuppliers);

  const handleExportCSV = (selected: SupplierItem[]) => {
    const list = selected.length > 0 ? selected : suppliers;
    const headers = ["ID", "Code", "Name", "Contact", "Phone", "Email", "District", "SuppliedProducts", "VolumeTons", "Status"];
    const rows = list.map((s) => [
      s.id,
      s.code,
      `"${s.name}"`,
      `"${s.contact}"`,
      s.phone,
      s.email,
      s.district,
      `"${s.suppliedProducts}"`,
      s.totalSuppliedTons,
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code & Supplier Name" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="min-w-[200px]">
            <Badge variant="outline" className="font-mono text-[10px] text-amber-700 dark:text-amber-400">
              {s.code}
            </Badge>
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors mt-0.5">
              {s.name}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "contact",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contact Person" />,
      cell: ({ row }) => <span className="text-xs font-medium text-foreground">{row.getValue("contact")}</span>,
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone & Email" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-mono text-foreground">{s.phone}</p>
            <p className="text-muted-foreground text-[11px]">{s.email}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "district",
      header: ({ column }) => <DataTableColumnHeader column={column} title="District" />,
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("district")}</span>,
    },
    {
      accessorKey: "tradeLicense",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Trade License / TIN" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="text-[11px] font-mono text-muted-foreground space-y-0.5">
            <p>{s.tradeLicense}</p>
            <p>{s.tin}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "suppliedProducts",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Products Supplied" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs" title={row.getValue("suppliedProducts")}>
          {row.getValue("suppliedProducts")}
        </span>
      ),
    },
    {
      accessorKey: "totalSuppliedTons",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Volume Procured" />,
      cell: ({ row }) => (
        <span className="font-bold text-xs text-foreground">{row.getValue("totalSuppliedTons")} Tons</span>
      ),
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
        const s = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => alert(`View details for ${s.name}`)}>
                <Eye className="h-3.5 w-3.5 mr-2" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Issue Purchase Order to ${s.name}`)}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Create PO
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setSuppliers((prev) => prev.filter((item) => item.id !== s.id))}
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

  const totalVolume = suppliers.reduce((acc, s) => acc + s.totalSuppliedTons, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers & Mills</h1>
          <p className="text-muted-foreground text-sm">
            Government and private sugar mills, grower cooperatives, and raw syrup partners
          </p>
        </div>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
          onClick={() => {
            const newSup: SupplierItem = {
              id: `SUP-00${suppliers.length + 1}`,
              code: `SUP-GEN-0${suppliers.length + 1}`,
              name: "Pabna Regional Sugar Refinery",
              contact: "Md. Enamul Haque",
              phone: "+8801712998877",
              email: "supply@pabnarefinery.bd",
              district: "Pabna",
              address: "Ishwardi Sugar Zone, Pabna",
              tradeLicense: "TRAD/PAB/2026/01923",
              tin: "TIN-8820194821",
              suppliedProducts: "Sugarcane Raw Molasses",
              totalSuppliedTons: 450,
              status: "active",
            };
            setSuppliers((prev) => [newSup, ...prev]);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Mills</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{suppliers.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Verified contracted suppliers</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Procured</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{totalVolume.toLocaleString()} Tons</p>
            <p className="text-xs text-muted-foreground mt-0.5">Delivered into central depots</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Trade License & TIN</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">100%</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">All suppliers KYC verified</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">On-Time Supply Rate</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">97.4%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg turnaround: 3.2 days</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* TanStack Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable
          columns={supplierColumns}
          data={suppliers}
          searchPlaceholder="Search supplier, district, contact..."
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
                onClick={() => handleExportCSV(selected)}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => {
                  const ids = new Set(selected.map((s) => s.id));
                  setSuppliers((prev) => prev.filter((s) => !ids.has(s.id)));
                  clearSelection();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Selected
              </Button>
            </>
          )}
          emptyMessage="No suppliers found matching your query."
        />
      </motion.div>
    </div>
  );
}
