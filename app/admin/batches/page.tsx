"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, CheckCircle2, FlaskConical, Beaker, AlertTriangle, FileText, Download, MoreHorizontal } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Batch {
  id: string;
  batchNo: string;
  product: string;
  supplier: string;
  mfgDate: string;
  expDate: string;
  brix: number;
  ph: number;
  purity: number;
  coaAttached: boolean;
  status: "released" | "quarantine" | "blocked" | "expired";
  quantity: string;
  warehouse: string;
}

const batches: Batch[] = [
  {
    id: "BAT-2026-041",
    batchNo: "LOT-BSM-2610-A1",
    product: "Blackstrap Molasses Heavy",
    supplier: "Carew & Co (Bangladesh) Ltd",
    mfgDate: "18 Oct 2026",
    expDate: "18 Oct 2028",
    brix: 82.4,
    ph: 5.6,
    purity: 99.1,
    coaAttached: true,
    status: "released",
    quantity: "60 Tons",
    warehouse: "WH-DHK-01",
  },
  {
    id: "BAT-2026-040",
    batchNo: "LOT-DPG-2610-J2",
    product: "Date Palm Liquid Nolen Gur",
    supplier: "Jashore Date Palm Farmers Co-op",
    mfgDate: "20 Oct 2026",
    expDate: "20 Apr 2027",
    brix: 76.8,
    ph: 6.2,
    purity: 99.8,
    coaAttached: true,
    status: "released",
    quantity: "8 Tons",
    warehouse: "WH-JSH-03",
  },
  {
    id: "BAT-2026-039",
    batchNo: "LOT-FGA-2610-R3",
    product: "Feed Grade Molasses A",
    supplier: "Rajshahi Sugar Refinery",
    mfgDate: "22 Oct 2026",
    expDate: "22 Oct 2027",
    brix: 79.5,
    ph: 5.4,
    purity: 96.5,
    coaAttached: false,
    status: "quarantine",
    quantity: "120 Tons",
    warehouse: "WH-RAJ-02",
  },
  {
    id: "BAT-2026-038",
    batchNo: "LOT-FGM-2609-K4",
    product: "Food Grade Sugarcane Molasses",
    supplier: "Kushtia Agro Processing",
    mfgDate: "15 Sep 2026",
    expDate: "15 Sep 2028",
    brix: 81.0,
    ph: 5.8,
    purity: 98.9,
    coaAttached: true,
    status: "released",
    quantity: "25 Tons",
    warehouse: "WH-DHK-01",
  },
  {
    id: "BAT-2026-037",
    batchNo: "LOT-IND-2608-X1",
    product: "Industrial Molasses Raw",
    supplier: "Faridpur Sugar Mill",
    mfgDate: "10 Aug 2026",
    expDate: "10 Aug 2027",
    brix: 72.1,
    ph: 4.8,
    purity: 91.2,
    coaAttached: true,
    status: "blocked",
    quantity: "15 Tons",
    warehouse: "WH-CTG-01",
  },
  {
    id: "BAT-2026-036",
    batchNo: "LOT-EXP-2510-Z9",
    product: "Seasonal Gur Block 2025",
    supplier: "Natore Gur Mill",
    mfgDate: "1 Oct 2025",
    expDate: "1 Oct 2026",
    brix: 75.0,
    ph: 5.9,
    purity: 97.0,
    coaAttached: true,
    status: "expired",
    quantity: "1.2 Tons",
    warehouse: "WH-DHK-01",
  },
];

const statusStyles: Record<string, string> = {
  released: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  quarantine: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  blocked: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function BatchesPage() {
  const [tabFilter, setTabFilter] = React.useState<string>("all");

  const filteredBatches = React.useMemo(() => {
    if (tabFilter === "all") return batches;
    if (tabFilter === "blocked") {
      return batches.filter((b) => b.status === "blocked" || b.status === "expired");
    }
    return batches.filter((b) => b.status === tabFilter);
  }, [tabFilter]);

  const columns: ColumnDef<Batch>[] = React.useMemo(
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
          <DataTableColumnHeader column={column} title="Lot / Batch Number" />
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div>
              <p className="font-mono text-xs font-bold text-amber-800 dark:text-amber-400">
                {b.batchNo}
              </p>
              <p className="text-[10px] text-muted-foreground">Mfg: {formatDate(b.mfgDate)}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "product",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-sm">{row.getValue("product")}</span>
        ),
      },
      {
        accessorKey: "supplier",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Supplier Mill" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.getValue("supplier")}</span>
        ),
      },
      {
        accessorKey: "quantity",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Quantity" />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold">{row.getValue("quantity")}</span>
        ),
      },
      {
        accessorKey: "warehouse",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Location" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-[10px]">
            {row.getValue("warehouse")}
          </Badge>
        ),
      },
      {
        accessorKey: "brix",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Brix (%)" />
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm text-amber-700 dark:text-amber-400">
            {row.getValue("brix")}°
          </span>
        ),
      },
      {
        accessorKey: "ph",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="pH" />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-mono">{row.getValue("ph")}</span>
        ),
      },
      {
        accessorKey: "purity",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Purity" />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.getValue("purity")}%</span>
        ),
      },
      {
        accessorKey: "coaAttached",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="COA Doc" />
        ),
        cell: ({ row }) => {
          const coa = row.getValue("coaAttached") as boolean;
          return coa ? (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px] cursor-pointer hover:bg-blue-200">
              <FileText className="h-3 w-3 mr-1" /> PDF COA
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground italic">Pending</span>
          );
        },
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
              <DropdownMenuItem>View Lab Results</DropdownMenuItem>
              <DropdownMenuItem>Upload New COA</DropdownMenuItem>
              <DropdownMenuItem>Release from Quarantine</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Mark Blocked</DropdownMenuItem>
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
          <h1 className="text-2xl font-bold tracking-tight">Batches, Lots & Quality Control</h1>
          <p className="text-muted-foreground text-sm">
            Monitor Brix refractometer tests, pH acidity, quarantine clearance, and Certificates of Analysis (COA)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Quality Logs
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Receive New Batch
          </Button>
        </div>
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
              <p className="text-sm font-medium text-muted-foreground">Released Batches</p>
              <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">34 Lots</p>
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
            <p className="text-2xl font-bold mt-2">3 Lots</p>
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
            <p className="text-2xl font-bold mt-2">80.2° Brix</p>
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
            <p className="text-2xl font-bold mt-2">1 Lot</p>
            <p className="text-xs text-rose-600 font-medium mt-1">Brix &lt; 74° below export grade</p>
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
            <TabsTrigger value="all">All Batches</TabsTrigger>
            <TabsTrigger value="released">Released</TabsTrigger>
            <TabsTrigger value="quarantine">Quarantine (3)</TabsTrigger>
            <TabsTrigger value="blocked">Blocked / Expired</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4">
          <DataTable
            columns={columns}
            data={filteredBatches}
            searchKey="batchNo"
            searchPlaceholder="Search lot number, mill, product..."
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
