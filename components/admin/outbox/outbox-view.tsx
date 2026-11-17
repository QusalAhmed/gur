"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Eye,
  FilterX,
  Globe,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  ShoppingBag,
  Skull,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  drainOutboxQueueAction,
  getOutboxEventsAction,
  getOutboxMetricsAction,
  retryOutboxEventAction,
  type OutboxMetrics,
} from "@/actions/outbox";
import {
  getOutboxNotificationsAction,
  retryOutboxNotificationAction,
  type OutboxNotification,
} from "@/actions/outbox-ops";
import type { OutboxEventRecord, OutboxStatus } from "@/lib/outbox";
import { formatDhakaDateTime } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

interface OutboxViewProps {
  initialEvents: OutboxEventRecord[];
  initialMetrics: OutboxMetrics;
  initialNotifications: OutboxNotification[];
}

type QueueTab = "events" | "channels";

type InspectableItem =
  | { kind: "event"; record: OutboxEventRecord }
  | { kind: "channel"; record: OutboxNotification };

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 0) {
      const ahead = Math.abs(diffSec);
      if (ahead < 60) return `in ${ahead}s`;
      const mins = Math.floor(ahead / 60);
      if (mins < 60) return `in ${mins}m`;
      return `in ${Math.floor(mins / 60)}h`;
    }
    if (diffSec < 30) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDhakaDateTime(iso);
  } catch {
    return "—";
  }
}

function getEventMeta(eventName: string): {
  label: string;
  icon: React.ReactNode;
  accentClass: string;
} {
  const name = eventName.toLowerCase();
  if (name.includes("sms")) {
    return {
      label: "SMS",
      icon: <MessageSquare className="size-3.5" />,
      accentClass:
        "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25",
    };
  }
  if (name.includes("email")) {
    return {
      label: "Email",
      icon: <Mail className="size-3.5" />,
      accentClass:
        "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25",
    };
  }
  if (name.includes("push")) {
    return {
      label: "Push",
      icon: <BellRing className="size-3.5" />,
      accentClass:
        "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    };
  }
  if (name.includes("capi") || name.includes("meta")) {
    return {
      label: "Meta CAPI",
      icon: <Sparkles className="size-3.5" />,
      accentClass:
        "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
    };
  }
  if (name.includes("order")) {
    return {
      label: "Order",
      icon: <ShoppingBag className="size-3.5" />,
      accentClass:
        "bg-orange-500/12 text-orange-700 dark:text-orange-300 border-orange-500/25",
    };
  }
  return {
    label: "Event",
    icon: <Globe className="size-3.5" />,
    accentClass:
      "bg-purple-500/12 text-purple-700 dark:text-purple-300 border-purple-500/25",
  };
}

function getChannelMeta(channel: string) {
  const ch = channel.toLowerCase();
  if (ch === "sms") {
    return {
      icon: <MessageSquare className="size-3.5" />,
      accentClass:
        "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25",
    };
  }
  if (ch === "email") {
    return {
      icon: <Mail className="size-3.5" />,
      accentClass:
        "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25",
    };
  }
  return {
    icon: <Globe className="size-3.5" />,
    accentClass:
      "bg-purple-500/12 text-purple-700 dark:text-purple-300 border-purple-500/25",
  };
}

function EventStatusBadge({ status }: { status: OutboxStatus | string }) {
  switch (status) {
    case "dispatched":
    case "delivered":
    case "sent":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-medium text-[11px] px-2 py-0.5"
        >
          <CheckCircle2 className="size-3" />
          {status === "dispatched" ? "Dispatched" : "Delivered"}
        </Badge>
      );
    case "processing":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300 font-medium text-[11px] px-2 py-0.5"
        >
          <RotateCw className="size-3 animate-spin" />
          Processing
        </Badge>
      );
    case "pending":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300 font-medium text-[11px] px-2 py-0.5"
        >
          <Clock className="size-3" />
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300 font-medium text-[11px] px-2 py-0.5"
        >
          <AlertTriangle className="size-3" />
          Failed
        </Badge>
      );
    case "dead_letter":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-purple-500/35 bg-purple-500/12 text-purple-700 dark:text-purple-300 font-medium text-[11px] px-2 py-0.5"
        >
          <Skull className="size-3" />
          Dead Letter
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[11px] capitalize">
          {status}
        </Badge>
      );
  }
}

function extractOrderNumber(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate =
    payload.orderNumber || payload.order_number || payload.orderIdOrNumber;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return null;
}

function extractRecipientSummary(ev: OutboxEventRecord): string | null {
  const payload = ev.payload || {};
  const phone = payload.customerPhone || payload.recipientPhone;
  const name = payload.customerName;
  if (typeof name === "string" && name.trim()) return name.trim();
  if (typeof phone === "string" && phone.trim()) return phone.trim();
  return null;
}

