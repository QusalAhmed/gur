"use client";

import * as React from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  ShoppingCart,
  Truck,
  AlertTriangle,
  MessageSquare,
  Info,
  Clock,
  ExternalLink,
  Printer,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNotifications } from "@/hooks/use-notifications";
import {
  isNotificationSoundMuted,
  setNotificationSoundMuted,
} from "@/lib/audio/notification-chime";
import { AdminNotification, NotificationType } from "@/types/notification";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 30) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "order_created":
      return <ShoppingCart className="h-4 w-4 text-emerald-500" />;
    case "order_status_changed":
      return <Truck className="h-4 w-4 text-blue-500" />;
    case "low_stock":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "customer_inquiry":
      return <MessageSquare className="h-4 w-4 text-purple-500" />;
    case "system_alert":
    default:
      return <Info className="h-4 w-4 text-sky-500" />;
  }
}

export function AdminNotificationsPopover() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"all" | "unread">("all");
  const [soundMuted, setSoundMuted] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearRead,
    isMarkingAllRead,
    isClearingRead,
  } = useNotifications();

  React.useEffect(() => {
    setMounted(true);
    setSoundMuted(isNotificationSoundMuted());
  }, []);

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !soundMuted;
    setSoundMuted(nextState);
    setNotificationSoundMuted(nextState);
  };

  const handleNotificationClick = (n: AdminNotification) => {
    if (!n.is_read) {
      markAsRead(n.id);
    }
    if (n.data?.link) {
      setOpen(false);
      router.push(n.data.link);
    }
  };

  const filteredNotifications = React.useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((n) => !n.is_read);
    }
    return notifications;
  }, [notifications, activeTab]);

  const hasReadItems = notifications.some((n) => n.is_read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {mounted && unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold shadow-sm transition-transform",
                "bg-amber-500 text-black animate-in zoom-in"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] sm:w-[400px] p-0 shadow-xl border bg-card text-card-foreground rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b bg-muted/40">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[11px] h-5 px-1.5 font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {unreadCount} new
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Sound Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleToggleSound}
              title={soundMuted ? "Unmute audio chime" : "Mute audio chime"}
            >
              {soundMuted ? (
                <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
            </Button>

            {/* Mark All As Read */}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                disabled={isMarkingAllRead}
                onClick={() => markAllAsRead()}
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Filters */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "all" | "unread")}
          className="w-full"
        >
          <div className="px-3 pt-2 pb-1 border-b">
            <TabsList className="grid grid-cols-2 h-7 w-full bg-muted/60 p-0.5">
              <TabsTrigger value="all" className="text-xs h-6 py-0 data-[state=active]:bg-background">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs h-6 py-0 data-[state=active]:bg-background">
                Unread ({unreadCount})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-border/50">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTab === "unread"
                    ? "You are all caught up!"
                    : "Live alerts for orders and inventory will appear here."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "flex items-start gap-3 p-3 transition-colors cursor-pointer group hover:bg-muted/50",
                    !n.is_read ? "bg-amber-500/[0.04]" : "opacity-85"
                  )}
                >
                  {/* Category Icon */}
                  <div className="mt-0.5 p-2 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                    {getNotificationIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={cn(
                          "text-xs truncate",
                          !n.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                        )}
                      >
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(n.created_at)}
                      </span>
                      {n.data?.link && (
                        <span className="flex items-center gap-0.5 text-[10px] text-primary group-hover:underline">
                          <span>View</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {n.data?.reprint_url && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!n.is_read) markAsRead(n.id);
                            window.open(n.data.reprint_url, "_blank");
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800 transition-colors cursor-pointer"
                          title="Open label reprint preview in new tab"
                        >
                          <Printer className="h-2.5 w-2.5" />
                          <span>Reprint Label</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    title="Delete notification"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Tabs>

        {/* Footer */}
        {hasReadItems && (
          <div className="p-2 border-t bg-muted/20 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground px-1">
              Read items auto-expire after 30 days
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
              disabled={isClearingRead}
              onClick={() => clearRead()}
            >
              Clear read
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

