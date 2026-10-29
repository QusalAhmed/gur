"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Sparkles,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Star,
  Plus,
  Layers,
  Package,
  Sliders,
  RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DbProduct,
  saveProductWithDetails,
  deleteProductImageFromStorage,
  fetchCategoriesList,
} from "@/lib/supabase";
import { ImageUploader, UploadedImage } from "@/components/ui/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToastNotificationPortal, ToastData } from "@/components/ui/toast-notification";
import { cn } from "@/lib/utils";

interface ProductFormProps {
  initialData?: DbProduct | null;
  mode: "create" | "edit";
}

interface FormVariant {
  id?: string;
  sku: string;
  name: string;
  nameBn?: string;
  pack_type: string;
  net_quantity: number;
  net_unit: string;
  price: number;
  compare_at_price?: number | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  track_inventory: boolean;
  low_stock_threshold: number;
  is_default: boolean;
  is_active: boolean;
}

interface FormImage {
  id?: string;
  storage_path: string;
  public_url?: string;
  alt_text?: string;
  is_primary: boolean;
  sort_order: number;
  isNew?: boolean;
}

const PUBLISHING_STATUS_OPTIONS = [
  { value: "draft", label: "Draft (Hidden from store)" },
  { value: "active", label: "Active (Visible in catalog)" },
  { value: "archived", label: "Archived (Discontinued)" },
] as const;

const STOCK_STATUS_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "backorder", label: "Available on Backorder" },
] as const;

const PACK_TYPES = [
  { value: "jar", label: "Glass Jar" },
  { value: "bottle", label: "Plastic / Glass Bottle" },
  { value: "pail", label: "Plastic Pail / Bucket" },
  { value: "drum", label: "Industrial Drum (200L)" },
  { value: "bag", label: "Bag / Sack" },
  { value: "block", label: "Solid Molded Block (Patali)" },
  { value: "ibc_tote", label: "1 Ton IBC Tote Tank" },
  { value: "pouch", label: "Stand-up Pouch" },
  { value: "bulk", label: "Bulk Tanker" },
];

const NET_UNITS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "l", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "t", label: "Metric Tonne (t)" },
  { value: "pcs", label: "Pieces (pcs)" },
];

