"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  FileQuestion,
  Clock,
  CheckCircle2,
  DollarSign,
  MapPin,
  MoreHorizontal,
  Send,
  Download,
  Trash2,
  Phone,
  Building2,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import {
  getAdminQuotesAction,
  submitQuoteReplyAction,
  updateQuoteStatusAction,
  deleteQuoteRequestAction,
  QuoteRequestItem,
} from "@/actions/quotes";

const statusStyles: Record<string, string> = {
  new: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  quoted: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  converted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  declined: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

export default function QuotesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState("all");

  // Respond quote dialog state
  const [isReplyOpen, setIsReplyOpen] = React.useState(false);
  const [selectedQuote, setSelectedQuote] = React.useState<QuoteRequestItem | null>(null);
  const [quotedPriceInput, setQuotedPriceInput] = React.useState("");
  const [replyMessageInput, setReplyMessageInput] = React.useState("");

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["admin", "quotes"],
    queryFn: async () => {
      const res = await getAdminQuotesAction();
      if (!res.success) throw new Error(res.error || "Failed to load quotes");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const replyMutation = useMutation({
    mutationFn: submitQuoteReplyAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Quote response dispatched");
        queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        setIsReplyOpen(false);
        setSelectedQuote(null);
        setQuotedPriceInput("");
        setReplyMessageInput("");
      } else {
        toast.error(res.error || "Failed to dispatch quote");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to dispatch quote");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateQuoteStatusAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Quote status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      } else {
        toast.error(res.error || "Failed to update quote status");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update quote status");
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: deleteQuoteRequestAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Quote request removed");
        queryClient.invalidateQueries({ queryKey: ["admin", "quotes"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      } else {
        toast.error(res.error || "Failed to delete quote");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete quote");
    },
  });

  const filteredQuotes = React.useMemo(() => {
    return quotes.filter((q) => {
      if (activeTab === "new" && q.status !== "new") return false;
      if (activeTab === "quoted" && q.status !== "quoted") return false;
      if (activeTab === "converted" && q.status !== "converted") return false;
      return true;
    });
  }, [quotes, activeTab]);

  const newCount = quotes.filter((q) => q.status === "new").length;
  const convertedCount = quotes.filter((q) => q.status === "converted").length;
  const pipelineValue = quotes
    .filter((q) => q.status !== "declined")
    .reduce((sum, q) => sum + (q.quotedPriceNumeric || 0), 0);

  const conversionRate = quotes.length > 0 ? Math.round((convertedCount / quotes.length) * 100) : 0;

  const handleExportCSV = (selected: QuoteRequestItem[]) => {
    const list = selected.length > 0 ? selected : filteredQuotes;
    const headers = ["RFQ_ID", "Company", "Contact", "Phone", "Product", "Quantity", "QuotedPrice", "Destination", "NeededBy", "Status"];
    const rows = list.map((q) => [
      q.referenceNo,
      `"${q.company}"`,
      `"${q.contact}"`,
      q.phone,
      `"${q.product}"`,
      `"${q.quantity}"`,
      `"${q.quotedPrice}"`,
      `"${q.destination}"`,
      formatDate(q.requiredBy),
      q.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `quotes_${Date.now()}.csv`;
    link.click();
  };

  const quoteColumns = React.useMemo<ColumnDef<QuoteRequestItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all RFQs"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select RFQ"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "referenceNo",
      header: ({ column }) => <DataTableColumnHeader column={column} title="RFQ Reference" />,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <div>
            <p className="font-mono text-xs font-semibold text-foreground">{q.referenceNo}</p>
            <p className="text-[11px] text-muted-foreground">{formatDate(q.createdAt)}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "company",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Institution" />,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <div>
            <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {q.company}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{q.contact} · {q.phone}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "product",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Requested Product" />,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <div>
            <p className="font-medium text-xs text-foreground">{q.product}</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">{q.quantity}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "destination",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Destination & Date" />,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <div className="text-xs">
            <p className="flex items-center text-muted-foreground gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {q.destination}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Need by: {formatDate(q.requiredBy)}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "quotedPrice",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Quoted Price" />,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <div className="font-mono text-xs">
            <p className="font-bold text-foreground">{q.quotedPrice}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${statusStyles[s]}`}
          >
            {s}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="text-amber-600 focus:text-amber-600"
                onClick={() => {
                  setSelectedQuote(q);
                  setQuotedPriceInput(String(q.quotedPriceNumeric || ""));
                  setReplyMessageInput(q.quoteReply || "");
                  setIsReplyOpen(true);
                }}
              >
                <Send className="h-3.5 w-3.5 mr-2" /> Provide Quotation
              </DropdownMenuItem>
              {q.status !== "converted" && (
                <DropdownMenuItem
                  className="text-emerald-600 focus:text-emerald-600"
                  onClick={() => updateStatusMutation.mutate({ id: q.id, status: "converted" })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark Converted
                </DropdownMenuItem>
              )}
              {q.status !== "declined" && (
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onClick={() => updateStatusMutation.mutate({ id: q.id, status: "declined" })}
                >
                  <Clock className="h-3.5 w-3.5 mr-2" /> Decline Request
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteQuoteMutation.mutate(q.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Request
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], [updateStatusMutation, deleteQuoteMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wholesale Quote Requests (RFQ)</h1>
          <p className="text-muted-foreground text-sm">
            Bulk orders, industrial procurement, and tanker delivery quotation negotiation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => handleExportCSV([])}
          >
            <Download className="h-4 w-4 mr-2" />
            Export RFQs
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">New RFQs</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <FileQuestion className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{newCount}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Pending sales response</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Pipeline Value</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">
                ৳ {pipelineValue.toLocaleString("en-BD")}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Estimated gross wholesale value</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Conversion Rate</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{conversionRate}%</p>
            )}
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Converted to confirmed orders</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Inquiries</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{quotes.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Total wholesale submissions</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs and Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs">
              All Inquiries <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{quotes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="new" className="text-xs">
              New RFQs <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[10px]">{newCount}</span>
            </TabsTrigger>
            <TabsTrigger value="quoted" className="text-xs">
              Quoted Pending Client
            </TabsTrigger>
            <TabsTrigger value="converted" className="text-xs">
              Converted
            </TabsTrigger>
          </TabsList>

          <DataTable
            columns={quoteColumns}
            data={filteredQuotes}
            searchPlaceholder="Search RFQ reference, institution, product..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={10}
            pageSizeOptions={[10, 25, 50]}
            bulkActions={(selected, clearSelection) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background"
                  onClick={() => handleExportCSV(selected)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export Selected
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={() => {
                    selected.forEach((s) => deleteQuoteMutation.mutate(s.id));
                    clearSelection();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Selected
                </Button>
              </>
            )}
            emptyMessage="No RFQs found in database matching criteria."
          />
        </Tabs>
      </motion.div>

      {/* Respond Quote Dialog */}
      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Provide Quotation</DialogTitle>
            <DialogDescription>
              Submit commercial offer for {selectedQuote?.company} ({selectedQuote?.referenceNo}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="qPrice">Quoted Total Amount (৳) *</Label>
              <Input
                id="qPrice"
                type="number"
                placeholder="e.g. 1500000"
                value={quotedPriceInput}
                onChange={(e) => setQuotedPriceInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qReply">Customer Reply / Terms Note</Label>
              <Input
                id="qReply"
                placeholder="e.g. Rate: ৳ 72,000/ton ex-factory, delivery within 4 days."
                value={replyMessageInput}
                onChange={(e) => setReplyMessageInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplyOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!quotedPriceInput || replyMutation.isPending}
              onClick={() => {
                if (selectedQuote) {
                  replyMutation.mutate({
                    id: selectedQuote.id,
                    quotedTotal: Number(quotedPriceInput),
                    replyMessage: replyMessageInput,
                  });
                }
              }}
            >
              {replyMutation.isPending ? "Sending..." : "Submit Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
