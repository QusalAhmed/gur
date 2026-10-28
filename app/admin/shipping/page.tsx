"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, Truck, DollarSign, Clock, Globe, MoreHorizontal, Download, Trash2, Edit, Database, RefreshCw } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { fetchShippingMethodsFromDb } from "@/lib/supabase";
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

export interface ShippingMethodItem {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  carrier: string;
  baseCost: string;
  perKgCost: string;
  freeAbove: string;
  transitDays: string;
  status: "active" | "inactive";
  type: string;
}

const initialMethods: ShippingMethodItem[] = [
  {
    id: "MTH-001",
    code: "EXPRESS-DHAKA",
    name: "Dhaka Metro Same/Next Day",
    nameBn: "ঢাকা মেট্রো এক্সপ্রেস ডেলিভারি",
    carrier: "Pathao Express / In-House Rider",
    baseCost: "৳ 80",
    perKgCost: "৳ 15 / kg",
    freeAbove: "৳ 2,000",
    transitDays: "1 day",
    status: "active",
    type: "Retail Parcels",
  },
  {
    id: "MTH-002",
    code: "STD-NATIONWIDE",
    name: "Nationwide Courier Standard",
    nameBn: "সারাদেশে কুরিয়ার ডেলিভারি",
    carrier: "Steadfast Courier / RedX",
    baseCost: "৳ 130",
    perKgCost: "৳ 25 / kg",
    freeAbove: "৳ 3,500",
    transitDays: "2 – 3 days",
    status: "active",
    type: "Retail & Small Business",
  },
  {
    id: "MTH-003",
    code: "HEAVY-FREIGHT",
    name: "Heavy Bulk Freight (Drums & IBC Totes)",
    nameBn: "ভারী পরিবহন (ড্রাম ও আইবিসি টোট)",
    carrier: "Dedicated 3-Ton / 5-Ton Trucks",
    baseCost: "৳ 2,500",
    perKgCost: "৳ 3.50 / kg",
    freeAbove: "৳ 150,000",
    transitDays: "1 – 2 days",
    status: "active",
    type: "B2B Commercial Bulk",
  },
  {
    id: "MTH-004",
    code: "TANKER-BULK",
    name: "Direct Sugar Mill Road Tanker",
    nameBn: "মিল গেট সরাসরি রোডার ট্যাঙ্কার",
    carrier: "Contract Tanker Transporters",
    baseCost: "৳ 18,000",
    perKgCost: "Flat Rate / Distance",
    freeAbove: "Contract Terms",
    transitDays: "Scheduled (24h)",
    status: "active",
    type: "Industrial 15-20 Ton",
  },
  {
    id: "MTH-005",
    code: "WH-PICKUP",
    name: "Depot Warehouse Self-Pickup",
    nameBn: "ডিপো থেকে সরাসরি গ্রহণ",
    carrier: "Customer Vehicle",
    baseCost: "৳ 0 (Free)",
    perKgCost: "৳ 0",
    freeAbove: "No Minimum",
    transitDays: "Instant during depot hours",
    status: "active",
    type: "All Customers",
  },
];

