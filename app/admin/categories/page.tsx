"use client";
import * as React from "react";
import { motion } from "motion/react";
import { Plus, Layers, FolderTree, Package, MoreHorizontal, ArrowUpDown, Download, Trash2, Edit, Database, RefreshCw } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { fetchCategoriesFromDb, createCategoryInDb, deleteCategoryInDb } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

export interface CategoryItem {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  parent: string;
  productsCount: number;
  displayOrder: number;
  status: "active" | "draft" | "archived";
  image: string;
}

const initialCategories: CategoryItem[] = [
  {
    id: "CAT-001",
    name: "Edible Molasses & Gur",
    nameBn: "খাবার উপযোগী মোলাসেস ও গুড়",
    slug: "edible-molasses",
    parent: "None (Top Level)",
    productsCount: 14,
    displayOrder: 1,
    status: "active",
    image: "🍯",
  },
  {
    id: "CAT-002",
    name: "Animal Feed Molasses",
    nameBn: "পশু খাদ্যের মোলাসেস",
    slug: "animal-feed-molasses",
    parent: "None (Top Level)",
    productsCount: 9,
    displayOrder: 2,
    status: "active",
    image: "🐄",
  },
  {
    id: "CAT-003",
    name: "Specialty & Organic Date Palm",
    nameBn: "স্পেশাল অর্গানিক খেজুর গুড়",
    slug: "specialty-organic-date-palm",
    parent: "Edible Molasses & Gur",
    productsCount: 7,
    displayOrder: 3,
    status: "active",
    image: "🌴",
  },
  {
    id: "CAT-004",
    name: "Industrial & Distillery Grade",
    nameBn: "ইন্ডাস্ট্রিয়াল গ্রেড মোলাসেস",
    slug: "industrial-grade",
    parent: "None (Top Level)",
    productsCount: 6,
    displayOrder: 4,
    status: "active",
    image: "🏭",
  },
  {
    id: "CAT-005",
    name: "Agricultural & Soil Conditioner",
    nameBn: "কৃষি ও মাটির পুষ্টি",
    slug: "agricultural-soil-conditioner",
    parent: "None (Top Level)",
    productsCount: 5,
    displayOrder: 5,
    status: "active",
    image: "🌱",
  },
  {
    id: "CAT-006",
    name: "Blackstrap High Brix Raw",
    nameBn: "ব্ল্যাকস্ট্র্যাপ হাই ব্রিক্স র",
    slug: "blackstrap-high-brix",
    parent: "Edible Molasses & Gur",
    productsCount: 6,
    displayOrder: 6,
    status: "draft",
    image: "🏺",
  },
  {
    id: "CAT-007",
    name: "Export Quality Jaggery Blocks",
    nameBn: "রপ্তানি মান গুড় ব্লক",
    slug: "export-quality-jaggery",
    parent: "Specialty & Organic Date Palm",
    productsCount: 4,
    displayOrder: 7,
    status: "active",
    image: "📦",
  },
];

