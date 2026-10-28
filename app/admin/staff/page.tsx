"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, UserCheck, Key, Lock, MoreHorizontal, Download, Trash2, Shield, UserCog } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

export interface StaffItem {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: "owner" | "admin" | "manager" | "editor" | "support";
  department: string;
  assignedWarehouse: string;
  twoFactor: boolean;
  status: "active" | "inactive";
  lastLogin: string;
}

const initialStaff: StaffItem[] = [
  {
    id: "STF-001",
    name: "Admin Owner",
    initials: "AO",
    email: "owner@molassesstore.com",
    phone: "+8801700000001",
    role: "owner",
    department: "Executive Management",
    assignedWarehouse: "All Depots (Full Access)",
    twoFactor: true,
    status: "active",
    lastLogin: "Active Now",
  },
  {
    id: "STF-002",
    name: "Enamul Haque",
    initials: "EH",
    email: "enamul@molassesstore.com",
    phone: "+8801711902341",
    role: "manager",
    department: "Warehouse Operations",
    assignedWarehouse: "WH-DHK-01 (Tejgaon Central)",
    twoFactor: true,
    status: "active",
    lastLogin: "10 mins ago",
  },
  {
    id: "STF-003",
    name: "Dr. Farhana Yasmin",
    initials: "FY",
    email: "farhana@molassesstore.com",
    phone: "+8801511223344",
    role: "editor",
    department: "Agronomy & Content Lab",
    assignedWarehouse: "WH-DHK-01",
    twoFactor: true,
    status: "active",
    lastLogin: "1 hour ago",
  },
  {
    id: "STF-004",
    name: "Mizanur Rahman",
    initials: "MR",
    email: "mizan@molassesstore.com",
    phone: "+8801812891044",
    role: "manager",
    department: "Sugar Mill Logistics",
    assignedWarehouse: "WH-RAJ-02 (Rajshahi)",
    twoFactor: true,
    status: "active",
    lastLogin: "3 hours ago",
  },
  {
    id: "STF-005",
    name: "Nusrat Jahan",
    initials: "NJ",
    email: "nusrat@molassesstore.com",
    phone: "+8801911445566",
    role: "support",
    department: "Customer Service & WhatsApp",
    assignedWarehouse: "Customer Desk",
    twoFactor: true,
    status: "active",
    lastLogin: "Today, 09:15",
  },
  {
    id: "STF-006",
    name: "Kazi Nayeem",
    initials: "KN",
    email: "nayeem@molassesstore.com",
    phone: "+8801611778899",
    role: "admin",
    department: "Finance & B2B Invoicing",
    assignedWarehouse: "Head Office",
    twoFactor: false,
    status: "active",
    lastLogin: "Yesterday",
  },
];

const roleStyles: Record<string, string> = {
  owner: "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold border-purple-500/30",
  admin: "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold border-blue-500/30",
  manager: "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border-amber-500/30",
  editor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium border-emerald-500/30",
  support: "bg-slate-500/15 text-slate-700 dark:text-slate-300 font-medium border-slate-500/30",
};

export default function StaffPage() {
  const [staff, setStaff] = React.useState<StaffItem[]>(initialStaff);

  const handleExportCSV = (selected: StaffItem[]) => {
    const list = selected.length > 0 ? selected : staff;
    const headers = ["ID", "Name", "Email", "Phone", "Role", "Department", "AssignedWarehouse", "2FA", "Status", "LastLogin"];
    const rows = list.map((s) => [
      s.id,
      `"${s.name}"`,
      s.email,
      s.phone,
      s.role,
      `"${s.department}"`,
      `"${s.assignedWarehouse}"`,
      s.twoFactor ? "Enabled" : "Off",
      s.status,
      formatDate(s.lastLogin),
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `staff_members_${Date.now()}.csv`;
    link.click();
  };

  const staffColumns = React.useMemo<ColumnDef<StaffItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all staff"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select staff"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Staff Member" />,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-3 min-w-[190px]">
            <Avatar className="h-8 w-8 ring-1 ring-border">
              <AvatarFallback className="bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-bold">
                {s.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
                {s.name}
              </p>
              <p className="text-xs text-muted-foreground">{s.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role (RBAC)" />,
      cell: ({ row }) => {
        const role = row.original.role;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] capitalize border ${roleStyles[role]}`}
          >
            {role}
          </span>
        );
      },
    },
    {
      accessorKey: "department",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("department")}</span>,
    },
    {
      accessorKey: "assignedWarehouse",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned Facility" />,
      cell: ({ row }) => <span className="text-xs font-medium text-foreground">{row.getValue("assignedWarehouse")}</span>,
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue("phone")}</span>,
    },
    {
      accessorKey: "twoFactor",
      header: ({ column }) => <DataTableColumnHeader column={column} title="2FA Security" />,
      cell: ({ row }) => {
        const twoFa = Boolean(row.getValue("twoFactor"));
        return twoFa ? (
          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] border-emerald-500/30">
            Enabled
          </Badge>
        ) : (
          <Badge variant="outline" className="text-rose-600 border-rose-300 text-[10px]">
            Off
          </Badge>
        );
      },
    },
    {
      accessorKey: "lastLogin",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Active" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.getValue("lastLogin"))}</span>,
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
              <DropdownMenuItem onClick={() => alert(`Edit role permissions for ${s.name}`)}>
                <UserCog className="h-3.5 w-3.5 mr-2" /> Edit Permissions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Password reset link sent to ${s.email}`)}>
                <Key className="h-3.5 w-3.5 mr-2" /> Reset Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setStaff((prev) => prev.filter((item) => item.id !== s.id))}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Revoke Access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const twoFactorCount = staff.filter((s) => s.twoFactor).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff & Access Control</h1>
          <p className="text-muted-foreground text-sm">
            Role-Based Access Control (RBAC), warehouse depot assignments, and 2FA credentials
          </p>
        </div>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
          onClick={() => {
            const newStf: StaffItem = {
              id: `STF-00${staff.length + 1}`,
              name: "New Team Member",
              initials: "NM",
              email: `member${staff.length + 1}@molassesstore.com`,
              phone: "+8801700112233",
              role: "manager",
              department: "Warehouse Operations",
              assignedWarehouse: "WH-DHK-01",
              twoFactor: true,
              status: "active",
              lastLogin: "Never",
            };
            setStaff((prev) => [newStf, ...prev]);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Invite Staff
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Staff</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{staff.length} Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">Across 5 permission roles</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">2FA Enforcement</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Lock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {((twoFactorCount / staff.length) * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">
              {twoFactorCount} of {staff.length} protected
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Sessions</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">3 Online</p>
            <p className="text-xs text-muted-foreground mt-0.5">HQ & Tejgaon Depot</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Security Auditing</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Key className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">All actions logged in audit trail</p>
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
          columns={staffColumns}
          data={staff}
          searchPlaceholder="Search staff name, email, phone..."
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
                  setStaff((prev) => prev.filter((s) => !ids.has(s.id)));
                  clearSelection();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Revoke Access
              </Button>
            </>
          )}
          emptyMessage="No staff members found matching your search."
        />
      </motion.div>
    </div>
  );
}
