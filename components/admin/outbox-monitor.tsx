"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getOutboxMetricsAction,
  getOutboxEventsAction,
  retryOutboxEventAction,
  drainOutboxQueueAction,
  type OutboxMetrics,
} from "@/actions/outbox";
import type { OutboxEventRecord, OutboxStatus } from "@/lib/outbox";
import {
  Activity,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Send,
  Database,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export function OutboxMonitor() {
  const [loading, setLoading] = React.useState(false);
  const [draining, setDraining] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<OutboxStatus | "all">("all");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [metrics, setMetrics] = React.useState<OutboxMetrics>({
    total: 0,
    pending: 0,
    processing: 0,
    dispatched: 0,
    failed: 0,
    dead_letter: 0,
  });
  const [events, setEvents] = React.useState<OutboxEventRecord[]>([]);

  React.useEffect(() => {
    let ignore = false;
    async function loadData() {
      setLoading(true);
      try {
        const [metricsRes, eventsRes] = await Promise.all([
          getOutboxMetricsAction(),
          getOutboxEventsAction({ status: statusFilter, limit: 15 }),
        ]);

        if (!ignore) {
          if (metricsRes.success) {
            setMetrics(metricsRes.metrics);
          }
          if (eventsRes.success) {
            setEvents(eventsRes.events);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error("Failed to fetch outbox data: " + msg);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [statusFilter, refreshKey]);

  const handleDrainQueue = async () => {
    setDraining(true);
    try {
      const res = await drainOutboxQueueAction();
      if (res.success) {
        toast.success(
          `Processed ${res.processed} pending events (${res.succeeded} dispatched, ${res.failed} pending retry)`
        );
        setRefreshKey((k) => k + 1);
      } else {
        toast.error("Failed to drain outbox queue: " + res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Drain queue error: " + msg);
    } finally {
      setDraining(false);
    }
  };

  const handleRetrySingle = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await retryOutboxEventAction(id);
      if (res.success) {
        toast.success("Event dispatched to Inngest successfully!");
        setRefreshKey((k) => k + 1);
      } else {
        toast.error("Retry failed: " + (res.error || "Unknown error"));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Retry error: " + msg);
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: OutboxStatus) => {
    switch (status) {
      case "dispatched":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />
            Dispatched
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200">
            <RotateCw className="mr-1 h-3 w-3 animate-spin text-sky-600" />
            Processing
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
            <Clock className="mr-1 h-3 w-3 text-amber-600" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200">
            <AlertTriangle className="mr-1 h-3 w-3 text-rose-600" />
            Failed
          </Badge>
        );
      case "dead_letter":
        return (
          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">
            Dead Letter
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-indigo-200/80 bg-gradient-to-b from-white to-indigo-50/20 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-700 shadow-sm">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Transactional Outbox & Inngest Background Jobs
                <Badge variant="outline" className="text-[10px] bg-indigo-100 text-indigo-800 border-indigo-300">
                  Reliable Outbox Engine
                </Badge>
              </CardTitle>
              <CardDescription>
                Guarantees zero dropped emails/SMS with local persistence, automatic Inngest retry sweeps, and idempotency.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleDrainQueue}
              disabled={draining || loading}
              className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Play className={`h-3.5 w-3.5 ${draining ? "animate-spin" : ""}`} />
              {draining ? "Draining Outbox..." : "Drain Pending Outbox"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Metric Counter Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Events</span>
            <p className="text-xl font-bold text-slate-900 mt-1">{metrics.total}</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-amber-200/80 shadow-2xs">
            <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">Pending</span>
            <p className="text-xl font-bold text-amber-800 mt-1">{metrics.pending}</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-sky-200/80 shadow-2xs">
            <span className="text-[11px] font-medium text-sky-700 uppercase tracking-wider">Processing</span>
            <p className="text-xl font-bold text-sky-800 mt-1">{metrics.processing}</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-emerald-200/80 shadow-2xs">
            <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Dispatched</span>
            <p className="text-xl font-bold text-emerald-800 mt-1">{metrics.dispatched}</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-rose-200/80 shadow-2xs">
            <span className="text-[11px] font-medium text-rose-700 uppercase tracking-wider">Failed</span>
            <p className="text-xl font-bold text-rose-800 mt-1">{metrics.failed}</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-purple-200/80 shadow-2xs">
            <span className="text-[11px] font-medium text-purple-700 uppercase tracking-wider">Dead Letter</span>
            <p className="text-xl font-bold text-purple-800 mt-1">{metrics.dead_letter}</p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 mr-1">Filter:</span>
            {(["all", "pending", "processing", "dispatched", "failed", "dead_letter"] as const).map((filter) => (
              <Button
                key={filter}
                type="button"
                variant={statusFilter === filter ? "default" : "ghost"}
                size="sm"
                className={`h-7 px-2.5 text-xs capitalize ${
                  statusFilter === filter ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""
                }`}
                onClick={() => setStatusFilter(filter)}
              >
                {filter.replace("_", " ")}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Showing recent 15 events</p>
        </div>

        {/* Outbox Events Table */}
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70">
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Event Name</TableHead>
                <TableHead className="text-xs">Aggregate / Order</TableHead>
                <TableHead className="text-xs">Retries</TableHead>
                <TableHead className="text-xs">Last Error / Note</TableHead>
                <TableHead className="text-xs">Created At</TableHead>
                <TableHead className="text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground">
                    {loading ? "Loading events..." : "No outbox events match the selected filter."}
                  </TableCell>
                </TableRow>
              ) : (
                events.map((ev) => (
                  <TableRow key={ev.id} className="text-xs">
                    <TableCell>{getStatusBadge(ev.status)}</TableCell>
                    <TableCell className="font-mono text-[11px] font-semibold text-indigo-900">
                      {ev.event_name}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {ev.aggregate_type}: {String(ev.payload?.orderNumber || ev.aggregate_id)}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[150px]">
                        {ev.idempotency_key}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {ev.retry_count}/{ev.max_retries}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {ev.last_error ? (
                        <p className="text-[11px] text-rose-600 truncate" title={ev.last_error}>
                          {ev.last_error}
                        </p>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {ev.status !== "dispatched" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          disabled={retryingId === ev.id}
                          onClick={() => handleRetrySingle(ev.id)}
                        >
                          <Send className={`h-3 w-3 ${retryingId === ev.id ? "animate-spin" : ""}`} />
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Local Inngest Dev Server Helper Box */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" />
            <span>
              To run the Inngest Dev Server locally during development:{" "}
              <code className="px-1.5 py-0.5 bg-slate-200/80 rounded font-mono text-slate-800">
                npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
              </code>
            </span>
          </div>
          <a
            href="http://localhost:8288"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
          >
            Open Inngest UI (localhost:8288)
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