export default function CategoriesPage() {
  const [categories, setCategories] = React.useState<CategoryItem[]>(initialCategories);
  const [loading, setLoading] = React.useState(true);
  const [isDbConnected, setIsDbConnected] = React.useState(false);

  const loadCategories = React.useCallback(async () => {
    setLoading(true);
    try {
      const dbCategories = await fetchCategoriesFromDb();
      if (dbCategories && dbCategories.length > 0) {
        setCategories(dbCategories);
        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
      }
    } catch (err) {
      console.error("Failed to load categories from Supabase:", err);
      setIsDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleExportCSV = (selected: CategoryItem[]) => {
    const list = selected.length > 0 ? selected : categories;
    const headers = ["ID", "Name", "NameBn", "Slug", "Parent", "Products", "Order", "Status"];
    const rows = list.map((c) => [
      c.id,
      `"${c.name}"`,
      `"${c.nameBn}"`,
      c.slug,
      `"${c.parent}"`,
      c.productsCount,
      c.displayOrder,
      c.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `categories_${Date.now()}.csv`;
    link.click();
  };

  const categoryColumns = React.useMemo<ColumnDef<CategoryItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all categories"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select category"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "image",
      header: () => <span className="text-center block w-8">Icon</span>,
      cell: ({ row }) => <span className="text-xl block text-center">{row.getValue("image")}</span>,
      enableSorting: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category Name (EN & BN)" />,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="min-w-[190px]">
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {c.name}
            </p>
            <p className="text-xs text-muted-foreground">{c.nameBn}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "slug",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Slug" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">/{row.getValue("slug")}</span>
      ),
    },
    {
      accessorKey: "parent",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Parent Hierarchy" />,
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
        <span className="text-xs font-semibold">{row.getValue("productsCount")} items</span>
      ),
    },
    {
      accessorKey: "displayOrder",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground">#{row.getValue("displayOrder")}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant="secondary"
            className={
              status === "active"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 capitalize text-[11px] border-emerald-500/30"
                : "bg-muted text-muted-foreground capitalize text-[11px]"
            }
          >
            {status}
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
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => alert(`Edit ${c.name}`)}>
                <Edit className="h-3.5 w-3.5 mr-2" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Add subcategory under ${c.name}`)}>
                <Plus className="h-3.5 w-3.5 mr-2" /> Add Subcategory
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setCategories((prev) => prev.filter((item) => item.id !== c.id))}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Organize catalog hierarchy, English & Bangla taxonomy, and display priority
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCategories}
            disabled={loading}
            className="h-9 cursor-pointer"
            title="Refresh categories"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
            onClick={async () => {
              const uniqueSlug = `sweeteners-${Date.now().toString().slice(-4)}`;
              try {
                const created = await createCategoryInDb({
                  name: "New Gourmet Sweeteners",
                  nameBn: "নতুন মিষ্টি পণ্য",
                  slug: uniqueSlug,
                  description: "Artisanal sweeteners from natural cane & palm",
                  sort_order: categories.length + 1,
                  is_active: true,
                });
                if (created) {
                  setCategories((prev) => [
                    {
                      id: created.id,
                      name: created.name,
                      nameBn: created.name_bn || "",
                      slug: created.slug,
                      parent: "None (Top Level)",
                      productsCount: 0,
                      displayOrder: created.sort_order || categories.length + 1,
                      status: created.is_active ? "active" : "draft",
                      image: "🍬",
                    },
                    ...prev,
                  ]);
                  return;
                }
              } catch (e) {
                console.warn("Supabase category create fallback:", e);
              }
              const newCat: CategoryItem = {
                id: `CAT-00${categories.length + 1}`,
                name: "New Gourmet Sweeteners",
                nameBn: "নতুন মিষ্টি পণ্য",
                slug: uniqueSlug,
                parent: "None (Top Level)",
                productsCount: 0,
                displayOrder: categories.length + 1,
                status: "draft",
                image: "🍬",
              };
              setCategories((prev) => [newCat, ...prev]);
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Categories</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{categories.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Top-level & subcategories</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Catalog Items Mapped</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {categories.reduce((acc, c) => acc + c.productsCount, 0)} Products
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">100% catalog coverage</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Categories</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <FolderTree className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {categories.filter((c) => c.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Live on storefront navigation</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* TanStack Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable
          columns={categoryColumns}
          data={categories}
          searchPlaceholder="Search category name or slug..."
          enableRowSelection={true}
          enableSorting={true}
          enablePagination={true}
          initialPageSize={5}
          pageSizeOptions={[5, 10, 20]}
          bulkActions={(selected, clearSelection) => (
            <>
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
                onClick={() => {
                  const ids = new Set(selected.map((s) => s.id));
                  setCategories((prev) => prev.filter((c) => !ids.has(c.id)));
                  clearSelection();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Selected
              </Button>
            </>
          )}
          emptyMessage="No categories match your search query."
        />
      </motion.div>
    </div>
  );
}