export default function ShippingMethodsPage() {
  const [methods, setMethods] = React.useState<ShippingMethodItem[]>(initialMethods);
  const [loading, setLoading] = React.useState(true);
  const [isDbConnected, setIsDbConnected] = React.useState(false);

  const loadMethods = React.useCallback(async () => {
    setLoading(true);
    try {
      const dbMethods = await fetchShippingMethodsFromDb();
      if (dbMethods && dbMethods.length > 0) {
        setMethods(dbMethods);
        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
      }
    } catch (e) {
      console.warn("Failed to load shipping methods from Supabase:", e);
      setIsDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const handleExportCSV = (selected: ShippingMethodItem[]) => {
    const list = selected.length > 0 ? selected : methods;
    const headers = ["ID", "Code", "Name", "Carrier", "Type", "BaseCost", "PerKgCost", "FreeAbove", "TransitDays", "Status"];
    const rows = list.map((m) => [
      m.id,
      m.code,
      `"${m.name}"`,
      `"${m.carrier}"`,
      m.type,
      `"${m.baseCost}"`,
      `"${m.perKgCost}"`,
      `"${m.freeAbove}"`,
      `"${m.transitDays}"`,
      m.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `shipping_methods_${Date.now()}.csv`;
    link.click();
  };

  const methodColumns = React.useMemo<ColumnDef<ShippingMethodItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all methods"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select method"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Method & Service" />,
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="min-w-[190px]">
            <Badge variant="outline" className="font-mono text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10">
              {m.code}
            </Badge>
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors mt-0.5">
              {m.name}
            </p>
            <p className="text-xs text-muted-foreground">{m.nameBn}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "carrier",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Service Carrier" />,
      cell: ({ row }) => <span className="text-xs font-medium text-foreground">{row.getValue("carrier")}</span>,
    },
    {
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Target Parcel Type" />,
      cell: ({ row }) => <Badge variant="secondary" className="text-xs font-normal">{row.getValue("type")}</Badge>,
    },
    {
      accessorKey: "baseCost",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Base Charge" />,
      cell: ({ row }) => <span className="font-bold text-xs text-foreground">{row.getValue("baseCost")}</span>,
    },
    {
      accessorKey: "perKgCost",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Weight Increment" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("perKgCost")}</span>,
    },
    {
      accessorKey: "freeAbove",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Free Shipping Over" />,
      cell: ({ row }) => <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{row.getValue("freeAbove")}</span>,
    },
    {
      accessorKey: "transitDays",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Est. Transit" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("transitDays")}</span>,
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
        const m = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => alert(`Edit rates for ${m.name}`)}>
                <Edit className="h-3.5 w-3.5 mr-2" /> Edit Rates
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setMethods((prev) =>
                    prev.map((item) =>
                      item.id === m.id
                        ? { ...item, status: item.status === "active" ? "inactive" : "active" }
                        : item
                    )
                  )
                }
              >
                {m.status === "active" ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setMethods((prev) => prev.filter((item) => item.id !== m.id))}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shipping Methods & Freight Rates</h1>
          <p className="text-muted-foreground text-sm">
            Courier API connections, weight slab pricing, dedicated road freight trucks, and free delivery thresholds
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMethods}
            disabled={loading}
            className="h-9 cursor-pointer"
            title="Refresh shipping methods"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
            onClick={() => {
              const newMth: ShippingMethodItem = {
                id: `MTH-00${methods.length + 1}`,
                code: `MTH-NEW-0${methods.length + 1}`,
                name: "District Special Courier Delivery",
                nameBn: "জেলা বিশেষ কুরিয়ার",
                carrier: "Paperfly Express",
                baseCost: "৳ 120",
                perKgCost: "৳ 20 / kg",
                freeAbove: "৳ 3,000",
                transitDays: "2 days",
                status: "active",
                type: "Retail Parcels",
              };
              setMethods((prev) => [newMth, ...prev]);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Method
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
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Configured Methods</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{methods.length} Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">Courier & Freight services</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">API Sync Status</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">Steadfast & Pathao</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Automated consignment API sync</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Avg Transit Speed</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">1.8 Days</p>
            <p className="text-xs text-muted-foreground mt-0.5">Across 64 Bangladesh districts</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Subsidies Provided</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">৳ 48,200 / mo</p>
            <p className="text-xs text-muted-foreground mt-0.5">For orders above ৳ 2,000 threshold</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* TanStack Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable
          columns={methodColumns}
          data={methods}
          searchPlaceholder="Search shipping method, carrier, code..."
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
                  setMethods((prev) => prev.filter((m) => !ids.has(m.id)));
                  clearSelection();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Selected
              </Button>
            </>
          )}
          emptyMessage="No shipping methods found matching your search."
        />
      </motion.div>
    </div>
  );
}
