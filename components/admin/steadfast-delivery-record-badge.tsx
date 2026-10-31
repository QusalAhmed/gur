"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Truck,
  Flag,
  HelpCircle,
  Database,
  Calendar,
  Sparkles,
} from "lucide-react";
import { useSteadfastDeliveryRecord } from "@/hooks/use-steadfast-delivery-record";
import { assessSteadfastDeliveryRisk, type SteadfastDeliveryRecord } from "@/lib/steadfast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface SteadfastDeliveryRecordBadgeProps {
  phone?: string | null;
  variant?: "compact" | "expanded" | "inline";
  autoFetch?: boolean;
  className?: string;
}

/**
 * Format timestamp into relative display and human-readable string.
 */
function formatRelativeTime(dateString?: string | null): { relative: string; full: string } {
  if (!dateString) return { relative: "Just now", full: "" };
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return { relative: "Recently", full: "" };

    const full = date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const diffMs = Date.now() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return { relative: "Just now", full };
    if (diffMins < 60) return { relative: `${diffMins}m ago`, full };
    if (diffHours < 24) return { relative: `${diffHours}h ago`, full };
    if (diffDays === 1) return { relative: "Yesterday", full };
    if (diffDays < 7) return { relative: `${diffDays}d ago`, full };
    return {
      relative: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      full,
    };
  } catch {
    return { relative: "Recently", full: "" };
  }
}

