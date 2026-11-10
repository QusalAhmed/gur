"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gift,
  Boxes,
  Plus,
  Trash2,
  Percent,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  TrendingDown,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/ui/image-uploader";
import { toast } from "sonner";
import type { ComboItemView } from "@/actions/combos";
import { saveComboAction } from "@/actions/combos";
import type { UiProductItem } from "@/lib/supabase/api";

export interface ComboDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  combo?: ComboItemView | null;
  catalogProducts: UiProductItem[];
  allCombos?: ComboItemView[];
  onSaved: () => void;
}

interface ComponentItemState {
  componentVariantId: string;
  productId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  physicalStock: number;
}

export function ComboDrawer({
  isOpen,
  onClose,
  combo,
  catalogProducts,
  allCombos = [],
  onSaved,
}: ComboDrawerProps) {
  const isEditing = Boolean(combo?.id);

  // Form State
  const [name, setName] = React.useState("");
  const [nameBn, setNameBn] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "draft">("active");
  const [price, setPrice] = React.useState<number>(0);
  const [compareAtPrice, setCompareAtPrice] = React.useState<number | null>(null);
  const [image, setImage] = React.useState<string>("");
  const [components, setComponents] = React.useState<ComponentItemState[]>([]);
  const [selectedVariantToAdd, setSelectedVariantToAdd] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Mode: "new" = create new product, "existing" = attach to existing product
  const [mode, setMode] = React.useState<"new" | "existing">("new");
  const [selectedExistingProductId, setSelectedExistingProductId] = React.useState<string>("");

  // Map of component variant ID -> other combos using it
  const variantUsageMap = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of allCombos) {
      if (combo?.variantId && c.variantId === combo.variantId) continue;
      for (const comp of c.components) {
        const list = map.get(comp.componentVariantId) || [];
        list.push(c.name);
        map.set(comp.componentVariantId, list);
      }
    }
    return map;
  }, [allCombos, combo?.variantId]);

  // Flattened selectable catalog variants (excluding combos)
  const selectableVariants = React.useMemo(() => {
    const list: Array<{
      variantId: string;
      productId: string;
      productName: string;
      variantName: string;
      price: number;
      stockStatus: string;
    }> = [];

    for (const p of catalogProducts) {
      // Don't include the current combo product itself to prevent circular reference
      if (combo?.id && p.id === combo.id) continue;
      if (p.variantList && Array.isArray(p.variantList)) {
        for (const v of p.variantList) {
          if (!v.isCombo) {
            list.push({
              variantId: v.id,
              productId: p.id,
              productName: p.name,
              variantName: v.name,
              price: v.price,
              stockStatus: v.stockStatus,
            });
          }
        }
      }
    }
    return list;
  }, [catalogProducts, combo?.id]);

  // Reset or initialize state when drawer opens or combo changes
  React.useEffect(() => {
    if (isOpen) {
      if (combo) {
        setName(combo.name);
        setNameBn(combo.nameBn || "");
        setSlug(combo.slug);
        setStatus(combo.status === "archived" ? "draft" : combo.status);
        setPrice(combo.price);
        setCompareAtPrice(combo.compareAtPrice ?? null);
        setImage(combo.image || "");
        setComponents(
          combo.components.map((c) => ({
            componentVariantId: c.componentVariantId,
            productId: c.productId,
            productName: c.productName,
            variantName: c.variantName,
            unitPrice: c.unitPrice,
            quantity: c.quantity,
            physicalStock: c.physicalStock,
          }))
        );
        setMode("new");
        setSelectedExistingProductId("");
      } else {
        setName("");
        setNameBn("");
        setSlug("");
        setStatus("active");
        setPrice(0);
        setCompareAtPrice(null);
        setImage("");
        setComponents([]);
        setMode("new");
        setSelectedExistingProductId("");
      }
      setSelectedVariantToAdd("");
    }
  }, [isOpen, combo]);

  // Auto-generate slug when name changes in "new" mode
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && mode === "new") {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      setSlug(generated);
    }
  };

  // When selecting an existing product to turn into a combo
  const handleSelectExistingProduct = (prodId: string) => {
    setSelectedExistingProductId(prodId);
    const prod = catalogProducts.find((p) => p.id === prodId);
    if (prod) {
      setName(prod.name);
      setNameBn(prod.nameBn || "");
      setSlug(prod.slug);
      if (prod.imageUrl) {
        setImage(prod.imageUrl);
      }
      const defaultVar = prod.variantList?.[0];
      if (defaultVar) {
        setPrice(defaultVar.price);
        setCompareAtPrice(defaultVar.compareAtPrice ?? null);
      }
    }
  };

  // Add a component to the combo
  const handleAddComponent = () => {
    if (!selectedVariantToAdd) return;
    const item = selectableVariants.find((v) => v.variantId === selectedVariantToAdd);
    if (!item) return;

    if (components.some((c) => c.componentVariantId === item.variantId)) {
      toast.info("This product is already in the combo.");
      return;
    }

    const otherCombos = variantUsageMap.get(item.variantId) || [];

    setComponents((prev) => [
      ...prev,
      {
        componentVariantId: item.variantId,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        unitPrice: item.price,
        quantity: 1,
        physicalStock: 100, // will be resolved server-side
      },
    ]);

    setSelectedVariantToAdd("");
  };

  // Remove a component
  const handleRemoveComponent = (idx: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  // Update component quantity
  const handleUpdateQty = (idx: number, qty: number) => {
    setComponents((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, quantity: Math.max(1, qty) } : c))
    );
  };

  // Calculations
  const regularTotal = React.useMemo(() => {
    return components.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);
  }, [components]);

  const savingsAmount = Math.max(0, regularTotal - price);
  const savingsPct = regularTotal > 0 ? Math.round((savingsAmount / regularTotal) * 100) : 0;

  // Quick discount buttons handler
  const applyQuickDiscount = (pct: number) => {
    if (regularTotal <= 0) return;
    const discounted = Math.round(regularTotal * (1 - pct / 100));
    setPrice(discounted);
    setCompareAtPrice(regularTotal);
  };

  const applyFixedDiscount = (amount: number) => {
    if (regularTotal <= 0) return;
    const discounted = Math.max(0, regularTotal - amount);
    setPrice(discounted);
    setCompareAtPrice(regularTotal);
  };

  // Save Combo
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a combo name.");
      return;
    }
    if (components.length === 0) {
      toast.error("Please add at least one product component to the combo.");
      return;
    }
    if (price <= 0) {
      toast.error("Please enter a valid combo selling price.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveComboAction({
        comboProductId: mode === "existing" ? selectedExistingProductId : combo?.id,
        comboVariantId: combo?.variantId,
        name: name.trim(),
        nameBn: nameBn.trim() || undefined,
        slug: slug.trim() || undefined,
        status,
        price,
        compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice : regularTotal > price ? regularTotal : null,
        imagePath: image.trim(),
        components: components.map((c) => ({
          componentVariantId: c.componentVariantId,
          quantity: c.quantity,
        })),
      });

      if (res.success) {
        toast.success(isEditing ? "Combo offer updated successfully!" : "New combo offer created!");
        onSaved();
        onClose();
      } else {
        toast.error(res.error || "Failed to save combo offer.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background"
      >
        {/* Header */}
        <SheetHeader className="p-6 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <Gift className="h-5 w-5" />
            <span className="text-xs font-bold tracking-wider uppercase">Combo & Bundle Offer</span>
          </div>
          <SheetTitle className="text-lg font-bold text-foreground">
            {isEditing ? `Edit Combo: ${combo?.name}` : "Create New Combo Offer"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Bundle multiple products together, offer a special promotional discount, and automate inventory deductions.
          </SheetDescription>
        </SheetHeader>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Mode Switch (only when creating new) */}
          {!isEditing && (
            <div className="p-1 bg-muted rounded-xl flex gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                  mode === "new"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Brand New Product
              </button>
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                  mode === "existing"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Turn Existing Product into Combo
              </button>
            </div>
          )}

          {/* Select Existing Product (if mode = existing) */}
          {mode === "existing" && !isEditing && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Select Existing Product to Convert:
              </label>
              <Select
                value={selectedExistingProductId}
                onValueChange={(val: any) => {
                  if (typeof val === "string") handleSelectExistingProduct(val);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Choose a product from your catalog..." />
                </SelectTrigger>
                <SelectContent>
                  {catalogProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.nameBn ? `(${p.nameBn})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Basic Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Combo Information
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Combo Name (English) <span className="text-destructive">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Winter Special Mega Combo"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Combo Name (বাংলা)
                </label>
                <Input
                  value={nameBn}
                  onChange={(e) => setNameBn(e.target.value)}
                  placeholder="e.g. শীতের স্পেশাল মেগা কম্বো"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  URL Slug
                </label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="winter-mega-combo"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Storefront Status
                </label>
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === "active"}
                      onChange={() => setStatus("active")}
                      className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Active (Live)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer ml-3">
                    <input
                      type="radio"
                      name="status"
                      checked={status === "draft"}
                      onChange={() => setStatus("draft")}
                      className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-muted-foreground">Draft (Hidden)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Combo Cover Image */}
          <div className="space-y-3 p-4 rounded-xl border border-border/80 bg-muted/10">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
                Combo Cover Image / প্যাকেজ ছবি
              </h4>
              {image && (
                <button
                  type="button"
                  onClick={() => setImage("")}
                  className="text-[11px] text-destructive hover:underline cursor-pointer"
                >
                  Remove Photo
                </button>
              )}
            </div>

            <ImageUploader
              value={image ? [{ id: "combo-cover", url: image, path: image }] : []}
              onChange={(items) => {
                const first = items[0];
                setImage(first?.url || first?.path || "");
              }}
              multiple={false}
              folder="combos"
              label="Click or drop combo cover photo"
              description="Upload a dedicated bundle photo or flyer. Auto-compressed & stored on ImageKit CDN."
              allowGallery={true}
              aspectRatio="square"
            />

            {/* Quick Component Photo Suggestions */}
            {components.length > 0 && (
              <div className="pt-2 border-t border-border/60">
                <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">
                  Or quickly adopt photo from an included product:
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {components.map((comp) => {
                    const prod = catalogProducts.find((p) => p.id === comp.productId);
                    if (!prod?.imageUrl) return null;
                    const isSelected = image === prod.imageUrl;

                    return (
                      <button
                        key={comp.componentVariantId}
                        type="button"
                        onClick={() => setImage(prod.imageUrl!)}
                        className={cn(
                          "flex items-center gap-1.5 p-1 pr-2 rounded-lg border text-xs transition-all cursor-pointer",
                          isSelected
                            ? "border-amber-600 bg-amber-500/10 font-medium"
                            : "border-border hover:bg-muted/50"
                        )}
                        title={`Use ${prod.name} image as combo cover`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="h-6 w-6 rounded object-cover"
                        />
                        <span className="truncate max-w-[120px] text-[11px]">{prod.name}</span>
                        {isSelected && <CheckCircle2 className="h-3 w-3 text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Component Recipe (Many-to-Many) */}
          <div className="space-y-3 pt-3 border-t border-border/80">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5 text-amber-600" />
                Products Inside this Combo (Recipe)
              </h4>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {components.length} {components.length === 1 ? "Product" : "Products"} Included
              </Badge>
            </div>

            {/* Add component picker */}
            <div className="flex gap-2">
              <Select
                value={selectedVariantToAdd}
                onValueChange={(val: any) => {
                  if (typeof val === "string") setSelectedVariantToAdd(val);
                }}
              >
                <SelectTrigger className="h-9 text-xs flex-1 bg-background">
                  <SelectValue placeholder="Search & select a product to add..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {selectableVariants.map((sv) => (
                    <SelectItem key={sv.variantId} value={sv.variantId}>
                      {sv.productName} - {sv.variantName} (৳{sv.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={handleAddComponent}
                disabled={!selectedVariantToAdd}
                className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>

            {/* Selected Components Table */}
            {components.length > 0 ? (
              <div className="space-y-2">
                {components.map((comp, idx) => (
                  <div
                    key={comp.componentVariantId}
                    className="p-3 rounded-xl border border-border/80 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate">{comp.productName}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {comp.variantName}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground mt-0.5 text-[11px]">
                        <span>Unit: ৳{comp.unitPrice}</span>
                        {(() => {
                          const otherCombosCount = (variantUsageMap.get(comp.componentVariantId) || []).length;
                          return otherCombosCount > 0 ? (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              • In {otherCombosCount} other {otherCombosCount === 1 ? "combo" : "combos"}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-[11px]">Qty:</span>
                        <Input
                          type="number"
                          min="1"
                          value={comp.quantity}
                          onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value) || 1)}
                          className="h-8 w-16 text-center text-xs font-bold"
                        />
                      </div>

                      <div className="w-16 text-right font-bold text-foreground">
                        ৳{comp.unitPrice * comp.quantity}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveComponent(idx)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                No components added yet. Pick products above to build this combo recipe.
              </div>
            )}
          </div>

          {/* Smart Pricing & Discounts */}
          <div className="space-y-3 pt-3 border-t border-border/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-emerald-600" />
              Smart Pricing & Customer Discount
            </h4>

            {/* Quick Discount Chips */}
            {regularTotal > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground block">
                  Quick Discounts (Calculated from Regular Value ৳{regularTotal}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyQuickDiscount(10)}
                    className="px-2.5 py-1 text-xs rounded-md font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer"
                  >
                    10% OFF (৳{Math.round(regularTotal * 0.9)})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDiscount(15)}
                    className="px-2.5 py-1 text-xs rounded-md font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer"
                  >
                    15% OFF (৳{Math.round(regularTotal * 0.85)})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDiscount(20)}
                    className="px-2.5 py-1 text-xs rounded-md font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer"
                  >
                    20% OFF (৳{Math.round(regularTotal * 0.8)})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFixedDiscount(100)}
                    className="px-2.5 py-1 text-xs rounded-md font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer"
                  >
                    ৳100 OFF (৳{Math.max(0, regularTotal - 100)})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFixedDiscount(200)}
                    className="px-2.5 py-1 text-xs rounded-md font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer"
                  >
                    ৳200 OFF (৳{Math.max(0, regularTotal - 200)})
                  </button>
                </div>
              </div>
            )}

            {/* Price Inputs */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Combo Selling Price (৳) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  value={price || ""}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 1350"
                  className="h-9 text-xs font-bold text-amber-600 dark:text-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Strikethrough / Compare-at (৳)
                </label>
                <Input
                  type="number"
                  min="0"
                  value={compareAtPrice ?? ""}
                  onChange={(e) =>
                    setCompareAtPrice(e.target.value ? parseFloat(e.target.value) : null)
                  }
                  placeholder={regularTotal > 0 ? `৳${regularTotal}` : "Original price"}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Live Savings Card */}
            {regularTotal > 0 && (
              <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Original Total:</span>
                    <span className="line-through font-semibold text-muted-foreground">
                      ৳{regularTotal}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                      ৳{price}
                    </span>
                  </div>
                  {savingsAmount > 0 ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      Customer saves ৳{savingsAmount} ({savingsPct}% discount)
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Set price lower than ৳{regularTotal} to offer customer savings.
                    </p>
                  )}
                </div>

                {regularTotal > price && compareAtPrice !== regularTotal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCompareAtPrice(regularTotal)}
                    className="h-7 text-[11px] border-amber-500/30 text-amber-700 dark:text-amber-300"
                  >
                    Sync Strikethrough
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t border-border/80 bg-muted/20 flex flex-row items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Combo"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
