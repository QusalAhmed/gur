"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  Warehouse,
  MapPin,
  Phone,
  User,
  Package,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Table as TableIcon,
  Download,
  Trash2,
  Eye,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  division: string;
  district: string;
  address: string;
  manager: string;
  phone: string;
  capacityTons: number;
  currentStockTons: number;
  utilization: number;
  status: "active" | "inactive";
  type: string;
}

const initialWarehouses: WarehouseItem[] = [
  {
    id: "WH-001",
    code: "WH-DHK-01",
    name: "Tejgaon Central Depot",
    nameBn: "তেজগাঁও সেন্ট্রাল ডিপো",
    division: "Dhaka",
    district: "Dhaka",
    address: "24/B Industrial Area, Tejgaon, Dhaka-1208",
    manager: "Enamul Haque",
    phone: "+8801711902341",
    capacityTons: 500,
    currentStockTons: 384.5,
    utilization: 76.9,
    status: "active",
    type: "Primary Bulk & Retail Hub",
  },
  {
    id: "WH-002",
    code: "WH-RAJ-02",
    name: "Rajshahi Sugarcane Mill Depot",
    nameBn: "রাজশাহী সুগার মিল ডিপো",
    division: "Rajshahi",
    district: "Rajshahi",
    address: "Mill Gate Road, Harian, Rajshahi-6205",
    manager: "Mizanur Rahman",
    phone: "+8801812891044",
    capacityTons: 1200,
    currentStockTons: 920.0,
    utilization: 76.6,
    status: "active",
    type: "Source Milling & Storage",
  },
  {
    id: "WH-003",
    code: "WH-CTG-01",
    name: "Chattogram Port Logistics Depot",
    nameBn: "চট্টগ্রাম বন্দর লজিস্টিকস ডিপো",
    division: "Chattogram",
    district: "Chattogram",
    address: "Plot 18, Halishahar Heavy Industrial Area, Chattogram",
    manager: "Kabir Chowdhury",
    phone: "+8801913778811",
    capacityTons: 800,
    currentStockTons: 410.2,
    utilization: 51.2,
    status: "active",
    type: "Coastal & Export Transit",
  },
  {
    id: "WH-004",
    code: "WH-JSH-03",
    name: "Jashore Date Palm Processing Depot",
    nameBn: "যশোর খেজুর গুড় প্রসেসিং ডিপো",
    division: "Khulna",
    district: "Jashore",
    address: "Khajura Road, Jashore Sadar, Jashore-7400",
    manager: "Mustafa Kamal",
    phone: "+8801614552299",
    capacityTons: 300,
    currentStockTons: 265.8,
    utilization: 88.6,
    status: "active",
    type: "Seasonal Organic Gur Facility",
  },
  {
    id: "WH-005",
    code: "WH-BOG-04",
    name: "Bogura Regional Distribution Hub",
    nameBn: "বগুড়া রিজিওনাল হাব",
    division: "Rajshahi",
    district: "Bogura",
    address: "Sherpur Highway Junction, Bogura",
    manager: "Tariqul Islam",
    phone: "+8801511664422",
    capacityTons: 450,
    currentStockTons: 180.0,
    utilization: 40.0,
    status: "active",
    type: "Regional Forward Stocking",
  },
];

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = React.useState<WarehouseItem[]>(initialWarehouses);

  const handleExportCSV = (selected: WarehouseItem[]) => {
    const list = selected.length > 0 ? selected : warehouses;
    const headers = ["ID", "Code", "Name", "District", "Manager", "Phone", "CapacityTons", "CurrentStockTons", "Utilization", "Status"];
    const rows = list.map((w) => [
      w.id,
      w.code,
      `"${w.name}"`,
      w.district,
      `"${w.manager}"`,
      w.phone,
      w.capacityTons,
      w.currentStockTons,
      `${w.utilization}%`,
      w.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `warehouses_${Date.now()}.csv`;
    link.click();
  };

  const warehouseColumns = React.useMemo<ColumnDef<WarehouseItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all depots"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select depot"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "code",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Depot Code" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10">
          {row.getValue("code")}
        </Badge>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Warehouse Name" />,
      cell: ({ row }) => {
        const wh = row.original;
        return (
          <div className="min-w-[190px]">
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {wh.name}
            </p>
            <p className="text-xs text-muted-foreground">{wh.nameBn}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "district",
      header: ({ column }) => <DataTableColumnHeader column={column} title="District / Division" />,
      cell: ({ row }) => {
        const wh = row.original;
        return (
          <span className="text-xs text-muted-foreground">
            {wh.district}, {wh.division}
          </span>
        );
      },
    },
    {
      accessorKey: "manager",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Manager & Phone" />,
      cell: ({ row }) => {
        const wh = row.original;
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-medium text-foreground">{wh.manager}</p>
            <p className="font-mono text-muted-foreground text-[11px]">{wh.phone}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "capacityTons",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Capacity" />,
      cell: ({ row }) => (
        <span className="text-xs font-semibold">{row.getValue("capacityTons")} Tons</span>
      ),
    },
    {
      accessorKey: "currentStockTons",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Current Stock" />,
      cell: ({ row }) => (
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {row.getValue("currentStockTons")} Tons
        </span>
      ),
    },
    {
      accessorKey: "utilization",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Occupancy" />,
      cell: ({ row }) => {
        const util = Number(row.getValue("utilization"));
        return (
          <div className="min-w-[100px] space-y-1">
            <span className="text-xs font-semibold">{util}%</span>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  util > 85 ? "bg-rose-500" : util > 70 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${util}%` }}
              />
            </div>
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
        const wh = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => alert(`View live inventory for ${wh.name}`)}>
                <Eye className="h-3.5 w-3.5 mr-2" /> View Inventory
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Edit depot ${wh.code}`)}>
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setWarehouses((prev) => prev.filter((item) => item.id !== wh.id))}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Decommission
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const totalCapacity = warehouses.reduce((acc, w) => acc + w.capacityTons, 0);
  const totalStock = warehouses.reduce((acc, w) => acc + w.currentStockTons, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses & Depots</h1>
          <p className="text-muted-foreground text-sm">
            Bulk tank farms, regional forward depots, and cold/dark storage facilities
          </p>
        </div>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
          onClick={() => {
            const newWh: WarehouseItem = {
              id: `WH-00${warehouses.length + 1}`,
              code: `WH-NEW-0${warehouses.length + 1}`,
              name: "Khulna Divisional Forward Hub",
              nameBn: "খুলনা বিভাগীয় ফরোয়ার্ড হাব",
              division: "Khulna",
              district: "Khulna",
              address: "Rupsha Industrial Belt, Khulna",
              manager: "Zulfikar Ali",
              phone: "+8801711223344",
              capacityTons: 400,
              currentStockTons: 120,
              utilization: 30,
              status: "active",
              type: "Regional Forward Stocking",
            };
            setWarehouses((prev) => [newWh, ...prev]);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Facility
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Depots</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Warehouse className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{warehouses.length} Facilities</p>
            <p className="text-xs text-muted-foreground mt-0.5">Nationwide coverage</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Holding Capacity</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{totalCapacity.toLocaleString()} Tons</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bulk tank bays & drums</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Aggregate Stock</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{totalStock.toLocaleString()} Tons</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">
              {((totalStock / totalCapacity) * 100).toFixed(1)}% capacity utilized
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">High Occupancy</p>
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {warehouses.filter((w) => w.utilization > 80).length} Depots
            </p>
            <p className="text-xs text-rose-600 font-medium mt-0.5">&gt;80% capacity utilization</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* View Switcher: Table View & Grid View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue="table" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-muted/60 p-1">
              <TabsTrigger value="table" className="text-xs">
                <TableIcon className="h-3.5 w-3.5 mr-1.5" />
                Table View
              </TabsTrigger>
              <TabsTrigger value="grid" className="text-xs">
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                Cards Grid
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="table" className="m-0">
            <DataTable
              columns={warehouseColumns}
              data={warehouses}
              searchPlaceholder="Search warehouse name, code, manager, district..."
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
                      setWarehouses((prev) => prev.filter((w) => !ids.has(w.id)));
                      clearSelection();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete Selected
                  </Button>
                </>
              )}
              emptyMessage="No warehouses found matching your query."
            />
          </TabsContent>

          <TabsContent value="grid" className="m-0">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {warehouses.map((wh) => (
                <Card key={wh.id} className="hover:border-amber-300 dark:hover:border-amber-700 transition-colors shadow-xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10">
                        {wh.code}
                      </Badge>
                      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs capitalize">
                        {wh.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{wh.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{wh.nameBn}</p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <span>{wh.address}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5" /> {wh.manager}
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> {wh.phone}
                      </span>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Storage Occupancy</span>
                        <span className="font-semibold">{wh.currentStockTons} / {wh.capacityTons} Tons ({wh.utilization}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            wh.utilization > 85 ? "bg-rose-500" : wh.utilization > 70 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${wh.utilization}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