export function SteadfastDeliveryRecordBadge({
  phone,
  variant = "compact",
  autoFetch,
  className = "",
}: SteadfastDeliveryRecordBadgeProps) {
  // Determine default autoFetch policy based on variant:
  // - "compact" (table rows): on-demand by default (or loads from batch DB cache)
  // - "expanded" (details sheet) & "inline" (edit modal): autoFetch=true (one order at a time)
  const defaultAutoFetch = variant === "compact" ? false : true;
  const shouldAutoFetch = autoFetch !== undefined ? autoFetch : defaultAutoFetch;

  const {
    data: record,
    isLoading,
    isError,
    error,
    isValidPhone,
    isTriggered,
    source,
    storedAt,
    triggerFetch,
    refetchFresh,
    isFetching,
  } = useSteadfastDeliveryRecord(phone, { autoFetch: shouldAutoFetch });

  const [isOpen, setIsOpen] = React.useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = React.useState(false);

  if (!phone || !isValidPhone) {
    return null;
  }

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsManualRefreshing(true);
    try {
      await refetchFresh();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerFetch();
  };

  // 1. Not yet triggered (on-demand mode for table cells if not present in DB cache)
  if (!isTriggered && !record) {
    return (
      <div className={`mt-0.5 ${className}`}>
        <button
          type="button"
          onClick={handleTrigger}
          className="group inline-flex items-center gap-1 text-[10px] text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 px-1.5 py-0.5 rounded font-medium transition-all cursor-pointer shadow-xs"
          title="Click to check customer delivery record from DB / Steadfast Courier"
        >
          <Truck className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
          <span>Check Delivery History</span>
        </button>
      </div>
    );
  }

  // 2. Loading state
  if (isLoading && !record) {
    return (
      <div
        className={`mt-0.5 inline-flex items-center gap-1.5 text-[10px] text-amber-700/80 dark:text-amber-400/80 animate-pulse px-1.5 py-0.5 rounded bg-amber-500/5 border border-amber-500/15 ${className}`}
      >
        <RefreshCw className="h-2.5 w-2.5 animate-spin text-amber-600 shrink-0" />
        <span>Searching DB & courier...</span>
      </div>
    );
  }

  // 3. Error state (Rate limit or network error)
  if (isError && !record) {
    const isRateLimited =
      error?.message?.toLowerCase().includes("rate limit") || error?.message?.includes("429");
    return (
      <div className={`mt-0.5 inline-flex items-center gap-1 text-[10px] ${className}`}>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-rose-200 dark:border-rose-900/40 bg-rose-50/70 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 hover:bg-rose-100 transition-colors cursor-pointer"
          title={error?.message || "Failed to load delivery record. Click to retry."}
        >
          <AlertTriangle className="h-2.5 w-2.5 text-rose-500 shrink-0" />
          <span>{isRateLimited ? "Rate limit (10/window)" : "Check failed"} • Retry</span>
        </button>
      </div>
    );
  }

  if (!record) {
    return null;
  }

  const risk = assessSteadfastDeliveryRisk(record);
  const deliveryRatio = record.delivery_ratio;
  const cancellationRatio =
    record.cancellation_ratio ?? (deliveryRatio !== null ? 100 - deliveryRatio : null);
  const volumeLabel = record.volume_range
    ? `${record.volume_range} parcels`
    : record.volume_band
    ? `${record.volume_band} vol`
    : "";
  const reportsCount = record.total_reports || 0;
  const fraudCategories =
    record.fraud_categories &&
    typeof record.fraud_categories === "object" &&
    !Array.isArray(record.fraud_categories)
      ? Object.entries(record.fraud_categories)
      : [];

  const timeInfo = formatRelativeTime(record.updated_at || record.stored_at || record.fetchedAt);
  const recordSource = record.source || source || "api";

  // =========================================================================
  // 1. COMPACT VARIANT (For Orders Table)
  // =========================================================================
  if (variant === "compact") {
    return (
      <div className={`mt-0.5 ${className}`}>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={`group inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all cursor-pointer select-none max-w-full truncate shadow-xs ${risk.badgeClass}`}
              title={`Delivery record: ${risk.badgeLabel} • Click for details (${
                recordSource === "db" ? `DB: ${timeInfo.relative}` : "Live API"
              })`}
            >
              {risk.level === "safe" ? (
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : risk.level === "moderate" ? (
                <AlertTriangle className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : risk.level === "risk" ? (
                <ShieldAlert className="h-2.5 w-2.5 text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <HelpCircle className="h-2.5 w-2.5 text-slate-500 shrink-0" />
              )}

              <span className="truncate">
                {deliveryRatio !== null ? `${deliveryRatio}% Delivered` : "New Buyer"}
                {record.volume_range ? ` (${record.volume_range})` : ""}
              </span>

              {reportsCount > 0 && (
                <span className="inline-flex items-center gap-0.5 bg-rose-600 text-white text-[9px] px-1 py-0.2 rounded-full font-bold ml-0.5">
                  <Flag className="h-2 w-2" />
                  {reportsCount}
                </span>
              )}

              {/* Source marker pill */}
              {recordSource === "db" ? (
                <span title={`Stored in DB (${timeInfo.relative})`}>
                  <Database className="h-2.5 w-2.5 text-muted-foreground/70 shrink-0 ml-0.5" />
                </span>
              ) : (
                <span title="Live Steadfast API">
                  <Sparkles className="h-2.5 w-2.5 text-amber-500 shrink-0 ml-0.5" />
                </span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            className="w-80 p-3.5 shadow-xl rounded-xl border bg-popover text-popover-foreground z-50 text-xs"
            align="start"
            sideOffset={6}
            onClick={(e) => e.stopPropagation()}
          >
            <DeliveryRecordContent
              record={record}
              risk={risk}
              source={recordSource}
              timeInfo={timeInfo}
              onRefresh={handleRefresh}
              isRefreshing={isManualRefreshing || isFetching}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // =========================================================================
  // 2. INLINE VARIANT (For Form Inputs in OrderFormDialog)
  // =========================================================================
  if (variant === "inline") {
    return (
      <div className={`mt-1.5 p-2.5 rounded-lg border text-xs shadow-xs ${risk.badgeClass} ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {risk.level === "safe" ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : risk.level === "moderate" ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : risk.level === "risk" ? (
              <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <HelpCircle className="h-4 w-4 text-slate-500 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">
                  {deliveryRatio !== null
                    ? `${deliveryRatio}% Delivery Success Rate`
                    : "New Buyer (No Prior Courier Record)"}
                </span>
                {volumeLabel && (
                  <span className="text-[11px] text-muted-foreground font-normal">
                    • {volumeLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                {recordSource === "db" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <Database className="h-3 w-3" />
                    <span>Stored in DB ({timeInfo.relative})</span>
                  </span>
                ) : recordSource === "db_fallback" ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <Database className="h-3 w-3" />
                    <span>DB Record (Rate limit fallback)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400">
                    <Sparkles className="h-3 w-3" />
                    <span>Live API ({timeInfo.relative})</span>
                  </span>
                )}
                {timeInfo.full && <span>• {timeInfo.full}</span>}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isManualRefreshing || isFetching}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh record from Steadfast"
          >
            <RefreshCw className={`h-3 w-3 ${isManualRefreshing || isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Short advice & summary */}
        <p className="mt-1 text-[11px] text-foreground/80 leading-relaxed">
          {risk.recommendation}
        </p>

        {reportsCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
            <Flag className="h-3 w-3 shrink-0" />
            <span>{reportsCount} merchant dispute/fraud report(s) on file</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. EXPANDED VARIANT (For Order Details Sheet)
  // =========================================================================
  return (
    <div className={`mt-2 p-3 rounded-xl border bg-card/60 space-y-2.5 shadow-xs ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">Courier Delivery Record</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${risk.badgeClass}`}>
                {risk.level === "safe"
                  ? "Trusted"
                  : risk.level === "moderate"
                  ? "Moderate"
                  : risk.level === "risk"
                  ? "High Risk"
                  : "Unverified"}
              </span>
            </div>
            {/* Storage status & source indicator */}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
              {recordSource === "db" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                  <Database className="h-2.5 w-2.5" />
                  <span>Stored in DB ({timeInfo.relative})</span>
                </span>
              ) : recordSource === "db_fallback" ? (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                  <Database className="h-2.5 w-2.5" />
                  <span>Saved DB (API fallback)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 font-medium">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Live Steadfast API</span>
                </span>
              )}
              {timeInfo.full && (
                <span title={timeInfo.full} className="cursor-help">
                  • {timeInfo.full}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isManualRefreshing || isFetching}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          title="Force refresh from Steadfast Courier"
        >
          <RefreshCw className={`h-3 w-3 ${isManualRefreshing || isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Progress Bar (Delivery Ratio vs Cancellation Ratio) */}
      {deliveryRatio !== null ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {deliveryRatio}% Delivered
            </span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {cancellationRatio}% Cancelled
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-rose-200 dark:bg-rose-950 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, deliveryRatio))}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="p-2 rounded bg-muted/50 text-[11px] text-muted-foreground italic text-center">
          No finished parcels recorded in Steadfast for this phone number yet.
        </div>
      )}

      {/* Stats 4-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-center">
        <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50">
          <span className="text-[10px] text-muted-foreground block">Delivered</span>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {deliveryRatio !== null ? `${deliveryRatio}%` : "N/A"}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50">
          <span className="text-[10px] text-muted-foreground block">Cancellation</span>
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
            {cancellationRatio !== null ? `${cancellationRatio}%` : "N/A"}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50">
          <span className="text-[10px] text-muted-foreground block">Volume</span>
          <span className="text-xs font-semibold text-foreground font-mono">
            {record.volume_range || record.volume_band || "None"}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50">
          <span className="text-[10px] text-muted-foreground block">Reports</span>
          <span
            className={`text-xs font-bold font-mono ${
              reportsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {reportsCount}
          </span>
        </div>
      </div>

      {/* Fraud/Dispute reports breakdown */}
      {fraudCategories.length > 0 && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
          <div className="flex items-center gap-1 font-semibold text-rose-800 dark:text-rose-300 text-[11px]">
            <Flag className="h-3 w-3 text-rose-600 shrink-0" />
            <span>Merchant Complaint Reasons:</span>
          </div>
          <div className="flex flex-wrap gap-1 pt-0.5">
            {fraudCategories.map(([cat, count]) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-200/60 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 font-medium"
              >
                <span>{cat.replace(/_/g, " ")}:</span>
                <b className="font-mono">{count}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation alert */}
      <p className="text-[11px] text-muted-foreground leading-normal italic px-0.5">
        💡 {risk.recommendation}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: Content for Popover View
// ─────────────────────────────────────────────────────────────────────────────
function DeliveryRecordContent({
  record,
  risk,
  source,
  timeInfo,
  onRefresh,
  isRefreshing,
}: {
  record: SteadfastDeliveryRecord;
  risk: ReturnType<typeof assessSteadfastDeliveryRisk>;
  source: string;
  timeInfo: { relative: string; full: string };
  onRefresh: (e: React.MouseEvent) => void;
  isRefreshing: boolean;
}) {
  const deliveryRatio = record.delivery_ratio;
  const cancellationRatio =
    record.cancellation_ratio ?? (deliveryRatio !== null ? 100 - deliveryRatio : null);
  const reportsCount = record.total_reports || 0;
  const fraudCategories =
    record.fraud_categories &&
    typeof record.fraud_categories === "object" &&
    !Array.isArray(record.fraud_categories)
      ? Object.entries(record.fraud_categories)
      : [];

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-1.5">
          <Truck className="h-4 w-4 text-amber-600 shrink-0" />
          <div>
            <h4 className="font-semibold text-xs leading-none text-foreground">
              Steadfast Delivery Record
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[10px] text-muted-foreground">{record.phone}</span>
              <span className="text-[9px] text-muted-foreground">•</span>
              {source === "db" ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-700 dark:text-emerald-400 font-medium">
                  <Database className="h-2.5 w-2.5" />
                  <span>DB: {timeInfo.relative}</span>
                </span>
              ) : source === "db_fallback" ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-700 dark:text-amber-400 font-medium">
                  <Database className="h-2.5 w-2.5" />
                  <span>DB Fallback</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-sky-700 dark:text-sky-400 font-medium">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Live API</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title={`Refresh live data from Steadfast${timeInfo.full ? ` (Stored: ${timeInfo.full})` : ""}`}
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Progress & Ratios */}
      {deliveryRatio !== null ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {deliveryRatio}% Delivered
            </span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {cancellationRatio}% Cancelled
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-rose-200 dark:bg-rose-950 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, deliveryRatio))}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="p-2 rounded bg-muted/60 text-[11px] text-muted-foreground italic text-center">
          No finished parcels in Steadfast for this customer yet.
        </div>
      )}

      {/* 3-Column Mini Grid */}
      <div className="grid grid-cols-3 gap-1 text-center pt-0.5">
        <div className="p-1.5 rounded-lg bg-muted/50 border">
          <span className="text-[10px] text-muted-foreground block">Volume</span>
          <span className="text-xs font-semibold text-foreground font-mono">
            {record.volume_range || record.volume_band || "0"}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-muted/50 border">
          <span className="text-[10px] text-muted-foreground block">Delivered</span>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {deliveryRatio !== null ? `${deliveryRatio}%` : "—"}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-muted/50 border">
          <span className="text-[10px] text-muted-foreground block">Reports</span>
          <span
            className={`text-xs font-bold font-mono ${
              reportsCount > 0 ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {reportsCount}
          </span>
        </div>
      </div>

      {/* Fraud categories breakdown if any reports */}
      {fraudCategories.length > 0 && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] space-y-1">
          <div className="flex items-center gap-1 font-semibold text-rose-800 dark:text-rose-300">
            <Flag className="h-3 w-3 text-rose-600 shrink-0" />
            <span>Reported Issues by Merchants:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {fraudCategories.map(([cat, count]) => (
              <span
                key={cat}
                className="text-[9px] px-1 py-0.2 rounded bg-rose-200/70 dark:bg-rose-900/50 text-rose-900 dark:text-rose-100 font-medium"
              >
                {cat.replace(/_/g, " ")}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Storing timestamp details */}
      {timeInfo.full && (
        <div className="flex items-center justify-between text-[9px] text-muted-foreground px-0.5 pt-0.5">
          <span className="flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            <span>Last stored / updated:</span>
          </span>
          <span className="font-mono">{timeInfo.full}</span>
        </div>
      )}

      {/* Recommendation footnote */}
      <div className="text-[10px] text-muted-foreground leading-tight pt-1 border-t">
        <p className="font-medium text-foreground">{risk.summary}</p>
        <p className="mt-0.5 text-muted-foreground">{risk.recommendation}</p>
      </div>
    </div>
  );
}
