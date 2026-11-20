"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  PhoneCall,
  CalendarClock,
  CheckCircle2,
  Clock,
  Users,
  Play,
  Pause,
  Trash2,
  MoreVertical,
  ExternalLink,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCallListsAction,
  updateCallListStatusAction,
  deleteCallListAction,
  CallListSummary,
  CallListStatus,
} from "@/actions/call-lists";
import { CallListStatusBadge } from "@/components/admin/calls/call-status-badge";

export default function CallListsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<string>("active");
  const [search, setSearch] = React.useState<string>("");

  const { data: lists = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "calls", "lists"],
    queryFn: async () => {
      const res = await getCallListsAction();
      if (!res.success) throw new Error(res.error || "Failed to load call lists");
      return res.data;
    },
    staleTime: 15_000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ listId, status }: { listId: string; status: CallListStatus }) =>
      updateCallListStatusAction(listId, status),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("List status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "calls"] });
      } else {
        toast.error(res.error || "Failed to update status");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (listId: string) => deleteCallListAction(listId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Call list deleted");
        queryClient.invalidateQueries({ queryKey: ["admin", "calls"] });
      } else {
        toast.error(res.error || "Failed to delete list");
      }
    },
  });

  // Calculate aggregates
  const totalContacts = lists.reduce((acc, l) => acc + l.totalContacts, 0);
  const totalCompleted = lists.reduce((acc, l) => acc + l.completedContacts, 0);
  const totalDueCallbacks = lists.reduce((acc, l) => acc + l.callbackDueCount, 0);
  const activeListsCount = lists.filter((l) => l.status === "active").length;

  const filteredLists = React.useMemo(() => {
    return lists.filter((l) => {
      if (activeTab === "active" && l.status !== "active") return false;
      if (activeTab === "completed" && l.status !== "completed") return false;
      if (activeTab === "paused" && l.status !== "paused") return false;

      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchesTitle = l.title.toLowerCase().includes(query);
        const matchesDesc = (l.description || "").toLowerCase().includes(query);
        const matchesAssignee = (l.assignedTo?.name || "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesAssignee) return false;
      }

      return true;
    });
  }, [lists, activeTab, search]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-primary" />
            Customer Call Lists
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize customer call outreach, follow up on incomplete orders, and track calling progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>

          <Button
            asChild
            className="bg-primary gap-1.5 font-semibold text-xs h-9 shadow-xs"
          >
            <Link href="/admin/calls/new">
              <Plus className="w-4 h-4" />
              Create Call List
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Lists</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{activeListsCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <PhoneCall className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{totalContacts}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Completed Outreach</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {totalCompleted}
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
              <p className="text-xs font-medium text-muted-foreground">Due Callbacks</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  totalDueCallbacks > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                }`}
              >
                {totalDueCallbacks}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600">
              <CalendarClock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-4 sm:flex w-full h-auto p-1">
            <TabsTrigger value="active" className="text-xs py-1.5">
              Active ({activeListsCount})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs py-1.5">
              Completed ({lists.filter((l) => l.status === "completed").length})
            </TabsTrigger>
            <TabsTrigger value="paused" className="text-xs py-1.5">
              Paused ({lists.filter((l) => l.status === "paused").length})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs py-1.5">
              All Lists ({lists.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search call lists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* List Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Loading call lists...
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center bg-card/50">
          <PhoneCall className="w-8 h-8 mx-auto text-muted-foreground opacity-50 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No call lists found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Create your first call list to organize customers for phone follow-up and tracking.
          </p>
          <Button
            asChild
            size="sm"
            className="mt-4 gap-1.5 bg-primary text-xs"
          >
            <Link href="/admin/calls/new">
              <Plus className="w-4 h-4" />
              Create Call List
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLists.map((list) => {
            const completionPct =
              list.totalContacts > 0
                ? Math.round((list.completedContacts / list.totalContacts) * 100)
                : 0;

            return (
              <Card
                key={list.id}
                className="hover:border-primary/50 transition-all flex flex-col justify-between shadow-xs group"
              >
                <CardHeader className="p-5 pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <Link
                        href={`/admin/calls/${list.id}`}
                        className="text-base font-bold text-foreground hover:text-primary transition-colors line-clamp-1 block"
                      >
                        {list.title}
                      </Link>
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                        {list.description || "No description provided."}
                      </p>
                    </div>
                    <CallListStatusBadge status={list.status} />
                  </div>

                  <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
                    <span>
                      Assigned: <strong>{list.assignedTo?.name || "Shared"}</strong>
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(list.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {/* Progress bar */}
                  <div className="space-y-1.5 bg-muted/30 p-3 rounded-lg border border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {list.completedContacts} / {list.totalContacts} Called
                      </span>
                      <span className="font-bold text-primary">{completionPct}%</span>
                    </div>
                    <div className="w-full bg-muted/80 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(100, completionPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Badges / Metrics */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Pending: <strong>{list.pendingContacts}</strong>
                    </span>
                    {list.callbackDueCount > 0 && (
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold text-[11px] bg-blue-500/10 px-2 py-0.5 rounded">
                        <CalendarClock className="w-3.5 h-3.5" />
                        {list.callbackDueCount} due callback{list.callbackDueCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 bg-primary text-xs font-semibold gap-1.5 h-8"
                    >
                      <Link href={`/admin/calls/${list.id}`}>
                        <PhoneCall className="w-3.5 h-3.5" />
                        Open Calling Workspace
                      </Link>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        {list.status !== "active" && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatusMutation.mutate({
                                listId: list.id,
                                status: "active",
                              })
                            }
                          >
                            <Play className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                            Resume Calling
                          </DropdownMenuItem>
                        )}
                        {list.status !== "paused" && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatusMutation.mutate({
                                listId: list.id,
                                status: "paused",
                              })
                            }
                          >
                            <Pause className="w-3.5 h-3.5 mr-2 text-amber-600" />
                            Pause List
                          </DropdownMenuItem>
                        )}
                        {list.status !== "completed" && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatusMutation.mutate({
                                listId: list.id,
                                status: "completed",
                              })
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-blue-600" />
                            Mark Completed
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive font-medium"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${list.title}"?`)) {
                              deleteMutation.mutate(list.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete List
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
