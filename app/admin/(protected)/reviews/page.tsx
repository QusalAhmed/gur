"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ThumbsUp,
  MoreHorizontal,
  Download,
  Trash2,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import {
  getAdminReviewsAction,
  updateReviewStatusAction,
  deleteReviewAction,
  ReviewItem,
} from "@/actions/reviews";

const statusStyles: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState("all");

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: async () => {
      const res = await getAdminReviewsAction();
      if (!res.success) throw new Error(res.error || "Failed to load reviews");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const reviews = reviewsData?.reviews || [];
  const kpis = reviewsData?.kpis || {
    averageRating: 5.0,
    totalReviews: 0,
    pendingCount: 0,
    verifiedPercentage: 0,
    recommendationRate: 100,
  };

  const updateStatusMutation = useMutation({
    mutationFn: updateReviewStatusAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Review status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      } else {
        toast.error(res.error || "Failed to update review status");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update review status");
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: deleteReviewAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Review deleted");
        queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      } else {
        toast.error(res.error || "Failed to delete review");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete review");
    },
  });

  const filteredReviews = React.useMemo(() => {
    return reviews.filter((r) => {
      if (activeTab === "pending" && r.status !== "pending") return false;
      if (activeTab === "approved" && r.status !== "approved") return false;
      if (activeTab === "rejected" && r.status !== "rejected") return false;
      return true;
    });
  }, [reviews, activeTab]);

  const handleExportCSV = (selected: ReviewItem[]) => {
    const list = selected.length > 0 ? selected : filteredReviews;
    const headers = ["ID", "Product", "Customer", "Rating", "Title", "Body", "Verified", "Date", "Status"];
    const rows = list.map((r) => [
      r.id,
      `"${r.product}"`,
      `"${r.customer}"`,
      r.rating,
      `"${r.title}"`,
      `"${r.body.replace(/"/g, '""')}"`,
      r.isVerified ? "Yes" : "No",
      formatDate(r.date),
      r.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `reviews_${Date.now()}.csv`;
    link.click();
  };

  const reviewColumns = React.useMemo<ColumnDef<ReviewItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all reviews"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select review"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "product",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <span className="font-semibold text-xs text-foreground line-clamp-1">{row.getValue("product")}</span>
        </div>
      ),
    },
    {
      accessorKey: "customer",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue("customer")}</span>,
    },
    {
      accessorKey: "rating",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
      cell: ({ row }) => {
        const rating = Number(row.getValue("rating"));
        return (
          <div className="flex items-center text-amber-500 text-xs font-bold gap-0.5">
            {"★".repeat(rating)}
            <span className="text-muted-foreground font-normal ml-1">({rating}/5)</span>
          </div>
        );
      },
    },
    {
      accessorKey: "title",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Review Content" />,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="max-w-md">
            <p className="font-semibold text-xs text-foreground">{r.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.body}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "isVerified",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Verified" />,
      cell: ({ row }) => {
        const isVerified = row.original.isVerified;
        return isVerified ? (
          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] border-emerald-500/30">
            <ShieldCheck className="h-3 w-3 mr-0.5 inline" /> Verified
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Guest
          </Badge>
        );
      },
    },
    {
      accessorKey: "date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Submitted" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.getValue("date"))}</span>,
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
        const r = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {r.status !== "approved" && (
                <DropdownMenuItem
                  className="text-emerald-600 focus:text-emerald-600"
                  onClick={() => updateStatusMutation.mutate({ id: r.id, status: "approved" })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Approve Review
                </DropdownMenuItem>
              )}
              {r.status !== "rejected" && (
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onClick={() => updateStatusMutation.mutate({ id: r.id, status: "rejected" })}
                >
                  <XCircle className="h-3.5 w-3.5 mr-2" /> Reject as Spam
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteReviewMutation.mutate(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], [updateStatusMutation, deleteReviewMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Reviews & Ratings</h1>
          <p className="text-muted-foreground text-sm">
            Customer feedback, verified buyer ratings, quality moderation, and spam protection
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
            Export CSV
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Average Rating</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Star className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{kpis.averageRating} / 5.0</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Based on {kpis.totalReviews} verified ratings</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Pending Moderation</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{kpis.pendingCount}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Awaiting staff review</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Verified Buyers</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{kpis.verifiedPercentage}%</p>
            )}
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Matched to completed order IDs</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Recommendation Rate</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <ThumbsUp className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded my-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-foreground">{kpis.recommendationRate}%</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">4-star and 5-star reviews</p>
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
              All Reviews <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{reviews.length}</span>
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">
              Pending Moderation <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[10px]">{kpis.pendingCount}</span>
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">
              Published Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">
              Rejected / Spam
            </TabsTrigger>
          </TabsList>

          <DataTable
            columns={reviewColumns}
            data={filteredReviews}
            searchPlaceholder="Search reviews by product, title, or reviewer..."
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
                  onClick={() => {
                    selected.forEach((r) => updateStatusMutation.mutate({ id: r.id, status: "approved" }));
                    clearSelection();
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Approve Selected
                </Button>
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
                    selected.forEach((r) => deleteReviewMutation.mutate(r.id));
                    clearSelection();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Selected
                </Button>
              </>
            )}
            emptyMessage="No product reviews found matching your criteria."
          />
        </Tabs>
      </motion.div>
    </div>
  );
}
