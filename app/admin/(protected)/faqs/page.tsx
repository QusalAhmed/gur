"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  MessageSquare,
  HelpCircle,
  CheckCircle2,
  MoreHorizontal,
  RefreshCw,
  Loader2,
  Trash2,
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
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminFaqsAction,
  createFaqAction,
  deleteFaqAction,
  FaqItem,
} from "@/actions/faqs";

export default function FaqsPage() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newQuestion, setNewQuestion] = React.useState("");
  const [newQuestionBn, setNewQuestionBn] = React.useState("");
  const [newAnswer, setNewAnswer] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("Quality & Testing");

  const { data: faqsRes, isLoading, refetch } = useQuery({
    queryKey: ["admin", "faqs"],
    queryFn: getAdminFaqsAction,
  });

  const faqs = faqsRes?.data || [];

  const createMutation = useMutation({
    mutationFn: createFaqAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("FAQ published successfully");
        queryClient.invalidateQueries({ queryKey: ["admin", "faqs"] });
        setIsCreateOpen(false);
        setNewQuestion("");
        setNewQuestionBn("");
        setNewAnswer("");
      } else {
        toast.error(res.error || "Failed to create FAQ");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create FAQ");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFaqAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("FAQ removed");
        queryClient.invalidateQueries({ queryKey: ["admin", "faqs"] });
      } else {
        toast.error(res.error || "Failed to delete FAQ");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete FAQ");
    },
  });

  const filteredFaqs = React.useMemo(() => {
    if (categoryFilter === "all") return faqs;
    return faqs.filter((f) => f.category.toLowerCase().includes(categoryFilter.toLowerCase()));
  }, [faqs, categoryFilter]);

  const bilingualCount = faqs.filter((f) => Boolean(f.questionBn && f.questionBn.trim())).length;
  const categoriesCount = new Set(faqs.map((f) => f.category)).size;

  const handleCreateFaq = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("Please provide both English question and answer");
      return;
    }
    createMutation.mutate({
      question: newQuestion,
      questionBn: newQuestionBn,
      answer: newAnswer,
      category: newCategory,
      displayOrder: faqs.length + 1,
    });
  };

  const columns: ColumnDef<FaqItem>[] = React.useMemo(
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
              {f.questionBn && (
                <p className="text-xs text-muted-foreground font-bangla mt-0.5">{f.questionBn}</p>
              )}
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
          <span className="text-xs text-muted-foreground max-w-md line-clamp-2 block" title={row.getValue("answer")}>
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
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs capitalize">
            {row.getValue("status")}
          </Badge>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const f = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => deleteMutation.mutate(f.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [deleteMutation]
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
            onClick={() => refetch()}
            className="h-9 cursor-pointer"
            title="Refresh FAQs"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white h-9 cursor-pointer"
            onClick={() => setIsCreateOpen(true)}
          >
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
            <p className="text-2xl font-bold mt-2">{faqs.length} FAQs</p>
            <p className="text-xs text-muted-foreground mt-1">Across {categoriesCount} distinct topic categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Bilingual Coverage</p>
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">
              {faqs.length > 0 ? `${((bilingualCount / faqs.length) * 100).toFixed(0)}%` : "0%"}
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-1">English and Bangla translations</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Knowledge Base Status</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">{faqs.length > 0 ? "Active" : "Empty"}</p>
            <p className="text-xs text-muted-foreground mt-1">Directly connected to PostgreSQL DB</p>
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
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredFaqs}
              searchPlaceholder="Search question or keyword..."
              enableRowSelection
              enableSorting
              enablePagination
              initialPageSize={10}
              pageSizeOptions={[5, 10, 20]}
              emptyMessage="No FAQs found in database."
            />
          )}
        </Card>
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Frequently Asked Question</DialogTitle>
            <DialogDescription>
              Create a new help center article for customer inquiries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold">Category Topic</label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Quality & Testing"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Question (English)</label>
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g. What is the Brix value of your molasses?"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Question (Bangla - Optional)</label>
              <Input
                value={newQuestionBn}
                onChange={(e) => setNewQuestionBn(e.target.value)}
                placeholder="e.g. আপনাদের মোলাসেসের ব্রিক্স মাত্রা কত?"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Answer Explanation</label>
              <Textarea
                rows={3}
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Detailed answer explanation..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleCreateFaq}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Publish FAQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
