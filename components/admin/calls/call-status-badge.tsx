"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Clock,
  PhoneMissed,
  CalendarClock,
  Smile,
  CheckCircle2,
  XCircle,
  PhoneOff,
} from "lucide-react";
import { CallItemStatus, CallListStatus } from "@/actions/call-lists";

interface CallStatusBadgeProps {
  status: CallItemStatus;
  className?: string;
  showIcon?: boolean;
}

export function CallStatusBadge({
  status,
  className,
  showIcon = true,
}: CallStatusBadgeProps) {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-muted/60 text-muted-foreground border-border gap-1.5 font-medium",
            className
          )}
        >
          {showIcon && <Clock className="w-3 h-3 text-muted-foreground" />}
          Pending
        </Badge>
      );
    case "no_answer":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1.5 font-medium",
            className
          )}
        >
          {showIcon && <PhoneMissed className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
          No Answer
        </Badge>
      );
    case "call_later":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1.5 font-medium animate-pulse",
            className
          )}
        >
          {showIcon && <CalendarClock className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
          Call Later
        </Badge>
      );
    case "reached_interested":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1.5 font-medium",
            className
          )}
        >
          {showIcon && <Smile className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
          Interested
        </Badge>
      );
    case "reached_ordered":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30 gap-1.5 font-semibold",
            className
          )}
        >
          {showIcon && <CheckCircle2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />}
          Ordered
        </Badge>
      );
    case "reached_not_interested":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 gap-1.5 font-medium",
            className
          )}
        >
          {showIcon && <XCircle className="w-3 h-3 text-slate-600 dark:text-slate-400" />}
          Not Interested
        </Badge>
      );
    case "wrong_number":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-destructive/15 text-destructive border-destructive/30 gap-1.5 font-medium",
            className
          )}
        >
          {showIcon && <PhoneOff className="w-3 h-3 text-destructive" />}
          Wrong Number
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
}

export function CallListStatusBadge({
  status,
  className,
}: {
  status: CallListStatus;
  className?: string;
}) {
  switch (status) {
    case "active":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-medium",
            className
          )}
        >
          Active
        </Badge>
      );
    case "paused":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium",
            className
          )}
        >
          Paused
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-medium",
            className
          )}
        >
          Completed
        </Badge>
      );
    case "archived":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-muted/60 text-muted-foreground border-border font-medium",
            className
          )}
        >
          Archived
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
