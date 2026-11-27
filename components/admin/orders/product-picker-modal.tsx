"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  Layers,
  Minus,
  Package,
  PackagePlus,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CatalogProduct, OrderItem } from "@/types/order";
import {
  addFilteredCatalogProducts,
  buildOrderItemsFromCartEntries,
  extractCatalogCategories,
  filterAndGroupCatalogProducts,
  formatPackTypeLabel,
  formatWeightLabel,
  getCatalogStockInfo,
  resetCartEntryPrice,
  setCartEntryPrice,
  setCartEntryQuantity,
  setCatalogProductQuantity,
  syncOrderItemsToCartEntries,
  type PickerCartEntry,
} from "@/lib/product-picker";

const FALLBACK_PRODUCT_IMAGE = "/images/products/raw-sugarcane-drum.jpg";
const PACKAGE_PILL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Packs" },
  { value: "jar", label: "Jar" },
  { value: "foil", label: "Foil" },
  { value: "bottle", label: "Bottle" },
  { value: "box", label: "Box" },
];

export interface ProductPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogProducts: CatalogProduct[];
  currentItems: OrderItem[];
  onApplyItems: (items: OrderItem[]) => void;
}

const STOCK_TONE_CLASSES = {
  emerald:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80",
  amber:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80",
  rose:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/80",
} as const;

