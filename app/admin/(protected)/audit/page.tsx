"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  ScrollText,
  Download,
  ShieldAlert,
  Database,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
} from "@/components/ui/responsive-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDateTime } from "@/lib/utils";
import { getAdminAuditLogsAction, AuditLogItem } from "@/actions/audit";

const actionStyles: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border-emerald-500/30",
  UPDATE: "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold border-blue-500/30",
  DELETE: "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold border-rose-500/30",
};

export default function AuditPage() {
  const [actionFilter, setActionFilter] = React.useState("all");
  const [tableFilter, setTableFilter] = React.useState("all");
  const [inspectingLog, setInspectingLog] = React.useState<AuditLogItem | null>(null);

  const { data: auditRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: getAdminAuditLogsAction,
  });

  const logs = auditRes?.data || [];

  const availableTables = React.useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l) => {
      if (l.table) s.add(l.table);
    });
    return Array.from(s).sort();
  }, [logs]);

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

  const insertCount = logs.filter((l) => l.action === "INSERT").length;
  const updateCount = logs.filter((l) => l.action === "UPDATE").length;
  const deleteCount = logs.filter((l) => l.action === "DELETE").length;

  const handleExportCSV = (selected: AuditLogItem[]) => {
    const list = selected.length > 0 ? selected : filteredLogs;
    if (list.length === 0) {
      toast.info("No audit logs to export");
      return;
    }
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
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${actionStyles[action] || ""}`}>
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
              <DropdownMenuItem onClick={() => setInspectingLog(log)}>
                <Eye className="h-3.5 w-3.5 mr-2" /> Inspect Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info(`Actor: ${log.staff}`)}>
                <ScrollText className="h-3.5 w-3.5 mr-2" /> Copy Event ID
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => handleExportCSV([])}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Audit Trail
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Audited Events</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ScrollText className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{logs.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Immutable audit trail</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Insert Operations</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Database className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{insertCount}</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">New records created</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Update Modifications</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{updateCount}</p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">Field mutations recorded</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Deletions</p>
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{deleteCount}</p>
            <p className="text-xs text-rose-600 font-medium mt-0.5">Purges & removals</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* TanStack Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {isLoading ? (
          <div className="h-48 flex items-center justify-center border rounded-lg bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
        ) : (
          <DataTable
            columns={auditColumns}
            data={filteredLogs}
            searchPlaceholder="Filter by record ID, staff, or description..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={10}
            pageSizeOptions={[5, 10, 20, 50]}
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
                    {availableTables.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
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
        )}
      </motion.div>

      {/* Inspect Dialog */}
      <Dialog open={!!inspectingLog} onOpenChange={(open) => !open && setInspectingLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Audit Event Details: {inspectingLog?.id}</DialogTitle>
            <DialogDescription>
              Detailed metadata recorded by database triggers.
            </DialogDescription>
          </DialogHeader>
          {inspectingLog && (
            <div className="space-y-3 py-2 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground">Actor</span>
                <span className="font-medium text-foreground">{inspectingLog.staff}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground">Operation</span>
                <span className={`px-2 py-0.5 rounded font-bold ${actionStyles[inspectingLog.action] || ""}`}>
                  {inspectingLog.action}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground">Target Table</span>
                <span className="font-mono font-medium text-foreground">{inspectingLog.table}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground">Record ID</span>
                <span className="font-mono text-foreground">{inspectingLog.recordId}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground">Timestamp</span>
                <span className="text-foreground">{formatDateTime(inspectingLog.date)}</span>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="font-semibold text-muted-foreground">Summary Description</span>
                <div className="p-2.5 rounded bg-muted/50 border text-foreground leading-relaxed">
                  {inspectingLog.description}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
