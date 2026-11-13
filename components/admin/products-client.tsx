"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  Package2,
  Trash2,
  Archive,
  Download,
  Copy,
  Layers,
  Sparkles,
  RefreshCw,
  Edit,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Share2,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MetaCatalogManager } from "@/components/admin/meta-catalog-manager";
import { syncSingleProductToMetaCatalogAction } from "@/actions/meta-catalog";
import {
  getAdminProductsAction,
  deleteProductAction,
  createDraftProductAction,
  updateProductStatusAction,
} from "@/actions/products";
import { fetchCategoriesListAction } from "@/actions/categories";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { type UiProductItem } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { toast } from "sonner";

const statusMeta: Record<string, { badge: string; dot: string }> = {
  active: {
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  draft: {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
    dot: "bg-amber-500",
  },
  archived: {
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
};

const stockMeta: Record<string, { badge: string; dot: string }> = {
  in_stock: {
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  low_stock: {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
    dot: "bg-amber-500",
  },
  out_of_stock: {
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
    dot: "bg-rose-500",
  },
  backorder: {
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25",
    dot: "bg-blue-500",
  },
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function StatusPill({
  value,
  meta,
}: {
  value: string;
  meta: Record<string, { badge: string; dot: string }>;
}) {
  const style = meta[value] || {
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap",
        style.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} />
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function ProductsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [stockFilter, setStockFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Collapsed by default; user expands per product or toggles all
  const [expandedRowIds, setExpandedRowIds] = React.useState<Set<string>>(() => new Set());

  const [productToDelete, setProductToDelete] = React.useState<UiProductItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    data: products = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: getAdminProductsAction,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories-list"],
    queryFn: fetchCategoriesListAction,
  });

  const invalidateProductQueries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "catalog-products"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "product"] });
    queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
    router.refresh();
  }, [queryClient, router]);

  const toggleRowExpanded = React.useCallback((id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteProductAction(id);
      if (!res.success) {
        throw new Error(res.error || res.message || "Failed to delete product.");
      }
      return res;
    },
    onSuccess: (res) => {
      invalidateProductQueries();
      if (res.archived) toast.warning(res.message);
      else toast.success(res.message);
      setProductToDelete(null);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "Failed to delete product."));
      setProductToDelete(null);
    },
    onSettled: () => setIsDeleting(false),
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "draft" | "archived";
    }) => {
      const res = await updateProductStatusAction(id, status);
      if (!res.success) {
        throw new Error(res.error || "Failed to update product status.");
      }
      return res;
    },
    onSuccess: () => {
      invalidateProductQueries();
      toast.success("Product status changed successfully.");
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "Could not update product status."));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (item: UiProductItem) => {
      const uniqueSlug = `${item.slug}-copy-${Date.now().toString().slice(-4)}`;
      return await createDraftProductAction({
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
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "Could not duplicate product."));
    },
  });

  const filteredProducts = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (activeTab !== "all" && p.status !== activeTab) return false;
      if (
        categoryFilter !== "all" &&
        p.category.toLowerCase() !== categoryFilter.toLowerCase() &&
        p.categoryId !== categoryFilter
      ) {
        return false;
      }
      if (stockFilter !== "all") {
        if (stockFilter === "attention") {
          if (p.stock !== "low_stock" && p.stock !== "out_of_stock") return false;
        } else if (p.stock !== stockFilter) {
          return false;
        }
      }
      if (query) {
        const matchesProduct =
          p.name.toLowerCase().includes(query) ||
          p.nameBn?.toLowerCase().includes(query) ||
          p.slug.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query);
        const matchesVariant = p.variantList?.some(
          (v) =>
            v.sku.toLowerCase().includes(query) ||
            v.name.toLowerCase().includes(query) ||
            v.nameBn?.toLowerCase().includes(query) ||
            v.barcode?.toLowerCase().includes(query) ||
            v.packType.toLowerCase().includes(query)
        );
        if (!matchesProduct && !matchesVariant) return false;
      }
      return true;
    });
  }, [products, activeTab, categoryFilter, stockFilter, searchQuery]);

  const allVisibleExpanded =
    filteredProducts.length > 0 && filteredProducts.every((p) => expandedRowIds.has(p.id));

  const toggleExpandAll = React.useCallback(() => {
    if (allVisibleExpanded) {
      setExpandedRowIds(new Set());
    } else {
      setExpandedRowIds(new Set(filteredProducts.map((p) => p.id)));
    }
  }, [allVisibleExpanded, filteredProducts]);

  const hasActiveFilters =
    activeTab !== "all" ||
    categoryFilter !== "all" ||
    stockFilter !== "all" ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setActiveTab("all");
    setCategoryFilter("all");
    setStockFilter("all");
    setSearchQuery("");
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
      invalidateProductQueries();
      clearSelection();
      toast.success(`Updated ${selected.length} products to "${newStatus}".`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update some products."));
    }
  };

  const handleBulkDelete = async (selected: UiProductItem[], clearSelection: () => void) => {
    try {
      let archivedCount = 0;
      let deletedCount = 0;
      for (const item of selected) {
        const res = await deleteProductAction(item.id);
        if (!res.success) {
          throw new Error(res.error || res.message || `Failed to delete ${item.name}.`);
        }
        if (res.archived) archivedCount++;
        else deletedCount++;
      }
      invalidateProductQueries();
      clearSelection();
      toast.success(
        `Deleted ${deletedCount} products and archived ${archivedCount} referenced products.`
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete some products."));
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
      const max =
        prices.length > 0 ? Math.max(...prices) : Number(p.maxPrice || p.basePrice || 0);
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

    const csv = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `products_export_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = React.useMemo<ColumnDef<UiProductItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center w-7">
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
          <div className="flex items-center justify-center w-7">
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
            <div className="flex items-center gap-2.5 min-w-[210px] max-w-[320px]">
              <div className="h-9 w-9 rounded-lg bg-muted/60 border border-border/80 flex items-center justify-center shrink-0 overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package2 className="h-4 w-4 text-amber-600/80" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/admin/products/${p.id}/edit`}
                    className="font-semibold text-[13px] leading-tight text-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors truncate"
                    title={p.name}
                  >
                    {p.name}
                  </Link>
                  {p.featured && (
                    <Badge className="h-4 px-1 text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold shrink-0">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      Featured
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
                  {p.nameBn && <span className="font-bangla truncate">{p.nameBn}</span>}
                  {p.nameBn && <span className="text-muted-foreground/40">·</span>}
                  <span className="font-mono text-[10px] text-muted-foreground/80 truncate">
                    /{p.slug}
                  </span>
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
          <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80 whitespace-nowrap">
            {row.getValue("category")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <StatusPill value={row.original.status} meta={statusMeta} />,
      },
      {
        accessorKey: "stock",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
        cell: ({ row }) => <StatusPill value={row.original.stock} meta={stockMeta} />,
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
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap",
                isExpanded
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300"
                  : "bg-muted/40 hover:bg-muted border-border/70 text-foreground"
              )}
              title={isExpanded ? "Collapse variants" : "View variants"}
            >
              <Layers className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="tabular-nums">
                {count} {count === 1 ? "pack" : "packs"}
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform duration-150",
                  isExpanded && "rotate-180 text-amber-700 dark:text-amber-300"
                )}
              />
            </button>
          );
        },
      },
      {
        accessorKey: "basePrice",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
        cell: ({ row }) => {
          const p = row.original;
          const variants = p.variantList || [];
          const prices = variants.map((v) => Number(v.price) || 0).filter((pr) => pr > 0);
          const min = prices.length > 0 ? Math.min(...prices) : Number(p.basePrice || 0);
          const max =
            prices.length > 0
              ? Math.max(...prices)
              : Number(p.maxPrice || p.basePrice || 0);

          if (variants.length > 1 && min < max) {
            return (
              <span className="font-semibold text-[13px] text-foreground tabular-nums whitespace-nowrap">
                ৳{min.toLocaleString()}–৳{max.toLocaleString()}
              </span>
            );
          }

          return (
            <span className="font-semibold text-[13px] text-foreground tabular-nums whitespace-nowrap">
              ৳{(min || 0).toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: "rating",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
        cell: ({ row }) => {
          const { rating, reviews } = row.original;
          return rating > 0 ? (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 tabular-nums whitespace-nowrap">
              ★ {rating}{" "}
              <span className="text-muted-foreground font-normal">({reviews})</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/60">–</span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open product menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => router.push(`/admin/products/${p.id}/edit`)}>
                    <Edit className="h-3.5 w-3.5 mr-2 text-amber-600" /> Edit Product
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push(`/admin/products/${p.id}/edit?tab=variants`)}
                  >
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
                      } catch (err: unknown) {
                        toast.error(getErrorMessage(err, "Unexpected error syncing to Meta."));
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
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [duplicateMutation, statusMutation, expandedRowIds, toggleRowExpanded, router]
  );

  // Clean, compact inline variants panel (no ReactFlow canvas)
  const renderProductVariantsSubRow = React.useCallback((product: UiProductItem) => {
    const variants = product.variantList || [];
    if (variants.length === 0) {
      return (
        <div className="py-2.5 px-4 sm:px-8 bg-muted/25 border-t border-border/60 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">
            No packaging variants configured for{" "}
            <strong className="text-foreground">{product.name}</strong>.
          </span>
          <Button variant="outline" size="sm" asChild className="h-7 text-xs">
            <Link href={`/admin/products/${product.id}/edit?tab=variants`}>
              <Plus className="h-3 w-3 mr-1" /> Add Variant
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="bg-muted/20 border-t border-border/60 px-3 sm:px-6 py-2.5">
        <div className="rounded-lg border border-border/70 bg-background/95 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/60 text-[11px]">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider">
              Variants ({variants.length})
            </span>
            <Link
              href={`/admin/products/${product.id}/edit?tab=variants`}
              className="text-amber-600 dark:text-amber-400 hover:underline font-medium inline-flex items-center gap-1"
            >
              Manage all <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-border/50">
            {variants.map((v) => {
              const hasDiscount = v.compareAtPrice && v.compareAtPrice > v.price;
              return (
                <div
                  key={v.id}
                  className="grid grid-cols-1 sm:grid-cols-12 items-center gap-1.5 sm:gap-3 px-3 py-2 text-xs hover:bg-muted/25 transition-colors"
                >
                  <div className="sm:col-span-4 flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className="capitalize text-[10px] px-1.5 py-0 h-5 shrink-0 font-medium"
                    >
                      {v.packType}
                    </Badge>
                    <span className="font-medium text-foreground truncate" title={v.name}>
                      {v.name}
                    </span>
                    {v.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium shrink-0">
                        Default
                      </span>
                    )}
                    {!v.isActive && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                        Hidden
                      </span>
                    )}
                  </div>

                  <div className="sm:col-span-3 flex items-center justify-between sm:justify-start gap-3 text-[11px] text-muted-foreground">
                    <span className="font-mono text-foreground/80 truncate" title={v.sku}>
                      {v.sku}
                    </span>
                    <span className="tabular-nums shrink-0">
                      {v.netQuantity} {v.netUnit}
                    </span>
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-1.5">
                    <StatusPill value={v.stockStatus} meta={stockMeta} />
                    {typeof v.stockQty === "number" && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        ({v.stockQty})
                      </span>
                    )}
                  </div>

                  <div className="sm:col-span-2 sm:text-right flex items-center sm:justify-end gap-1.5 tabular-nums">
                    <span className="font-semibold text-foreground">
                      ৳{v.price.toLocaleString()}
                    </span>
                    {hasDiscount && (
                      <span className="text-[11px] text-muted-foreground line-through">
                        ৳{v.compareAtPrice!.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="sm:col-span-1 flex sm:justify-end">
                    <Link
                      href={`/admin/products/${product.id}/edit?tab=variants`}
                      className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, []);

  const totalCount = products.length;
  const activeCount = products.filter((p) => p.status === "active").length;
  const draftCount = products.filter((p) => p.status === "draft").length;
  const archivedCount = products.filter((p) => p.status === "archived").length;
  const lowStockCount = products.filter(
    (p) => p.stock === "low_stock" || p.stock === "out_of_stock"
  ).length;

  const kpis = [
    {
      label: "Total Products",
      value: totalCount,
      dot: "bg-foreground/40",
      onClick: resetFilters,
      active: !hasActiveFilters,
    },
    {
      label: "Active in Store",
      value: activeCount,
      dot: "bg-emerald-500",
      onClick: () => {
        setActiveTab("active");
        setStockFilter("all");
      },
      active: activeTab === "active" && stockFilter === "all",
    },
    {
      label: "Drafts",
      value: draftCount,
      dot: "bg-amber-500",
      onClick: () => {
        setActiveTab("draft");
        setStockFilter("all");
      },
      active: activeTab === "draft" && stockFilter === "all",
    },
    {
      label: "Low / Out of Stock",
      value: lowStockCount,
      dot: lowStockCount > 0 ? "bg-rose-500" : "bg-muted-foreground/40",
      onClick: () => {
        setActiveTab("all");
        setStockFilter((prev) => (prev === "attention" ? "all" : "attention"));
      },
      active: stockFilter === "attention",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-border/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Products Catalog</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Manage products, packaging variants, stock status, and Meta Catalog sync.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs cursor-pointer"
            title="Refresh products list"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCSV([])}
            className="h-8 text-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <MetaCatalogManager />
          <Button
            size="sm"
            asChild
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-8 text-xs cursor-pointer"
          >
            <Link href="/products/new">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Compact Interactive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={kpi.onClick}
            className={cn(
              "text-left rounded-xl border bg-card px-4 py-3 transition-all cursor-pointer hover:border-amber-500/40",
              kpi.active
                ? "border-amber-500/50 ring-1 ring-amber-500/20 bg-amber-500/[0.03]"
                : "border-border/80"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </span>
              <span className={cn("h-2 w-2 rounded-full shrink-0", kpi.dot)} />
            </div>
            <p className="text-xl sm:text-2xl font-bold mt-1 text-foreground tabular-nums">
              {kpi.value}
            </p>
          </button>
        ))}
      </div>

      {/* Status Tabs + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="bg-muted/60 p-1 h-9 overflow-x-auto max-w-full">
            <TabsTrigger value="all" className="text-xs h-7 px-2.5">
              All
              <span className="ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] tabular-nums">
                {totalCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs h-7 px-2.5">
              Active
              <span className="ml-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 text-[10px] tabular-nums">
                {activeCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="draft" className="text-xs h-7 px-2.5">
              Draft
              <span className="ml-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 text-[10px] tabular-nums">
                {draftCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs h-7 px-2.5">
              Archived
              <span className="ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] tabular-nums">
                {archivedCount}
              </span>
            </TabsTrigger>
          </TabsList>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Reset filters ({filteredProducts.length}/{totalCount})
            </Button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filteredProducts}
          isLoading={isLoading}
          enableRowSelection={true}
          enableGlobalFilter={false}
          cellClassName="py-2.5 px-2.5 align-middle"
          emptyMessage="No products match the current filters."
          toolbarPrefix={
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
              <div className="relative flex-1 min-w-0 sm:max-w-xs">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search name, SKU, barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 pr-8 text-xs w-full bg-background"
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

              <div className="grid grid-cols-2 sm:flex items-center gap-2">
                <Select
                  value={categoryFilter}
                  onValueChange={(val) => setCategoryFilter(val || "all")}
                >
                  <SelectTrigger className="h-9 data-[size=default]:h-9 text-xs w-full sm:w-[145px] bg-background">
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

                <Select value={stockFilter} onValueChange={(val) => setStockFilter(val || "all")}>
                  <SelectTrigger className="h-9 data-[size=default]:h-9 text-xs w-full sm:w-[135px] bg-background">
                    <SelectValue placeholder="Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock</SelectItem>
                    <SelectItem value="attention">Low / Out of Stock</SelectItem>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    <SelectItem value="backorder">Backorder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleExpandAll}
                disabled={filteredProducts.length === 0}
                className="h-9 text-xs px-2.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0 self-start sm:self-auto"
                title={allVisibleExpanded ? "Collapse all variants" : "Expand all variants"}
              >
                <Layers className="h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
                {allVisibleExpanded ? "Collapse Variants" : "Expand Variants"}
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
                onClick={() => handleBulkStatusChange(selectedRows, "archived", clearSelection)}
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
