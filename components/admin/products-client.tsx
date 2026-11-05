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
  Share2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductVariantsFlow } from "@/components/admin/product-variants-flow";
import { MetaCatalogManager } from "@/components/admin/meta-catalog-manager";
import { syncSingleProductToMetaCatalogAction } from "@/actions/meta-catalog";
import { updateProductStatusAction } from "@/actions/products";
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
import { toast } from "sonner";

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

  // Product Row Expansion State (Default expanded so variants are shown below each product)
  const [expandedRowIds, setExpandedRowIds] = React.useState<Set<string>>(() => new Set());
  const [hasInitializedExpanded, setHasInitializedExpanded] = React.useState(false);

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

  // Automatically initialize all product rows with variants as expanded so variants are visible below products
  React.useEffect(() => {
    if (products.length > 0 && !hasInitializedExpanded) {
      setExpandedRowIds(new Set(products.map((p) => p.id)));
      setHasInitializedExpanded(true);
    }
  }, [products, hasInitializedExpanded]);

  const toggleRowExpanded = React.useCallback((id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allExpanded = products.length > 0 && expandedRowIds.size === products.length;

  const toggleExpandAll = React.useCallback(() => {
    if (allExpanded) {
      setExpandedRowIds(new Set());
    } else {
      setExpandedRowIds(new Set(products.map((p) => p.id)));
    }
  }, [allExpanded, products]);

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
      queryClient.invalidateQueries({ queryKey: ["admin", "product"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
      router.refresh();
      if (res.archived) {
        toast.warning(res.message);
      } else {
        toast.success(res.message);
      }
      setProductToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete product.");
      setProductToDelete(null);
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  // Status Update Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "draft" | "archived" }) => {
      const res = await updateProductStatusAction(id, status);
      if (!res.success) {
        throw new Error(res.error || "Failed to update product status.");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "product"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
      router.refresh();
      toast.success("Product status changed successfully.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not update product status.");
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
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      toast.success("A draft copy of the product was created successfully.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not duplicate product.");
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
        const matchesVariant = p.variantList?.some(
          (v) =>
            v.sku.toLowerCase().includes(query) ||
            v.name.toLowerCase().includes(query) ||
            (v.nameBn && v.nameBn.toLowerCase().includes(query)) ||
            (v.barcode && v.barcode.toLowerCase().includes(query)) ||
            v.packType.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesNameBn && !matchesSlug && !matchesCategory && !matchesVariant) {
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
        selected.map((item) => updateProductStatusAction(item.id, "archived"))
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "product"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
      router.refresh();
      clearSelection();
      toast.success(`Successfully archived ${selected.length} products.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive some products.");
    }
  };

  const handleBulkStatusChange = async (
    selected: UiProductItem[],
    newStatus: "active" | "draft" | "archived",
    clearSelection: () => void
  ) => {
    try {
      await Promise.all(
        selected.map((item) => updateProductStatusAction(item.id, newStatus))
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "product"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
      router.refresh();
      clearSelection();
      toast.success(`Updated ${selected.length} products to "${newStatus}".`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update some products.");
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
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "product"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
      router.refresh();
      clearSelection();
      toast.success(
        `Deleted ${deletedCount} products and archived ${archivedCount} referenced products.`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete some products.");
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
      "Status",
      "Stock",
      "Variants",
      "Base_Price_BDT",
      "Price_Range",
      "Rating",
    ];
    const rows = dataToExport.map((p) => {
      const variants = p.variantList || [];
      const prices = variants.map((v) => Number(v.price) || 0).filter((pr) => pr > 0);
      const min = prices.length > 0 ? Math.min(...prices) : Number(p.basePrice || 0);
      const max = prices.length > 0 ? Math.max(...prices) : Number(p.maxPrice || p.basePrice || 0);
      const priceRange = variants.length > 1 && min < max ? `৳${min} - ৳${max}` : `৳${min}`;

      return [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.nameBn || "").replace(/"/g, '""')}"`,
        p.slug,
        p.category,
        p.status,
        p.stock,
        p.variants,
        p.basePrice || 0,
        `"${priceRange}"`,
        p.rating,
      ];
    });
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
          <div className="flex items-center justify-center w-8">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all products"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center w-8 pt-2.5">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select product row"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
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
              {/* Product Thumbnail from ImageKit CDN / Fallback */}
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
        cell: ({ row }) => {
          const p = row.original;
          const count = p.variants || 0;
          const isExpanded = expandedRowIds.has(p.id);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleRowExpanded(p.id);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/50 hover:bg-muted border border-border/60 transition-colors cursor-pointer group"
              title={isExpanded ? "Collapse variants below" : "Expand variants below"}
            >
              <Layers className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-foreground">
                {count} pack{count !== 1 ? "s" : ""}
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180 text-foreground"
                )}
              />
            </button>
          );
        },
      },
      {
        accessorKey: "basePrice",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Base Price" />,
        cell: ({ row }) => {
          const p = row.original;
          const variants = p.variantList || [];
          const prices = variants
            .map((v) => Number(v.price) || 0)
            .filter((pr) => pr > 0);

          const min = prices.length > 0 ? Math.min(...prices) : Number(p.basePrice || 0);
          const max =
            prices.length > 0
              ? Math.max(...prices)
              : Number(p.maxPrice || p.basePrice || 0);

          if (variants.length > 1 && min < max) {
            return (
              <span className="font-semibold text-sm text-foreground whitespace-nowrap">
                ৳{min.toLocaleString()} – ৳{max.toLocaleString()}
              </span>
            );
          }

          const price = min || Number(p.basePrice || 0);
          return (
            <span className="font-semibold text-sm text-foreground whitespace-nowrap">
              ৳{price ? price.toLocaleString() : "0"}
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
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      toast.info(`Submitting "${p.name}" to Meta Catalog...`);
                      const res = await syncSingleProductToMetaCatalogAction(p.id);
                      if (res.success) {
                        toast.success(`Successfully synced "${p.name}" to Meta Catalog.`);
                      } else {
                        toast.error(res.error || "Failed to sync to Meta Catalog.");
                      }
                    } catch (err: any) {
                      toast.error(err?.message || "Unexpected error syncing to Meta.");
                    }
                  }}
                >
                  <Share2 className="h-3.5 w-3.5 mr-2 text-[#1877F2]" /> Sync to Meta Catalog
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
    [duplicateMutation, statusMutation, expandedRowIds, toggleRowExpanded, router]
  );

  // Sub-row rendering to display packaging variants directly below each master product
  const renderProductVariantsSubRow = React.useCallback(
    (product: UiProductItem) => {
      const variants = product.variantList || [];
      if (variants.length === 0) {
        return (
          <div className="py-3 px-4 sm:px-8 bg-muted/20 border-l-4 border-amber-500/40 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Layers className="h-4 w-4 text-amber-600" />
              <span>
                No packaging variants configured yet for{" "}
                <strong className="text-foreground">{product.name}</strong>.
              </span>
            </div>
            <Button variant="outline" size="sm" asChild className="h-7 text-xs cursor-pointer">
              <Link href={`/admin/products/${product.id}/edit?tab=variants`}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Variant
              </Link>
            </Button>
          </div>
        );
      }

      return (
        <div className="bg-muted/15 dark:bg-muted/10 border-y border-border/70 px-3 sm:px-6 py-2.5">
          <ProductVariantsFlow product={product} />
        </div>
      );
    },
    []
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
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products Catalog</h1>
          <p className="text-muted-foreground text-sm">
            Manage catalog items, packaging variants, pricing tiers, and ImageKit CDN media storage.
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
          <MetaCatalogManager />
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
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
          </div>

          <DataTable
            columns={columns}
            data={filteredProducts}
            enableRowSelection={true}
            enableGlobalFilter={false}
            toolbarPrefix={
              <div className="flex flex-1 items-center gap-2 flex-wrap sm:flex-nowrap w-full">
                {/* Unified Merged Search Bar */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search products, SKU, category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 pr-8 text-xs w-full bg-background"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter Select Button */}
                <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || "all")}>
                  <SelectTrigger className="h-9 data-[size=default]:h-9 text-xs w-[140px] bg-background">
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

                {/* Stock Filter Select Button */}
                <Select value={stockFilter} onValueChange={(val) => setStockFilter(val || "all")}>
                  <SelectTrigger className="h-9 data-[size=default]:h-9 text-xs w-[130px] bg-background">
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

                {/* Expand / Collapse All Variants Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleExpandAll}
                  className="h-9 text-xs px-2.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  title={allExpanded ? "Collapse all variants" : "Expand all variants below products"}
                >
                  <Layers className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                  <span>{allExpanded ? "Collapse Variants" : "Expand Variants"}</span>
                </Button>
              </div>
            }
            renderSubRow={renderProductVariantsSubRow}
            isRowExpanded={(row) => expandedRowIds.has(row.id)}
            bulkActions={(selectedRows: UiProductItem[], clearSelection: () => void) => (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs border-amber-500/30 hover:bg-amber-500/20 text-foreground cursor-pointer"
                  onClick={() => handleBulkStatusChange(selectedRows, "active", clearSelection)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Set Active
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs border-amber-500/30 hover:bg-amber-500/20 text-foreground cursor-pointer"
                  onClick={() => handleBulkStatusChange(selectedRows, "draft", clearSelection)}
                >
                  Set Draft
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs border-amber-500/30 hover:bg-amber-500/20 text-foreground cursor-pointer"
                  onClick={() => handleBulkArchive(selectedRows, clearSelection)}
                >
                  <Archive className="h-3.5 w-3.5 mr-1" />
                  Archive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs border-destructive/30 hover:bg-destructive/15 text-destructive cursor-pointer"
                  onClick={() => handleBulkDelete(selectedRows, clearSelection)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs border-amber-500/30 hover:bg-amber-500/20 text-foreground cursor-pointer"
                  onClick={() => handleExportCSV(selectedRows)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
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

          <div className="py-2.5 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border mb-2">
            <p className="font-semibold text-foreground mb-1">Data Safety Note:</p>
            If this product is associated with existing customer orders or inventory batches, the
            system will automatically and safely <strong>archive</strong> it instead of deleting it,
            preserving invoice history and accounting accuracy.
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
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
