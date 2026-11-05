"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, FileText, CheckCircle2, Clock, MoreHorizontal, RefreshCw, Loader2, Trash2 } from "lucide-react";
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
  getAdminPostsAction,
  updatePostStatusAction,
  deletePostAction,
  PostItem,
} from "@/actions/posts";

const statusStyles: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  archived: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function BlogPostsPage() {
  const queryClient = useQueryClient();
  const [tabFilter, setTabFilter] = React.useState<string>("all");

  const { data: postsRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "posts"],
    queryFn: getAdminPostsAction,
  });

  const posts = postsRes?.data || [];

  const updateStatusMutation = useMutation({
    mutationFn: updatePostStatusAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Post status updated");
        queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      } else {
        toast.error(res.error || "Failed to update status");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePostAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Post deleted");
        queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      } else {
        toast.error(res.error || "Failed to delete post");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete post");
    },
  });

  const filteredPosts = React.useMemo(() => {
    if (tabFilter === "all") return posts;
    return posts.filter((p) => p.status === tabFilter);
  }, [posts, tabFilter]);

  const publishedCount = posts.filter((p) => p.status === "published").length;
  const draftCount = posts.filter((p) => p.status === "draft").length;
  const archivedCount = posts.filter((p) => p.status === "archived").length;

  const columns: ColumnDef<PostItem>[] = React.useMemo(
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
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Article Title (EN & BN)" />
        ),
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="max-w-md">
              <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
              {p.titleBn && (
                <p className="text-xs text-muted-foreground font-bangla line-clamp-1 mt-0.5">{p.titleBn}</p>
              )}
              <p className="font-mono text-[10px] text-amber-700 dark:text-amber-400 mt-1">/{p.slug}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "category",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Category" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.getValue("category")}
          </Badge>
        ),
      },
      {
        accessorKey: "author",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Author" />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.getValue("author")}</span>
        ),
      },
      {
        accessorKey: "tags",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tags" />
        ),
        cell: ({ row }) => {
          const tags = row.original.tags;
          return (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: "publishedDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{formatDate(row.getValue("publishedDate"))}</span>
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
          const p = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {p.status !== "published" && (
                  <DropdownMenuItem
                    className="text-emerald-600 focus:text-emerald-600 font-medium"
                    onClick={() => updateStatusMutation.mutate({ id: p.id, status: "published" })}
                  >
                    Publish Post
                  </DropdownMenuItem>
                )}
                {p.status !== "draft" && (
                  <DropdownMenuItem
                    onClick={() => updateStatusMutation.mutate({ id: p.id, status: "draft" })}
                  >
                    Move to Draft
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onClick={() => deleteMutation.mutate(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
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
          <h1 className="text-2xl font-bold tracking-tight">Articles & Education Posts</h1>
          <p className="text-muted-foreground text-sm">
            Publish agronomy insights, animal feed guidelines, Brix research, and organic harvesting methods
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white h-9 cursor-pointer"
            onClick={() => toast.info("Post editor can be accessed from CMS actions")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Write Article
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Published Posts</p>
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{publishedCount} Live</p>
            <p className="text-xs text-muted-foreground mt-1">Live on storefront blog</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Drafts & In-Review</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{draftCount} In Prep</p>
            <p className="text-xs text-muted-foreground mt-1">Unpublished revisions</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Database Posts</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{posts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Managed via PostgreSQL</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Archived</p>
              <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{archivedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">De-indexed content</p>
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
            <TabsTrigger value="all">All Articles ({posts.length})</TabsTrigger>
            <TabsTrigger value="published">Published ({publishedCount})</TabsTrigger>
            <TabsTrigger value="draft">Drafts ({draftCount})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedCount})</TabsTrigger>
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
              data={filteredPosts}
              searchPlaceholder="Search article title or slug..."
              enableRowSelection
              enableSorting
              enablePagination
              initialPageSize={10}
              pageSizeOptions={[5, 10, 20]}
              emptyMessage="No posts found in database."
            />
          )}
        </Card>
      </motion.div>
    </div>
  );
}
