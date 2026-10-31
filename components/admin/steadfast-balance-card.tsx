"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getSteadfastBalanceAction } from "@/actions/steadfast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, ExternalLink, AlertCircle, CheckCircle2, Truck } from "lucide-react";

export function SteadfastBalanceCard() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "steadfast-balance"],
    queryFn: async () => {
      const res = await getSteadfastBalanceAction();
      if (!res.success) {
        throw new Error(res.error || "Failed to fetch Steadfast balance");
      }
      return res;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  const isBusy = isLoading || isFetching;

  return (
    <Card className="border border-border/80 bg-gradient-to-br from-card to-muted/20 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Truck className="h-4 w-4" />
            </div>
            <CardTitle className="text-base font-semibold tracking-tight">
              Steadfast Courier
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Merchant Wallet & COD Remittance Balance
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => refetch()}
            disabled={isBusy}
            title="Refresh balance"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh</span>
          </Button>
          <a
            href="https://steadfast.com.bd/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Open Steadfast Merchant Portal"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="sr-only">Portal</span>
          </a>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Could not retrieve balance</p>
              <p className="text-[11px] text-destructive/80 leading-relaxed">
                {(error as Error).message}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {isLoading ? (
                    <span className="inline-block h-7 w-28 animate-pulse bg-muted rounded" />
                  ) : (
                    `৳ ${(data?.current_balance ?? 0).toLocaleString("en-BD", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </span>
                <span className="text-xs text-muted-foreground ml-2">Available for payout</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="h-3 w-3" />
                <span>Active</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2.5">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                <span>Net COD delivered minus courier fees</span>
              </span>
              <span>
                {data?.updatedAt ? (
                  <>Updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                ) : (
                  "Ready"
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

