"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  MessageSquare,
  Phone,
  CheckCircle2,
  AlertOctagon,
  Reply,
  MoreHorizontal,
  Mail,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getAdminMessagesAction,
  updateMessageStatusAction,
  deleteMessageAction,
  MessageItem,
} from "@/actions/messages";

const statusStyles: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold",
  read: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  replied: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium",
  spam: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function ContactMessagesPage() {
  const queryClient = useQueryClient();
  const [tabFilter, setTabFilter] = React.useState<string>("new");
  const [selectedMessage, setSelectedMessage] = React.useState<MessageItem | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [isReplyOpen, setIsReplyOpen] = React.useState(false);

  const { data: messagesRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "messages"],
    queryFn: getAdminMessagesAction,
  });

  const messages: MessageItem[] = messagesRes?.data || [];

  const updateStatusMutation = useMutation({
    mutationFn: updateMessageStatusAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Message status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      } else {
        toast.error(res.error || "Failed to update status");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMessageAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Message deleted");
        queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      } else {
        toast.error(res.error || "Failed to delete message");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete message");
    },
  });

  const filteredMessages = React.useMemo(() => {
    if (tabFilter === "all") return messages;
    return messages.filter((m) => m.status === tabFilter);
  }, [messages, tabFilter]);

  const newCount = messages.filter((m) => m.status === "new").length;
  const repliedCount = messages.filter((m) => m.status === "replied").length;
  const spamCount = messages.filter((m) => m.status === "spam").length;

  const handleOpenReply = (m: MessageItem) => {
    setSelectedMessage(m);
    setReplyText("");
    setIsReplyOpen(true);
  };

  const handleSendReply = () => {
    if (!selectedMessage) return;
    if (replyText.trim()) {
      window.open(
        `mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(
          selectedMessage.subject
        )}&body=${encodeURIComponent(replyText)}`
      );
    }
    updateStatusMutation.mutate({ id: selectedMessage.id, status: "replied" });
    setIsReplyOpen(false);
  };

  const columns: ColumnDef<MessageItem>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sender & Channel" />
        ),
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div>
              <p className="font-semibold text-sm">{m.name}</p>
              <Badge variant="outline" className="text-[10px] mt-0.5">
                {m.channel}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone & Email" />
        ),
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="text-xs space-y-0.5">
              <p className="font-mono font-medium">{m.phone}</p>
              <p className="text-muted-foreground">{m.email}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "subject",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Subject" />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold max-w-[200px] truncate block" title={row.getValue("subject")}>
            {row.getValue("subject")}
          </span>
        ),
      },
      {
        accessorKey: "message",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Message Preview" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground max-w-sm line-clamp-2 block" title={row.getValue("message")}>
            {row.getValue("message")}
          </span>
        ),
      },
      {
        accessorKey: "time",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Received" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(row.getValue("time"))}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[status] || ""}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const m = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-amber-700 dark:text-amber-400 font-medium"
                  onClick={() => handleOpenReply(m)}
                >
                  <Reply className="h-3.5 w-3.5 mr-2" /> View & Reply
                </DropdownMenuItem>
                {m.phone && m.phone !== "N/A" && (
                  <DropdownMenuItem onClick={() => window.open(`tel:${m.phone}`)}>
                    <Phone className="h-3.5 w-3.5 mr-2" /> Call Phone
                  </DropdownMenuItem>
                )}
                {m.status !== "read" && m.status !== "replied" && (
                  <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: m.id, status: "read" })}>
                    <CheckCircle className="h-3.5 w-3.5 mr-2" /> Mark as Read
                  </DropdownMenuItem>
                )}
                {m.status !== "spam" && (
                  <DropdownMenuItem
                    className="text-amber-600"
                    onClick={() => updateStatusMutation.mutate({ id: m.id, status: "spam" })}
                  >
                    <AlertOctagon className="h-3.5 w-3.5 mr-2" /> Mark as Spam
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onClick={() => deleteMutation.mutate(m.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [updateStatusMutation, deleteMutation]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Messages & Inquiries</h1>
          <p className="text-muted-foreground text-sm">
            Handle incoming trade inquiries, WhatsApp leads, technical support questions, and spam filtering
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Unread Inquiries</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{newCount} New</p>
            <p className="text-xs text-blue-600 font-medium mt-1">Pending first response</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Replied Inquiries</p>
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{repliedCount}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              {messages.length > 0 ? `${((repliedCount / messages.length) * 100).toFixed(0)}% resolved` : "No inquiries yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Inquiries</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Phone className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{messages.length} Total</p>
            <p className="text-xs text-muted-foreground mt-1">Website contact & trade inquiries</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Blocked Spam</p>
              <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertOctagon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{spamCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Filtered from inbox</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs and Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <Tabs value={tabFilter} onValueChange={setTabFilter}>
          <TabsList>
            <TabsTrigger value="new">Unread ({newCount})</TabsTrigger>
            <TabsTrigger value="all">All Messages ({messages.length})</TabsTrigger>
            <TabsTrigger value="replied">Replied ({repliedCount})</TabsTrigger>
            <TabsTrigger value="spam">Spam ({spamCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredMessages}
              searchPlaceholder="Search sender, phone, subject..."
              enableRowSelection
              enableSorting
              enablePagination
              initialPageSize={10}
              pageSizeOptions={[5, 10, 20]}
              emptyMessage="No customer messages found."
            />
          )}
        </Card>
      </motion.div>

      {/* Reply Dialog */}
      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer Inquiry: {selectedMessage?.subject}</DialogTitle>
            <DialogDescription>
              From {selectedMessage?.name} ({selectedMessage?.email || selectedMessage?.phone})
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/50 rounded border text-xs space-y-1">
                <p className="font-semibold text-foreground">Message Body:</p>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{selectedMessage.message}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Draft Email Response</label>
                <Textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Dear customer, thank you for reaching out..."
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplyOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSendReply}
            >
              <Mail className="h-4 w-4 mr-1.5" />
              Dispatch Reply & Mark Solved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