export function ProductForm({ initialData, mode }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("general");
  const [toast, setToast] = React.useState<ToastData | null>(null);

  // General Form State
  const [name, setName] = React.useState(initialData?.name || "");
  const [nameBn, setNameBn] = React.useState(initialData?.name_bn || "");
  const [slug, setSlug] = React.useState(initialData?.slug || "");
  const [isSlugManual, setIsSlugManual] = React.useState(Boolean(initialData?.slug));
  const [categoryId, setCategoryId] = React.useState(initialData?.category_id || "");
  const [status, setStatus] = React.useState<"draft" | "active" | "archived">(
    initialData?.status || "draft"
  );
  const [isFeatured, setIsFeatured] = React.useState(initialData?.is_featured || false);
  const [summary, setSummary] = React.useState(initialData?.summary || "");
  const [summaryBn, setSummaryBn] = React.useState(initialData?.summary_bn || "");
  const [description, setDescription] = React.useState(initialData?.description || "");
  const [descriptionBn, setDescriptionBn] = React.useState(initialData?.description_bn || "");

  // Specifications & SEO State
  const [grade, setGrade] = React.useState(initialData?.grade || "");
  const [origin, setOrigin] = React.useState(initialData?.origin || "");
  const [ingredients, setIngredients] = React.useState(initialData?.ingredients || "");
  const [storageInstructions, setStorageInstructions] = React.useState(
    initialData?.storage_instructions || ""
  );
  const [shelfLifeDays, setShelfLifeDays] = React.useState<number | "">(
    initialData?.shelf_life_days ?? ""
  );
  const [taxRate, setTaxRate] = React.useState<number>(initialData?.tax_rate ?? 0);
  const [seoTitle, setSeoTitle] = React.useState(initialData?.seo_title || "");
  const [seoDescription, setSeoDescription] = React.useState(
    initialData?.seo_description || ""
  );

  // Variants State
  const [variants, setVariants] = React.useState<FormVariant[]>(() => {
    if (initialData?.variants && initialData.variants.length > 0) {
      return initialData.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        nameBn: v.name_bn || "",
        pack_type: v.pack_type || "jar",
        net_quantity: Number(v.net_quantity) || 1,
        net_unit: v.net_unit || "kg",
        price: Number(v.price) || 0,
        compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
        stock_status: v.stock_status || "in_stock",
        track_inventory: v.track_inventory ?? true,
        low_stock_threshold: Number(v.low_stock_threshold) || 5,
        is_default: v.is_default ?? false,
        is_active: v.is_active ?? true,
      }));
    }
    // Default initial variant for new products
    return [
      {
        sku: `MOL-${Date.now().toString().slice(-4)}`,
        name: "Standard Pack (1kg)",
        nameBn: "স্ট্যান্ডার্ড প্যাক (১ কেজি)",
        pack_type: "jar",
        net_quantity: 1,
        net_unit: "kg",
        price: 350,
        compare_at_price: null,
        stock_status: "in_stock",
        track_inventory: true,
        low_stock_threshold: 5,
        is_default: true,
        is_active: true,
      },
    ];
  });

  const [deletedVariantIds, setDeletedVariantIds] = React.useState<string[]>([]);

  // Images State via ImageUploader
  const [uploadedImages, setUploadedImages] = React.useState<UploadedImage[]>(() => {
    if (initialData?.images && initialData.images.length > 0) {
      return initialData.images.map((img, idx) => ({
        id: img.id,
        url: img.public_url || img.storage_path,
        path: img.storage_path,
        name: img.alt_text || img.storage_path.split("/").pop() || `Product Photo ${idx + 1}`,
        altText: img.alt_text || "",
        isPrimary: img.is_primary ?? idx === 0,
        sortOrder: img.sort_order ?? idx,
        status: "success" as const,
        progress: 100,
      }));
    }
    return [];
  });

  // Derived FormImage[] for compatibility with saveProductWithDetails and live preview
  const images: FormImage[] = React.useMemo(() => {
    return uploadedImages.map((img, idx) => ({
      id: img.id && !img.id.startsWith("local-") && !img.id.startsWith("gallery-") ? img.id : undefined,
      storage_path: img.path || img.url,
      public_url: img.url,
      alt_text: img.altText || img.name || name || "Product image",
      is_primary: idx === 0 || img.isPrimary === true,
      sort_order: idx,
      isNew: !img.id || img.id.startsWith("local-") || img.id.startsWith("gallery-"),
    }));
  }, [uploadedImages, name]);

  const [deletedImageIds, setDeletedImageIds] = React.useState<string[]>([]);

  const handleImageRemove = (item: UploadedImage) => {
    if (item.id && !item.id.startsWith("local-") && !item.id.startsWith("gallery-")) {
      setDeletedImageIds((prev) => [...prev, item.id]);
    }
    if (item.path) {
      deleteProductImageFromStorage(item.path);
    }
  };

  // Fetch categories from DB
  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories-list"],
    queryFn: fetchCategoriesList,
  });

  const categoryItems = React.useMemo(() => {
    return categories.map((c) => ({
      value: c.id,
      label: `${c.name}${c.name_bn ? ` (${c.name_bn})` : ""}`,
    }));
  }, [categories]);

  // Auto slug generation from Name
  React.useEffect(() => {
    if (!isSlugManual && name.trim()) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      queueMicrotask(() => {
        setSlug(generated);
      });
    }
  }, [name, isSlugManual]);

  // Variant Management
  const handleAddVariant = () => {
    const nextIndex = variants.length + 1;
    const newVariant: FormVariant = {
      sku: `MOL-${slug ? slug.toUpperCase().slice(0, 4) : "PACK"}-${nextIndex * 100}G`,
      name: `Variant ${nextIndex}`,
      pack_type: "jar",
      net_quantity: 1,
      net_unit: "kg",
      price: variants[0]?.price || 350,
      stock_status: "in_stock",
      track_inventory: true,
      low_stock_threshold: 5,
      is_default: variants.length === 0,
      is_active: true,
    };
    setVariants((prev) => [...prev, newVariant]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      setToast({
        type: "warning",
        title: "At Least One Variant Required",
        message: "Every catalog product must contain at least one packaging variant for pricing.",
      });
      return;
    }
    const target = variants[index];
    if (target.id) {
      setDeletedVariantIds((prev) => [...prev, target.id!]);
    }
    setVariants((prev) => {
      const remaining = prev.filter((_, i) => i !== index);
      if (target.is_default && remaining.length > 0) {
        remaining[0].is_default = true;
      }
      return remaining;
    });
  };

  const handleUpdateVariant = (
    index: number,
    field: keyof FormVariant,
    value: FormVariant[keyof FormVariant]
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i !== index) return v;
        if (field === "is_default" && value === true) {
          // Only one default variant allowed
          return { ...v, is_default: true };
        }
        return { ...v, [field]: value };
      }).map((v, i) => (field === "is_default" && value === true && i !== index ? { ...v, is_default: false } : v))
    );
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (submitStatus?: "draft" | "active" | "archived") => {
      if (!name.trim()) {
        throw new Error("Product name is required.");
      }
      if (!slug.trim()) {
        throw new Error("URL slug is required.");
      }
      if (variants.length === 0) {
        throw new Error("Please add at least one product variant.");
      }

      const finalStatus = submitStatus || status;

      return await saveProductWithDetails({
        productId: initialData?.id,
        product: {
          name: name.trim(),
          nameBn: nameBn.trim() || undefined,
          slug: slug.trim(),
          category_id: categoryId || null,
          status: finalStatus,
          summary: summary.trim() || undefined,
          summaryBn: summaryBn.trim() || undefined,
          description: description.trim() || undefined,
          descriptionBn: descriptionBn.trim() || undefined,
          grade: grade.trim() || undefined,
          origin: origin.trim() || undefined,
          ingredients: ingredients.trim() || undefined,
          storage_instructions: storageInstructions.trim() || undefined,
          shelf_life_days: typeof shelfLifeDays === "number" ? shelfLifeDays : undefined,
          tax_rate: taxRate,
          is_featured: isFeatured,
          seo_title: seoTitle.trim() || undefined,
          seo_description: seoDescription.trim() || undefined,
        },
        variants,
        images,
        deletedVariantIds,
        deletedImageIds,
      });
    },
    onSuccess: (result) => {
      if (result.error) {
        setToast({
          type: "destructive",
          title: "Save Failed",
          message: result.error,
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog-products"] });

      setToast({
        type: "success",
        title: mode === "create" ? "Product Created" : "Product Updated",
        message: `"${name}" has been saved successfully in the catalog database.`,
      });

      setTimeout(() => {
        router.push("/admin/products");
      }, 700);
    },
    onError: (err: Error) => {
      setToast({
        type: "destructive",
        title: "Error Saving Product",
        message: err?.message || "Failed to save product to database.",
      });
    },
  });

  return (
    <div className="space-y-6 pb-20">
      <ToastNotificationPortal toast={toast} onDismiss={() => setToast(null)} />

      {/* Sticky Header with Actions */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3.5 bg-background/90 backdrop-blur-md border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-9 w-9 rounded-lg hover:bg-muted"
          >
            <Link href="/admin/products" title="Back to products list">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {mode === "create" ? "New Product" : `Edit: ${name || initialData?.name}`}
              </h1>
              <Badge
                variant="outline"
                className={`capitalize text-xs font-semibold ${
                  status === "active"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : status === "draft"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : "bg-destructive/15 text-destructive border-destructive/30"
                }`}
              >
                {status}
              </Badge>
              {isFeatured && (
                <Badge className="bg-amber-500 text-white text-[10px] h-5 px-1.5 shadow-xs">
                  <Star className="h-2.5 w-2.5 mr-1 fill-white" /> Featured
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "create"
                ? "Configure catalog metadata, upload images, and set package pricing"
                : `Product ID: ${initialData?.id || ""}`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-9">
            <Link href="/admin/products">Cancel</Link>
          </Button>

          {status !== "active" && (
            <Button
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate("draft")}
              className="h-9 cursor-pointer"
            >
              Save Draft
            </Button>
          )}

          <Button
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9 cursor-pointer"
          >
            {saveMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {mode === "create"
              ? status === "active"
                ? "Publish Product"
                : "Save Product"
              : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-muted/70 p-1">
          <TabsTrigger value="general" className="text-xs sm:text-sm flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            <span>General</span>
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs sm:text-sm flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" />
            <span>Media ({images.length})</span>
          </TabsTrigger>
          <TabsTrigger value="variants" className="text-xs sm:text-sm flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            <span>Variants ({variants.length})</span>
          </TabsTrigger>
          <TabsTrigger value="specs" className="text-xs sm:text-sm flex items-center gap-1.5">
            <Sliders className="h-4 w-4" />
            <span>Specs & SEO</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: GENERAL INFO ──────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left 2 Cols: Main Details */}
            <div className="md:col-span-2 space-y-6">
              <Card className="border shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Product Title & Slug</CardTitle>
                  <CardDescription className="text-xs">
                    Define the core display name and public URL slug for this product.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Product Name (English) <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Pure Artisanal Date Palm Molasses (Khejur Gur)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-10 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Product Name (Bangla / বাংলা নাম)
                    </label>
                    <Input
                      placeholder="e.g. খাঁটি ঝোলা খেজুর গুড়"
                      value={nameBn}
                      onChange={(e) => setNameBn(e.target.value)}
                      className="h-10 text-sm font-bangla"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-foreground">
                        URL Slug <span className="text-destructive">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSlugManual(false);
                          const generated = name
                            .toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, "")
                            .trim()
                            .replace(/\s+/g, "-");
                          setSlug(generated);
                        }}
                        className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" /> Auto-generate from title
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground px-2.5 py-2 bg-muted/60 border border-border rounded-md select-none shrink-0">
                        /products/
                      </span>
                      <Input
                        value={slug}
                        onChange={(e) => {
                          setIsSlugManual(true);
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                        }}
                        placeholder="pure-date-palm-molasses"
                        className="h-10 text-sm font-mono"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Descriptions */}
              <Card className="border shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Summary & Description</CardTitle>
                  <CardDescription className="text-xs">
                    Engaging copy displayed in storefront listings and customer details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Short Summary (English)
                    </label>
                    <Input
                      placeholder="e.g. Freshly tapped seasonal date palm molasses from Jessore"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Short Summary (Bangla)
                    </label>
                    <Input
                      placeholder="e.g. যশোরের খাঁটি ও প্রাকৃতিক শিউলি গাছিদের তৈরি খেজুরের ঝোলা গুড়"
                      value={summaryBn}
                      onChange={(e) => setSummaryBn(e.target.value)}
                      className="h-10 text-sm font-bangla"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Full Description (Markdown supported)
                    </label>
                    <Textarea
                      rows={6}
                      placeholder="Detailed product story, harvest notes, taste notes, and culinary uses..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="text-sm leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Full Description (Bangla / বিস্তারিত বিবরণ)
                    </label>
                    <Textarea
                      rows={4}
                      placeholder="বিস্তারিত বিবরণ..."
                      value={descriptionBn}
                      onChange={(e) => setDescriptionBn(e.target.value)}
                      className="text-sm leading-relaxed font-bangla"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right 1 Col: Status & Organization */}
            <div className="space-y-6">
              <Card className="border shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Catalog Organization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Publishing Status
                    </label>
                    <Select
                      items={PUBLISHING_STATUS_OPTIONS}
                      value={status}
                      onValueChange={(val) => {
                        if (val) setStatus(val as "draft" | "active" | "archived");
                      }}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Select Publishing Status">
                          {(val) => {
                            const found = PUBLISHING_STATUS_OPTIONS.find((opt) => opt.value === val);
                            return found ? (
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "size-2 rounded-full",
                                    val === "active" && "bg-emerald-500",
                                    val === "draft" && "bg-amber-500",
                                    val === "archived" && "bg-slate-400"
                                  )}
                                />
                                <span>{found.label}</span>
                              </span>
                            ) : (
                              "Select Status"
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PUBLISHING_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "size-2 rounded-full",
                                  opt.value === "active" && "bg-emerald-500",
                                  opt.value === "draft" && "bg-amber-500",
                                  opt.value === "archived" && "bg-slate-400"
                                )}
                              />
                              <span>{opt.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Category
                    </label>
                    <Select
                      items={categoryItems}
                      value={categoryId}
                      onValueChange={(val) => setCategoryId(val || "")}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Select Category">
                          {(val) =>
                            categoryItems.find((c) => c.value === val)?.label || "Select Category"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categoryItems.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Featured Product</p>
                      <p className="text-[11px] text-muted-foreground">
                        Showcase on storefront homepage carousel
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="isFeatured"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Primary Image Preview Widget */}
              <Card className="border shadow-xs">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span>Primary Thumbnail</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("media")}
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Manage
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-4">
                  {images.length > 0 ? (
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted/40 border border-border flex items-center justify-center group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={images.find((img) => img.is_primary)?.public_url || images[0].public_url}
                        alt="Primary thumbnail"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <Badge className="absolute bottom-2 left-2 bg-black/70 text-white backdrop-blur-xs text-[10px]">
                        Primary Thumbnail
                      </Badge>
                    </div>
                  ) : (
                    <div
                      onClick={() => setActiveTab("media")}
                      className="w-full aspect-square rounded-xl border-2 border-dashed border-border hover:border-amber-500/50 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors bg-muted/20"
                    >
                      <UploadCloud className="h-8 w-8 text-muted-foreground/60 mb-2" />
                      <p className="text-xs font-medium text-foreground">No Images Yet</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Click to upload images in the Media tab
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: MEDIA & SUPABASE STORAGE ─────────────────────────────────── */}
        <TabsContent value="media" className="space-y-6">
          <Card className="border shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Product Media & Supabase Storage
              </CardTitle>
              <CardDescription className="text-xs">
                Upload product photography directly to the public{" "}
                <code className="text-amber-600 bg-amber-500/10 px-1 py-0.5 rounded">
                  catalog-images
                </code>{" "}
                storage bucket. Drag and drop cards to change serial order. The #1 serial image is automatically set as the primary catalog cover.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ImageUploader
                value={uploadedImages}
                onChange={(newItems) => {
                  setUploadedImages(newItems);
                }}
                multiple={true}
                maxFiles={12}
                bucket="catalog-images"
                folder={`products/${slug || initialData?.id || "draft"}`}
                label="Click or drag product images to upload"
                description="Supported formats: JPEG, PNG, WebP, AVIF up to 50MB (files > 5MB auto-compressed). Drag to serialize order. Serial #1 is the primary cover."
                showAltInput={true}
                allowGallery={true}
                onRemove={handleImageRemove}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: VARIANTS & PACK SIZES ────────────────────────────────────── */}
        <TabsContent value="variants" className="space-y-6">
          <Card className="border shadow-xs">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Product Variants & Pack Sizes
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configure individual package sizes, unit pricing, SKU codes, and stock status.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={handleAddVariant}
                  className="bg-amber-600 hover:bg-amber-700 text-white h-9 cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Add Pack Size
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {variants.map((v, index) => (
                  <div
                    key={v.id || index}
                    className={`p-4 rounded-xl border transition-all ${
                      v.is_default
                        ? "border-amber-500/50 bg-amber-500/5 shadow-xs"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/70">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          Pack #{index + 1}:
                        </span>
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          {v.name || "Untitled Pack"}
                        </span>
                        {v.is_default && (
                          <Badge className="h-4 px-1.5 text-[10px] bg-amber-500 text-white">
                            Default Pricing
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="radio"
                            name="defaultVariant"
                            checked={v.is_default}
                            onChange={() => handleUpdateVariant(index, "is_default", true)}
                            className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <span>Set as Default</span>
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={variants.length <= 1}
                          onClick={() => handleRemoveVariant(index)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Remove variant"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {/* Variant Name */}
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-1">
                          Pack Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={v.name}
                          onChange={(e) => handleUpdateVariant(index, "name", e.target.value)}
                          placeholder="e.g. 1kg Plastic Jar"
                          className="h-9 text-xs"
                        />
                      </div>

                      {/* SKU */}
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-1">
                          SKU <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={v.sku}
                          onChange={(e) =>
                            handleUpdateVariant(
                              index,
                              "sku",
                              e.target.value.toUpperCase().replace(/[^A-Z0-9._-]/g, "")
                            )
                          }
                          placeholder="MOL-1KG-JAR"
                          className="h-9 text-xs font-mono"
                        />
                      </div>

                      {/* Pack Type */}
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-1">
                          Package Type
                        </label>
                        <Select
                          value={v.pack_type}
                          onValueChange={(val) => {
                            if (val) handleUpdateVariant(index, "pack_type", val);
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PACK_TYPES.map((pt) => (
                              <SelectItem key={pt.value} value={pt.value}>
                                {pt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Net Quantity & Unit */}
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-1">
                          Net Weight / Volume
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            step="any"
                            min="0.01"
                            value={v.net_quantity}
                            onChange={(e) =>
                              handleUpdateVariant(
                                index,
                                "net_quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-9 text-xs w-20"
                          />
                          <Select
                            value={v.net_unit}
                            onValueChange={(val) => {
                              if (val) handleUpdateVariant(index, "net_unit", val);
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NET_UNITS.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Unit Price */}
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-1">
                          Price (BDT ৳) <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={v.price}
                          onChange={(e) =>
                            handleUpdateVariant(
                              index,
                              "price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="350"
                          className="h-9 text-xs font-semibold"
                        />
                      </div>

                      {/* Compare at Price */}
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-1">
                          Compare-at Price (৳)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={v.compare_at_price ?? ""}
                          onChange={(e) =>
                            handleUpdateVariant(
                              index,
                              "compare_at_price",
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          placeholder="Original strike-through price"
                          className="h-9 text-xs"
                        />
                      </div>

                      {/* Stock Status */}
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-1">
                          Stock Status
                        </label>
                        <Select
                          items={STOCK_STATUS_OPTIONS}
                          value={v.stock_status}
                          onValueChange={(val) => {
                            if (val) handleUpdateVariant(index, "stock_status", val);
                          }}
                        >
                          <SelectTrigger className="w-full h-9 text-xs">
                            <SelectValue>
                              {(val) =>
                                STOCK_STATUS_OPTIONS.find((s) => s.value === val)?.label || "In Stock"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STOCK_STATUS_OPTIONS.map((st) => (
                              <SelectItem key={st.value} value={st.value}>
                                {st.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Low Stock Threshold */}
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-1">
                          Low Stock Alert Threshold
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={v.low_stock_threshold}
                          onChange={(e) =>
                            handleUpdateVariant(
                              index,
                              "low_stock_threshold",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: SPECIFICATIONS & SEO ─────────────────────────────────────── */}
        <TabsContent value="specs" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Technical Specifications */}
            <Card className="border shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Technical Specifications</CardTitle>
                <CardDescription className="text-xs">
                  Origin traceability, harvesting grade, storage guidelines, and taxation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Molasses Grade
                  </label>
                  <Input
                    placeholder="e.g. First Boil Artisanal, Food Grade, Blackstrap Spec A"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Geographic Origin / Production Region
                  </label>
                  <Input
                    placeholder="e.g. Jessore Date Palm Groves / Kushtia Sugar Mill"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Ingredients List
                  </label>
                  <Input
                    placeholder="e.g. 100% Unadulterated Date Palm Sap"
                    value={ingredients}
                    onChange={(e) => setIngredients(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Storage Instructions
                  </label>
                  <Input
                    placeholder="e.g. Keep in a dry, cool cellar. Refrigerate after breaking seal."
                    value={storageInstructions}
                    onChange={(e) => setStorageInstructions(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Shelf Life (Days)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="365"
                      value={shelfLifeDays}
                      onChange={(e) =>
                        setShelfLifeDays(e.target.value ? parseInt(e.target.value) : "")
                      }
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      VAT / Tax Rate (%)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEO & Search Preview */}
            <Card className="border shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-semibold">SEO & Search Engine Preview</CardTitle>
                <CardDescription className="text-xs">
                  Customize meta title and description for search engines and social sharing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    SEO Meta Title
                  </label>
                  <Input
                    placeholder={name ? `${name} | Gur Molasses Bangladesh` : "Custom SEO Title"}
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    SEO Meta Description
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Summary description indexed by Google and shared on Facebook..."
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Google Search Snippet Preview */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border mt-4">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Search Result Snippet Preview
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-mono">
                      https://gur.com.bd/products/{slug || "sample-product"}
                    </p>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer line-clamp-1">
                      {seoTitle || name || "Product Title Preview"} | GUR Bangladesh
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {seoDescription ||
                        summary ||
                        "Experience the pure rich taste of artisanal molasses produced under strict quality testing. Delivered across Bangladesh."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
