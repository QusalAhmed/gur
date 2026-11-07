"use client";

import * as React from "react";
import { Share2, Globe, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatBDT } from "@/lib/admin-format";

interface SourcesCardProps {
  sources: Array<{
    dimension_key: string;
    dimension_label: string;
    orders_count: number;
    revenue: number;
  }>;
}

export function SourcesCampaignsCard({ sources }: SourcesCardProps) {
  const totalRev = sources.reduce((sum, s) => sum + Number(s.revenue || 0), 0);

  return (
    <Card className="border-border/80 shadow-xs flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
        <CardTitle className="text-base font-semibold tracking-tight">Sales by Acquisition Source</CardTitle>
        <CardDescription className="text-xs">UTM campaigns and attribution traffic</CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 pt-1 flex-1">
        {sources.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            No attribution sources recorded in this period.
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((s) => {
              const pct = totalRev > 0 ? Math.round((Number(s.revenue) / totalRev) * 100) : 0;
              return (
                <div key={s.dimension_key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate">{s.dimension_label}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground text-[11px]">{s.orders_count} orders</span>
                      <span className="font-semibold">{formatBDT(s.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-600 dark:bg-amber-500 rounded-full"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
