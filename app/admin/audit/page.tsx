"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Search, ScrollText, Download, ShieldAlert, User, Database, MoreHorizontal, Eye } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDateTime } from "@/lib/utils";

export interface AuditLogItem {
  id: string;
  staff: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  recordId: string;
  description: string;
  ip: string;
  date: string;
}

const initialAuditLogs: AuditLogItem[] = [
  {
    id: "AUD-99824",
    staff: "Admin Owner (AO)",
    action: "UPDATE",
    table: "business_accounts",
    recordId: "BIZ-001 (Rahman Dairy)",
    description: "Credit limit raised from ৳ 300,000 to ৳ 500,000",
    ip: "103.145.12.84",
    date: "24 Oct 2026, 12:45:10",
  },
  {
    id: "AUD-99823",
    staff: "Enamul Haque (EH)",
    action: "INSERT",
    table: "batches",
    recordId: "LOT-BSM-2610-A1",
    description: "Registered 60 Tons molasses batch with Brix 82.4°",
    ip: "103.145.12.85",
    date: "24 Oct 2026, 11:30:22",
  },
  {
    id: "AUD-99822",
    staff: "Nusrat Jahan (NJ)",
    action: "UPDATE",
    table: "orders",
    recordId: "MOL-2610-01084",
    description: "Order status transitioned from 'pending' to 'processing'",
    ip: "103.145.12.90",
    date: "24 Oct 2026, 10:15:40",
  },
  {
    id: "AUD-99821",
    staff: "Kazi Nayeem (KN)",
    action: "UPDATE",
    table: "price_tiers",
    recordId: "PTR-002",
    description: "Adjusted wholesale tier price to ৳ 21,500",
    ip: "103.145.12.91",
    date: "23 Oct 2026, 16:50:18",
  },
  {
    id: "AUD-99820",
    staff: "Enamul Haque (EH)",
    action: "INSERT",
    table: "shipments",
    recordId: "SHP-2026-0891",
    description: "Created freight consignment with carrier Steadfast",
    ip: "103.145.12.85",
    date: "23 Oct 2026, 15:20:05",
  },
  {
    id: "AUD-99819",
    staff: "Admin Owner (AO)",
    action: "UPDATE",
    table: "coupons",
    recordId: "CPN-001 (RAMADAN2026)",
    description: "Extended expiration date to 15 Nov 2026",
    ip: "103.145.12.84",
    date: "23 Oct 2026, 14:00:12",
  },
  {
    id: "AUD-99818",
    staff: "System Automated Cron",
    action: "DELETE",
    table: "cart_items",
    recordId: "BATCH-ABANDONED",
    description: "Purged 42 expired guest cart sessions older than 7 days",
    ip: "127.0.0.1 (Internal Worker)",
    date: "23 Oct 2026, 04:00:00",
  },
];

const actionStyles: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border-emerald-500/30",
  UPDATE: "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold border-blue-500/30",
  DELETE: "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold border-rose-500/30",
};

