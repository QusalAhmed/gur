"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Globe,
  RotateCcw,
  Eye,
  Loader2,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  OutboxNotification,
  retryOutboxNotificationAction,
  getOutboxNotificationsAction,
} from "@/actions/outbox-ops";
import { formatDhakaDateTime } from "@/lib/admin-format";

interface OutboxViewProps {
  initialNotifications: OutboxNotification[];
}

export function OutboxView({ initialNotifications }: OutboxViewProps) {
  const [notifications, setNotifications] = useState<OutboxNotification[]>(initialNotifications);
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Inspect modal
  const [inspectingItem, setInspectingItem] = useState<OutboxNotification | null>(null);

  const handleRefresh = async () => {
    const res = await getOutboxNotificationsAction({
      channel: channelFilter,
      status: statusFilter,
    });
    if (res.ok) {
      setNotifications(res.data);
    }
  };

  const handleRetry = (id: number) => {
    startTransition(async () => {
      const res = await retryOutboxNotificationAction(id);
      if (!res.ok) {
        toast.error(res.message || "Failed to retry notification");
        return;
      }

      toast.success("Notification reset to pending for immediate delivery.");
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, status: "pending", attempts: 0, lastError: null } : n
        )
      );
    });
  };

  const counts = {
    all: notifications.length,
    pending: notifications.filter((n) => n.status === "pending").length,
    delivered: notifications.filter((n) => n.status === "delivered" || n.status === "sent").length,
    failed: notifications.filter((n) => n.status === "failed").length,
  };

  const filtered = notifications.filter((n) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      n.recipient.toLowerCase().includes(q) ||
      n.template.toLowerCase().includes(q) ||
      (n.lastError && n.lastError.toLowerCase().includes(q));

    const matchesChannel = channelFilter === "all" || n.channel === channelFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "delivered" && (n.status === "delivered" || n.status === "sent")) ||
      n.status === statusFilter;

    return matchesSearch && matchesChannel && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Send className="size-6 text-primary" />
            Transactional Outbox / নোটিফিকেশন আউটবক্স
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Reliable event-driven SMS, email receipts, and courier webhook deliveries with automated retry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="size-3 text-amber-500" />
            Pending Outbox
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-amber-600 dark:text-amber-400">
            {counts.pending}
          </div>
          <span className="text-[10px] text-muted-foreground">Queued for background worker</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-500" />
            Delivered Successfully
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-emerald-600 dark:text-emerald-400">
            {counts.delivered}
          </div>
          <span className="text-[10px] text-muted-foreground">Dispatched to gateway</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="size-3 text-destructive" />
            Delivery Failures
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-destructive">
            {counts.failed}
          </div>
          <span className="text-[10px] text-muted-foreground">Requires inspection or retry</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">Total Events</div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-foreground">
            {counts.all}
          </div>
          <span className="text-[10px] text-muted-foreground">Recent transactional activity</span>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
          <TabsList className="h-9 bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs px-2.5">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs px-2.5 text-amber-600 dark:text-amber-400">
              Pending ({counts.pending})
            </TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs px-2.5 text-emerald-600 dark:text-emerald-400">
              Delivered ({counts.delivered})
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs px-2.5 text-rose-600 dark:text-rose-400">
              Failed ({counts.failed})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search recipient, template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Template</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Attempts</th>
                <th className="py-2.5 px-3">Scheduled / Sent At</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                    No outbox notifications found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isPending = item.status === "pending";
                  const isDelivered = item.status === "delivered" || item.status === "sent";
                  const isFailed = item.status === "failed";

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                        #{item.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="flex items-center gap-1.5 font-medium">
                          {item.channel === "sms" ? (
                            <MessageSquare className="size-3.5 text-blue-500" />
                          ) : item.channel === "email" ? (
                            <Mail className="size-3.5 text-amber-500" />
                          ) : (
                            <Globe className="size-3.5 text-purple-500" />
                          )}
                          <span className="uppercase text-[11px] font-mono">{item.channel}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-foreground">
                        {item.template}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {item.recipient}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isDelivered ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] uppercase font-mono px-1.5 py-0">
                            Delivered
                          </Badge>
                        ) : isPending ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-[10px] uppercase font-mono px-1.5 py-0">
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] uppercase font-mono px-1.5 py-0">
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">{item.attempts}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {item.sentAt
                          ? formatDhakaDateTime(item.sentAt)
                          : formatDhakaDateTime(item.scheduledAt)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInspectingItem(item)}
                            className="h-7 px-2 text-[11px] gap-1 hover:bg-muted"
                            title="Inspect Payload"
                          >
                            <Eye className="size-3" />
                            Payload
                          </Button>
                          {isFailed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(item.id)}
                              className="h-7 px-2 text-[11px] text-amber-600 dark:text-amber-400 border-amber-300 hover:bg-amber-500/10 gap-1"
                              title="Retry Delivery"
                            >
                              <RotateCcw className="size-3" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Payload Dialog */}
      <Dialog open={Boolean(inspectingItem)} onOpenChange={(open) => !open && setInspectingItem(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Notification Payload</DialogTitle>
            <DialogDescription className="text-xs">
              Template: {inspectingItem?.template} · Recipient: {inspectingItem?.recipient}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {inspectingItem?.lastError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive space-y-1">
                <span className="font-semibold block">Last Gateway Error:</span>
                <span className="font-mono text-[11px]">{inspectingItem.lastError}</span>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Payload JSON:</span>
              <pre className="p-3 rounded-lg border bg-muted/40 font-mono text-[11px] overflow-x-auto max-h-60">
                {JSON.stringify(inspectingItem?.payload, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
