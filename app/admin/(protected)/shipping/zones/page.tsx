"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Globe, MapPin, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import {
  getAdminDeliveryZonesAction,
  DeliveryZoneItem,
} from "@/actions/shipping";

export default function DeliveryZonesPage() {
  const { data: zonesRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "delivery-zones"],
    queryFn: getAdminDeliveryZonesAction,
  });

  const zones = zonesRes?.data || [];

  const columns: ColumnDef<DeliveryZoneItem>[] = React.useMemo(
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
              {z.nameBn && <p className="text-xs text-muted-foreground font-bangla">{z.nameBn}</p>}
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
          <DataTableColumnHeader column={column} title="COD Available" />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
            {row.getValue("codAvailable") ? "Active" : "Disabled"}
          </Badge>
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
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/admin/shipping">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Delivery Zones & Regional Rates</h1>
            <p className="text-muted-foreground text-sm">
              Configure divisional transit pricing, district mapping, and courier delivery tiers
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-9 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
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
              <p className="text-sm font-medium text-muted-foreground">Mapped Delivery Zones</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{zones.length} Zones</p>
            <p className="text-xs text-muted-foreground mt-1">Covering nationwide routes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">National District Coverage</p>
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <MapPin className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">64 Districts</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">100% of Bangladesh districts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Database Sync</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">Connected</p>
            <p className="text-xs text-muted-foreground mt-1">Live geo_districts mapping</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-4">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={zones}
              searchPlaceholder="Search delivery zone or coverage..."
              enableRowSelection
              enableSorting
              enablePagination
              initialPageSize={10}
              pageSizeOptions={[5, 10, 20]}
              emptyMessage="No delivery zones found in database."
            />
          )}
        </Card>
      </motion.div>
    </div>
  );
}
