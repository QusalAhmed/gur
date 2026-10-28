"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, Globe, MapPin, ArrowLeft, MoreHorizontal, CheckCircle2, Database, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { fetchDeliveryZonesFromDb } from "@/lib/supabase";
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

interface DeliveryZone {
  id: string;
  name: string;
  nameBn: string;
  coverage: string;
  divisions: string;
  districtsCount: number;
  baseRate: string;
  extraPerKg: string;
  transitDays: string;
  codAvailable: boolean;
  status: string;
}

const deliveryZones: DeliveryZone[] = [
  {
    id: "ZN-001",
    name: "Dhaka Metro City",
    nameBn: "ঢাকা মেট্রোপলিটন",
    coverage: "Dhaka North & South City Corporations",
    divisions: "Dhaka",
    districtsCount: 1,
    baseRate: "৳ 80",
    extraPerKg: "৳ 15",
    transitDays: "Same / Next Day (1 day)",
    codAvailable: true,
    status: "active",
  },
  {
    id: "ZN-002",
    name: "Dhaka Suburbs & Greater Industrial",
    nameBn: "ঢাকা উপশহর ও পার্শ্ববর্তী এলাকা",
    coverage: "Gazipur, Narayanganj, Savar, Keraniganj",
    divisions: "Dhaka",
    districtsCount: 3,
    baseRate: "৳ 100",
    extraPerKg: "৳ 20",
    transitDays: "1 – 2 days",
    codAvailable: true,
    status: "active",
  },
  {
    id: "ZN-003",
    name: "Chattogram Metro City",
    nameBn: "চট্টগ্রাম মেট্রো",
    coverage: "Chattogram City Corporation & Port Area",
    divisions: "Chattogram",
    districtsCount: 1,
    baseRate: "৳ 120",
    extraPerKg: "৳ 20",
    transitDays: "2 days",
    codAvailable: true,
    status: "active",
  },
  {
    id: "ZN-004",
    name: "Major Divisional Cities",
    nameBn: "বিভাগীয় প্রধান শহরসমূহ",
    coverage: "Rajshahi, Khulna, Sylhet, Barishal, Rangpur, Mymensingh Sadar",
    divisions: "6 Divisions",
    districtsCount: 6,
    baseRate: "৳ 130",
    extraPerKg: "৳ 25",
    transitDays: "2 – 3 days",
    codAvailable: true,
    status: "active",
  },
  {
    id: "ZN-005",
    name: "All Other Districts & Upazilas",
    nameBn: "সারাদেশের অন্যান্য জেলা ও উপজেলা",
    coverage: "Remaining 53 districts & sub-district rural points",
    divisions: "All Divisions",
    districtsCount: 53,
    baseRate: "৳ 150",
    extraPerKg: "৳ 30",
    transitDays: "3 – 5 days",
    codAvailable: true,
    status: "active",
  },
];

export default function DeliveryZonesPage() {
  const [zones, setZones] = React.useState<DeliveryZone[]>(deliveryZones);
  const [loading, setLoading] = React.useState(true);
  const [isDbConnected, setIsDbConnected] = React.useState(false);

  const loadZones = React.useCallback(async () => {
    setLoading(true);
    try {
      const dbZones = await fetchDeliveryZonesFromDb();
      if (dbZones && dbZones.length > 0) {
        setZones(dbZones);
        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
      }
    } catch (e) {
      console.warn("Failed to load zones from Supabase:", e);
      setIsDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadZones();
  }, [loadZones]);

  const columns: ColumnDef<DeliveryZone>[] = React.useMemo(
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
          <DataTableColumnHeader column={column} title="Zone Name (EN & BN)" />
        ),
        cell: ({ row }) => {
          const z = row.original;
          return (
            <div>
              <p className="font-semibold text-sm">{z.name}</p>
              <p className="text-xs text-muted-foreground font-bangla">{z.nameBn}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "coverage",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Coverage Area" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground max-w-xs block">
            {row.getValue("coverage")}
          </span>
        ),
      },
      {
        accessorKey: "divisions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Divisions" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.getValue("divisions")}
          </Badge>
        ),
      },
      {
        accessorKey: "baseRate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Base Rate" />
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm">{row.getValue("baseRate")}</span>
        ),
      },
      {
        accessorKey: "extraPerKg",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Extra / Kg" />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            +{row.getValue("extraPerKg")}
          </span>
        ),
      },
      {
        accessorKey: "transitDays",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Estimated Transit" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.getValue("transitDays")}
          </span>
        ),
      },
      {
        accessorKey: "codAvailable",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="COD" />
        ),
        cell: () => (
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">
            Enabled
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs capitalize">
            {row.getValue("status")}
          </Badge>
        ),
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
              <DropdownMenuItem>Edit Zone Rates</DropdownMenuItem>
              <DropdownMenuItem>Manage Included Districts</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Deactivate</DropdownMenuItem>
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
        <div className="flex items-center gap-3">
          <Link href="/admin/shipping">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Delivery Zones & Geo Rates</h1>
            <p className="text-muted-foreground text-sm">
              Configure geographic zones across Bangladesh divisions, districts, and per-kg rate structures
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadZones}
            disabled={loading}
            className="h-9 cursor-pointer"
            title="Refresh delivery zones"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-9 cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Add Zone
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Configured Zones</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">5 Zones</p>
            <p className="text-xs text-muted-foreground mt-1">100% Bangladesh geographic coverage</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Covered Districts</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <MapPin className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">64 Districts</p>
            <p className="text-xs text-muted-foreground mt-1">8 administrative divisions mapped</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Cash On Delivery Support</p>
              <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">All 5 Zones</p>
            <p className="text-xs text-green-600 font-medium mt-1">Via Steadfast and Pathao networks</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Zones Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-4">
          <DataTable
            columns={columns}
            data={zones}
            searchKey="name"
            searchPlaceholder="Search delivery zone..."
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
