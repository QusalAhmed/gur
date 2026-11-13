"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { checkSmsBalanceAction } from "@/actions/sms";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminSmsBalance() {
  const [mounted, setMounted] = React.useState(false);
  const [lastRefreshed, setLastRefreshed] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["admin", "sms-balance"],
    queryFn: async () => {
      const res = await checkSmsBalanceAction();
      setLastRefreshed(new Date());
      return res;
    },
    staleTime: 1000 * 60 * 3, // Cache balance for 3 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const isBusy = isLoading || isFetching;
  const balance = data?.balance;
  const isSuccess = data?.success && balance !== undefined;
  const isLow = isSuccess && balance !== undefined && balance < 50;
  const isDepleted = isSuccess && balance !== undefined && balance <= 0;

  const handleManualRefresh = async () => {
    try {
      const result = await refetch();
      if (result.data?.success && result.data.balance !== undefined) {
        toast.success(`SMS balance refreshed: ৳${result.data.balance.toFixed(2)}`);
      } else if (result.data?.error) {
        toast.error(result.data.error);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to refresh SMS balance");
    }
  };

  // Status dot indicator
  const getDotColor = () => {
    if (isLoading) return "bg-muted-foreground/50 animate-pulse";
    if (!isSuccess || isError) return "bg-rose-500";
    if (isDepleted) return "bg-rose-500";
    if (isLow) return "bg-amber-500";
    return "bg-emerald-500";
  };

  if (!mounted) {
    return (
      <div className="h-8 px-2.5 rounded-full border border-border/60 bg-muted/30 text-xs font-medium flex items-center gap-1.5 text-muted-foreground opacity-60">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="hidden sm:inline">SMS</span>
        <span className="font-mono">--</span>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="View SMS gateway balance"
          className={cn(
            "h-8 px-2 sm:px-2.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500",
            isSuccess
              ? isLow || isDepleted
                ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 hover:bg-amber-500/15"
                : "border-border/70 bg-background/70 hover:bg-muted text-foreground"
              : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted"
          )}
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background",
                getDotColor()
              )}
            />
          </div>

          <div className="flex items-center gap-1 font-mono text-[11px] sm:text-xs">
            <span className="hidden md:inline font-sans text-muted-foreground font-semibold">
              SMS:
            </span>
            {isLoading ? (
              <span className="inline-block h-3.5 w-10 animate-pulse bg-muted rounded" />
            ) : isSuccess && balance !== undefined ? (
              <span className="font-bold">
                ৳{balance.toFixed(2)}
              </span>
            ) : (
              <span className="text-muted-foreground font-sans">
                {data?.error ? "Error" : "--"}
              </span>
            )}
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-3.5 space-y-3.5 text-xs">
        {/* Popover Header */}
        <div className="flex items-center justify-between border-b pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-xs leading-none">
                SMS Gateway Balance
              </h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                SMSBangladesh REST API
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-medium px-1.5 py-0 border",
              isSuccess
                ? isLow || isDepleted
                  ? "border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-rose-400 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
            )}
          >
            {isLoading ? "Checking..." : isSuccess ? (isLow ? "Low Balance" : "Active") : "Offline / Unset"}
          </Badge>
        </div>

        {/* Balance Display Card */}
        <div className="p-3 rounded-lg border bg-gradient-to-br from-card to-muted/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3 w-3 text-sky-600 dark:text-sky-400" />
              Available Credit
            </span>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isBusy}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh SMS balance"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isBusy && "animate-spin")} />
            </button>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {isLoading ? (
                <span className="inline-block h-6 w-24 animate-pulse bg-muted rounded" />
              ) : isSuccess && balance !== undefined ? (
                `৳ ${balance.toFixed(2)}`
              ) : (
                "৳ 0.00"
              )}
            </span>
            {isSuccess && (
              <span className="text-[10px] text-muted-foreground">BDT</span>
            )}
          </div>

          {/* Status Notes & Alerts */}
          {isSuccess && isLow && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2 rounded border border-amber-300/50 mt-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
              <span>Balance is running low (&lt; ৳50). Re-charge via SMSBangladesh to ensure continuous customer notifications.</span>
            </div>
          )}

          {(!isSuccess || isError) && !isLoading && (
            <div className="flex items-start gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 p-2 rounded border border-rose-300/50 mt-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Failed to read balance</span>
                <span className="text-[10px] leading-tight block text-rose-600/90 dark:text-rose-400/90">
                  {data?.error || "Please verify SMSBangladesh API credentials in settings."}
                </span>
              </div>
            </div>
          )}

          {lastRefreshed && (
            <p className="text-[10px] text-muted-foreground/80 pt-1">
              Last checked: {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </div>

        {/* Action Links */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t">
          <Link
            href="/settings"
            className="inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded-md border text-[11px] font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3 w-3" />
            <span>SMS Settings</span>
          </Link>
          <a
            href="http://panel.smsbangladesh.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-medium transition-colors shadow-xs"
          >
            <span>Recharge</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
