"use client";

import * as React from "react";
import Link from "next/link";
import {
  GripVertical,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Sparkles,
  Package2,
  RefreshCw,
  Check,
  RotateCcw,
  ArrowLeft,
  ExternalLink,
  Search,
  Eye,
  Info,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type UiProductItem } from "@/lib/supabase";
import { getAdminProductsAction, updateProductsSortOrderAction } from "@/actions/products";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ReorderProductsPageClient() {
  const queryClient = useQueryClient();

  const {
    data: allProducts = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: getAdminProductsAction,
  });

  // Filter to active products, sorted by sortOrder ASC
  const initialActiveProducts = React.useMemo(() => {
    return [...allProducts]
      .filter((p) => p.status === "active")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [allProducts]);

  const [items, setItems] = React.useState<UiProductItem[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  // Initialize or re-sync items when data loads or changes
  React.useEffect(() => {
    if (initialActiveProducts.length > 0 && items.length === 0) {
      setItems(initialActiveProducts);
    }
  }, [initialActiveProducts, items.length]);

  // Check if modified compared to initial
  const isDirty = React.useMemo(() => {
    if (items.length !== initialActiveProducts.length) return false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].id !== initialActiveProducts[i].id) return true;
    }
    return false;
  }, [items, initialActiveProducts]);

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return;
    const newItems = [...items];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);
    setItems(newItems);
  };

  const moveToTop = (index: number) => {
    moveItem(index, 0);
  };

  const moveToBottom = (index: number) => {
    moveItem(index, items.length - 1);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      moveItem(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleReset = () => {
    setItems(initialActiveProducts);
    toast.info("Reset to live order.");
  };

  const handleSave = async () => {
    if (!isDirty || items.length === 0) return;

    try {
      setIsSaving(true);
      const orderedIds = items.map((it) => it.id);
      const res = await updateProductsSortOrderAction(orderedIds);

      if (!res.success) {
        throw new Error(res.error || "Failed to update product order.");
      }

      toast.success("Storefront product order saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-products"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "products"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save product order.");
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut: Ctrl+S or Cmd+S to save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isSaving) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isSaving, items]);

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameBn && p.nameBn.toLowerCase().includes(q)) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const heroProduct = items[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/70 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/products"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Products Catalog</span>
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Storefront Product Order</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Storefront Product Order
            {isDirty && (
              <Badge className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40">
                Unsaved Changes
              </Badge>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Drag and drop or use the reorder buttons to set which product appears 1st, 2nd, and so on for storefront visitors.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" asChild className="h-9 cursor-pointer">
            <Link href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Storefront
            </Link>
          </Button>

          {isDirty && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={handleReset}
              className="h-9 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset Order
            </Button>
          )}

          <Button
            size="sm"
            disabled={isSaving || !isDirty}
            onClick={handleSave}
            className="h-9 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs min-w-[125px]"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Order
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Grid Layout: Drag List & Live Storefront Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Interactive Reorder Workspace */}
        <div className="lg:col-span-2 space-y-4">
          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Find a product to position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs bg-background"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              <Package2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>{items.length}</strong> active products
              </span>
            </div>
          </div>

          {/* Draggable Card List */}
          {isLoading ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-muted/40 rounded-xl border border-border animate-pulse" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-xl">
              <Package2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No active products match your search.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((product) => {
                // Find true index in overall items array
                const index = items.findIndex((it) => it.id === product.id);
                const isHero = index === 0;
                const isDragging = draggedIndex === index;
                const isTarget = dragOverIndex === index && draggedIndex !== index;

                return (
                  <div
                    key={product.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "group relative flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing select-none",
                      isHero
                        ? "bg-gradient-to-r from-amber-500/[0.08] to-transparent border-amber-500/50 shadow-xs ring-1 ring-amber-500/20"
                        : "bg-card border-border hover:border-amber-500/40 hover:bg-muted/30 shadow-xs",
                      isDragging && "opacity-30 scale-[0.98] ring-2 ring-amber-500",
                      isTarget && "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/40"
                    )}
                  >
                    {/* Drag Handle */}
                    <div className="text-muted-foreground/50 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors p-1.5 -ml-1 rounded-md hover:bg-muted">
                      <GripVertical className="h-5 w-5" />
                    </div>

                    {/* Position Number Pill */}
                    <div className="shrink-0 flex items-center justify-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-lg text-xs font-mono font-bold tracking-tight border",
                          isHero
                            ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                            : "bg-muted text-foreground border-border/80"
                        )}
                        title={`Position #${index + 1}`}
                      >
                        #{index + 1}
                      </span>
                    </div>

                    {/* Product Thumbnail */}
                    <div className="h-12 w-12 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-2xs relative">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Package2 className="h-6 w-6 text-muted-foreground/60" />
                      )}
                    </div>

                    {/* Product Metadata */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-sm text-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors truncate"
                        >
                          {product.name}
                        </Link>
                        {isHero && (
                          <Badge className="h-5 px-1.5 text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium border-0 shadow-2xs">
                            <Sparkles className="h-3 w-3 mr-1" /> Storefront Hero
                          </Badge>
                        )}
                        {product.featured && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-300">
                            Featured
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate">
                        {product.nameBn && (
                          <span className="font-bangla truncate text-muted-foreground/90">
                            {product.nameBn}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/40">•</span>
                        <span className="font-mono text-[11px] text-muted-foreground/70 truncate">
                          /{product.slug}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">•</span>
                        <span className="text-foreground/80 font-medium">
                          ৳{product.basePrice ? product.basePrice.toLocaleString() : "0"}
                        </span>
                      </div>
                    </div>

                    {/* Quick Move Button Group */}
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0 || isSaving}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToTop(index);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-20"
                        title="Move to Top (Hero #1)"
                      >
                        <ChevronsUp className="h-4 w-4" />
                        <span className="sr-only">Move to Top</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0 || isSaving}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(index, index - 1);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-20"
                        title="Move Up"
                      >
                        <ChevronUp className="h-4 w-4" />
                        <span className="sr-only">Move Up</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === items.length - 1 || isSaving}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(index, index + 1);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-20"
                        title="Move Down"
                      >
                        <ChevronDown className="h-4 w-4" />
                        <span className="sr-only">Move Down</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === items.length - 1 || isSaving}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToBottom(index);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-20"
                        title="Move to Bottom"
                      >
                        <ChevronsDown className="h-4 w-4" />
                        <span className="sr-only">Move to Bottom</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Storefront Showcase Live Preview & Guide */}
        <div className="space-y-6">
          {/* Live Hero Preview Card */}
          <Card className="border border-border/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-amber-600" />
                  Live Hero Product Preview
                </span>
                <Badge className="bg-amber-600 text-white font-mono text-[10px] px-2 py-0.5">
                  Position #1
                </Badge>
              </div>
              <CardTitle className="text-base font-bold text-foreground">
                {heroProduct ? heroProduct.name : "Loading..."}
              </CardTitle>
              <CardDescription className="text-xs font-bangla">
                {heroProduct?.nameBn || "প্রথম প্রদর্শিত পণ্য"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-muted/60 border border-border">
                {heroProduct?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroProduct.imageUrl}
                    alt={heroProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package2 className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge className="bg-black/75 backdrop-blur-xs text-white text-[10px] border-0">
                    Hero Section
                  </Badge>
                </div>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg border border-border/60 text-xs space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Base Price:</span>
                  <strong className="text-foreground">৳{heroProduct?.basePrice || 0}</strong>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Slug:</span>
                  <span className="font-mono text-muted-foreground">/{heroProduct?.slug}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Category:</span>
                  <span className="text-foreground">{heroProduct?.category}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sequence Overview Card */}
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-600" />
                Storefront Scroll Sequence
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <ol className="space-y-2 text-xs">
                {items.slice(0, 6).map((item, idx) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg border transition-colors",
                      idx === 0
                        ? "bg-amber-500/10 border-amber-500/30 font-semibold text-foreground"
                        : "bg-muted/20 border-border/60 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold text-[11px] w-5 text-amber-600 dark:text-amber-400">
                        #{idx + 1}
                      </span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    {idx === 0 && (
                      <Badge className="text-[9px] h-4 px-1 bg-amber-600 text-white shrink-0">
                        Hero
                      </Badge>
                    )}
                  </li>
                ))}
                {items.length > 6 && (
                  <li className="text-center text-muted-foreground/60 py-1 text-[11px]">
                    + {items.length - 6} more products below...
                  </li>
                )}
              </ol>
            </CardContent>
          </Card>

          {/* Helpful Tips Card */}
          <div className="p-4 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Info className="h-4 w-4 text-amber-600" />
              How Storefront Ordering Works
            </div>
            <p className="leading-relaxed">
              1. <strong>Position #1</strong> is shown first as the hero showcase on the home page.
            </p>
            <p className="leading-relaxed">
              2. Visitors scrolling down experience products in this exact order (2nd, 3rd, and so on).
            </p>
            <p className="leading-relaxed">
              3. Saving immediately purges storefront cache tags so live customers see the update without delay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