export function OutboxView({
  initialEvents,
  initialMetrics,
  initialNotifications,
}: OutboxViewProps) {
  const [activeQueue, setActiveQueue] = React.useState<QueueTab>(
    initialEvents.length > 0 || initialNotifications.length === 0
      ? "events"
      : "channels"
  );
  const [events, setEvents] = React.useState<OutboxEventRecord[]>(initialEvents);
  const [metrics, setMetrics] = React.useState<OutboxMetrics>(initialMetrics);
  const [notifications, setNotifications] =
    React.useState<OutboxNotification[]>(initialNotifications);

  // Filters
  const [eventStatusFilter, setEventStatusFilter] = React.useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string>("all");
  const [channelStatusFilter, setChannelStatusFilter] = React.useState<string>("all");
  const [channelTypeFilter, setChannelTypeFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  // Live operational controls
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isDraining, setIsDraining] = React.useState(false);
  const [retryingKey, setRetryingKey] = React.useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);

  // Slide-over Inspector
  const [inspecting, setInspecting] = React.useState<InspectableItem | null>(null);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = React.useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedField((prev) => (prev === label ? null : prev)), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, []);

  const refreshAll = React.useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [eventsRes, metricsRes, notificationsRes] = await Promise.all([
        getOutboxEventsAction({ limit: 100 }),
        getOutboxMetricsAction(),
        getOutboxNotificationsAction({ limit: 100 }),
      ]);

      if (eventsRes.success) {
        setEvents(eventsRes.events);
      }
      if (metricsRes.success) {
        setMetrics(metricsRes.metrics);
      }
      if (notificationsRes.ok) {
        setNotifications(notificationsRes.data);
      }
      setLastSyncedAt(new Date().toISOString());
    } catch (err: unknown) {
      if (!silent) {
        toast.error(
          err instanceof Error ? err.message : "Failed to refresh outbox data"
        );
      }
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  // Optional 15-second live polling
  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void refreshAll(true);
    }, 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, refreshAll]);

  const handleDrainQueue = async () => {
    setIsDraining(true);
    try {
      const res = await drainOutboxQueueAction();
      if (!res.success) {
        toast.error(res.error || "Failed to drain pending outbox queue");
        return;
      }
      if (res.processed === 0) {
        toast.info("Queue is already clean — no pending events ready for dispatch.");
      } else {
        toast.success(
          `Drained ${res.processed} event${res.processed === 1 ? "" : "s"} (${res.succeeded} dispatched, ${res.failed} scheduled for retry).`
        );
      }
      await refreshAll(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Drain queue error");
    } finally {
      setIsDraining(false);
    }
  };

  const handleRetryEvent = async (ev: OutboxEventRecord) => {
    setRetryingKey(`event:${ev.id}`);
    try {
      const res = await retryOutboxEventAction(ev.id);
      if (!res.success) {
        toast.error(res.error || "Retry dispatch failed");
      } else {
        toast.success(`Event ${ev.event_name} dispatched to Inngest.`);
      }
      await refreshAll(true);
      setInspecting((curr) =>
        curr && curr.kind === "event" && curr.record.id === ev.id ? null : curr
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingKey(null);
    }
  };

  const handleRetryChannelNotification = async (item: OutboxNotification) => {
    setRetryingKey(`channel:${item.id}`);
    try {
      const res = await retryOutboxNotificationAction(item.id);
      if (!res.ok) {
        toast.error(res.message || "Failed to requeue notification");
        return;
      }
      toast.success("Notification reset to pending for immediate delivery.");
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? { ...n, status: "pending", attempts: 0, lastError: null }
            : n
        )
      );
      setInspecting((curr) =>
        curr && curr.kind === "channel" && curr.record.id === item.id
          ? {
              kind: "channel",
              record: {
                ...curr.record,
                status: "pending",
                attempts: 0,
                lastError: null,
              },
            }
          : curr
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingKey(null);
    }
  };

  // Distinct event names and channels for dropdown filtering
  const availableEventNames = React.useMemo(() => {
    return Array.from(new Set(events.map((e) => e.event_name))).sort();
  }, [events]);

  const availableChannels = React.useMemo(() => {
    return Array.from(new Set(notifications.map((n) => n.channel))).sort();
  }, [notifications]);

  // Derived channel log metrics
  const channelMetrics = React.useMemo(() => {
    const pending = notifications.filter((n) => n.status === "pending").length;
    const delivered = notifications.filter(
      (n) => n.status === "delivered" || n.status === "sent"
    ).length;
    const failed = notifications.filter((n) => n.status === "failed").length;
    return {
      total: notifications.length,
      pending,
      delivered,
      failed,
    };
  }, [notifications]);

  // Filtered Event Queue rows
  const filteredEvents = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (eventStatusFilter !== "all" && ev.status !== eventStatusFilter) {
        return false;
      }
      if (eventTypeFilter !== "all" && ev.event_name !== eventTypeFilter) {
        return false;
      }
      if (!q) return true;
      const orderNo = extractOrderNumber(ev.payload) || "";
      const recipient = extractRecipientSummary(ev) || "";
      return (
        ev.event_name.toLowerCase().includes(q) ||
        ev.aggregate_id.toLowerCase().includes(q) ||
        ev.aggregate_type.toLowerCase().includes(q) ||
        ev.idempotency_key.toLowerCase().includes(q) ||
        orderNo.toLowerCase().includes(q) ||
        recipient.toLowerCase().includes(q) ||
        (ev.last_error?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [events, eventStatusFilter, eventTypeFilter, search]);

  // Filtered Channel Log rows
  const filteredNotifications = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((n) => {
      const matchesStatus =
        channelStatusFilter === "all" ||
        (channelStatusFilter === "delivered" &&
          (n.status === "delivered" || n.status === "sent")) ||
        n.status === channelStatusFilter;
      if (!matchesStatus) return false;

      if (channelTypeFilter !== "all" && n.channel !== channelTypeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        n.recipient.toLowerCase().includes(q) ||
        n.template.toLowerCase().includes(q) ||
        n.channel.toLowerCase().includes(q) ||
        String(n.id).includes(q) ||
        (n.lastError?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [notifications, channelStatusFilter, channelTypeFilter, search]);

  // Active summary figures based on selected queue
  const activeTotal =
    activeQueue === "events" ? metrics.total : channelMetrics.total;
  const activeSuccess =
    activeQueue === "events" ? metrics.dispatched : channelMetrics.delivered;
  const activeInFlight =
    activeQueue === "events"
      ? metrics.pending + metrics.processing
      : channelMetrics.pending;
  const activeErrors =
    activeQueue === "events"
      ? metrics.failed + metrics.dead_letter
      : channelMetrics.failed;

  const successRate =
    activeTotal > 0 ? Math.round((activeSuccess / activeTotal) * 100) : 100;
  const successPct = activeTotal > 0 ? (activeSuccess / activeTotal) * 100 : 100;
  const inFlightPct = activeTotal > 0 ? (activeInFlight / activeTotal) * 100 : 0;
  const errorPct = activeTotal > 0 ? (activeErrors / activeTotal) * 100 : 0;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    (activeQueue === "events"
      ? eventStatusFilter !== "all" || eventTypeFilter !== "all"
      : channelStatusFilter !== "all" || channelTypeFilter !== "all");

  const resetFilters = () => {
    setSearch("");
    if (activeQueue === "events") {
      setEventStatusFilter("all");
      setEventTypeFilter("all");
    } else {
      setChannelStatusFilter("all");
      setChannelTypeFilter("all");
    }
  };

  return (
    <div className="space-y-5">
      {/* Command Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Send className="size-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Transactional Outbox
            </h1>
            {activeErrors > 0 ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-medium"
              >
                <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                {activeErrors} Needs Attention
              </Badge>
            ) : activeInFlight > 0 ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-medium"
              >
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                {activeInFlight} In Queue
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                All Systems Healthy
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Reliable event delivery monitor for order emails, SMS, Meta CAPI, and webhook jobs with idempotent retry.
          </p>
        </div>

        {/* Operational Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={autoRefresh ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setAutoRefresh((prev) => {
                      const next = !prev;
                      toast.info(
                        next
                          ? "Live auto-refresh enabled (every 15s)"
                          : "Live auto-refresh paused"
                      );
                      return next;
                    });
                  }}
                  className={cn(
                    "h-8 gap-1.5 text-xs",
                    autoRefresh &&
                      "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                  )}
                />
              }
            >
              <Radio
                className={cn(
                  "size-3.5",
                  autoRefresh && "text-emerald-500 animate-pulse"
                )}
              />
              {autoRefresh ? "Live (15s)" : "Auto-refresh"}
            </TooltipTrigger>
            <TooltipContent>
              {lastSyncedAt
                ? `Last synced ${formatRelativeTime(lastSyncedAt)}`
                : "Poll outbox every 15 seconds"}
            </TooltipContent>
          </Tooltip>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshAll(false)}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => void handleDrainQueue()}
            disabled={isDraining || isRefreshing}
            className="h-8 gap-1.5 text-xs bg-amber-500 text-black hover:bg-amber-400 font-semibold shadow-xs"
          >
            {isDraining ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
            {isDraining ? "Draining..." : "Drain Queue"}
            {metrics.pending + metrics.failed > 0 && !isDraining && (
              <span className="ml-0.5 rounded-full bg-black/15 px-1.5 py-0 text-[10px] font-bold">
                {metrics.pending + metrics.failed}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Queue Switcher + Health Summary Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border/80 bg-muted/40 p-1 w-fit">
          <button
            type="button"
            onClick={() => {
              setActiveQueue("events");
              setSearch("");
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              activeQueue === "events"
                ? "bg-background text-foreground shadow-xs ring-1 ring-border/70"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Database className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span>Event Queue</span>
            <Badge
              variant="secondary"
              className="h-4.5 px-1.5 text-[10px] font-mono tabular-nums"
            >
              {metrics.total}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveQueue("channels");
              setSearch("");
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              activeQueue === "channels"
                ? "bg-background text-foreground shadow-xs ring-1 ring-border/70"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="size-3.5 text-sky-600 dark:text-sky-400" />
            <span>Channel Log</span>
            <Badge
              variant="secondary"
              className="h-4.5 px-1.5 text-[10px] font-mono tabular-nums"
            >
              {channelMetrics.total}
            </Badge>
          </button>
        </div>

        {/* Compact pipeline health bar */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {successRate}% success
          </span>
          <div
            className="h-2 w-36 sm:w-44 overflow-hidden rounded-full bg-muted flex"
            role="img"
            aria-label={`Delivery health: ${successRate}% successful`}
          >
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${successPct}%` }}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${inFlightPct}%` }}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-300"
              style={{ width: `${errorPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interactive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() =>
            activeQueue === "events"
              ? setEventStatusFilter("all")
              : setChannelStatusFilter("all")
          }
          className="text-left group cursor-pointer"
        >
          <Card
            className={cn(
              "rounded-xl border transition-all duration-150 hover:border-foreground/25 hover:shadow-sm",
              (activeQueue === "events"
                ? eventStatusFilter === "all"
                : channelStatusFilter === "all") &&
                "ring-1 ring-amber-500/40 border-amber-500/40"
            )}
          >
            <CardContent className="p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Events
                </span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Activity className="size-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {activeTotal}
                </span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {successRate}% ok
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                {activeQueue === "events"
                  ? "Inngest transactional outbox"
                  : "Direct channel records"}
              </p>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() =>
            activeQueue === "events"
              ? setEventStatusFilter("pending")
              : setChannelStatusFilter("pending")
          }
          className="text-left group cursor-pointer"
        >
          <Card
            className={cn(
              "rounded-xl border transition-all duration-150 hover:border-amber-500/40 hover:shadow-sm",
              (activeQueue === "events"
                ? eventStatusFilter === "pending" ||
                  eventStatusFilter === "processing"
                : channelStatusFilter === "pending") &&
                "ring-1 ring-amber-500/50 border-amber-500/50"
            )}
          >
            <CardContent className="p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Queued / Active
                </span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400">
                  <Clock className="size-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                  {activeInFlight}
                </span>
                {activeQueue === "events" && metrics.processing > 0 && (
                  <span className="text-[11px] text-sky-600 dark:text-sky-400">
                    {metrics.processing} running
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                Waiting for worker dispatch
              </p>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() =>
            activeQueue === "events"
              ? setEventStatusFilter("dispatched")
              : setChannelStatusFilter("delivered")
          }
          className="text-left group cursor-pointer"
        >
          <Card
            className={cn(
              "rounded-xl border transition-all duration-150 hover:border-emerald-500/40 hover:shadow-sm",
              (activeQueue === "events"
                ? eventStatusFilter === "dispatched"
                : channelStatusFilter === "delivered") &&
                "ring-1 ring-emerald-500/50 border-emerald-500/50"
            )}
          >
            <CardContent className="p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {activeQueue === "events" ? "Dispatched" : "Delivered"}
                </span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                  {activeSuccess}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                Confirmed handoff to gateway
              </p>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() =>
            activeQueue === "events"
              ? setEventStatusFilter("failed")
              : setChannelStatusFilter("failed")
          }
          className="text-left group cursor-pointer"
        >
          <Card
            className={cn(
              "rounded-xl border transition-all duration-150 hover:border-rose-500/40 hover:shadow-sm",
              activeErrors > 0 && "border-rose-500/30 bg-rose-500/[0.03]",
              (activeQueue === "events"
                ? eventStatusFilter === "failed" ||
                  eventStatusFilter === "dead_letter"
                : channelStatusFilter === "failed") &&
                "ring-1 ring-rose-500/50 border-rose-500/50"
            )}
          >
            <CardContent className="p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Failures &amp; DLQ
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    activeErrors > 0
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <AlertTriangle className="size-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-2xl font-bold tracking-tight tabular-nums",
                    activeErrors > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-foreground"
                  )}
                >
                  {activeErrors}
                </span>
                {activeQueue === "events" && metrics.dead_letter > 0 && (
                  <span className="text-[11px] text-purple-600 dark:text-purple-400">
                    {metrics.dead_letter} dead letter
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                {activeErrors > 0
                  ? "Inspect error & trigger retry"
                  : "Zero delivery errors"}
              </p>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Main Workspace Card: Filter Bar + Data Table / Mobile Cards */}
      <Card className="rounded-xl border border-border/80 shadow-xs overflow-hidden">
        {/* Filter Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/25 p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            {/* Status Tabs */}
            {activeQueue === "events" ? (
              <div className="overflow-x-auto pb-0.5 -mx-1 px-1">
                <Tabs
                  value={eventStatusFilter}
                  onValueChange={setEventStatusFilter}
                >
                  <TabsList className="h-8 bg-muted/70 p-0.5">
                    <TabsTrigger value="all" className="h-7 px-2.5 text-xs">
                      All ({metrics.total})
                    </TabsTrigger>
                    <TabsTrigger value="dispatched" className="h-7 px-2.5 text-xs">
                      Dispatched ({metrics.dispatched})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="h-7 px-2.5 text-xs">
                      Pending ({metrics.pending})
                    </TabsTrigger>
                    <TabsTrigger value="processing" className="h-7 px-2.5 text-xs">
                      Processing ({metrics.processing})
                    </TabsTrigger>
                    <TabsTrigger value="failed" className="h-7 px-2.5 text-xs">
                      Failed ({metrics.failed})
                    </TabsTrigger>
                    <TabsTrigger value="dead_letter" className="h-7 px-2.5 text-xs">
                      Dead Letter ({metrics.dead_letter})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            ) : (
              <div className="overflow-x-auto pb-0.5 -mx-1 px-1">
                <Tabs
                  value={channelStatusFilter}
                  onValueChange={setChannelStatusFilter}
                >
                  <TabsList className="h-8 bg-muted/70 p-0.5">
                    <TabsTrigger value="all" className="h-7 px-2.5 text-xs">
                      All ({channelMetrics.total})
                    </TabsTrigger>
                    <TabsTrigger value="delivered" className="h-7 px-2.5 text-xs">
                      Delivered ({channelMetrics.delivered})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="h-7 px-2.5 text-xs">
                      Pending ({channelMetrics.pending})
                    </TabsTrigger>
                    <TabsTrigger value="failed" className="h-7 px-2.5 text-xs">
                      Failed ({channelMetrics.failed})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Type Select + Search */}
            <div className="flex flex-wrap items-center gap-2">
              {activeQueue === "events" ? (
                <Select
                  value={eventTypeFilter}
                  onValueChange={(v) => setEventTypeFilter(v || "all")}
                >
                  <SelectTrigger className="h-8 w-full sm:w-48 text-xs bg-background">
                    <SelectValue placeholder="All event types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All event types</SelectItem>
                    {availableEventNames.map((name) => (
                      <SelectItem key={name} value={name} className="font-mono text-xs">
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={channelTypeFilter}
                  onValueChange={(v) => setChannelTypeFilter(v || "all")}
                >
                  <SelectTrigger className="h-8 w-full sm:w-40 text-xs bg-background">
                    <SelectValue placeholder="All channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    {availableChannels.map((ch) => (
                      <SelectItem key={ch} value={ch} className="uppercase text-xs">
                        {ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    activeQueue === "events"
                      ? "Order #, event, key, error..."
                      : "Recipient, template, error..."
                  }
                  className="h-8 pl-8 pr-7 text-xs bg-background"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <FilterX className="size-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* EVENT QUEUE CONTENT */}
        {activeQueue === "events" ? (
          filteredEvents.length === 0 ? (
            <EmptyOutboxState
              hasFilters={hasActiveFilters}
              onReset={resetFilters}
              title={
                hasActiveFilters
                  ? "No events match your current filters"
                  : "Event queue is empty"
              }
              description={
                hasActiveFilters
                  ? "Try clearing your search query or switching status tabs."
                  : "New order notifications, SMS dispatches, and Meta CAPI jobs will appear here automatically."
              }
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Event
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Target / Order
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                        Retries
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Diagnostics
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Created
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((ev) => {
                      const meta = getEventMeta(ev.event_name);
                      const orderNo = extractOrderNumber(ev.payload);
                      const recipient = extractRecipientSummary(ev);
                      const isRetrying = retryingKey === `event:${ev.id}`;
                      const canRetry = ev.status !== "dispatched";

                      return (
                        <TableRow
                          key={ev.id}
                          onClick={() => setInspecting({ kind: "event", record: ev })}
                          className="cursor-pointer transition-colors hover:bg-muted/35"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                                  meta.accentClass
                                )}
                              >
                                {meta.icon}
                              </span>
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-semibold text-foreground truncate">
                                  {ev.event_name}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {meta.label} · {ev.aggregate_type}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            <div className="flex flex-col gap-0.5">
                              {orderNo ? (
                                <Link
                                  href={`/admin/orders?search=${encodeURIComponent(orderNo)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex w-fit items-center gap-1 font-mono text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                                >
                                  {orderNo}
                                  <ArrowUpRight className="size-3" />
                                </Link>
                              ) : (
                                <span className="font-mono text-xs text-foreground truncate max-w-[160px]">
                                  {ev.aggregate_id}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                {recipient || ev.idempotency_key}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            <EventStatusBadge status={ev.status} />
                          </TableCell>

                          <TableCell className="py-3 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] tabular-nums",
                                ev.retry_count > 0
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : "border-border/70 bg-muted/40 text-muted-foreground"
                              )}
                            >
                              {ev.retry_count}/{ev.max_retries}
                            </span>
                          </TableCell>

                          <TableCell className="py-3 max-w-[220px]">
                            {ev.last_error ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <p className="truncate text-xs text-rose-600 dark:text-rose-400 font-mono" />
                                  }
                                >
                                  {ev.last_error}
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs break-words font-mono text-[11px]">
                                  {ev.last_error}
                                </TooltipContent>
                              </Tooltip>
                            ) : ev.dispatched_at ? (
                              <span className="text-xs text-muted-foreground">
                                Sent {formatRelativeTime(ev.dispatched_at)}
                              </span>
                            ) : ev.next_retry_at ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                Retry {formatRelativeTime(ev.next_retry_at)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="py-3 whitespace-nowrap">
                            <div className="text-xs font-medium text-foreground">
                              {formatRelativeTime(ev.created_at)}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {formatDhakaDateTime(ev.created_at)}
                            </div>
                          </TableCell>

                          <TableCell
                            className="py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setInspecting({ kind: "event", record: ev })
                                }
                                className="h-7 px-2 text-xs gap-1"
                              >
                                <Eye className="size-3.5" />
                                Inspect
                              </Button>
                              {canRetry && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isRetrying}
                                  onClick={() => void handleRetryEvent(ev)}
                                  className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                                >
                                  {isRetrying ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="size-3" />
                                  )}
                                  Retry
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="divide-y divide-border/70 md:hidden">
                {filteredEvents.map((ev) => {
                  const meta = getEventMeta(ev.event_name);
                  const orderNo = extractOrderNumber(ev.payload);
                  const recipient = extractRecipientSummary(ev);
                  const isRetrying = retryingKey === `event:${ev.id}`;
                  const canRetry = ev.status !== "dispatched";

                  return (
                    <div
                      key={ev.id}
                      onClick={() => setInspecting({ kind: "event", record: ev })}
                      className="p-3.5 space-y-2.5 active:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                              meta.accentClass
                            )}
                          >
                            {meta.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-semibold text-foreground truncate">
                              {ev.event_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {orderNo || ev.aggregate_id}
                              {recipient ? ` · ${recipient}` : ""}
                            </p>
                          </div>
                        </div>
                        <EventStatusBadge status={ev.status} />
                      </div>

                      {ev.last_error && (
                        <div className="rounded-lg border border-rose-500/25 bg-rose-500/8 px-2.5 py-1.5 font-mono text-[11px] text-rose-700 dark:text-rose-300 line-clamp-2">
                          {ev.last_error}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-muted-foreground">
                        <span>
                          {formatRelativeTime(ev.created_at)} · Retries{" "}
                          <span className="font-mono text-foreground">
                            {ev.retry_count}/{ev.max_retries}
                          </span>
                        </span>
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setInspecting({ kind: "event", record: ev })
                            }
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Eye className="size-3" />
                            Inspect
                          </Button>
                          {canRetry && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isRetrying}
                              onClick={() => void handleRetryEvent(ev)}
                              className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
                            >
                              {isRetrying ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3" />
                              )}
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : /* CHANNEL LOG CONTENT */
        filteredNotifications.length === 0 ? (
          <EmptyOutboxState
            hasFilters={hasActiveFilters}
            onReset={resetFilters}
            title={
              hasActiveFilters
                ? "No channel logs match your filters"
                : "No direct channel log entries yet"
            }
            description={
              hasActiveFilters
                ? "Clear filters or switch back to Event Queue to inspect active background dispatches."
                : "Most order SMS, email, and Meta CAPI jobs run through the Inngest Event Queue tab."
            }
            action={
              !hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveQueue("events")}
                  className="h-8 text-xs gap-1.5"
                >
                  <Database className="size-3.5" />
                  Switch to Event Queue ({metrics.total})
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      ID
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Channel
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Template
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recipient
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                      Attempts
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Timestamp
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotifications.map((item) => {
                    const chMeta = getChannelMeta(item.channel);
                    const isFailed = item.status === "failed";
                    const isRetrying = retryingKey === `channel:${item.id}`;

                    return (
                      <TableRow
                        key={item.id}
                        onClick={() =>
                          setInspecting({ kind: "channel", record: item })
                        }
                        className="cursor-pointer transition-colors hover:bg-muted/35"
                      >
                        <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                          #{item.id}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1.5 uppercase font-mono text-[10px] px-2 py-0.5",
                              chMeta.accentClass
                            )}
                          >
                            {chMeta.icon}
                            {item.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 font-mono text-xs text-foreground">
                          {item.template}
                        </TableCell>
                        <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                          {item.recipient}
                        </TableCell>
                        <TableCell className="py-3">
                          <EventStatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="py-3 text-center font-mono text-xs tabular-nums">
                          {item.attempts}
                        </TableCell>
                        <TableCell className="py-3 whitespace-nowrap">
                          <div className="text-xs font-medium text-foreground">
                            {formatRelativeTime(item.sentAt || item.scheduledAt)}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {formatDhakaDateTime(item.sentAt || item.scheduledAt)}
                          </div>
                        </TableCell>
                        <TableCell
                          className="py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setInspecting({ kind: "channel", record: item })
                              }
                              className="h-7 px-2 text-xs gap-1"
                            >
                              <Eye className="size-3.5" />
                              Inspect
                            </Button>
                            {isFailed && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isRetrying}
                                onClick={() =>
                                  void handleRetryChannelNotification(item)
                                }
                                className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                              >
                                {isRetrying ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="size-3" />
                                )}
                                Retry
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="divide-y divide-border/70 md:hidden">
              {filteredNotifications.map((item) => {
                const chMeta = getChannelMeta(item.channel);
                const isFailed = item.status === "failed";
                const isRetrying = retryingKey === `channel:${item.id}`;

                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      setInspecting({ kind: "channel", record: item })
                    }
                    className="p-3.5 space-y-2 active:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 uppercase font-mono text-[10px] px-1.5 py-0",
                              chMeta.accentClass
                            )}
                          >
                            {chMeta.icon}
                            {item.channel}
                          </Badge>
                          <span className="font-mono text-xs font-semibold text-foreground truncate">
                            {item.template}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground truncate">
                          #{item.id} · {item.recipient}
                        </p>
                      </div>
                      <EventStatusBadge status={item.status} />
                    </div>

                    {item.lastError && (
                      <div className="rounded-lg border border-rose-500/25 bg-rose-500/8 px-2.5 py-1.5 font-mono text-[11px] text-rose-700 dark:text-rose-300 line-clamp-2">
                        {item.lastError}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {formatRelativeTime(item.sentAt || item.scheduledAt)} ·{" "}
                        {item.attempts} attempt{item.attempts === 1 ? "" : "s"}
                      </span>
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setInspecting({ kind: "channel", record: item })
                          }
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Eye className="size-3" />
                          Inspect
                        </Button>
                        {isFailed && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isRetrying}
                            onClick={() =>
                              void handleRetryChannelNotification(item)
                            }
                            className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
                          >
                            {isRetrying ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3" />
                            )}
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Table Footer Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>
            Showing{" "}
            <strong className="font-semibold text-foreground tabular-nums">
              {activeQueue === "events"
                ? filteredEvents.length
                : filteredNotifications.length}
            </strong>{" "}
            of{" "}
            <strong className="font-semibold text-foreground tabular-nums">
              {activeQueue === "events" ? events.length : notifications.length}
            </strong>{" "}
            loaded {activeQueue === "events" ? "events" : "records"}
          </span>
          <span>Click any row to inspect payload &amp; delivery diagnostics</span>
        </div>
      </Card>

      {/* Slide-Over Payload & Diagnostics Inspector Sheet */}
      <Sheet
        open={Boolean(inspecting)}
        onOpenChange={(open) => {
          if (!open) setInspecting(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col p-0 gap-0"
        >
          {inspecting && (
            <>
              <SheetHeader className="border-b border-border/80 bg-muted/25 px-5 py-4">
                <div className="flex items-center gap-2 pr-8">
                  <EventStatusBadge status={inspecting.record.status} />
                  <span className="font-mono text-[11px] text-muted-foreground truncate">
                    {inspecting.kind === "event"
                      ? inspecting.record.aggregate_type
                      : inspecting.record.channel.toUpperCase()}
                  </span>
                </div>
                <SheetTitle className="font-mono text-base font-semibold tracking-tight break-all">
                  {inspecting.kind === "event"
                    ? inspecting.record.event_name
                    : inspecting.record.template}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {inspecting.kind === "event"
                    ? `Idempotency key: ${inspecting.record.idempotency_key}`
                    : `Recipient: ${inspecting.record.recipient}`}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Quick Identifiers & Deep Link */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void handleCopy(
                        "Record ID",
                        String(inspecting.record.id)
                      )
                    }
                    className="h-7 text-[11px] gap-1.5 font-mono"
                  >
                    {copiedField === "Record ID" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    Copy ID
                  </Button>

                  {inspecting.kind === "event" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void handleCopy(
                          "Idempotency Key",
                          inspecting.record.idempotency_key
                        )
                      }
                      className="h-7 text-[11px] gap-1.5 font-mono"
                    >
                      {copiedField === "Idempotency Key" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      Copy Key
                    </Button>
                  )}

                  {inspecting.kind === "event" &&
                    extractOrderNumber(inspecting.record.payload) && (
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                      >
                        <Link
                          href={`/admin/orders?search=${encodeURIComponent(
                            extractOrderNumber(inspecting.record.payload)!
                          )}`}
                        >
                          Open Order{" "}
                          {extractOrderNumber(inspecting.record.payload)}
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </Button>
                    )}
                </div>

                {/* Error Diagnostics Callout */}
                {(inspecting.kind === "event"
                  ? inspecting.record.last_error
                  : inspecting.record.lastError) && (
                  <div className="rounded-xl border border-rose-500/35 bg-rose-500/8 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="size-3.5" />
                        Last Delivery Error
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void handleCopy(
                            "Error",
                            (inspecting.kind === "event"
                              ? inspecting.record.last_error
                              : inspecting.record.lastError) || ""
                          )
                        }
                        className="h-6 px-2 text-[11px] text-rose-700 dark:text-rose-300 hover:bg-rose-500/15"
                      >
                        <Copy className="size-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <p className="font-mono text-[11px] leading-relaxed text-rose-800 dark:text-rose-200 break-words">
                      {inspecting.kind === "event"
                        ? inspecting.record.last_error
                        : inspecting.record.lastError}
                    </p>
                  </div>
                )}

                {/* Lifecycle Metadata Grid */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                    <span className="text-[11px] text-muted-foreground block">
                      Created At
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] font-medium text-foreground">
                      {formatDhakaDateTime(
                        inspecting.kind === "event"
                          ? inspecting.record.created_at
                          : inspecting.record.createdAt
                      )}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                    <span className="text-[11px] text-muted-foreground block">
                      {inspecting.kind === "event"
                        ? "Dispatched At"
                        : "Sent / Scheduled At"}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] font-medium text-foreground">
                      {inspecting.kind === "event"
                        ? inspecting.record.dispatched_at
                          ? formatDhakaDateTime(inspecting.record.dispatched_at)
                          : "Not yet dispatched"
                        : formatDhakaDateTime(
                            inspecting.record.sentAt ||
                              inspecting.record.scheduledAt
                          )}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                    <span className="text-[11px] text-muted-foreground block">
                      Delivery Attempts
                    </span>
                    <span className="mt-0.5 block font-mono text-xs font-semibold text-foreground tabular-nums">
                      {inspecting.kind === "event"
                        ? `${inspecting.record.retry_count} / ${inspecting.record.max_retries}`
                        : inspecting.record.attempts}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                    <span className="text-[11px] text-muted-foreground block">
                      {inspecting.kind === "event"
                        ? "Next Retry Window"
                        : "Channel"}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] font-medium text-foreground uppercase">
                      {inspecting.kind === "event"
                        ? inspecting.record.next_retry_at &&
                          inspecting.record.status !== "dispatched"
                          ? formatDhakaDateTime(inspecting.record.next_retry_at)
                          : "—"
                        : inspecting.record.channel}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Payload JSON Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Event Payload (JSON)
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void handleCopy(
                          "Payload JSON",
                          JSON.stringify(inspecting.record.payload, null, 2)
                        )
                      }
                      className="h-7 px-2.5 text-[11px] gap-1"
                    >
                      {copiedField === "Payload JSON" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      Copy JSON
                    </Button>
                  </div>
                  <pre className="max-h-[340px] overflow-auto rounded-xl border border-border/80 bg-muted/40 p-3.5 font-mono text-[11px] leading-relaxed text-foreground">
                    {JSON.stringify(inspecting.record.payload, null, 2)}
                  </pre>
                </div>
              </div>

              <SheetFooter className="border-t border-border/80 bg-muted/20 px-5 py-3 flex-row items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInspecting(null)}
                  className="h-8 text-xs"
                >
                  Close
                </Button>

                {inspecting.kind === "event" &&
                  inspecting.record.status !== "dispatched" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={retryingKey === `event:${inspecting.record.id}`}
                      onClick={() => void handleRetryEvent(inspecting.record)}
                      className="h-8 text-xs gap-1.5 bg-amber-500 text-black hover:bg-amber-400 font-semibold"
                    >
                      {retryingKey === `event:${inspecting.record.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Retry Dispatch Now
                    </Button>
                  )}

                {inspecting.kind === "channel" &&
                  inspecting.record.status === "failed" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        retryingKey === `channel:${inspecting.record.id}`
                      }
                      onClick={() =>
                        void handleRetryChannelNotification(inspecting.record)
                      }
                      className="h-8 text-xs gap-1.5 bg-amber-500 text-black hover:bg-amber-400 font-semibold"
                    >
                      {retryingKey === `channel:${inspecting.record.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Retry Delivery Now
                    </Button>
                  )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EmptyOutboxState({
  hasFilters,
  onReset,
  title,
  description,
  action,
}: {
  hasFilters: boolean;
  onReset: () => void;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-border/80 bg-muted/50 text-muted-foreground">
        {hasFilters ? (
          <Search className="size-5" />
        ) : (
          <CheckCircle2 className="size-5 text-emerald-500" />
        )}
      </div>
      <h3 className="mt-3.5 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      <div className="mt-4 flex items-center gap-2">
        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-8 text-xs gap-1.5"
          >
            <FilterX className="size-3.5" />
            Clear filters
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
