"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Plus, MessageSquare, HelpCircle, CheckCircle2, ArrowUpDown, MoreHorizontal, Database, RefreshCw } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { fetchFaqsFromDb } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Faq {
  id: string;
  category: string;
  question: string;
  questionBn: string;
  answer: string;
  displayOrder: number;
  status: string;
}

const faqs: Faq[] = [
  {
    id: "FAQ-001",
    category: "Quality & Testing",
    question: "What is the Brix value of your blackstrap molasses and how is it tested?",
    questionBn: "আপনাদের ব্ল্যাকস্ট্র্যাপ মোলাসেসের ব্রিক্স মাত্রা কত এবং এটি কিভাবে পরীক্ষা করা হয়?",
    answer: "Our industrial and feed-grade blackstrap molasses carries a guaranteed minimum of 79.5° to 82.5° Brix. Every lot comes with a laboratory Certificate of Analysis (COA) tested using calibrated optical refractometers.",
    displayOrder: 1,
    status: "active",
  },
  {
    id: "FAQ-002",
    category: "Bulk Commercial Orders",
    question: "Can you supply bulk quantities via road tanker trucks to regional dairy mills?",
    questionBn: "আপনারা কি ডেইরি ও ফিড মিলের জন্য সরাসরি ট্যাঙ্কার ট্রাকে মোলাসেস সরবরাহ করেন?",
    answer: "Yes, we dispatch 10-ton to 20-ton road tanker trucks directly from our sugar mill depots in Rajshahi and Chuadanga with same-week scheduled delivery nationwide.",
    displayOrder: 2,
    status: "active",
  },
  {
    id: "FAQ-003",
    category: "Organic Date Palm Gur",
    question: "Is your Jashore Nolen Gur 100% free from sugar and artificial chemicals?",
    questionBn: "আপনাদের যশোরের নলেন গুড় কি সম্পূর্ণ চিনি ও হাইড্রোসমুক্ত?",
    answer: "Yes, our organic date palm molasses and Patali gur are collected directly from registered date palm farmers in Jashore without added white sugar, chemical bleaching agents (hydros), or preservatives.",
    displayOrder: 3,
    status: "active",
  },
  {
    id: "FAQ-004",
    category: "Payments & Terms",
    question: "What credit terms are available for registered B2B corporations and feed mills?",
    questionBn: "রেজিস্টার্ড বি২বি কোম্পানি ও ফিড মিলের জন্য কি বাকিতে বা ক্রেডিট সুবিধা আছে?",
    answer: "Verified corporations with valid Trade License and BIN can apply for Net-15, Net-30, or Net-45 credit terms with credit limits up to ৳ 3,000,000 upon KYC approval.",
    displayOrder: 4,
    status: "active",
  },
  {
    id: "FAQ-005",
    category: "Shipping & Delivery",
    question: "How are 200L steel drums and 1-ton IBC totes transported to customer warehouses?",
    questionBn: "২০০ লিটার ড্রাম এবং ১ টন আইবিসি টোট কিভাবে গ্রাহকের গুদামে পৌঁছানো হয়?",
    answer: "We utilize dedicated 3-ton to 5-ton hydraulic tail-lift freight trucks ensuring zero spill risk and safe pallet offloading directly into client storage depots.",
    displayOrder: 5,
    status: "active",
  },
];

export default function FaqsPage() {
  const [faqList, setFaqList] = React.useState<Faq[]>(faqs);
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);
  const [isDbConnected, setIsDbConnected] = React.useState(false);

  const loadFaqs = React.useCallback(async () => {
    setLoading(true);
    try {
      const dbFaqs = await fetchFaqsFromDb();
      if (dbFaqs && dbFaqs.length > 0) {
        setFaqList(dbFaqs);
        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
      }
    } catch (e) {
      console.warn("Failed to load FAQs from Supabase:", e);
      setIsDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const filteredFaqs = React.useMemo(() => {
    if (categoryFilter === "all") return faqList;
    return faqList.filter((f) => f.category.toLowerCase().includes(categoryFilter.toLowerCase()));
  }, [faqList, categoryFilter]);

  const columns: ColumnDef<Faq>[] = React.useMemo(
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
        accessorKey: "displayOrder",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            #{row.getValue("displayOrder")}
          </span>
        ),
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
        accessorKey: "question",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Question (EN & BN)" />
        ),
        cell: ({ row }) => {
          const f = row.original;
          return (
            <div className="max-w-xs">
              <p className="font-semibold text-sm">{f.question}</p>
              <p className="text-xs text-muted-foreground font-bangla mt-0.5">{f.questionBn}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "answer",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Answer Summary" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground max-w-md line-clamp-2 block">
            {row.getValue("answer")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs capitalize">
            {row.getValue("status")}
          </Badge>
        ),
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
              <DropdownMenuItem>Edit FAQ</DropdownMenuItem>
              <DropdownMenuItem>Move Up</DropdownMenuItem>
              <DropdownMenuItem>Move Down</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
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
          <h1 className="text-2xl font-bold tracking-tight">Frequently Asked Questions (FAQs)</h1>
          <p className="text-muted-foreground text-sm">
            Manage customer help center questions, bilingual explanations, and category groupings
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadFaqs}
            disabled={loading}
            className="h-9 cursor-pointer"
            title="Refresh FAQs"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-9 cursor-pointer">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Reorder
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-9 cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Add FAQ
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Questions</p>
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <HelpCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">15 FAQs</p>
            <p className="text-xs text-muted-foreground mt-1">Across 5 distinct topic categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Bilingual Coverage</p>
              <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">100%</p>
            <p className="text-xs text-green-600 font-medium mt-1">English and Bangla translations</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Most Read Category</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">Bulk Logistics</p>
            <p className="text-xs text-muted-foreground mt-1">Drum & tanker transport inquiries</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search and Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || "all")}>
            <SelectTrigger className="w-56 h-9">
              <SelectValue placeholder="Category filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="quality">Quality & Testing</SelectItem>
              <SelectItem value="bulk">Bulk Commercial</SelectItem>
              <SelectItem value="organic">Organic Date Palm</SelectItem>
              <SelectItem value="payments">Payments & Terms</SelectItem>
              <SelectItem value="shipping">Shipping & Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="p-4">
          <DataTable
            columns={columns}
            data={filteredFaqs}
            searchKey="question"
            searchPlaceholder="Search question or keyword..."
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
