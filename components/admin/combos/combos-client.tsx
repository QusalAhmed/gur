"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Plus,
  Gift,
  Boxes,
  Trash2,
  Download,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  Sparkles,
  RefreshCw,
  Edit,
  MoreHorizontal,
  ChevronDown,
  Info,
  Package,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  fetchCombosListAction,
  toggleComboStatusAction,
  deleteComboAction,
  type ComboItemView,
  type ComboComponentDetail,
} from "@/actions/combos";
import { getAdminProductsAction } from "@/actions/products";
import { type UiProductItem } from "@/lib/supabase";
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
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { ComboDrawer } from "@/components/admin/combos/combo-drawer";
import { toast } from "sonner";

export function CombosClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filters & State
  const [activeTab, setActiveTab] = React.useState("all");
  const [stockFilter, setStockFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Row Expansion State
  const [expandedRowIds, setExpandedRowIds] = React.useState<Set<string>>(() => new Set());

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [selectedComboForEdit, setSelectedComboForEdit] = React.useState<ComboItemView | null>(
    null
  );

  // Deletion Modal State
  const [comboToDelete, setComboToDelete] = React.useState<ComboItemView | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // TanStack Query for Combos
  const {
    data: combos = [],
    isLoading: isCombosLoading,
    isFetching: isCombosFetching,
    refetch: refetchCombos,
  } = useQuery({
    queryKey: ["admin", "combos"],
    queryFn: () => fetchCombosListAction(),
  });

  // TanStack Query for Catalog Products (needed by ComboDrawer to pick items)
  const { data: catalogProducts = [] } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: getAdminProductsAction,
  });

  // Toggle Combo Status Mutation
  const statusMutation = useMutation({
    mutationFn: async ({
      productId,
      newStatus,
    }: {
      productId: string;
      newStatus: "active" | "draft";
    }) => {
      const res = await toggleComboStatusAction(productId, newStatus);
      if (!res.success) {
        throw new Error(res.error || "Failed to toggle status.");
      }
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "combos"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
      toast.success(
        `Combo status updated to "${variables.newStatus === "active" ? "Active" : "Draft"}".`
      );
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not change status.");
    },
  });

  // Delete Combo Mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await deleteComboAction(productId);
      if (!res.success) {
        throw new Error(res.error || "Failed to delete combo.");
      }
      return res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "combos"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
      setComboToDelete(null);
      if (data?.archived) {
        toast.success("Combo bundle archived (preserved for order history).");
      } else {
        toast.success("Combo bundle deleted successfully.");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete combo.");
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  // Expand / Collapse Helpers
  const toggleRowExpanded = React.useCallback((id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allExpanded = combos.length > 0 && expandedRowIds.size === combos.length;
  const toggleExpandAll = React.useCallback(() => {
    if (allExpanded) {
      setExpandedRowIds(new Set());
    } else {
      setExpandedRowIds(new Set(combos.map((c) => c.id)));
    }
  }, [allExpanded, combos]);

  // Open Drawer for New or Edit
  const handleOpenCreate = () => {
    setSelectedComboForEdit(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (combo: ComboItemView) => {
    setSelectedComboForEdit(combo);
    setIsDrawerOpen(true);
  };

  // Filtered Combos List
  const filteredCombos = React.useMemo(() => {
    return combos.filter((c) => {
      // Tab filter
      if (activeTab === "active" && c.status !== "active") return false;
      if (activeTab === "draft" && c.status !== "draft") return false;

      // Stock filter
      if (stockFilter === "in_stock" && c.virtualStock <= 0) return false;
      if (stockFilter === "out_of_stock" && c.virtualStock > 0) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesNameBn = c.nameBn && c.nameBn.toLowerCase().includes(q);
        const matchesSku = c.sku.toLowerCase().includes(q);
        const matchesSlug = c.slug.toLowerCase().includes(q);
        const matchesComponent = c.components.some(
          (comp) =>
            comp.productName.toLowerCase().includes(q) ||
            (comp.productNameBn && comp.productNameBn.toLowerCase().includes(q)) ||
            comp.variantName.toLowerCase().includes(q) ||
            comp.sku.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesNameBn && !matchesSku && !matchesSlug && !matchesComponent) {
          return false;
        }
      }

      return true;
    });
  }, [combos, activeTab, stockFilter, searchQuery]);

  // Export CSV Helper
  const handleExportCSV = (selected: ComboItemView[]) => {
    const list = selected.length > 0 ? selected : filteredCombos;
    const headers = [
      "ID",
      "Combo Name",
      "Bangla Name",
      "SKU",
      "Slug",
      "Status",
      "Combo Price (BDT)",
      "Regular Total (BDT)",
      "Savings (BDT)",
      "Savings (%)",
      "Virtual Available Stock",
      "Components Recipe",
      "Bottleneck Component",
    ];

    const rows = list.map((c) => {
      const componentsRecipe = c.components
        .map((comp) => `${comp.quantity}x ${comp.productName} (${comp.variantName})`)
        .join("; ");
      const bottleneck = c.bottleneckComponent
        ? `${c.bottleneckComponent.productName} (${c.bottleneckComponent.variantName}, stock: ${c.bottleneckComponent.availableStock})`
        : "None";

      return [
        c.id,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${(c.nameBn || "").replace(/"/g, '""')}"`,
        c.sku,
        c.slug,
        c.status,
        c.price,
        c.regularTotal,
        c.savingsAmount,
        c.savingsPct,
        c.virtualStock,
        `"${componentsRecipe.replace(/"/g, '""')}"`,
        `"${bottleneck.replace(/"/g, '""')}"`,
      ];
    });

    const csvString = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `combos_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // KPI Calculations
  const totalCombos = combos.length;
  const activeCombos = combos.filter((c) => c.status === "active").length;
  const draftCombos = combos.filter((c) => c.status === "draft").length;
  const lowOrOutStockCombos = combos.filter((c) => c.virtualStock <= 5).length;
  const avgSavingsPct =
    combos.length > 0
      ? Math.round(
          combos.reduce((sum, c) => sum + (c.savingsPct || 0), 0) / combos.length
        )
      : 0;

  // TanStack Columns
  const columns = React.useMemo<ColumnDef<ComboItemView>[]>(
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
              aria-label="Select all combos"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center w-8 pt-2">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select combo row"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Combo Package" />,
        cell: ({ row }) => {
          const combo = row.original;
          const isExpanded = expandedRowIds.has(combo.id);

          return (
            <div className="flex items-center gap-3 min-w-[260px]">
              {/* Thumbnail / Icon */}
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative">
                {combo.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={combo.image}
                    alt={combo.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Gift className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    onClick={() => handleOpenEdit(combo)}
                    className="font-semibold text-sm text-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer line-clamp-1"
                  >
                    {combo.name}
                  </span>
                  <Badge className="h-4 px-1.5 text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium border-0 shadow-xs">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Combo
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {combo.nameBn && (
                    <>
                      <span className="font-bangla">{combo.nameBn}</span>
                      <span className="text-[10px] text-muted-foreground/50">•</span>
                    </>
                  )}
                  <span className="font-mono text-[11px] text-muted-foreground/80">{combo.sku}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "components",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Items Included" />,
        cell: ({ row }) => {
          const combo = row.original;
          const count = combo.components.length;
          const isExpanded = expandedRowIds.has(combo.id);

          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleRowExpanded(combo.id);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted border border-border/80 transition-colors cursor-pointer group"
              title={isExpanded ? "Hide items recipe" : "Show items recipe"}
            >
              <Boxes className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-foreground">
                {count} {count === 1 ? "Product" : "Products"}
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
        accessorKey: "price",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Pricing & Value" />,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground whitespace-nowrap">
                  ৳{c.price.toLocaleString()}
                </span>
                {c.regularTotal > c.price && (
                  <span className="text-xs text-muted-foreground line-through whitespace-nowrap">
                    ৳{c.regularTotal.toLocaleString()}
                  </span>
                )}
              </div>
              {c.savingsAmount > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <TrendingDown className="h-3 w-3" />
                  <span>
                    Save ৳{c.savingsAmount.toLocaleString()} ({c.savingsPct}%)
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "virtualStock",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Virtual Available Stock" />
        ),
        cell: ({ row }) => {
          const c = row.original;
          const stock = c.virtualStock;
          const isOutOfStock = stock <= 0;
          const isLowStock = stock > 0 && stock <= 5;

          return (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
                    isOutOfStock
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                      : isLowStock
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                    )}
                  />
                  {stock} {stock === 1 ? "combo" : "combos"}
                </span>
              </div>

              {c.bottleneckComponent && (
                <p className="text-[11px] text-muted-foreground line-clamp-1" title={`Limited by: ${c.bottleneckComponent.productName} (${c.bottleneckComponent.availableStock} physical stock left)`}>
                  Limited by: <span className="font-medium text-foreground">{c.bottleneckComponent.productName}</span>
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const combo = row.original;
          const isActive = combo.status === "active";
          const isPending = statusMutation.isPending && statusMutation.variables?.productId === combo.id;

          return (
            <button
              type="button"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                statusMutation.mutate({
                  productId: combo.id,
                  newStatus: isActive ? "draft" : "active",
                });
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                isActive
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
              )}
              title={`Click to switch to ${isActive ? "Draft" : "Active"}`}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )}
              />
              {isPending ? "Updating..." : isActive ? "Active" : "Draft"}
            </button>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const combo = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted cursor-pointer">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open combo menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleOpenEdit(combo)}>
                  <Edit className="h-3.5 w-3.5 mr-2 text-amber-600" />
                  Edit Combo Recipe
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open(`/products/${combo.slug}`, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-2 text-blue-600" />
                  View on Storefront
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setComboToDelete(combo)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete Combo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [expandedRowIds, handleOpenEdit, statusMutation, toggleRowExpanded]
  );

  // Sub-row rendering: Component breakdown with shared stock badges
  const renderComboSubRow = React.useCallback(
    (combo: ComboItemView) => {
      const components = combo.components || [];

      if (components.length === 0) {
        return (
          <div className="py-3 px-6 bg-muted/20 border-l-4 border-amber-500/40 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">
              No components configured yet for this combo.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEdit(combo)}
              className="h-7 text-xs cursor-pointer"
            >
              <Plus className="h-3 w-3 mr-1" /> Add Components
            </Button>
          </div>
        );
      }

      return (
        <div className="bg-muted/15 dark:bg-muted/10 border-y border-border/80 px-4 sm:px-8 py-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Components Recipe & Shared Inventory Breakdown
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEdit(combo)}
              className="h-7 text-xs cursor-pointer border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Edit className="h-3 w-3 mr-1" /> Edit Recipe
            </Button>
          </div>

          <div className="rounded-xl border border-border/70 overflow-hidden bg-background">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-2 px-3 text-left font-medium">Component Product</th>
                  <th className="py-2 px-3 text-left font-medium">Variant & SKU</th>
                  <th className="py-2 px-3 text-center font-medium">Qty in Combo</th>
                  <th className="py-2 px-3 text-right font-medium">Unit Price</th>
                  <th className="py-2 px-3 text-right font-medium">Line Value</th>
                  <th className="py-2 px-3 text-center font-medium">Physical Stock</th>
                  <th className="py-2 px-3 text-center font-medium">Max Combos</th>
                  <th className="py-2 px-3 text-left font-medium">Shared Usage</th>
                  <th className="py-2 px-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {components.map((comp) => {
                  const maxPossible =
                    comp.quantity > 0
                      ? Math.floor(comp.physicalStock / comp.quantity)
                      : 0;
                  const isBottleneck = maxPossible === combo.virtualStock;

                  return (
                    <tr
                      key={comp.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        isBottleneck && "bg-amber-500/5 font-medium"
                      )}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">
                          {comp.productName}
                        </div>
                        {comp.productNameBn && (
                          <div className="text-[11px] text-muted-foreground font-bangla">
                            {comp.productNameBn}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-foreground">{comp.variantName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {comp.sku}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className="font-mono text-xs font-bold">
                          {comp.quantity}x
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        ৳{comp.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                        ৳{comp.lineTotal.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border",
                            comp.physicalStock <= 0
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              : comp.physicalStock <= 10
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          )}
                        >
                          {comp.physicalStock} units
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={cn(
                              "font-mono font-bold text-xs",
                              isBottleneck ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                            )}
                          >
                            {maxPossible}
                          </span>
                          {isBottleneck && (
                            <span
                              className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1 py-0.2 rounded font-semibold"
                              title="This item is the bottleneck limiting the overall combo stock"
                            >
                              Bottleneck
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {comp.otherCombosCount > 0 ? (
                          <div
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-400 text-[11px]"
                            title={`Also part of: ${comp.otherCombosNames.join(", ")}`}
                          >
                            <span>📌 In {comp.otherCombosCount} other {comp.otherCombosCount === 1 ? "combo" : "combos"}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Exclusive to this</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Link href={`/admin/products/${comp.productId}/edit`}>
                            Edit Product
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    },
    [handleOpenEdit]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Combos & Bundles</h1>
            <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
              কম্বো অফার
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Configure multi-product bundle offers, set smart bundle discounts, and track shared inventory bottlenecks in real time.
          </p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchCombos()}
            disabled={isCombosFetching}
            className="h-9 cursor-pointer"
            title="Refresh combos"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isCombosFetching ? "animate-spin" : ""}`} />
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
            onClick={handleOpenCreate}
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Combo
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
          {
            label: "Total Combos",
            value: totalCombos,
            icon: Gift,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10",
          },
          {
            label: "Active Store Deals",
            value: activeCombos,
            icon: CheckCircle2,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Average Savings",
            value: `${avgSavingsPct}%`,
            icon: TrendingDown,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-500/10",
          },
          {
            label: "Low / Out of Stock",
            value: lowOrOutStockCombos,
            icon: AlertTriangle,
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-500/10",
          },
        ].map((s, i) => (
          <Card key={i} className="border shadow-xs">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-medium text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
                </div>
                <div className={cn("p-2.5 rounded-xl", s.bg)}>
                  <s.icon className={cn("h-5 w-5", s.color)} />
                </div>
              </div>
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
                  {totalCombos}
                </span>
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs">
                Active{" "}
                <span className="ml-1.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[10px]">
                  {activeCombos}
                </span>
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs">
                Draft{" "}
                <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">
                  {draftCombos}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <DataTable
            columns={columns}
            data={filteredCombos}
            enableRowSelection={true}
            enableGlobalFilter={false}
            toolbarPrefix={
              <div className="flex flex-1 items-center gap-2 flex-wrap sm:flex-nowrap w-full">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search combos, SKU, included items..."
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

                {/* Stock Filter Select */}
                <Select value={stockFilter} onValueChange={(val) => setStockFilter(val || "all")}>
                  <SelectTrigger className="h-9 data-[size=default]:h-9 text-xs w-[140px] bg-background">
                    <SelectValue placeholder="Stock Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock</SelectItem>
                    <SelectItem value="in_stock">In Stock (&gt;0)</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock (=0)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Expand / Collapse All Recipes */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleExpandAll}
                  className="h-9 text-xs px-2.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  title={allExpanded ? "Collapse all component recipes" : "Expand all component recipes"}
                >
                  <Boxes className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                  <span>{allExpanded ? "Collapse Recipes" : "Expand Recipes"}</span>
                </Button>
              </div>
            }
            renderSubRow={renderComboSubRow}
            isRowExpanded={(row) => expandedRowIds.has(row.id)}
            emptyMessage="No combo deals found. Click 'Create Combo' to set up your first multi-product package."
            bulkActions={(selectedRows: ComboItemView[], clearSelection: () => void) => (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs border-amber-500/30 hover:bg-amber-500/20 text-foreground cursor-pointer"
                  onClick={async () => {
                    try {
                      const settled = await Promise.allSettled(
                        selectedRows.map((c) => toggleComboStatusAction(c.id, "active"))
                      );
                      queryClient.invalidateQueries({ queryKey: ["admin", "combos"] });
                      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
                      clearSelection();

                      const failures = settled.filter(
                        (r) => r.status === "rejected" || !r.value.success
                      );

                      if (failures.length === 0) {
                        toast.success(`Activated ${selectedRows.length} combos.`);
                      } else if (failures.length === selectedRows.length) {
                        toast.error(`Failed to activate all ${selectedRows.length} combos.`);
                      } else {
                        toast.warning(
                          `Activated ${selectedRows.length - failures.length} combos (${failures.length} failed).`
                        );
                      }
                    } catch (err: any) {
                      queryClient.invalidateQueries({ queryKey: ["admin", "combos"] });
                      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
                      clearSelection();
                      toast.error("Failed to activate some combos.");
                    }
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Set Active
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs border-amber-500/30 hover:bg-amber-500/20 text-foreground cursor-pointer"
                  onClick={async () => {
                    try {
                      const settled = await Promise.allSettled(
                        selectedRows.map((c) => toggleComboStatusAction(c.id, "draft"))
                      );
                      queryClient.invalidateQueries({ queryKey: ["admin", "combos"] });
                      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
                      clearSelection();

                      const failures = settled.filter(
                        (r) => r.status === "rejected" || !r.value.success
                      );

                      if (failures.length === 0) {
                        toast.success(`Drafted ${selectedRows.length} combos.`);
                      } else if (failures.length === selectedRows.length) {
                        toast.error(`Failed to draft all ${selectedRows.length} combos.`);
                      } else {
                        toast.warning(
                          `Drafted ${selectedRows.length - failures.length} combos (${failures.length} failed).`
                        );
                      }
                    } catch (err: any) {
                      queryClient.invalidateQueries({ queryKey: ["admin", "combos"] });
                      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
                      clearSelection();
                      toast.error("Failed to draft some combos.");
                    }
                  }}
                >
                  Set Draft
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

      {/* Slide-over Drawer for Creating/Editing Combos */}
      <ComboDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        combo={selectedComboForEdit}
        catalogProducts={catalogProducts}
        allCombos={combos}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "combos"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
          queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!comboToDelete} onOpenChange={(open) => !open && setComboToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Confirm Combo Deletion</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm">
              Are you sure you want to delete combo{" "}
              <strong className="text-foreground">{comboToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2.5 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border mb-2">
            <p className="font-semibold text-foreground mb-1">Safety Note:</p>
            This action deletes the combo offering. The physical component products ({comboToDelete?.components.length || 0} items) and their warehouse inventory will <strong>remain intact</strong> and unaffected.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setComboToDelete(null)}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (comboToDelete) {
                  setIsDeleting(true);
                  deleteMutation.mutate(comboToDelete.id);
                }
              }}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              {isDeleting ? "Deleting..." : "Delete Combo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
