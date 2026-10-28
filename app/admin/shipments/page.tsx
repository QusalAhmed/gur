"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Printer,
  MoreHorizontal,
  Download,
  CheckCircle,
  FileText,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

export interface ShipmentItem {
  id: string;
  orderId: string;
  recipient: string;
  district: string;
  carrier: string;
  tracking: string;
  weight: string;
  packages: number;
  status: "preparing" | "in_transit" | "delivered" | "failed" | "returned";
  dispatchedAt: string;
  eta: string;
}

const carrierVolume = [
  { carrier: "Steadfast", shipments: 58 },
  { carrier: "Pathao Express", shipments: 44 },
  { carrier: "RedX", shipments: 22 },
  { carrier: "Internal Freight", shipments: 18 },
  { carrier: "Paperfly", shipments: 9 },
];

const initialShipments: ShipmentItem[] = [
  {
    id: "SHP-2026-0891",
    orderId: "MOL-2610-01005",
    recipient: "Tareq Rahman",
    district: "Dhaka (Dhanmondi)",
    carrier: "Courier delivery",
    tracking: "COUR-TRK-409",
    weight: "1 kg",
    packages: 1,
    status: "preparing",
    dispatchedAt: "–",
    eta: "Today, 5:00 PM",
  },
  {
    id: "SHP-2026-0890",
    orderId: "MOL-2610-01004",
    recipient: "Rana",
    district: "Dhaka",
    carrier: "Courier delivery",
    tracking: "COUR-TRK-408",
    weight: "7 kg",
    packages: 2,
    status: "preparing",
    dispatchedAt: "–",
    eta: "Tomorrow, 11:00 AM",
  },
  {
    id: "SHP-2026-0889",
    orderId: "MOL-2610-01003",
    recipient: "Karim Ullah",
    district: "Dhaka",
    carrier: "Courier delivery",
    tracking: "COUR-TRK-407",
    weight: "1 kg",
    packages: 1,
    status: "preparing",
    dispatchedAt: "–",
    eta: "Tomorrow, 4:00 PM",
  },
  {
    id: "SHP-2026-0888",
    orderId: "MOL-2610-01002",
    recipient: "Qusal Ahmed",
    district: "Dhaka",
    carrier: "Pickup from warehouse",
    tracking: "PICK-01002",
    weight: "500 g",
    packages: 1,
    status: "preparing",
    dispatchedAt: "–",
    eta: "Ready for pickup",
  },
  {
    id: "SHP-2026-0888",
    orderId: "MOL-2610-01079",
    recipient: "Fatema Khatun",
    district: "Sylhet",
    carrier: "Steadfast",
    tracking: "STDF-9912048",
    weight: "12 kg",
    packages: 2,
    status: "in_transit",
    dispatchedAt: "23 Oct 2026, 16:30",
    eta: "25 Oct 2026",
  },
  {
    id: "SHP-2026-0887",
    orderId: "MOL-2610-01078",
    recipient: "AgroTech BD",
    district: "Rajshahi",
    carrier: "Steadfast",
    tracking: "STDF-9911950",
    weight: "120 kg",
    packages: 3,
    status: "delivered",
    dispatchedAt: "23 Oct 2026, 12:00",
    eta: "Delivered 24 Oct 2026",
  },
  {
    id: "SHP-2026-0886",
    orderId: "MOL-2610-01074",
    recipient: "Hasan Traders",
    district: "Bogura",
    carrier: "RedX",
    tracking: "RDX-7740192",
    weight: "20 kg",
    packages: 1,
    status: "failed",
    dispatchedAt: "22 Oct 2026, 14:00",
    eta: "Customer unavailable",
  },
  {
    id: "SHP-2026-0885",
    orderId: "MOL-2610-01070",
    recipient: "Green Agro Farm",
    district: "Khulna",
    carrier: "Steadfast",
    tracking: "STDF-9908123",
    weight: "50 kg",
    packages: 2,
    status: "returned",
    dispatchedAt: "21 Oct 2026, 11:00",
    eta: "Returned to WH-DHK-01",
  },
  {
    id: "SHP-2026-0884",
    orderId: "MOL-2610-01065",
    recipient: "Sylhet Yeast Co.",
    district: "Sylhet",
    carrier: "Internal Freight",
    tracking: "FREIGHT-TRK-405",
    weight: "500 kg",
    packages: 4,
    status: "delivered",
    dispatchedAt: "20 Oct 2026, 08:30",
    eta: "Delivered 21 Oct 2026",
  },
];

