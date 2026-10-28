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
  MessageSquare,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
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

export interface ReviewItem {
  id: string;
  product: string;
  customer: string;
  rating: number;
  title: string;
  body: string;
  isVerified: boolean;
  status: "approved" | "pending" | "rejected";
  date: string;
}

const initialReviews: ReviewItem[] = [
  {
    id: "REV-001",
    product: "Blackstrap Molasses (200L Steel Drum)",
    customer: "Rahman Dairy Farm (Gazipur)",
    rating: 5,
    title: "Best high brix molasses for cattle feed in Bangladesh",
    body: "We tested the Brix at our farm lab and it came at 82.2°. The cows love the aroma and milk yield increased noticeably within 10 days. Clean delivery in fresh steel drums.",
    isVerified: true,
    status: "approved",
    date: "24 Oct 2026, 11:20",
  },
  {
    id: "REV-002",
    product: "Date Palm Liquid Nolen Gur (500ml Bottle)",
    customer: "Nadia Begum (Dhanmondi, Dhaka)",
    rating: 5,
    title: "Exact authentic taste of childhood winter gur!",
    body: "Zero added sugar crystallization. The smoky caramel aroma is genuinely unadulterated. Prepared Payesh and everyone in the family was impressed.",
    isVerified: true,
    status: "approved",
    date: "24 Oct 2026, 09:45",
  },
  {
    id: "REV-003",
    product: "Feed Grade Molasses A (1 Ton IBC Tote)",
    customer: "Dhaka Feed Mills Ltd",
    rating: 5,
    title: "Consistent viscosity and high purity",
    body: "Delivered on a dedicated truck directly to our mixing hopper. Very competitive bulk wholesale rate compared to local market intermediaries.",
    isVerified: true,
    status: "approved",
    date: "23 Oct 2026, 16:30",
  },
  {
    id: "REV-004",
    product: "Food Grade Sugarcane Molasses (5kg Pail)",
    customer: "Fatema Khatun (Sylhet)",
    rating: 4,
    title: "Good quality, packaging handle could be stronger",
    body: "Molasses quality is pure food grade and dark. But the yellow pail handle got slightly deformed during courier handling. Fast delivery though.",
    isVerified: true,
    status: "pending",
    date: "23 Oct 2026, 13:10",
  },
  {
    id: "REV-005",
    product: "Date Palm Patali Block (1kg Clay Mould)",
    customer: "Kamrul Islam (Uttara)",
    rating: 5,
    title: "Solid clay mold aroma is unmistakable",
    body: "Soft melt-in-mouth texture. No sugar grains at the center. Excellent authentic product from Jashore.",
    isVerified: true,
    status: "pending",
    date: "23 Oct 2026, 10:20",
  },
  {
    id: "REV-006",
    product: "Blackstrap Molasses (25kg Heavy Jerrycan)",
    customer: "Al-Amin Poultry (Narsingdi)",
    rating: 5,
    title: "Heavy concentration, perfect for winter poultry heat",
    body: "Helps maintain body temperature of broiler birds during chilly weather. Will order monthly.",
    isVerified: true,
    status: "approved",
    date: "22 Oct 2026, 15:40",
  },
];

const statusStyles: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

export default function ReviewsPage() {
  const [reviews, setReviews] = React.useState<ReviewItem[]>(initialReviews);
  const [activeTab, setActiveTab] = React.useState("all");

  const filteredReviews = React.useMemo(() => {
    return reviews.filter((r) => {
      if (activeTab === "pending" && r.status !== "pending") return false;
      if (activeTab === "approved" && r.status !== "approved") return false;
      if (activeTab === "rejected" && r.status !== "rejected") return false;
      return true;
    });
  }, [reviews, activeTab]);

  const handleBulkStatusChange = (
    selected: ReviewItem[],
    newStatus: ReviewItem["status"],
    clearSelection: () => void
  ) => {
    const ids = new Set(selected.map((s) => s.id));
    setReviews((prev) =>
      prev.map((r) => (ids.has(r.id) ? { ...r, status: newStatus } : r))
    );
    clearSelection();
  };

  const handleExportCSV = (selected: ReviewItem[]) => {
    const list = selected.length > 0 ? selected : filteredReviews;
    const headers = ["ReviewID", "Product", "Customer", "Rating", "Title", "Verified", "Status", "Date"];
    const rows = list.map((r) => [
      r.id,
      `"${r.product}"`,
      `"${r.customer}"`,
      r.rating,
      `"${r.title}"`,
      r.isVerified,
      r.status,
      formatDate(r.date),
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
        <span className="font-semibold text-xs text-foreground line-clamp-1 max-w-[170px]" title={row.getValue("product")}>
          {row.getValue("product")}
        </span>
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
                  onClick={() =>
                    setReviews((prev) =>
                      prev.map((item) => (item.id === r.id ? { ...item, status: "approved" } : item))
                    )
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Approve Review
                </DropdownMenuItem>
              )}
              {r.status !== "rejected" && (
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onClick={() =>
                    setReviews((prev) =>
                      prev.map((item) => (item.id === r.id ? { ...item, status: "rejected" } : item))
                    )
                  }
                >
                  <XCircle className="h-3.5 w-3.5 mr-2" /> Reject as Spam
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setReviews((prev) => prev.filter((item) => item.id !== r.id))}
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
  ], []);

  const pendingCount = reviews.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Reviews</h1>
          <p className="text-muted-foreground text-sm">
            Moderate verified buyer feedback, ratings distribution, and product satisfaction
          </p>
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
            <p className="text-2xl font-bold mt-1 text-foreground">4.85 / 5.0</p>
            <p className="text-xs text-muted-foreground mt-0.5">Based on 128 verified reviews</p>
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
            <p className="text-2xl font-bold mt-1 text-foreground">{pendingCount}</p>
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
            <p className="text-2xl font-bold mt-1 text-foreground">94.5%</p>
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
            <p className="text-2xl font-bold mt-1 text-foreground">98.2%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Would recommend to other farms</p>
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
              Pending <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[10px]">{pendingCount}</span>
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">
              Rejected
            </TabsTrigger>
          </TabsList>

          <DataTable
            columns={reviewColumns}
            data={filteredReviews}
            searchPlaceholder="Search reviews, customer or product..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={5}
            pageSizeOptions={[5, 10, 20]}
            bulkActions={(selected, clearSelection) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background text-emerald-700 dark:text-emerald-400"
                  onClick={() => handleBulkStatusChange(selected, "approved", clearSelection)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Approve Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background text-rose-700 dark:text-rose-400"
                  onClick={() => handleBulkStatusChange(selected, "rejected", clearSelection)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Reject Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background"
                  onClick={() => handleExportCSV(selected)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export CSV
                </Button>
              </>
            )}
            emptyMessage="No reviews found matching your search or filters."
          />
        </Tabs>
      </motion.div>
    </div>
  );
}
