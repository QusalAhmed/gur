"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, FileText, Eye, CheckCircle2, Clock, MoreHorizontal, Database, RefreshCw } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { fetchPostsFromDb } from "@/lib/supabase";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Post {
  id: string;
  title: string;
  titleBn: string;
  slug: string;
  category: string;
  author: string;
  views: number;
  status: "published" | "draft" | "archived";
  publishedDate: string;
  tags: string[];
}

const posts: Post[] = [
  {
    id: "PST-001",
    title: "Why Blackstrap Molasses is the Ultimate Energy Supplement for Dairy Cattle",
    titleBn: "ডেইরি গাভীর শক্তির ঘাটতি পূরণে কেন ব্ল্যাকস্ট্র্যাপ মোলাসেস সেরা",
    slug: "blackstrap-molasses-dairy-cattle-energy",
    category: "Livestock & Feed",
    author: "Dr. Farhana Yasmin",
    views: 3420,
    status: "published",
    publishedDate: "14 Oct 2026",
    tags: ["Dairy", "Cattle Feed", "Brix 80", "Nutrition"],
  },
  {
    id: "PST-002",
    title: "Authentic Jashore Nolen Gur: Traditional Harvesting vs Industrial Adulteration",
    titleBn: "যশোরের খাঁটি নলেন গুড় চেনার উপায় ও ভেজালমুক্তির আধুনিক পরীক্ষা",
    slug: "authentic-jashore-nolen-gur-guide",
    category: "Organic Farming",
    author: "Alhaj Anisur Rahman",
    views: 8940,
    status: "published",
    publishedDate: "2 Oct 2026",
    tags: ["Khejur Gur", "Organic", "Winter Special", "Purity Test"],
  },
  {
    id: "PST-003",
    title: "How to Measure Molasses Brix Using an Optical Refractometer",
    titleBn: "রিফ্র্যাক্টোমিটার দিয়ে সহজে মোলাসেসের ব্রিক্স মাত্রা নির্ণয়",
    slug: "how-to-measure-molasses-brix",
    category: "Quality & Testing",
    author: "Engr. Shamsul Alam",
    views: 1820,
    status: "published",
    publishedDate: "22 Sep 2026",
    tags: ["Lab Guide", "Brix", "Quality Assurance"],
  },
  {
    id: "PST-004",
    title: "Molasses as an Organic Soil Conditioner & Microbial Accelerator in Bangladesh",
    titleBn: "জৈব কৃষিতে মাটির অনুজীব বাড়াতে মোলাসেসের বৈজ্ঞানিক ব্যবহার",
    slug: "molasses-organic-soil-conditioner",
    category: "Agriculture",
    author: "Tariqul Islam",
    views: 2150,
    status: "published",
    publishedDate: "10 Sep 2026",
    tags: ["Organic Farming", "Bio-Fertilizer", "Soil Health"],
  },
  {
    id: "PST-005",
    title: "Commercial Distilleries: Optimizing Fermentation Yield with Sugarcane Molasses",
    titleBn: "বাণিজ্যিক ডিস্টিলারি উৎপাদনে সুগারকেন মোলাসেস ব্যবহারের প্রযুক্তি",
    slug: "distillery-fermentation-yield-optimization",
    category: "Industrial By-Products",
    author: "Dr. Parvez Mahmud",
    views: 0,
    status: "draft",
    publishedDate: "–",
    tags: ["Distillery", "Bio-Ethanol", "Industrial"],
  },
];

const statusStyles: Record<string, string> = {
  published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  archived: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function BlogPostsPage() {
  const [postList, setPostList] = React.useState<Post[]>(posts);
  const [tabFilter, setTabFilter] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);
  const [isDbConnected, setIsDbConnected] = React.useState(false);

  const loadPosts = React.useCallback(async () => {
    setLoading(true);
    try {
      const dbPosts = await fetchPostsFromDb();
      if (dbPosts && dbPosts.length > 0) {
        setPostList(dbPosts);
        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
      }
    } catch (e) {
      console.warn("Failed to load posts from Supabase:", e);
      setIsDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filteredPosts = React.useMemo(() => {
    if (tabFilter === "all") return postList;
    return postList.filter((p) => p.status === tabFilter);
  }, [postList, tabFilter]);

  const columns: ColumnDef<Post>[] = React.useMemo(
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
              <p className="text-xs text-muted-foreground font-bangla line-clamp-1 mt-0.5">{p.titleBn}</p>
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
        accessorKey: "views",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Reads" />
        ),
        cell: ({ row }) => {
          const views = row.getValue("views") as number;
          return (
            <span className="text-xs font-mono">
              {views > 0 ? views.toLocaleString() : "–"}
            </span>
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
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit Content</DropdownMenuItem>
              <DropdownMenuItem>View on Live Blog</DropdownMenuItem>
              <DropdownMenuItem>SEO Settings</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Unpublish</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
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
          <h1 className="text-2xl font-bold tracking-tight">Articles & Industry Insights</h1>
          <p className="text-muted-foreground text-sm">
            Publish educational content on feed nutrition, artisanal gur authenticity, and technical manuals
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPosts}
            disabled={loading}
            className="h-9 cursor-pointer"
            title="Refresh articles"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-9 cursor-pointer">
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
              <p className="text-sm font-medium text-muted-foreground">Published Articles</p>
              <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">18 Live</p>
            <p className="text-xs text-muted-foreground mt-1">Bilingual (English & Bangla)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Drafts in Progress</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">4 Drafts</p>
            <p className="text-xs text-muted-foreground mt-1">Written by agronomists & staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Article Views</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Eye className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">48,250</p>
            <p className="text-xs text-green-600 font-medium mt-1">+24% organic Google search traffic</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Top Performing</p>
              <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold mt-2 truncate">Jashore Nolen Gur</p>
            <p className="text-xs text-muted-foreground mt-1">8,940 reads this season</p>
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
            <TabsTrigger value="all">All Articles</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4">
          <DataTable
            columns={columns}
            data={filteredPosts}
            searchKey="title"
            searchPlaceholder="Search article title or tags..."
            enableRowSelection
            enableColumnVisibility
            enableSorting
            enablePagination
            pageSize={10}
          />
        </Card>
      </motion.div>
    </div>
  );
}
