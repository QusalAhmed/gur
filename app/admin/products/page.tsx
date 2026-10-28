"use client";

import * as React from "react";
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
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import {
  fetchProductsFromDb,
  createProductInDb,
  updateProductInDb,
  deleteProductInDb,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

export interface ProductItem {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  category: string;
  status: "active" | "draft" | "archived";
  source: string;
  variants: number;
  stock: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  rating: number;
  reviews: number;
  featured: boolean;
  basePrice?: number;
}

const initialProducts: ProductItem[] = [
  { id: "1", name: "Blackstrap Molasses (Industrial & Food)", nameBn: "ব্ল্যাকস্ট্র্যাপ মোলাসেস", slug: "blackstrap-molasses", category: "Molasses", status: "active", source: "sugarcane", variants: 4, stock: "in_stock", rating: 4.8, reviews: 24, featured: true, basePrice: 480 },
  { id: "2", name: "Food Grade Pure Molasses", nameBn: "ফুড গ্রেড মোলাসেস", slug: "food-grade-molasses", category: "Molasses", status: "active", source: "sugarcane", variants: 3, stock: "in_stock", rating: 4.5, reviews: 18, featured: false, basePrice: 320 },
  { id: "3", name: "Feed Grade Molasses Grade A", nameBn: "ফিড গ্রেড মোলাসেস এ", slug: "feed-grade-molasses-a", category: "Animal Feed", status: "active", source: "sugar_beet", variants: 2, stock: "low_stock", rating: 4.2, reviews: 11, featured: false, basePrice: 180 },
  { id: "4", name: "Artisanal Date Palm Molasses (Khejur Gur)", nameBn: "খেজুর মোলাসেস", slug: "date-palm-molasses", category: "Specialty", status: "active", source: "date_palm", variants: 2, stock: "out_of_stock", rating: 4.9, reviews: 8, featured: true, basePrice: 650 },
  { id: "5", name: "Heavy Industrial Molasses (Distillery Spec)", nameBn: "ইন্ডাস্ট্রিয়াল মোলাসেস", slug: "industrial-molasses", category: "Industrial", status: "draft", source: "sugarcane", variants: 1, stock: "out_of_stock", rating: 0, reviews: 0, featured: false, basePrice: 120 },
  { id: "6", name: "Certified Organic Sugarcane Molasses", nameBn: "অর্গানিক মোলাসেস", slug: "organic-sugarcane-molasses", category: "Specialty", status: "active", source: "sugarcane", variants: 3, stock: "in_stock", rating: 4.7, reviews: 32, featured: true, basePrice: 590 },
  { id: "7", name: "Bakery Grade Liquid Molasses", nameBn: "বেকারি গ্রেড মোলাসেস", slug: "bakery-grade-molasses", category: "Molasses", status: "active", source: "sugarcane", variants: 2, stock: "in_stock", rating: 4.6, reviews: 14, featured: false, basePrice: 390 },
  { id: "8", name: "Cattle Nutrition Molasses Blend", nameBn: "ক্যাটল নিউট্রিশন ব্লেন্ড", slug: "cattle-nutrition-blend", category: "Animal Feed", status: "active", source: "sugar_beet", variants: 2, stock: "in_stock", rating: 4.3, reviews: 9, featured: false, basePrice: 160 },
  { id: "9", name: "Raw Unrefined Cane Jaggery Syrup", nameBn: "র সুগারকেন সিরাপ", slug: "raw-unrefined-cane-syrup", category: "Specialty", status: "draft", source: "sugarcane", variants: 1, stock: "low_stock", rating: 4.4, reviews: 5, featured: false, basePrice: 420 },
  { id: "10", name: "Fisheries Yeast Culture Molasses", nameBn: "ফিশারিজ কালচার মোলাসেস", slug: "fisheries-culture-molasses", category: "Industrial", status: "active", source: "sugarcane", variants: 2, stock: "in_stock", rating: 4.1, reviews: 7, featured: false, basePrice: 140 },
  { id: "11", name: "Traditional Granulated Gur (Patali)", nameBn: "পাটালি গুড়", slug: "traditional-patali-gur", category: "Specialty", status: "active", source: "date_palm", variants: 3, stock: "in_stock", rating: 4.9, reviews: 45, featured: true, basePrice: 520 },
  { id: "12", name: "High-Brix Fermentation Molasses", nameBn: "হাই-ব্রিক্স ফারমেন্টেশন মোলাসেস", slug: "high-brix-fermentation", category: "Industrial", status: "archived", source: "sugarcane", variants: 1, stock: "out_of_stock", rating: 3.9, reviews: 4, featured: false, basePrice: 110 },
];

const statusStyle: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  draft: "bg-muted text-muted-foreground border-border",
  archived: "bg-destructive/15 text-destructive border-destructive/30",
};