export default function AuditPage() {
  const [logs] = React.useState<AuditLogItem[]>(initialAuditLogs);
  const [actionFilter, setActionFilter] = React.useState("all");
  const [tableFilter, setTableFilter] = React.useState("all");

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action.toLowerCase() !== actionFilter.toLowerCase()) {
        return false;
      }
      if (tableFilter !== "all" && log.table !== tableFilter) {
        return false;
      }
      return true;
    });
  }, [logs, actionFilter, tableFilter]);

  const handleExportCSV = (selected: AuditLogItem[]) => {
    const list = selected.length > 0 ? selected : filteredLogs;
    const headers = ["EventID", "Staff", "Operation", "TargetTable", "RecordID", "Description", "ClientIP", "Timestamp"];
    const rows = list.map((l) => [
      l.id,
      `"${l.staff}"`,
      l.action,
      l.table,
      `"${l.recordId}"`,
      `"${l.description.replace(/"/g, '""')}"`,
      l.ip,
      formatDateTime(l.date),
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `audit_logs_${Date.now()}.csv`;
    link.click();
  };

  const auditColumns = React.useMemo<ColumnDef<AuditLogItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all logs"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select log"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Event ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {row.getValue("id")}
        </span>
      ),
    },
    {
      accessorKey: "staff",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Staff Member" />,
      cell: ({ row }) => <span className="text-xs font-medium text-foreground">{row.getValue("staff")}</span>,
    },
    {
      accessorKey: "action",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Operation" />,
      cell: ({ row }) => {
        const action = row.original.action;
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${actionStyles[action]}`}>
            {action}
          </span>
        );
      },
    },
    {
      accessorKey: "table",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Target Table" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-amber-700 dark:text-amber-400 font-medium">
          {row.getValue("table")}
        </span>
      ),
    },
    {
      accessorKey: "recordId",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Record ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.getValue("recordId")}</span>
      ),
    },
    {
      accessorKey: "description",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Change Summary" />,
      cell: ({ row }) => (
        <span className="text-xs font-medium text-foreground max-w-sm line-clamp-1" title={row.getValue("description")}>
          {row.getValue("description")}
        </span>
      ),
    },
    {
      accessorKey: "ip",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client IP" />,
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-muted-foreground">{row.getValue("ip")}</span>
      ),
    },
    {
      accessorKey: "date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(row.getValue("date"))}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const log = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => alert(`Inspecting diff for ${log.id}`)}>
                <Eye className="h-3.5 w-3.5 mr-2" /> Inspect Diff
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Filtered records modified by ${log.staff}`)}>
                <User className="h-3.5 w-3.5 mr-2" /> View Actor Logs
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
          <h1 className="text-2xl font-bold tracking-tight">Security & Audit Logs</h1>
          <p className="text-muted-foreground text-sm">
            Immutable append-only record of all database modifications, user actions, and security events
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => handleExportCSV([])}
        >
          <Download className="h-4 w-4 mr-2" />
          Export Audit Trail
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Immutable Log</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ScrollText className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">SHA-256 hashed write logs</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Events Today</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Database className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">124 Actions</p>
            <p className="text-xs text-muted-foreground mt-0.5">Orders, stock updates & shipments</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Credit & Limit Edits</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">3 Edits</p>
            <p className="text-xs text-purple-600 font-medium mt-0.5">Authorized by Owner role</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Trusted IP Subnet</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">103.145.12.x</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Corporate HQ static IP</p>
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
          columns={auditColumns}
          data={filteredLogs}
          searchPlaceholder="Filter by record ID, staff, or description..."
          enableRowSelection={true}
          enableSorting={true}
          enablePagination={true}
          initialPageSize={5}
          pageSizeOptions={[5, 10, 20]}
          toolbarPrefix={
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={actionFilter} onValueChange={(v) => setActionFilter(v || "all")}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Operation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Operations</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tableFilter} onValueChange={(v) => setTableFilter(v || "all")}>
                <SelectTrigger className="w-40 h-9 text-xs">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  <SelectItem value="orders">orders</SelectItem>
                  <SelectItem value="business_accounts">business_accounts</SelectItem>
                  <SelectItem value="batches">batches</SelectItem>
                  <SelectItem value="price_tiers">price_tiers</SelectItem>
                  <SelectItem value="shipments">shipments</SelectItem>
                  <SelectItem value="cart_items">cart_items</SelectItem>
                  <SelectItem value="coupons">coupons</SelectItem>
                </SelectContent>
              </Select>

              {(actionFilter !== "all" || tableFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActionFilter("all");
                    setTableFilter("all");
                  }}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </Button>
              )}
            </div>
          }
          bulkActions={(selected) => (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-background"
              onClick={() => handleExportCSV(selected)}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export Selected
            </Button>
          )}
          emptyMessage="No audit logs match your filter criteria."
        />
      </motion.div>
    </div>
  );
}