function ProductThumbnail({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const resolvedSrc = !failed && src ? src : FALLBACK_PRODUCT_IMAGE;

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={48}
      height={48}
      unoptimized
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

export function ProductPickerModal({
  open,
  onOpenChange,
  catalogProducts,
  currentItems,
  onApplyItems,
}: ProductPickerModalProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        id="dialog-content-product-selection"
        overlayClassName="z-[55]"
        className="z-[60] w-screen h-[100dvh] max-w-none max-h-none rounded-none md:rounded-xl md:w-[94vw] md:max-w-[1220px] md:h-[90vh] md:max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col bg-background"
        mobileClassName="h-[94dvh] max-h-[94dvh] p-0"
      >
        {open ? (
          <ProductPickerWorkspace
            onOpenChange={onOpenChange}
            catalogProducts={catalogProducts}
            currentItems={currentItems}
            onApplyItems={onApplyItems}
          />
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ProductPickerWorkspace({
  onOpenChange,
  catalogProducts,
  currentItems,
  onApplyItems,
}: Omit<ProductPickerModalProps, "open">) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [packageFilter, setPackageFilter] = React.useState("all");
  const [cartEntries, setCartEntries] = React.useState<PickerCartEntry[]>(() =>
    syncOrderItemsToCartEntries(currentItems, catalogProducts)
  );
  const [mobilePane, setMobilePane] = React.useState<"catalog" | "cart">("catalog");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, []);

  const categories = React.useMemo(
    () => extractCatalogCategories(catalogProducts),
    [catalogProducts]
  );

  const filteredGroups = React.useMemo(
    () =>
      filterAndGroupCatalogProducts(catalogProducts, {
        query: searchQuery,
        category: categoryFilter,
        packType: packageFilter,
      }),
    [catalogProducts, searchQuery, categoryFilter, packageFilter]
  );

  const filteredVariants = React.useMemo(
    () => filteredGroups.flatMap((group) => group.variants),
    [filteredGroups]
  );

  // Lookup map by SKU so catalog rows read quantity/override state in O(1).
  const cartBySku = React.useMemo(() => {
    const map = new Map<string, PickerCartEntry>();
    for (const entry of cartEntries) {
      if (!map.has(entry.sku)) {
        map.set(entry.sku, entry);
      }
    }
    return map;
  }, [cartEntries]);

  const { totalUnits, subtotal, customPriceCount, outOfStockCount } = React.useMemo(() => {
    let units = 0;
    let sum = 0;
    let customCount = 0;
    let oosCount = 0;

    for (const entry of cartEntries) {
      units += entry.quantity;
      sum += entry.quantity * entry.unit_price;
      if (entry.catalog_unit_price !== null && entry.unit_price !== entry.catalog_unit_price) {
        customCount += 1;
      }
      if (entry.in_catalog) {
        const stockInfo = getCatalogStockInfo({
          stock_status: entry.stock_status,
          available_qty: entry.available_qty,
          stock: entry.stock || "",
        });
        if (stockInfo.isOutOfStock) {
          oosCount += 1;
        }
      }
    }

    return {
      totalUnits: units,
      subtotal: sum,
      customPriceCount: customCount,
      outOfStockCount: oosCount,
    };
  }, [cartEntries]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || categoryFilter !== "all" || packageFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setPackageFilter("all");
    searchInputRef.current?.focus();
  };

  const handleToggleVariant = (variant: CatalogProduct) => {
    const current = cartBySku.get(variant.sku);
    const nextQty = current ? 0 : 1;
    setCartEntries((prev) => setCatalogProductQuantity(prev, variant, nextQty));
  };

  const handleIncrementVariant = (variant: CatalogProduct) => {
    const current = cartBySku.get(variant.sku);
    const nextQty = (current?.quantity ?? 0) + 1;
    setCartEntries((prev) => setCatalogProductQuantity(prev, variant, nextQty));
  };

  const handleSetVariantQty = (variant: CatalogProduct, nextQty: number) => {
    setCartEntries((prev) => setCatalogProductQuantity(prev, variant, nextQty));
  };

  const handleSelectAllFiltered = () => {
    setCartEntries((prev) => addFilteredCatalogProducts(prev, filteredVariants));
  };

  const handleClearCart = () => {
    setCartEntries([]);
  };

  const handleApply = () => {
    const nextItems = buildOrderItemsFromCartEntries(cartEntries);
    onApplyItems(nextItems);
    onOpenChange(false);
  };

  const applyDisabled = cartEntries.length === 0 && currentItems.length === 0;

  return (
    <>
      {/* TOP HEADER */}
        <ResponsiveDialogHeader className="px-4 py-3 md:px-5 md:py-3.5 border-b bg-card shrink-0 text-left space-y-0">
          <div className="flex items-start justify-between gap-3 pr-8 md:pr-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shrink-0">
                <PackagePlus className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                <ResponsiveDialogTitle className="text-base md:text-lg font-bold tracking-tight truncate">
                  Select Order Products
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Click any variant to add to cart, then tune quantities or override ৳ prices on the right.
                </ResponsiveDialogDescription>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/40 text-xs">
                <ShoppingCart className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold tabular-nums">
                  {cartEntries.length} {cartEntries.length === 1 ? "item" : "items"}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground tabular-nums">{totalUnits} units</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  ৳ {subtotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </ResponsiveDialogHeader>

        {/* SEARCH & FAST 1-CLICK FILTER TOOLBAR */}
        <div className="px-4 py-2.5 md:px-5 border-b bg-muted/25 shrink-0 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                id="product-search-input"
                type="search"
                autoComplete="off"
                placeholder="Search English / বাংলা নাম, variant, SKU, or combo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm bg-background focus-visible:ring-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
              <Button
                id="btn-modal-select-all"
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllFiltered}
                disabled={filteredVariants.length === 0}
                className="h-9 px-2.5 text-xs font-medium bg-background hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 cursor-pointer"
                title="Add every filtered variant not yet in the cart"
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-amber-600" />
                Add Filtered ({filteredVariants.length})
              </Button>
              <Button
                id="btn-modal-clear"
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearCart}
                disabled={cartEntries.length === 0}
                className="h-9 px-2.5 text-xs font-medium bg-background text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
              >
                Clear Cart
              </Button>
            </div>
          </div>

          {/* 1-CLICK CATEGORY & PACKAGING PILLS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 pr-0.5">
              Category:
            </span>
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-2.5 py-1 min-h-[28px] rounded-full text-[11px] font-medium border transition-colors motion-reduce:transition-none shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                categoryFilter === "all"
                  ? "bg-foreground text-background border-foreground shadow-xs"
                  : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
              )}
            >
              All
            </button>
            {categories.map((cat) => {
              const active = categoryFilter.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(active ? "all" : cat)}
                  className={cn(
                    "px-2.5 py-1 min-h-[28px] rounded-full text-[11px] font-medium border transition-colors motion-reduce:transition-none shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                    active
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-amber-300"
                  )}
                >
                  {cat}
                </button>
              );
            })}

            <div className="h-4 w-px bg-border mx-1 shrink-0" aria-hidden="true" />

            <div id="modal-package-type-filter" className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 pr-0.5">
                Pack:
              </span>
              {PACKAGE_PILL_OPTIONS.map((pill) => {
                const active = packageFilter === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() =>
                      setPackageFilter(active && pill.value !== "all" ? "all" : pill.value)
                    }
                    className={cn(
                      "px-2.5 py-1 min-h-[28px] rounded-full text-[11px] font-medium border transition-colors motion-reduce:transition-none shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                      active
                        ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* MOBILE VIEW SWITCHER (< lg) */}
        <div className="lg:hidden grid grid-cols-2 border-b bg-card shrink-0">
          <button
            type="button"
            onClick={() => setMobilePane("catalog")}
            className={cn(
              "py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer min-h-[44px]",
              mobilePane === "catalog"
                ? "border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-3.5 w-3.5" />
            Catalog ({filteredVariants.length})
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("cart")}
            className={cn(
              "py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer min-h-[44px]",
              mobilePane === "cart"
                ? "border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Order Cart ({cartEntries.length})
          </button>
        </div>

        {/* 2-COLUMN SPLIT POS WORKSPACE */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT COLUMN: SEARCHABLE GROUPED CATALOG */}
          <section
            aria-label="Product catalog"
            className={cn(
              "flex-1 min-w-0 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 bg-muted/10",
              mobilePane === "cart" ? "hidden lg:block" : "block"
            )}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground px-0.5">
              <span>
                Showing <strong className="text-foreground font-semibold">{filteredVariants.length}</strong>{" "}
                {filteredVariants.length === 1 ? "variant" : "variants"} across{" "}
                <strong className="text-foreground font-semibold">{filteredGroups.length}</strong>{" "}
                {filteredGroups.length === 1 ? "product" : "products"}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-amber-700 dark:text-amber-400 hover:underline font-medium cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>

            {filteredGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card/60 py-10 px-4 text-center space-y-3">
                <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Search className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    No matching products found
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? `Nothing matched "${searchQuery}" under the active filters.`
                      : "No variants match your selected category or pack filter."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {hasActiveFilters && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleResetFilters}
                      className="h-8 text-xs cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Show All Catalog Products
                    </Button>
                  )}
                  {categories.slice(0, 3).map((cat) => (
                    <Button
                      key={cat}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSearchQuery("");
                        setPackageFilter("all");
                        setCategoryFilter(cat);
                      }}
                      className="h-8 text-xs cursor-pointer"
                    >
                      Browse {cat}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const selectedInGroup = group.variants.filter((v) => cartBySku.has(v.sku)).length;

                return (
                  <div
                    key={group.key}
                    className={cn(
                      "rounded-xl border bg-card shadow-xs overflow-hidden transition-colors",
                      selectedInGroup > 0
                        ? "border-amber-300/80 dark:border-amber-800/70"
                        : "border-border/80"
                    )}
                  >
                    {/* PRODUCT PARENT HEADER */}
                    <div className="px-3.5 py-2.5 border-b bg-muted/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg border bg-background overflow-hidden shrink-0">
                          <ProductThumbnail
                            key={group.image || FALLBACK_PRODUCT_IMAGE}
                            src={group.image}
                            alt={group.productName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
                              {group.productName}
                            </h3>
                            {group.productNameBn && (
                              <span className="text-xs text-muted-foreground truncate">
                                ({group.productNameBn})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground"
                            >
                              {group.category}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {group.variants.length}{" "}
                              {group.variants.length === 1 ? "variant" : "variants"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {selectedInGroup > 0 && (
                        <Badge className="shrink-0 bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-[10px] font-semibold">
                          {selectedInGroup} in cart
                        </Badge>
                      )}
                    </div>

                    {/* VARIANT ROWS */}
                    <div className="divide-y divide-border/70">
                      {group.variants.map((variant) => {
                        const cartEntry = cartBySku.get(variant.sku);
                        const qty = cartEntry?.quantity ?? 0;
                        const isSelected = qty > 0;
                        const hasCustomPrice =
                          Boolean(cartEntry) &&
                          cartEntry!.catalog_unit_price !== null &&
                          cartEntry!.unit_price !== cartEntry!.catalog_unit_price;
                        const stockInfo = getCatalogStockInfo(variant);
                        const weightLabel = formatWeightLabel(variant.weight_grams);
                        const packLabel = formatPackTypeLabel(variant.pack_type);

                        return (
                          <div
                            key={variant.sku}
                            className={cn(
                              "px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors motion-reduce:transition-none",
                              isSelected
                                ? "bg-amber-50/55 dark:bg-amber-950/20"
                                : "hover:bg-muted/35"
                            )}
                          >
                            {/* LEFT / MIDDLE: TOGGLE + CLICKABLE ADD ROW */}
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                              <button
                                id={`btn-select-product-${variant.sku}`}
                                type="button"
                                onClick={() => handleToggleVariant(variant)}
                                aria-label={
                                  isSelected
                                    ? `Remove ${variant.product_name} ${variant.variant_name} from cart`
                                    : `Add ${variant.product_name} ${variant.variant_name} to cart`
                                }
                                aria-pressed={isSelected}
                                className={cn(
                                  "mt-0.5 sm:mt-0 h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                                  isSelected
                                    ? "bg-amber-600 border-amber-600 text-white"
                                    : "border-muted-foreground/40 bg-background hover:border-amber-500"
                                )}
                              >
                                {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleIncrementVariant(variant)}
                                className="flex-1 min-w-0 text-left cursor-pointer rounded-md py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                title="Click to add 1 unit to order cart"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-sm font-semibold text-foreground leading-snug">
                                    {variant.variant_name}
                                  </span>
                                  {variant.variant_name_bn && (
                                    <span className="text-[11px] text-muted-foreground">
                                      ({variant.variant_name_bn})
                                    </span>
                                  )}
                                  {variant.is_combo && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800 gap-1 font-medium"
                                    >
                                      <Layers className="h-2.5 w-2.5" />
                                      Combo
                                    </Badge>
                                  )}
                                  {hasCustomPrice && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 bg-amber-100/70 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-mono"
                                    >
                                      ৳{cartEntry!.unit_price.toLocaleString()} custom
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {variant.sku}
                                  </span>
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border",
                                      STOCK_TONE_CLASSES[stockInfo.tone]
                                    )}
                                  >
                                    {stockInfo.isOutOfStock && (
                                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                    )}
                                    {stockInfo.label}
                                  </span>
                                  {variant.pack_type && (
                                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                                      {packLabel}
                                    </span>
                                  )}
                                  {weightLabel && (
                                    <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 tabular-nums">
                                      {weightLabel}
                                    </span>
                                  )}
                                </div>
                              </button>
                            </div>

                            {/* RIGHT: BASE PRICE + INLINE STEPPER / ADD BUTTON */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 pl-7 sm:pl-0 shrink-0">
                              <span className="font-mono text-xs sm:text-sm font-bold text-foreground tabular-nums">
                                ৳ {variant.unit_price.toLocaleString()}
                              </span>

                              {isSelected ? (
                                <div className="flex items-center rounded-lg border border-amber-300 dark:border-amber-700 bg-background overflow-hidden shadow-2xs">
                                  <Button
                                    id={`btn-qty-minus-${variant.sku}`}
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label={`Decrease quantity for ${variant.variant_name}`}
                                    onClick={() => handleSetVariantQty(variant, qty - 1)}
                                    className="h-9 w-9 sm:h-8 sm:w-8 rounded-none text-muted-foreground hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </Button>
                                  <Input
                                    id={`input-product-qty-${variant.sku}`}
                                    type="number"
                                    min={0}
                                    aria-label={`Quantity for ${variant.variant_name}`}
                                    value={qty}
                                    onChange={(e) => {
                                      const parsed = Number.parseInt(e.target.value, 10);
                                      if (!Number.isNaN(parsed)) {
                                        handleSetVariantQty(variant, parsed);
                                      }
                                    }}
                                    className="h-9 sm:h-8 w-12 border-0 rounded-none text-center font-mono text-xs font-bold tabular-nums px-1 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <Button
                                    id={`btn-qty-plus-${variant.sku}`}
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label={`Increase quantity for ${variant.variant_name}`}
                                    onClick={() => handleSetVariantQty(variant, qty + 1)}
                                    className="h-9 w-9 sm:h-8 sm:w-8 rounded-none text-muted-foreground hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  id={`btn-qty-plus-${variant.sku}`}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetVariantQty(variant, 1)}
                                  className="h-9 sm:h-8 px-3 sm:px-2.5 text-xs font-semibold border-border hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* RIGHT COLUMN: LIVE SELECTED ORDER CART & PRICE OVERRIDES */}
          <aside
            aria-label="Order cart summary and price overrides"
            className={cn(
              "w-full lg:w-[400px] xl:w-[430px] shrink-0 border-t lg:border-t-0 lg:border-l bg-muted/20 flex-col min-h-0 flex-1 lg:flex-initial",
              mobilePane === "cart" ? "flex" : "hidden lg:flex"
            )}
          >
            <div className="px-4 py-2.5 border-b bg-card flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingCart className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Order Cart
                </h3>
                <Badge variant="secondary" className="text-[11px] font-mono tabular-nums h-5">
                  {cartEntries.length}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {outOfStockCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 gap-1"
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {outOfStockCount} OOS
                  </Badge>
                )}
                {customPriceCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                  >
                    {customPriceCount} Custom ৳
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
              {cartEntries.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed bg-card/50 space-y-2">
                  <div className="h-10 w-10 rounded-full bg-amber-100/70 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Order cart is empty</p>
                  <p className="text-xs text-muted-foreground max-w-[240px]">
                    Click any product row in the catalog to add it here, adjust quantity, or set custom prices.
                  </p>
                  {mobilePane === "cart" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMobilePane("catalog")}
                      className="lg:hidden mt-2 h-9 text-xs cursor-pointer"
                    >
                      Browse Catalog
                    </Button>
                  )}
                </div>
              ) : (
                cartEntries.map((entry) => {
                  const lineTotal = entry.quantity * entry.unit_price;
                  const isCustomPrice =
                    entry.catalog_unit_price !== null &&
                    entry.unit_price !== entry.catalog_unit_price;
                  const stockInfo = entry.in_catalog
                    ? getCatalogStockInfo({
                        stock_status: entry.stock_status,
                        available_qty: entry.available_qty,
                        stock: entry.stock || "",
                      })
                    : null;

                  return (
                    <div
                      key={entry.key}
                      className="rounded-xl border bg-card p-3 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-md border bg-muted overflow-hidden shrink-0">
                            <ProductThumbnail
                              key={entry.image || FALLBACK_PRODUCT_IMAGE}
                              src={entry.image}
                              alt={entry.product_name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground leading-tight truncate">
                              {entry.product_name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[11px] font-medium text-muted-foreground truncate">
                                {entry.variant_name}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground/80">
                                {entry.sku}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {!entry.in_catalog && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground"
                                >
                                  Existing Custom Item
                                </Badge>
                              )}
                              {stockInfo?.isOutOfStock && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 gap-1"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Out of stock (Override)
                                </Badge>
                              )}
                              {entry.is_combo && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800"
                                >
                                  Combo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove ${entry.product_name} ${entry.variant_name}`}
                          onClick={() =>
                            setCartEntries((prev) => setCartEntryQuantity(prev, entry.key, 0))
                          }
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0 cursor-pointer"
                          title="Remove from cart"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* QTY + CUSTOM PRICE OVERRIDE + LINE TOTAL */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <div className="flex items-center rounded-md border bg-background overflow-hidden shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={entry.quantity <= 1}
                            aria-label={`Decrease cart quantity for ${entry.variant_name}`}
                            onClick={() =>
                              setCartEntries((prev) =>
                                setCartEntryQuantity(prev, entry.key, entry.quantity - 1)
                              )
                            }
                            className="h-7 w-7 rounded-none cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-mono text-xs font-bold tabular-nums select-none">
                            {entry.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Increase cart quantity for ${entry.variant_name}`}
                            onClick={() =>
                              setCartEntries((prev) =>
                                setCartEntryQuantity(prev, entry.key, entry.quantity + 1)
                              )
                            }
                            className="h-7 w-7 rounded-none cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-1 min-w-0">
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-[11px] font-semibold text-muted-foreground pointer-events-none">
                              ৳
                            </span>
                            <Input
                              id={
                                entry.key === entry.sku
                                  ? `input-product-price-${entry.sku}`
                                  : `input-product-price-${entry.key}`
                              }
                              type="number"
                              min={0}
                              aria-label={`Unit price override for ${entry.variant_name}`}
                              value={entry.unit_price}
                              onChange={(e) => {
                                const nextVal = Number(e.target.value);
                                setCartEntries((prev) =>
                                  setCartEntryPrice(
                                    prev,
                                    entry.key,
                                    Number.isFinite(nextVal) ? nextVal : 0
                                  )
                                );
                              }}
                              className={cn(
                                "h-7 w-[82px] pl-5 pr-1.5 text-right font-mono text-xs font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                isCustomPrice &&
                                  "border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30"
                              )}
                            />
                          </div>
                          {isCustomPrice && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                setCartEntries((prev) => resetCartEntryPrice(prev, entry.key))
                              }
                              title={`Reset to catalog price (৳${entry.catalog_unit_price})`}
                              aria-label={`Reset unit price to catalog price ৳${entry.catalog_unit_price}`}
                              className="h-7 w-7 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer shrink-0"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        <div className="text-right font-mono text-xs font-bold text-foreground tabular-nums min-w-[66px] shrink-0">
                          ৳ {lineTotal.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>

        {/* STICKY FOOTER SUMMARY & CONFIRM CTA */}
        <footer className="px-4 py-3 md:px-5 border-t bg-card shrink-0 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobilePane((p) => (p === "catalog" ? "cart" : "catalog"))}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-muted/40 text-xs font-medium cursor-pointer"
            >
              <ShoppingCart className="h-3.5 w-3.5 text-amber-600" />
              <span className="font-mono font-bold tabular-nums">
                ৳ {subtotal.toLocaleString()}
              </span>
              <span className="text-muted-foreground">({cartEntries.length})</span>
            </button>

            <div className="hidden lg:flex flex-col">
              <span className="text-xs text-muted-foreground">
                Subtotal:{" "}
                <strong className="font-mono text-sm font-bold text-foreground tabular-nums">
                  ৳ {subtotal.toLocaleString()}
                </strong>{" "}
                <span className="tabular-nums">
                  ({cartEntries.length} {cartEntries.length === 1 ? "item" : "items"}, {totalUnits}{" "}
                  units)
                </span>
              </span>
              {(outOfStockCount > 0 || customPriceCount > 0) && (
                <span className="text-[11px] text-muted-foreground">
                  {outOfStockCount > 0 && `${outOfStockCount} out-of-stock override`}
                  {outOfStockCount > 0 && customPriceCount > 0 && " · "}
                  {customPriceCount > 0 && `${customPriceCount} custom price applied`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 px-3.5 text-xs font-medium cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              id="btn-confirm-add-product"
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={applyDisabled}
              className="h-9 px-4 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              <Check className="h-4 w-4 mr-1.5" />
              {currentItems.length > 0
                ? `Apply to Order (${cartEntries.length})`
                : `Add to Order (${cartEntries.length})`}
            </Button>
          </div>
        </footer>
    </>
  );
}