const statusStyles: Record<string, string> = {
  preparing: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  in_transit: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  returned: "bg-muted text-muted-foreground border-border",
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = React.useState<ShipmentItem[]>(initialShipments);
  const [activeTab, setActiveTab] = React.useState("all");
  const [carrierFilter, setCarrierFilter] = React.useState("all");

  const filteredShipments = React.useMemo(() => {
    return shipments.filter((s) => {
      if (activeTab === "transit" && s.status !== "in_transit") return false;
      if (activeTab === "preparing" && s.status !== "preparing") return false;
      if (activeTab === "delivered" && s.status !== "delivered") return false;
      if (activeTab === "returns" && s.status !== "failed" && s.status !== "returned") return false;

      if (carrierFilter !== "all" && !s.carrier.toLowerCase().includes(carrierFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [shipments, activeTab, carrierFilter]);

  const handleBulkStatusChange = (
    selected: ShipmentItem[],
    newStatus: ShipmentItem["status"],
    clearSelection: () => void
  ) => {
    const ids = new Set(selected.map((s) => s.id));
    setShipments((prev) =>
      prev.map((s) => (ids.has(s.id) ? { ...s, status: newStatus } : s))
    );
    clearSelection();
  };

  const handleExportCSV = (selected: ShipmentItem[]) => {
    const list = selected.length > 0 ? selected : filteredShipments;
    const headers = ["ShipmentID", "OrderID", "Recipient", "District", "Carrier", "Tracking", "Weight", "Status", "Dispatched", "ETA"];
    const rows = list.map((s) => [
      s.id,
      s.orderId,
      `"${s.recipient}"`,
      `"${s.district}"`,
      s.carrier,
      s.tracking,
      s.weight,
      s.status,
      formatDate(s.dispatchedAt),
      `"${formatDate(s.eta)}"`,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `shipments_${Date.now()}.csv`;
    link.click();
  };

  const shipmentColumns = React.useMemo<ColumnDef<ShipmentItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all shipments"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select shipment"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Shipment ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {row.getValue("id")}
        </span>
      ),
    },
    {
      accessorKey: "orderId",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-amber-700 dark:text-amber-400 font-medium">
          {row.getValue("orderId")}
        </span>
      ),
    },
    {
      accessorKey: "recipient",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Recipient & District" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="min-w-[180px]">
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {s.recipient}
            </p>
            <p className="text-xs text-muted-foreground">{s.district}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "carrier",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Carrier & Tracking" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="min-w-[160px]">
            <p className="text-xs font-medium text-foreground">{s.carrier}</p>
            <p className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
              {s.tracking}
              <ExternalLink className="h-3 w-3 inline text-amber-600" />
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "weight",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Weight & Pkg" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="text-xs">
            <span className="font-semibold">{s.weight}</span>
            <span className="text-muted-foreground text-[11px]"> ({s.packages} pkg)</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${statusStyles[status]}`}
          >
            {status.replace("_", " ")}
          </span>
        );
      },
    },
    {
      accessorKey: "dispatchedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Dispatched" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.getValue("dispatchedAt"))}</span>
      ),
    },
    {
      accessorKey: "eta",
      header: ({ column }) => <DataTableColumnHeader column={column} title="ETA / Notes" />,
      cell: ({ row }) => (
        <span className="text-xs font-medium text-foreground">{formatDate(row.getValue("eta"))}</span>
      ),
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
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => alert(`Tracking ${s.tracking} via ${s.carrier}`)}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" /> Track Courier API
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Print label for ${s.id}`)}>
                <Printer className="h-3.5 w-3.5 mr-2" /> Print Shipping Label
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {s.status !== "delivered" && (
                <DropdownMenuItem
                  className="text-emerald-600 focus:text-emerald-600"
                  onClick={() =>
                    setShipments((prev) =>
                      prev.map((item) => (item.id === s.id ? { ...item, status: "delivered" } : item))
                    )
                  }
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-2" /> Mark as Delivered
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const inTransitCount = shipments.filter((s) => s.status === "in_transit").length;
  const preparingCount = shipments.filter((s) => s.status === "preparing").length;
  const deliveredCount = shipments.filter((s) => s.status === "delivered").length;
  const issueCount = shipments.filter((s) => s.status === "failed" || s.status === "returned").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shipments & Logistics</h1>
          <p className="text-muted-foreground text-sm">
            Track courier dispatches, bulk freight trucks, Steadfast/Pathao API sync, and returns
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => handleExportCSV([])}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Manifest
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
            onClick={() => {
              const newShipment: ShipmentItem = {
                id: `SHP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
                orderId: `MOL-2610-0${Math.floor(1085 + Math.random() * 100)}`,
                recipient: "New Customer Dispatch",
                district: "Dhaka Central",
                carrier: "Pathao Express",
                tracking: `PTH-${Date.now().toString().slice(-8)}`,
                weight: "15 kg",
                packages: 1,
                status: "preparing",
                dispatchedAt: "–",
                eta: "Tomorrow",
              };
              setShipments((prev) => [newShipment, ...prev]);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Dispatch
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
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">In-Transit</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{inTransitCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Active courier routes</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Preparing at Depot</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{preparingCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Packing & label generation</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Delivered</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{deliveredCount}</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">96.4% success rate</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Returns & Issues</p>
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{issueCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Requires resolution</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Carrier Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="border shadow-xs">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold">Carrier Dispatch Breakdown (Current Month)</CardTitle>
            <CardDescription className="text-xs">Steadfast, Pathao, RedX, and Bulk Freight</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carrierVolume} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="carrier" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => [`${val} shipments`, "Volume"]} />
                  <Bar dataKey="shipments" fill="#d97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* TanStack Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList className="bg-muted/60 p-1">
              <TabsTrigger value="all" className="text-xs">
                All <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{shipments.length}</span>
              </TabsTrigger>
              <TabsTrigger value="transit" className="text-xs">
                In Transit <span className="ml-1.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px]">{inTransitCount}</span>
              </TabsTrigger>
              <TabsTrigger value="preparing" className="text-xs">
                Preparing <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[10px]">{preparingCount}</span>
              </TabsTrigger>
              <TabsTrigger value="delivered" className="text-xs">
                Delivered <span className="ml-1.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[10px]">{deliveredCount}</span>
              </TabsTrigger>
              <TabsTrigger value="returns" className="text-xs">
                Issues / Returns <span className="ml-1.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 text-[10px]">{issueCount}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <DataTable
            columns={shipmentColumns}
            data={filteredShipments}
            searchPlaceholder="Search tracking #, order ID, recipient..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={5}
            pageSizeOptions={[5, 10, 20]}
            toolbarPrefix={
              <div className="flex items-center gap-2">
                <Select value={carrierFilter} onValueChange={(v) => setCarrierFilter(v || "all")}>
                  <SelectTrigger className="w-40 h-9 text-xs">
                    <SelectValue placeholder="Carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Carriers</SelectItem>
                    <SelectItem value="Steadfast">Steadfast</SelectItem>
                    <SelectItem value="Pathao">Pathao Express</SelectItem>
                    <SelectItem value="RedX">RedX</SelectItem>
                    <SelectItem value="Internal Freight">Internal Freight</SelectItem>
                  </SelectContent>
                </Select>
                {carrierFilter !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCarrierFilter("all")}
                    className="h-9 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear filter
                  </Button>
                )}
              </div>
            }
            bulkActions={(selected, clearSelection) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background text-emerald-700 dark:text-emerald-400"
                  onClick={() => handleBulkStatusChange(selected, "delivered", clearSelection)}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Mark Delivered
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background"
                  onClick={() => {
                    alert(`Generating shipping labels for ${selected.length} shipments`);
                    clearSelection();
                  }}
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Print Labels
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background"
                  onClick={() => handleExportCSV(selected)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export CSV
                </Button>
              </>
            )}
            emptyMessage="No shipments found matching your search or filters."
          />
        </Tabs>
      </motion.div>
    </div>
  );
}
