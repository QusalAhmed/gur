"use client";

import * as React from "react";
import { formatDistanceToNow, format } from "date-fns";
import { CallLogItem } from "@/actions/call-lists";
import { CallStatusBadge } from "./call-status-badge";
import { Clock, User, CalendarClock } from "lucide-react";

interface CallTimelineProps {
  logs: CallLogItem[];
}

export function CallTimeline({ logs }: CallTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-6 border border-dashed rounded-lg bg-muted/20">
        <Clock className="w-6 h-6 mx-auto text-muted-foreground mb-2 opacity-60" />
        <p className="text-sm font-medium text-muted-foreground">No call attempts logged yet</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dial the customer and record the first call outcome below.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-4 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border/60">
      {logs.map((log) => {
        const logDate = new Date(log.createdAt);
        const timeAgo = formatDistanceToNow(logDate, { addSuffix: true });
        const exactTime = format(logDate, "dd MMM yyyy, h:mm a");

        return (
          <div key={log.id} className="relative group">
            {/* Timeline bullet dot */}
            <div className="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full bg-primary/70 border-2 border-background ring-2 ring-primary/20 group-hover:scale-125 transition-transform" />

            <div className="bg-card border rounded-lg p-3 text-sm shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CallStatusBadge status={log.outcome} />
                <span className="text-xs text-muted-foreground" title={exactTime}>
                  {timeAgo}
                </span>
              </div>

              {log.notes && (
                <p className="text-sm text-foreground/90 bg-muted/30 p-2 rounded border border-border/40 whitespace-pre-wrap">
                  "{log.notes}"
                </p>
              )}

              {log.callbackAt && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>
                    Callback scheduled for:{" "}
                    {format(new Date(log.callbackAt), "dd MMM yyyy, h:mm a")}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                <User className="w-3 h-3" />
                <span>Called by: {log.calledBy?.name || "Staff"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