const stockStyle: Record<string, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  low_stock: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  out_of_stock: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  backorder: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

export default function ProductsPage() {
  const [products, setProducts] = React.useState<ProductItem[]>(initialProducts);
  const [activeTab, setActiveTab] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [stockFilter, setStockFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [isDbConnected, setIsDbConnected] = React.useState(false);

  const loadProducts = React.useCallback(async () => {
    setLoading(true);
    try {
      const dbProducts = await fetchProductsFromDb();
      if (dbProducts && dbProducts.length > 0) {
        setProducts(dbProducts);
        setIsDbConnected(true);
      } else {
        // Fallback to initialProducts if empty
        setIsDbConnected(false);
      }
    } catch (err) {
      console.error("Failed to load products from Supabase:", err);
      setIsDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      if (activeTab !== "all" && p.status !== activeTab) return false;
      if (categoryFilter !== "all" && p.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (stockFilter !== "all" && p.stock !== stockFilter) return false;
      return true;
    });
  }, [products, activeTab, categoryFilter, stockFilter]);

  const handleBulkArchive = async (selected: ProductItem[], clearSelection: () => void) => {
    const ids = new Set(selected.map((s) => s.id));
    setProducts((prev) =>
      prev.map((p) => (ids.has(p.id) ? { ...p, status: "archived" as const } : p))
    );
    clearSelection();
    // Sync with Supabase for UUID records
    for (const item of selected) {
      if (item.id.includes("-")) {
        try {
          await updateProductInDb(item.id, { status: "archived" });
        } catch (e) {
          console.warn("Could not archive product in Supabase:", e);
        }
      }
    }
  };

  const handleBulkStatusChange = async (
    selected: ProductItem[],
    newStatus: "active" | "draft" | "archived",
    clearSelection: () => void
  ) => {
    const ids = new Set(selected.map((s) => s.id));
    setProducts((prev) =>
      prev.map((p) => (ids.has(p.id) ? { ...p, status: newStatus } : p))
    );
    clearSelection();
    // Sync with Supabase for UUID records
    for (const item of selected) {
      if (item.id.includes("-")) {
        try {
          await updateProductInDb(item.id, { status: newStatus });
        } catch (e) {
          console.warn("Could not update product status in Supabase:", e);
        }
      }
    }
  };

  const handleBulkDelete = async (selected: ProductItem[], clearSelection: () => void) => {
    const ids = new Set(selected.map((s) => s.id));
    setProducts((prev) => prev.filter((p) => !ids.has(p.id)));
    clearSelection();
    // Sync with Supabase for UUID records
    for (const item of selected) {
      if (item.id.includes("-")) {
        try {
          await deleteProductInDb(item.id);
        } catch (e) {
          console.warn("Could not delete product in Supabase:", e);
        }
      }
    }
  };

  const handleExportCSV = (selected: ProductItem[]) => {
    const dataToExport = selected.length > 0 ? selected : filteredProducts;
    const headers = ["ID", "Name", "Category", "Source", "Status", "Stock", "Variants", "Rating"];
    const rows = dataToExport.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      p.source,
      p.status,
      p.stock,
      p.variants,
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

  const productColumns = React.useMemo<ColumnDef<ProductItem>[]>(() => [
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
          <div className="flex items-center gap-3 min-w-[220px]">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-xs">
              <Package2 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors line-clamp-1">
                  {p.name}
                </p>
                {p.featured && (
                  <Badge className="h-4 px-1 text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium border-0 shadow-xs">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Featured
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{p.nameBn}</p>
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
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${statusStyle[status]}`}
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
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${stockStyle[stock]}`}
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
          {row.getValue("variants")}
        </div>
      ),
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
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => alert(`View/Edit ${p.name}`)}>
                <Eye className="h-3.5 w-3.5 mr-2" /> View & Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Manage variants for ${p.name}`)}>
                <Layers className="h-3.5 w-3.5 mr-2" /> Manage Variants
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const duplicated: ProductItem = {
                    ...p,
                    id: String(Date.now()),
                    name: `${p.name} (Copy)`,
                    status: "draft",
                  };
                  setProducts((prev) => [duplicated, ...prev]);
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setProducts((prev) =>
                    prev.map((item) =>
                      item.id === p.id
                        ? { ...item, status: item.status === "archived" ? "active" : "archived" }
                        : item
                    )
                  );
                }}
              >
                <Archive className="h-3.5 w-3.5 mr-2" />
                {p.status === "archived" ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setProducts((prev) => prev.filter((item) => item.id !== p.id));
                }}
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
            Manage catalog items, variants, stock status, and categorization
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProducts}
            disabled={loading}
            className="h-9 cursor-pointer"
            title="Refresh products"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
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
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
            onClick={async () => {
              const uniqueSlug = `molasses-${Date.now()}`;
              try {
                const created = await createProductInDb({
                  name: "New Artisanal Molasses Batch",
                  nameBn: "নতুন মোলাসেস ব্যাচ",
                  slug: uniqueSlug,
                  status: "draft",
                  source: "sugarcane",
                  summary: "Fresh harvest molasses from Jessore depot",
                });
                if (created) {
                  setProducts((prev) => [
                    {
                      id: created.id,
                      name: created.name,
                      nameBn: created.name_bn || "",
                      slug: created.slug,
                      category: "General Molasses",
                      status: "draft",
                      source: created.source || "sugarcane",
                      variants: 0,
                      stock: "in_stock",
                      rating: 0,
                      reviews: 0,
                      featured: false,
                      basePrice: 350,
                    },
                    ...prev,
                  ]);
                  return;
                }
              } catch (e) {
                console.warn("Supabase create fallback:", e);
              }
              const newProd: ProductItem = {
                id: String(Date.now()),
                name: "New Artisanal Molasses Batch",
                nameBn: "নতুন মোলাসেস ব্যাচ",
                slug: uniqueSlug,
                category: "Molasses",
                status: "draft",
                source: "sugarcane",
                variants: 1,
                stock: "in_stock",
                rating: 0,
                reviews: 0,
                featured: false,
                basePrice: 350,
              };
              setProducts((prev) => [newProd, ...prev]);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
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
                All <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{totalCount}</span>
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs">
                Active <span className="ml-1.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[10px]">{activeCount}</span>
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs">
                Draft <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{draftCount}</span>
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-xs">
                Archived <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{archivedCount}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <DataTable
            columns={productColumns}
            data={filteredProducts}
            searchPlaceholder="Search products by title or category..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={5}
            pageSizeOptions={[5, 10, 20, 50]}
            toolbarPrefix={
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v || "all")}>
                  <SelectTrigger className="w-36 h-9 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="Molasses">Molasses</SelectItem>
                    <SelectItem value="Animal Feed">Animal Feed</SelectItem>
                    <SelectItem value="Specialty">Specialty</SelectItem>
                    <SelectItem value="Industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={stockFilter} onValueChange={(v) => setStockFilter(v || "all")}>
                  <SelectTrigger className="w-36 h-9 text-xs">
                    <SelectValue placeholder="Stock status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stock</SelectItem>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>

                {(categoryFilter !== "all" || stockFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCategoryFilter("all");
                      setStockFilter("all");
                    }}
                    className="h-9 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset filters
                  </Button>
                )}
              </div>
            }
            bulkActions={(selected, clearSelection) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background"
                  onClick={() => handleBulkStatusChange(selected, "active", clearSelection)}
                >
                  Mark Active
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background"
                  onClick={() => handleBulkArchive(selected, clearSelection)}
                >
                  <Archive className="h-3.5 w-3.5 mr-1" />
                  Archive
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
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={() => handleBulkDelete(selected, clearSelection)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </>
            )}
            emptyMessage="No products match the selected filters or search query."
          />
        </Tabs>
      </motion.div>
    </div>
  );
}
