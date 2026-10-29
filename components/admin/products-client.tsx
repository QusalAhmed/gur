"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Plus,
  Filter,
  MoreHorizontal,
  Package2,
  Trash2,
  Archive,
  Download,
  Eye,
  Copy,
  Layers,
  Sparkles,
  Database,
  RefreshCw,
  Edit,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  UiProductItem,
  fetchProductsFromDb,
  fetchCategoriesList,
  updateProductInDb,
  deleteProductSafe,
  createProductInDb,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const statusStyle: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  draft: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  archived: "bg-destructive/15 text-destructive border-destructive/30",
};

const stockStyle: Record<string, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  low_stock: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  out_of_stock: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  backorder: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

export function ProductsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [stockFilter, setStockFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [toast, setToast] = React.useState<ToastData | null>(null);

  // Deletion Modal State
  const [productToDelete, setProductToDelete] = React.useState<UiProductItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // TanStack Query for Products
  const {
    data: products = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: fetchProductsFromDb,
  });

  // TanStack Query for Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories-list"],
    queryFn: fetchCategoriesList,
  });

  // Safe Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteProductSafe(id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-products"] });
      setToast({
        type: res.archived ? "warning" : "success",
        title: res.archived ? "Product Archived" : "Product Deleted",
        message: res.message,
      });
      setProductToDelete(null);
    },
    onError: (err: any) => {
      setToast({
        type: "destructive",
        title: "Delete Error",
        message: err?.message || "Failed to delete product.",
      });
      setProductToDelete(null);
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  // Status Update Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "draft" | "archived" }) => {
      return await updateProductInDb(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setToast({
        type: "success",
        title: "Status Updated",
        message: "Product status changed successfully.",
      });
    },
    onError: (err: any) => {
      setToast({
        type: "destructive",
        title: "Update Failed",
        message: err?.message || "Could not update product status.",
      });
    },
  });

  // Duplicate Product Mutation
  const duplicateMutation = useMutation({
    mutationFn: async (item: UiProductItem) => {
      const uniqueSlug = `${item.slug}-copy-${Date.now().toString().slice(-4)}`;
      return await createProductInDb({
        name: `${item.name} (Copy)`,
        nameBn: item.nameBn ? `${item.nameBn} (কপি)` : undefined,
        slug: uniqueSlug,
        category_id: item.categoryId || null,
        status: "draft",
        source: item.source || "sugarcane",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setToast({
        type: "success",
        title: "Product Duplicated",
        message: "A draft copy of the product was created successfully.",
      });
    },
    onError: (err: any) => {
      setToast({
        type: "destructive",
        title: "Duplicate Failed",
        message: err?.message || "Could not duplicate product.",
      });
    },
  });

  // Filter products by tab, category, stock, and search
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      if (activeTab !== "all" && p.status !== activeTab) return false;
      if (
        categoryFilter !== "all" &&
        p.category.toLowerCase() !== categoryFilter.toLowerCase() &&
        p.categoryId !== categoryFilter
      ) {
        return false;
      }
      if (stockFilter !== "all" && p.stock !== stockFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesNameBn = p.nameBn?.toLowerCase().includes(query);
        const matchesSlug = p.slug.toLowerCase().includes(query);
        const matchesCategory = p.category.toLowerCase().includes(query);
        if (!matchesName && !matchesNameBn && !matchesSlug && !matchesCategory) {
          return false;
        }
      }
      return true;
    });
  }, [products, activeTab, categoryFilter, stockFilter, searchQuery]);

  // Bulk Operations
  const handleBulkArchive = async (selected: UiProductItem[], clearSelection: () => void) => {
    try {
      await Promise.all(
        selected.map((item) => updateProductInDb(item.id, { status: "archived" }))
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      clearSelection();
      setToast({
        type: "success",
        title: "Bulk Archive Completed",
        message: `Successfully archived ${selected.length} products.`,
      });
    } catch (err: any) {
      setToast({
        type: "destructive",
        title: "Bulk Archive Failed",
        message: err?.message || "Failed to archive some products.",
      });
    }
  };

  const handleBulkStatusChange = async (
    selected: UiProductItem[],
    newStatus: "active" | "draft" | "archived",
    clearSelection: () => void
  ) => {
    try {
      await Promise.all(
        selected.map((item) => updateProductInDb(item.id, { status: newStatus }))
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      clearSelection();
      setToast({
        type: "success",
        title: "Bulk Status Updated",
        message: `Updated ${selected.length} products to "${newStatus}".`,
      });
    } catch (err: any) {
      setToast({
        type: "destructive",
        title: "Bulk Update Failed",
        message: err?.message || "Failed to update some products.",
      });
    }
  };

  const handleBulkDelete = async (selected: UiProductItem[], clearSelection: () => void) => {
    try {
      let archivedCount = 0;
      let deletedCount = 0;
      for (const item of selected) {
        const res = await deleteProductSafe(item.id);
        if (res.archived) archivedCount++;
        else deletedCount++;
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      clearSelection();
      setToast({
        type: "success",
        title: "Bulk Deletion Processed",
        message: `Deleted ${deletedCount} products. Safely archived ${archivedCount} products with orders.`,
      });
    } catch (err: any) {
      setToast({
        type: "destructive",
        title: "Bulk Delete Failed",
        message: err?.message || "Failed to delete some products.",
      });
    }
  };

  const handleExportCSV = (selected: UiProductItem[]) => {
    const dataToExport = selected.length > 0 ? selected : filteredProducts;
    const headers = [
      "ID",
      "Name",
      "Name_BN",
      "Slug",
      "Category",
      "Source",
      "Status",
      "Stock",
      "Variants",
      "Base_Price_BDT",
      "Rating",
    ];
    const rows = dataToExport.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.nameBn || "").replace(/"/g, '""')}"`,
      p.slug,
      p.category,
      p.source,
      p.status,
      p.stock,
      p.variants,
      p.basePrice || 0,
      p.rating,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TanStack Table Column Definitions
  const columns = React.useMemo<ColumnDef<UiProductItem>[]>(
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
            aria-label="Select all products"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select product row"
            className="translate-y-[2px]"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-3 min-w-[240px]">
              {/* Product Thumbnail from Supabase Storage / Fallback */}
              <div className="h-11 w-11 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
                  />
                ) : (
                  <div className="h-full w-full bg-amber-500/10 flex items-center justify-center">
                    <Package2 className="h-5 w-5 text-amber-600" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/admin/products/${p.id}/edit`}
                    className="font-semibold text-sm text-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors line-clamp-1"
                  >
                    {p.name}
                  </Link>
                  {p.featured && (
                    <Badge className="h-4 px-1 text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium border-0 shadow-xs">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Featured
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-bangla">{p.nameBn || "–"}</span>
                  <span className="text-[10px] text-muted-foreground/50">•</span>
                  <span className="font-mono text-[11px] text-muted-foreground/80">/{p.slug}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "category",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="font-medium text-xs">
            {row.getValue("category")}
          </Badge>
        ),
      },
      {
        accessorKey: "source",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
        cell: ({ row }) => {
          const source = String(row.getValue("source")).replace("_", " ");
          return <span className="capitalize text-xs text-muted-foreground">{source}</span>;
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${
                statusStyle[status] || "bg-muted text-muted-foreground"
              }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: "stock",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
        cell: ({ row }) => {
          const stock = row.original.stock;
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                stockStyle[stock] || "bg-muted text-muted-foreground"
              }`}
            >
              {stock.replace("_", " ")}
            </span>
          );
        },
      },
      {
        accessorKey: "variants",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Variants" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <Layers className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span>{row.getValue("variants")} packs</span>
          </div>
        ),
      },
      {
        accessorKey: "basePrice",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Base Price" />,
        cell: ({ row }) => {
          const price = row.original.basePrice;
          return (
            <span className="font-semibold text-sm text-foreground">
              ৳{price ? Number(price).toLocaleString() : "0"}
            </span>
          );
        },
      },
      {
        accessorKey: "rating",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
        cell: ({ row }) => {
          const rating = row.original.rating;
          const reviews = row.original.reviews;
          return rating > 0 ? (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              ★ {rating} <span className="text-muted-foreground font-normal">({reviews})</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">–</span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open product menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.push(`/admin/products/${p.id}/edit`)}>
                  <Edit className="h-3.5 w-3.5 mr-2 text-amber-600" /> Edit Product
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/admin/products/${p.id}/edit?tab=variants`)}>
                  <Layers className="h-3.5 w-3.5 mr-2" /> Manage Variants
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateMutation.mutate(p)}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    statusMutation.mutate({
                      id: p.id,
                      status: p.status === "archived" ? "active" : "archived",
                    })
                  }
                >
                  <Archive className="h-3.5 w-3.5 mr-2" />
                  {p.status === "archived" ? "Unarchive" : "Archive"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setProductToDelete(p)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Product
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [duplicateMutation, statusMutation]
  );

  // Statistics counters
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.status === "active").length;
  const draftCount = products.filter((p) => p.status === "draft").length;
  const archivedCount = products.filter((p) => p.status === "archived").length;
  const lowStockCount = products.filter(
    (p) => p.stock === "low_stock" || p.stock === "out_of_stock"
  ).length;

  return (
    <div className="space-y-6">
      <ToastNotificationPortal toast={toast} onDismiss={() => setToast(null)} />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products Catalog</h1>
          <p className="text-muted-foreground text-sm">
            Manage catalog items, packaging variants, pricing tiers, and Supabase media storage.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 cursor-pointer"
            title="Refresh products list"
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
            size="sm"
            asChild
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
          >
            <Link href="/admin/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* KPI Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: "Total Products", value: totalCount },
          { label: "Active in Store", value: activeCount },
          { label: "Drafts / In Review", value: draftCount },
          { label: "Low / Out of Stock", value: lowStockCount },
        ].map((s, i) => (
          <Card key={i} className="border shadow-xs">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase font-medium text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* TanStack Data Table View */}
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
              <TabsTrigger value="archived" className="text-xs">
                Archived{" "}
                <span className="ml-1.5 rounded-full bg-destructive/20 text-destructive px-1.5 py-0.2 text-[10px]">
                  {archivedCount}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Filters & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-48 sm:w-64">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search products..."
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

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || "all")}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Stock Filter */}
              <Select value={stockFilter} onValueChange={(val) => setStockFilter(val || "all")}>
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  <SelectItem value="backorder">Backorder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredProducts}
            enableRowSelection={true}
            searchKey="name"
            searchPlaceholder="Filter products..."
            bulkActions={(selectedRows: UiProductItem[], clearSelection: () => void) => (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {selectedRows.length} selected
                </span>
                <div className="h-3 w-px bg-amber-500/30 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-amber-500/20"
                  onClick={() => handleBulkStatusChange(selectedRows, "active", clearSelection)}
                >
                  Set Active
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-amber-500/20"
                  onClick={() => handleBulkStatusChange(selectedRows, "draft", clearSelection)}
                >
                  Set Draft
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-amber-500/20"
                  onClick={() => handleBulkArchive(selectedRows, clearSelection)}
                >
                  Archive
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
          />
        </Tabs>
      </motion.div>

      {/* Safe Delete Confirmation Dialog */}
      <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Confirm Product Deletion</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{productToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
            <p className="font-semibold text-foreground mb-1">Data Safety Note:</p>
            If this product is associated with existing customer orders or inventory batches, the
            system will automatically and safely <strong>archive</strong> it instead of deleting it,
            preserving invoice history and accounting accuracy.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setProductToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                if (productToDelete) {
                  setIsDeleting(true);
                  deleteMutation.mutate(productToDelete.id);
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
