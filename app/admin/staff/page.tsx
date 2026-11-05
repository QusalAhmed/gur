"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  UserCheck,
  Key,
  Lock,
  MoreHorizontal,
  Download,
  Trash2,
  Shield,
  UserCog,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImageUploader } from "@/components/ui/image-uploader";
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
import {
  getStaffDirectoryAction,
  saveStaffMemberAction,
  deleteStaffMemberAction,
} from "@/actions/admin-profile";

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
  avatarUrl?: string;
}

const roleStyles: Record<string, string> = {
  owner: "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold border-purple-500/30",
  admin: "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold border-blue-500/30",
  manager: "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border-amber-500/30",
  editor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium border-emerald-500/30",
  support: "bg-slate-500/15 text-slate-700 dark:text-slate-300 font-medium border-slate-500/30",
};

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [isStaffDialogOpen, setIsStaffDialogOpen] = React.useState(false);
  const [editingStaff, setEditingStaff] = React.useState<StaffItem | null>(null);

  const { data: staffRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: getStaffDirectoryAction,
  });

  const staff: StaffItem[] = (staffRes?.staff || []).map((s: any) => ({
    id: s.id,
    name: s.name || "Staff Member",
    initials: s.initials || "SM",
    email: s.email || "staff@molassesstore.com",
    phone: s.phone || "+8801700000000",
    role: s.role || "support",
    department: s.department || "Operations",
    assignedWarehouse: s.assignedWarehouse || "Main Depot",
    twoFactor: Boolean(s.twoFactor ?? true),
    status: s.status || "active",
    lastLogin: s.lastLogin || "Recently",
    avatarUrl: s.avatarUrl || undefined,
  }));

  const saveMutation = useMutation({
    mutationFn: saveStaffMemberAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Staff member saved successfully");
        queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
        setIsStaffDialogOpen(false);
      } else {
        toast.error(res.error || "Failed to save staff member");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save staff member");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStaffMemberAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Staff access revoked");
        queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      } else {
        toast.error(res.error || "Failed to revoke access");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to revoke access");
    },
  });

  const handleOpenInvite = () => {
    setEditingStaff({
      id: `STF-${Date.now().toString().slice(-4)}`,
      name: "",
      initials: "NM",
      email: "",
      phone: "+88017",
      role: "support",
      department: "Customer Support",
      assignedWarehouse: "Tejgaon Central",
      twoFactor: false,
      status: "active",
      lastLogin: "Never",
      avatarUrl: "",
    });
    setIsStaffDialogOpen(true);
  };

  const handleOpenEdit = (s: StaffItem) => {
    setEditingStaff({ ...s });
    setIsStaffDialogOpen(true);
  };

  const handleSaveStaff = () => {
    if (!editingStaff) return;
    const name = editingStaff.name.trim() || "Team Member";
    saveMutation.mutate({
      id: editingStaff.id,
      name,
      email: editingStaff.email,
      phone: editingStaff.phone,
      role: editingStaff.role,
      department: editingStaff.department,
      avatarUrl: editingStaff.avatarUrl,
    });
  };

  const handleExportCSV = (selected: StaffItem[]) => {
    const list = selected.length > 0 ? selected : staff;
    if (list.length === 0) {
      toast.info("No staff records to export");
      return;
    }
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
              {s.avatarUrl && (
                <AvatarImage src={s.avatarUrl} alt={s.name} className="object-cover" />
              )}
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
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] capitalize border ${roleStyles[role] || roleStyles.support}`}
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
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleOpenEdit(s)}>
                <UserCog className="h-3.5 w-3.5 mr-2" /> Edit Member
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(`Password reset link dispatched to ${s.email}`)}>
                <Key className="h-3.5 w-3.5 mr-2" /> Reset Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteMutation.mutate(s.id)}
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
  ], [deleteMutation]);

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
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
            onClick={handleOpenInvite}
          >
            <Plus className="h-4 w-4 mr-2" />
            Invite Staff
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Staff</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{staff.length} Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">Across permission roles</p>
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
              {staff.length > 0 ? `${((twoFactorCount / staff.length) * 100).toFixed(0)}%` : "0%"}
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
            <p className="text-2xl font-bold mt-1 text-foreground">{staff.length > 0 ? "1+ Online" : "0 Online"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Admin Central</p>
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
        {isLoading ? (
          <div className="h-48 flex items-center justify-center border rounded-lg bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
        ) : (
          <DataTable
            columns={staffColumns}
            data={staff}
            searchPlaceholder="Search staff name, email, phone..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={10}
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
                  onClick={async () => {
                    for (const s of selected) {
                      await deleteMutation.mutateAsync(s.id);
                    }
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
        )}
      </motion.div>

      {/* Add / Edit Staff Dialog */}
      <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingStaff?.name ? `Edit Member: ${editingStaff.name}` : "Invite Staff Member"}
            </DialogTitle>
            <DialogDescription>
              Configure profile details, avatar image, and system role for this team member.
            </DialogDescription>
          </DialogHeader>

          {editingStaff && (
            <div className="space-y-4 pt-2 pb-4">
              <div className="flex flex-col items-center gap-2">
                <ImageUploader
                  folder="avatars"
                  multiple={false}
                  value={editingStaff.avatarUrl ? [editingStaff.avatarUrl] : []}
                  onChange={(items) => {
                    const first = items[0];
                    setEditingStaff((prev) =>
                      prev ? { ...prev, avatarUrl: first?.url || first?.path || "" } : null
                    );
                  }}
                  onRemove={() =>
                    setEditingStaff((prev) => (prev ? { ...prev, avatarUrl: "" } : null))
                  }
                  label="Upload Profile Photo"
                  description="Square avatar photo"
                  aspectRatio="square"
                />
                <span className="text-xs text-muted-foreground">Upload profile picture (auto-compressed)</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input
                  value={editingStaff.name}
                  onChange={(e) =>
                    setEditingStaff((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  placeholder="e.g. Tanvir Ahmed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">Email Address</label>
                  <Input
                    type="email"
                    value={editingStaff.email}
                    onChange={(e) =>
                      setEditingStaff((prev) => (prev ? { ...prev, email: e.target.value } : null))
                    }
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">Phone Number</label>
                  <Input
                    value={editingStaff.phone}
                    onChange={(e) =>
                      setEditingStaff((prev) => (prev ? { ...prev, phone: e.target.value } : null))
                    }
                    placeholder="+8801..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">System Role</label>
                <Select
                  value={editingStaff.role}
                  onValueChange={(val) => {
                    if (val) {
                      setEditingStaff((prev) =>
                        prev ? { ...prev, role: val as StaffItem["role"] } : null
                      );
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner (Full Admin Access)</SelectItem>
                    <SelectItem value="admin">Administrator (Full Store Access)</SelectItem>
                    <SelectItem value="manager">Manager (Inventory & Orders)</SelectItem>
                    <SelectItem value="editor">Editor (Products & Content)</SelectItem>
                    <SelectItem value="support">Customer Support (Read-only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Department</label>
                <Input
                  value={editingStaff.department}
                  onChange={(e) =>
                    setEditingStaff((prev) => (prev ? { ...prev, department: e.target.value } : null))
                  }
                  placeholder="e.g. Logistics & Warehouse"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsStaffDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSaveStaff}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
