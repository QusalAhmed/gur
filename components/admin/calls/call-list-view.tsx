"use client";

import * as React from "react";
import Link from "next/link";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  PhoneCall,
  CalendarClock,
  CheckCircle2,
  Clock,
  PhoneMissed,
  Users,
  Search,
  Download,
  MoreVertical,
  Play,
  Pause,
  Archive,
  RefreshCw,
  ExternalLink,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCallListDetailAction,
  updateCallListStatusAction,
  CallListItemDetail,
  CallListStatus,
  CallItemStatus,
} from "@/actions/call-lists";
import { CallStatusBadge, CallListStatusBadge } from "./call-status-badge";
import { CallDrawer } from "./call-drawer";

interface CallListViewProps {
  listId: string;
}

export function CallListView({ listId }: CallListViewProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [search, setSearch] = React.useState<string>("");
  const [selectedItem, setSelectedItem] = React.useState<CallListItemDetail | null>(
    null
  );
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "calls", "detail", listId],
    queryFn: async () => {
      const res = await getCallListDetailAction(listId);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Failed to load call list");
      }
      return res.data;
    },
    staleTime: 10_000,
  });

  const list = data?.list;
  const items = data?.items || [];
  const logs = data?.logs || [];

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: CallListStatus) =>
      updateCallListStatusAction(listId, newStatus),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("List status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "calls"] });
        queryClient.invalidateQueries({
          queryKey: ["admin", "calls", "detail", listId],
        });
      } else {
        toast.error(res.error || "Failed to update status");
      }
    },
  });

  const handleOpenDrawer = (item: CallListItemDetail) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  // Keep selected item fresh on refetch
  React.useEffect(() => {
    if (selectedItem && items.length > 0) {
      const updated = items.find((i) => i.id === selectedItem.id);
      if (updated) setSelectedItem(updated);
    }
  }, [items]);

  // Export CSV
  const handleExportCsv = () => {
    if (items.length === 0) return;

    const headers = [
      "Customer Name",
      "Phone",
      "Email",
      "Status",
      "Attempts",
      "Scheduled Callback",
      "Last Called At",
      "Last Called By",
      "Notes",
      "Total Orders",
      "Total Spent (BDT)",
    ];

    const rows = items.map((i) => [
      `"${i.customerName.replace(/"/g, '""')}"`,
      `"${i.customerPhone}"`,
      `"${i.customerEmail || ""}"`,
      `"${i.status}"`,
      i.attemptCount,
      i.callbackAt ? `"${format(new Date(i.callbackAt), "yyyy-MM-dd HH:mm")}"` : '""',
      i.lastCalledAt ? `"${format(new Date(i.lastCalledAt), "yyyy-MM-dd HH:mm")}"` : '""',
      `"${i.lastCalledBy?.name || ""}"`,
      `"${(i.notes || "").replace(/"/g, '""')}"`,
      i.customerTotalOrders,
      i.customerTotalSpent,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `call-list-${list?.title.toLowerCase().replace(/\s+/g, "-") || "export"}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      // Tab filter
      if (activeTab === "pending" && item.status !== "pending") return false;
      if (activeTab === "call_later" && item.status !== "call_later") return false;
      if (activeTab === "no_answer" && item.status !== "no_answer") return false;
      if (
        activeTab === "completed" &&
        !["reached_interested", "reached_ordered", "reached_not_interested", "wrong_number"].includes(
          item.status
        )
      ) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchesName = item.customerName.toLowerCase().includes(query);
        const matchesPhone = item.customerPhone.includes(query);
        const matchesNotes = (item.notes || "").toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesNotes) return false;
      }

      return true;
    });
  }, [items, activeTab, search]);

  if (isLoading) {
    return (
      <div className="p-8 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading call list workspace...</p>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm font-medium text-destructive">Call list not found</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/calls">Back to Call Lists</Link>
        </Button>
      </div>
    );
  }

  const completionPct =
    list.totalContacts > 0
      ? Math.round((list.completedContacts / list.totalContacts) * 100)
      : 0;

  const dueCallbacksCount = items.filter(
    (i) => i.status === "call_later" && i.callbackAt && isPast(new Date(i.callbackAt))
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon-sm" className="h-8 w-8">
              <Link href="/admin/calls" title="Back to Lists">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span>{list.title}</span>
              <CallListStatusBadge status={list.status} />
            </h1>
          </div>
          {list.description && (
            <p className="text-sm text-muted-foreground ml-10">{list.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground ml-10 pt-1">
            <span>Created by: {list.createdBy?.name || "Staff"}</span>
            <span>·</span>
            <span>
              Assigned: <strong>{list.assignedTo?.name || "Shared / All Staff"}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleExportCsv}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Refresh List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>

          {/* Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <span>Actions</span>
                <MoreVertical className="w-3.5 h-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {list.status !== "active" && (
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate("active")}>
                  <Play className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                  Mark as Active
                </DropdownMenuItem>
              )}
              {list.status !== "paused" && (
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate("paused")}>
                  <Pause className="w-3.5 h-3.5 mr-2 text-amber-600" />
                  Pause Calling
                </DropdownMenuItem>
              )}
              {list.status !== "completed" && (
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate("completed")}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-blue-600" />
                  Mark as Completed
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-muted-foreground"
                onClick={() => updateStatusMutation.mutate("archived")}
              >
                <Archive className="w-3.5 h-3.5 mr-2" />
                Archive List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Progress & KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{list.totalContacts}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Completed Calls</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {list.completedContacts}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pending To Call</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{list.pendingContacts}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Due Callbacks</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  dueCallbacksCount > 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-foreground"
                }`}
              >
                {dueCallbacksCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <CalendarClock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar Strip */}
      <div className="bg-card border rounded-lg p-4 space-y-2 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2">
            <span className="text-foreground">Calling Progress:</span>
            <span className="text-muted-foreground">
              {list.completedContacts} of {list.totalContacts} customers finalized
            </span>
          </span>
          <span className="text-primary font-bold">{completionPct}%</span>
        </div>
        <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, completionPct)}%` }}
          />
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-3 sm:flex w-full h-auto p-1">
              <TabsTrigger value="all" className="text-xs py-1.5">
                All ({items.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs py-1.5">
                Pending ({items.filter((i) => i.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="call_later" className="text-xs py-1.5 flex items-center gap-1">
                Call Later ({items.filter((i) => i.status === "call_later").length})
                {dueCallbacksCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping inline-block ml-0.5" />
                )}
              </TabsTrigger>
              <TabsTrigger value="no_answer" className="text-xs py-1.5">
                No Answer ({items.filter((i) => i.status === "no_answer").length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs py-1.5">
                Completed ({list.completedContacts})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* Customer Call Items Table */}
        <div className="border rounded-lg bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-3">Orders & Value</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Attempts</th>
                  <th className="py-3 px-3">Scheduled Callback</th>
                  <th className="py-3 px-3">Last Attempt</th>
                  <th className="py-3 px-3">Latest Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      No customer contacts found matching this view.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isDue =
                      item.status === "call_later" &&
                      item.callbackAt &&
                      isPast(new Date(item.callbackAt));

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleOpenDrawer(item)}
                        className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                          isDue ? "bg-blue-500/5 font-medium" : ""
                        }`}
                      >
                        {/* Customer */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground block">
                            {item.customerName}
                          </span>
                          <span className="font-mono text-muted-foreground text-[11px]">
                            {item.customerPhone}
                          </span>
                        </td>

                        {/* Order stats */}
                        <td className="py-3 px-3">
                          <span className="text-foreground font-semibold block">
                            {item.customerTotalOrders} {item.customerTotalOrders === 1 ? "order" : "orders"}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            ৳ {item.customerTotalSpent.toLocaleString("en-BD")}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <CallStatusBadge status={item.status} />
                        </td>

                        {/* Attempts */}
                        <td className="py-3 px-3">
                          <Badge variant="secondary" className="text-[11px]">
                            {item.attemptCount}
                          </Badge>
                        </td>

                        {/* Scheduled callback */}
                        <td className="py-3 px-3">
                          {item.callbackAt ? (
                            <div
                              className={`flex items-center gap-1.5 ${
                                isDue
                                  ? "text-rose-600 dark:text-rose-400 font-bold"
                                  : "text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {format(new Date(item.callbackAt), "dd MMM, h:mm a")}
                              </span>
                              {isDue && (
                                <Badge
                                  variant="destructive"
                                  className="text-[9px] px-1 py-0 h-4 uppercase"
                                >
                                  Due
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Last Attempt */}
                        <td className="py-3 px-3">
                          {item.lastCalledAt ? (
                            <div className="text-[11px] space-y-0.5">
                              <span className="text-foreground block">
                                {formatDistanceToNow(new Date(item.lastCalledAt), {
                                  addSuffix: true,
                                })}
                              </span>
                              <span className="text-muted-foreground text-[10px] block">
                                By {item.lastCalledBy?.name || "Staff"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">Not called yet</span>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="py-3 px-3 max-w-[200px]">
                          {item.notes ? (
                            <p className="truncate text-foreground/80 text-[11px]" title={item.notes}>
                              {item.notes}
                            </p>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>

                        {/* Action Call */}
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 h-7 px-2.5 text-xs shadow-2xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(item);
                            }}
                          >
                            <PhoneCall className="w-3 h-3" />
                            Dial
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-over Call Drawer */}
      <CallDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        item={selectedItem}
        logs={logs}
        onLogSaved={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["admin", "calls"] });
        }}
      />
    </div>
  );
}
