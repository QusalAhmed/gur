"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  Layers,
  FolderTree,
  Package,
  MoreHorizontal,
  Download,
  Trash2,
  Edit,
  RefreshCw,
  Search,
  X,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  UiCategoryItem,
  fetchCategoriesFromDb,
  updateCategoryInDb,
  deleteCategorySafe,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { ToastNotificationPortal, ToastData } from "@/components/ui/toast-notification";
import { CategoryFormDialog } from "@/components/admin/category-form-dialog";

export function CategoriesClient() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [toast, setToast] = React.useState<ToastData | null>(null);

  // Modal Dialog States
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<UiCategoryItem | null>(null);
  const [prefilledParentId, setPrefilledParentId] = React.useState<string | null>(null);

  // Deletion Dialog State
  const [categoryToDelete, setCategoryToDelete] = React.useState<UiCategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // TanStack Query for Categories
  const {
    data: categories = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: fetchCategoriesFromDb,
  });

  // Safe Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteCategorySafe(id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "categories-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setToast({
        type: res.archived ? "warning" : "success",
        title: res.archived ? "Category Deactivated" : "Category Deleted",
        message: res.message,
      });
      setCategoryToDelete(null);
    },
    onError: (err: any) => {
      setToast({
        type: "destructive",
        title: "Deletion Error",
        message: err?.message || "Failed to delete category.",
      });
      setCategoryToDelete(null);
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  // Status Toggle Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await updateCategoryInDb(id, { is_active: isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "categories-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setToast({
        type: "success",
        title: "Status Updated",
        message: "Category status updated successfully.",
      });
    },
    onError: (err: any) => {
      setToast({
        type: "destructive",
        title: "Update Failed",
        message: err?.message || "Failed to update category status.",
      });
    },
  });

  // Filter Categories
  const filteredCategories = React.useMemo(() => {
    return categories.filter((c) => {
      if (activeTab === "active" && !c.isActive) return false;
      if (activeTab === "draft" && c.isActive) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesNameBn = c.nameBn?.toLowerCase().includes(query);
        const matchesSlug = c.slug.toLowerCase().includes(query);
        const matchesParent = c.parent.toLowerCase().includes(query);
        if (!matchesName && !matchesNameBn && !matchesSlug && !matchesParent) {
          return false;
        }
      }
      return true;
    });
  }, [categories, activeTab, searchQuery]);

  // Bulk Operations
  const handleBulkStatusChange = async (
    selected: UiCategoryItem[],
    isActive: boolean,
    clearSelection: () => void
  ) => {
    try {
      await Promise.all(
        selected.map((item) => updateCategoryInDb(item.id, { is_active: isActive }))
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "categories-list"] });
      clearSelection();
      setToast({
        type: "success",
        title: "Bulk Status Updated",
        message: `Updated ${selected.length} categories to ${isActive ? "Active" : "Draft"}.`,
      });
    } catch (err: any) {
      setToast({
        type: "destructive",
        title: "Bulk Update Failed",
        message: err?.message || "Failed to update some categories.",
      });
    }
  };

  const handleBulkDelete = async (
    selected: UiCategoryItem[],
    clearSelection: () => void
  ) => {
    try {
      let deactivated = 0;
      let deleted = 0;
      for (const item of selected) {
        const res = await deleteCategorySafe(item.id);
        if (res.archived) deactivated++;
        else deleted++;
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "categories-list"] });
      clearSelection();
      setToast({
        type: "success",
        title: "Bulk Deletion Completed",
        message: `Deleted ${deleted} categories. Safely deactivated ${deactivated} categories with products.`,
      });
    } catch (err: any) {
      setToast({
        type: "destructive",
        title: "Bulk Delete Failed",
        message: err?.message || "Failed to delete some categories.",
      });
    }
  };

  const handleExportCSV = (selected: UiCategoryItem[]) => {
    const list = selected.length > 0 ? selected : filteredCategories;
    const headers = [
      "ID",
      "Name",
      "Name_BN",
      "Slug",
      "Parent",
      "Products_Count",
      "Sort_Order",
      "Status",
    ];
    const rows = list.map((c) => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.nameBn || "").replace(/"/g, '""')}"`,
      c.slug,
      `"${c.parent.replace(/"/g, '""')}"`,
      c.productsCount,
      c.displayOrder,
      c.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `categories_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TanStack Table Column Definitions
  const columns = React.useMemo<ColumnDef<UiCategoryItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all categories"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select category row"
            className="translate-y-[2px]"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Category Name & Slug" />
        ),
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3 min-w-[220px]">
              {/* Image Thumbnail from Storage or Fallback */}
              <div className="h-10 w-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
                  />
                ) : (
                  <div className="h-full w-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <FolderTree className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(c);
                    setPrefilledParentId(null);
                    setDialogOpen(true);
                  }}
                  className="font-semibold text-sm text-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left"
                >
                  {c.name}
                </button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-bangla">{c.nameBn || "–"}</span>
                  <span className="text-[10px] text-muted-foreground/50">•</span>
                  <span className="font-mono text-[11px] text-muted-foreground/80">/{c.slug}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "parent",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Parent Hierarchy" />
        ),
        cell: ({ row }) => {
          const parent = String(row.getValue("parent"));
          return parent === "None (Top Level)" ? (
            <span className="text-xs text-muted-foreground font-medium">Top Level</span>
          ) : (
            <Badge variant="outline" className="text-xs font-normal">
              {parent}
            </Badge>
          );
        },
      },
      {
        accessorKey: "productsCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Products" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{row.getValue("productsCount")} items</span>
          </div>
        ),
      },
      {
        accessorKey: "displayOrder",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order #" />,
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            #{row.getValue("displayOrder")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const isActive = row.original.isActive;
          return (
            <Badge
              variant="secondary"
              className={
                isActive
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 capitalize text-[11px] border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400 capitalize text-[11px] border-amber-500/30"
              }
            >
              {isActive ? "Active" : "Draft"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  id={`category-actions-${c.slug}`}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted cursor-pointer"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedCategory(c);
                    setPrefilledParentId(null);
                    setDialogOpen(true);
                  }}
                >
                  <Edit className="h-3.5 w-3.5 mr-2 text-amber-600" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedCategory(null);
                    setPrefilledParentId(c.id);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-2 text-amber-600" /> Add Subcategory
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    statusMutation.mutate({
                      id: c.id,
                      isActive: !c.isActive,
                    })
                  }
                >
                  {c.isActive ? "Set as Draft" : "Activate"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setCategoryToDelete(c)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Category
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [statusMutation]
  );

  // Statistics
  const totalCount = categories.length;
  const activeCount = categories.filter((c) => c.isActive).length;
  const draftCount = categories.filter((c) => !c.isActive).length;
  const totalProductsMapped = categories.reduce((acc, c) => acc + c.productsCount, 0);

  return (
    <div className="space-y-6">
      <ToastNotificationPortal toast={toast} onDismiss={() => setToast(null)} />

      {/* Category Create/Edit Modal Dialog */}
      <CategoryFormDialog
        key={dialogOpen ? `${selectedCategory?.id || "create"}-${prefilledParentId || "none"}` : "closed"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={selectedCategory}
        parentCategories={categories}
        prefilledParentId={prefilledParentId}
        onSuccess={(msg) =>
          setToast({
            type: "success",
            title: "Success",
            message: msg,
          })
        }
        onError={(err) =>
          setToast({
            type: "destructive",
            title: "Error",
            message: err,
          })
        }
      />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Organize catalog taxonomy, bilingual labels, Supabase media, and navigation hierarchy.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 cursor-pointer"
            title="Refresh categories"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCSV([])}
            className="h-9 cursor-pointer"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            id="add-category-btn"
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
            onClick={() => {
              setSelectedCategory(null);
              setPrefilledParentId(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </motion.div>

      {/* KPI Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">
                Total Categories
              </p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Top-level & subcategories</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">
                Catalog Items Mapped
              </p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {totalProductsMapped} Products
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Live database mapping</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">
                Active Categories
              </p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <FolderTree className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Live on storefront navigation</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* TanStack Table View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList className="bg-muted/60 p-1">
              <TabsTrigger value="all" className="text-xs">
                All{" "}
                <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">
                  {totalCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs">
                Active{" "}
                <span className="ml-1.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[10px]">
                  {activeCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs">
                Draft{" "}
                <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">
                  {draftCount}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search category name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredCategories}
            enableRowSelection={true}
            searchKey="name"
            searchPlaceholder="Filter categories..."
            initialPageSize={10}
            pageSizeOptions={[5, 10, 20]}
            bulkActions={(selectedRows: UiCategoryItem[], clearSelection: () => void) => (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {selectedRows.length} selected
                </span>
                <div className="h-3 w-px bg-amber-500/30 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-amber-500/20"
                  onClick={() => handleBulkStatusChange(selectedRows, true, clearSelection)}
                >
                  Set Active
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-amber-500/20"
                  onClick={() => handleBulkStatusChange(selectedRows, false, clearSelection)}
                >
                  Set Draft
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-amber-500/20 text-destructive"
                  onClick={() => handleBulkDelete(selectedRows, clearSelection)}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-amber-500/20"
                  onClick={() => handleExportCSV(selectedRows)}
                >
                  Export
                </Button>
              </div>
            )}
            emptyMessage="No categories match your search criteria."
          />
        </Tabs>
      </motion.div>

      {/* Safe Delete Confirmation Dialog */}
      <Dialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Confirm Category Deletion</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{categoryToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
            <p className="font-semibold text-foreground mb-1">Catalog Integrity Protection:</p>
            If products currently belong to this category, the category will be safely{" "}
            <strong>deactivated (draft)</strong> instead of deleted to protect storefront
            organization and product relations.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setCategoryToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                if (categoryToDelete) {
                  setIsDeleting(true);
                  deleteMutation.mutate(categoryToDelete.id);
                }
              }}
              className="cursor-pointer"
            >
              {isDeleting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
