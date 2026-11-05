"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  UploadCloud,
  Search,
  Star,
  Trash2,
  Edit3,
  Copy,
  Check,
  LayoutGrid,
  Table as TableIcon,
  ExternalLink,
  Image as ImageIcon,
  MoreHorizontal,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Link2,
  Cloud,
  CheckCircle2,
  ZoomIn,
  SlidersHorizontal,
  Sliders,
  Filter,
  Eye,
  FileText,
  Code2,
  Maximize2,
  X,
  Compass,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  fetchProductImagesAction,
  fetchImageKitMediaAction,
  fetchProductsForImageAssignmentAction,
  setPrimaryProductImageAction,
  deleteProductImageAction,
  deleteImageKitFileAction,
  updateProductImageAltTextAction,
  linkImageKitFileToProductAction,
  ProductImageItem,
  ImageKitMediaItem,
  ProductOption,
} from "@/actions/product-images";
import { buildImageKitUrl } from "@/lib/imagekit/url";
import { UploadImageDialog } from "./upload-image-dialog";
import { EditAltDialog } from "./edit-alt-dialog";
import { LinkImageDialog } from "./link-image-dialog";

type ViewMode = "grid" | "sheet" | "table";
type TabMode = "imagekit" | "assigned";

function getAspectRatioLabel(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  if (Math.abs(ratio - 4 / 3) < 0.05) return "4:3";
  if (Math.abs(ratio - 3 / 4) < 0.05) return "3:4";
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(ratio - 4 / 5) < 0.05) return "4:5";
  return `${width}×${height}`;
}

export function ProductImagesClient() {
  const queryClient = useQueryClient();

  // Primary Workspace Mode: "imagekit" (Asset Library) vs "assigned" (Catalog Attached)
  const [activeTab, setActiveTab] = React.useState<TabMode>("imagekit");

  // Dialog & Modal States
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [editImage, setEditImage] = React.useState<ProductImageItem | null>(null);
  const [linkImage, setLinkImage] = React.useState<ImageKitMediaItem | null>(null);
  const [inspectItem, setInspectItem] = React.useState<{
    url: string;
    title: string;
    subtitle?: string;
    fileId?: string;
    width?: number;
    height?: number;
    size?: number;
    assignedProduct?: { id: string; name: string; slug?: string; isPrimary: boolean } | null;
    rawImageKitItem?: ImageKitMediaItem;
    rawAssignedItem?: ProductImageItem;
  } | null>(null);

  // Inspector Transformation Preview State
  const [transformWidth, setTransformWidth] = React.useState<number>(800);
  const [transformQuality, setTransformQuality] = React.useState<number>(80);
  const [transformFormat, setTransformFormat] = React.useState<"auto" | "webp" | "avif">("auto");
  const [inspectorAltEn, setInspectorAltEn] = React.useState("");
  const [inspectorAltBn, setInspectorAltBn] = React.useState("");
  const [isSavingAlt, setIsSavingAlt] = React.useState(false);

  // Quick Copy Feedback State
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // Filters & View Mode
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedProductFilter, setSelectedProductFilter] = React.useState("all");
  const [primaryFilter, setPrimaryFilter] = React.useState<"all" | "primary" | "secondary">("all");
  const [linkedFilter, setLinkedFilter] = React.useState<"all" | "linked" | "unlinked">("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");

  // Fetch ImageKit media library
  const {
    data: ikMediaRes,
    isLoading: loadingIkMedia,
    refetch: refetchIkMedia,
    isRefetching: isRefetchingIk,
  } = useQuery({
    queryKey: ["admin", "imagekit-media"],
    queryFn: fetchImageKitMediaAction,
  });

  // Fetch assigned product images
  const {
    data: imagesRes,
    isLoading: loadingImages,
    refetch: refetchAssigned,
    isRefetching: isRefetchingAssigned,
  } = useQuery({
    queryKey: ["admin", "product-images"],
    queryFn: fetchProductImagesAction,
  });

  // Fetch product list for assignment
  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products-for-images"],
    queryFn: fetchProductsForImageAssignmentAction,
  });

  const ikFiles: ImageKitMediaItem[] = ikMediaRes?.files || [];
  const assignedImages: ProductImageItem[] = imagesRes?.images || [];
  const isRefreshing = isRefetchingIk || isRefetchingAssigned;

  const handleRefreshAll = () => {
    refetchIkMedia();
    refetchAssigned();
  };

  // Synchronize inspector fields when item is opened
  React.useEffect(() => {
    if (inspectItem?.rawAssignedItem) {
      setInspectorAltEn(inspectItem.rawAssignedItem.alt_text || "");
      setInspectorAltBn(inspectItem.rawAssignedItem.alt_text_bn || "");
    } else {
      setInspectorAltEn(inspectItem?.title || "");
      setInspectorAltBn("");
    }
  }, [inspectItem]);

  // Mutations
  const setPrimaryMutation = useMutation({
    mutationFn: (item: ProductImageItem) =>
      setPrimaryProductImageAction({ imageId: item.id, productId: item.product_id }),
    onSuccess: (res, item) => {
      if (res.success) {
        toast.success(`Designated cover for ${item.product?.name || "product"}`);
        queryClient.invalidateQueries({ queryKey: ["admin", "product-images"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "imagekit-media"] });
        if (inspectItem?.rawAssignedItem?.id === item.id) {
          setInspectItem((prev) =>
            prev ? { ...prev, assignedProduct: prev.assignedProduct ? { ...prev.assignedProduct, isPrimary: true } : null } : null
          );
        }
      } else {
        toast.error(res.error || "Failed to designate primary cover");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to designate primary cover");
    },
  });

  const deleteAssignedMutation = useMutation({
    mutationFn: (item: ProductImageItem) =>
      deleteProductImageAction({ imageId: item.id, productId: item.product_id }),
    onSuccess: (res, item) => {
      if (res.success) {
        toast.success(`Removed photo from ${item.product?.name || "product"}`);
        queryClient.invalidateQueries({ queryKey: ["admin", "product-images"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "imagekit-media"] });
        if (inspectItem?.rawAssignedItem?.id === item.id) {
          setInspectItem(null);
        }
      } else {
        toast.error(res.error || "Failed to remove image");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to remove image");
    },
  });

  const deleteIkFileMutation = useMutation({
    mutationFn: (file: ImageKitMediaItem) => deleteImageKitFileAction(file.fileId),
    onSuccess: (res, file) => {
      if (res.success) {
        toast.success(`Permanently deleted "${file.name}" from ImageKit`);
        queryClient.invalidateQueries({ queryKey: ["admin", "imagekit-media"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "product-images"] });
        if (inspectItem?.fileId === file.fileId) {
          setInspectItem(null);
        }
      } else {
        toast.error(res.error || "Failed to delete file from ImageKit");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete file from ImageKit");
    },
  });

  const handleSaveInspectorAlt = async () => {
    if (!inspectItem?.rawAssignedItem) return;
    setIsSavingAlt(true);
    try {
      const res = await updateProductImageAltTextAction({
        imageId: inspectItem.rawAssignedItem.id,
        altText: inspectorAltEn,
        altTextBn: inspectorAltBn,
      });
      if (res.success) {
        toast.success("Updated image alt descriptions");
        queryClient.invalidateQueries({ queryKey: ["admin", "product-images"] });
      } else {
        toast.error(res.error || "Failed to update alt text");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error saving alt text");
    } finally {
      setIsSavingAlt(false);
    }
  };

  const handleCopy = (text: string, key: string, label: string = "Copied to clipboard") => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(label);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  // Filtered ImageKit Files
  const filteredIkFiles = React.useMemo(() => {
    return ikFiles.filter((file) => {
      if (linkedFilter === "linked" && !file.assignedProduct) return false;
      if (linkedFilter === "unlinked" && file.assignedProduct) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = file.name.toLowerCase().includes(q);
        const matchesPath = file.filePath.toLowerCase().includes(q);
        const matchesProd = file.assignedProduct?.name.toLowerCase().includes(q) || false;
        return matchesName || matchesPath || matchesProd;
      }

      return true;
    });
  }, [ikFiles, linkedFilter, searchQuery]);

  // Filtered Assigned Images
  const filteredAssignedImages = React.useMemo(() => {
    return assignedImages.filter((img) => {
      if (selectedProductFilter !== "all" && img.product_id !== selectedProductFilter) {
        return false;
      }
      if (primaryFilter === "primary" && !img.is_primary) return false;
      if (primaryFilter === "secondary" && img.is_primary) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesProduct = img.product?.name?.toLowerCase().includes(q) || false;
        const matchesProductBn = img.product?.name_bn?.toLowerCase().includes(q) || false;
        const matchesAlt = img.alt_text?.toLowerCase().includes(q) || false;
        const matchesAltBn = img.alt_text_bn?.toLowerCase().includes(q) || false;
        const matchesPath = img.storage_path?.toLowerCase().includes(q) || false;
        return matchesProduct || matchesProductBn || matchesAlt || matchesAltBn || matchesPath;
      }

      return true;
    });
  }, [assignedImages, selectedProductFilter, primaryFilter, searchQuery]);

  // Dynamic Transformation Preview for Inspector
  const previewTransformedUrl = React.useMemo(() => {
    if (!inspectItem?.url) return "";
    return buildImageKitUrl(inspectItem.url, {
      width: transformWidth,
      quality: transformQuality,
      format: transformFormat,
    });
  }, [inspectItem?.url, transformWidth, transformQuality, transformFormat]);

  // Derived Studio Metrics
  const totalAssetsCount = ikFiles.length;
  const catalogAssignedCount = assignedImages.length;
  const primaryCoversCount = assignedImages.filter((img) => img.is_primary).length;
  const unassignedVaultCount = ikFiles.filter((file) => !file.assignedProduct).length;

  return (
    <div className="space-y-6">
      {/* ── 1. STUDIO HEADER ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-5"
      >
        <div className="flex items-center gap-3.5">
          <Link href="/admin/products">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-border/80 bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Return to Products Catalog"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Media Studio
              </h1>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                ImageKit CDN Active
              </div>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Curate, transform, and assign high-resolution photography across products and pack sizes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="h-9 px-3 rounded-lg text-sm font-medium border-border/80 hover:bg-muted/60 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="h-9 px-3.5 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer transition-all"
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload Photography
          </Button>
        </div>
      </motion.div>

      {/* ── 2. STUDIO METRICS STRIP ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-amber-500/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs sm:text-sm font-medium">Total Media Assets</span>
            <Cloud className="h-4 w-4 text-blue-500/80" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
              {totalAssetsCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">files in CDN</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-amber-500/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs sm:text-sm font-medium">Catalog Assigned</span>
            <Package className="h-4 w-4 text-emerald-500/80" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
              {catalogAssignedCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">active images</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-amber-500/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs sm:text-sm font-medium">Primary Hero Covers</span>
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
              {primaryCoversCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">lead photos</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-amber-500/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs sm:text-sm font-medium">Unlinked Vault</span>
            <Layers className="h-4 w-4 text-purple-500/80" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
              {unassignedVaultCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">ready to assign</span>
          </div>
        </div>
      </div>

      {/* ── 3. WORKSPACE SEGMENTED NAV ────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-3.5">
        <div className="inline-flex rounded-xl bg-muted/50 p-1 border border-border/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab("imagekit");
              setSearchQuery("");
            }}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all cursor-pointer flex items-center gap-2.5 ${
              activeTab === "imagekit"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Cloud className="h-4 w-4 text-blue-500" />
            <span>ImageKit Vault</span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
              {ikFiles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("assigned");
              setSearchQuery("");
            }}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all cursor-pointer flex items-center gap-2.5 ${
              activeTab === "assigned"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4 text-amber-600" />
            <span>Catalog Photography</span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
              {assignedImages.length}
            </span>
          </button>
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Viewing {activeTab === "imagekit" ? filteredIkFiles.length : filteredAssignedImages.length} assets
          </span>
          <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/30">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className={`h-8 w-8 rounded-md cursor-pointer ${
                viewMode === "grid"
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Showcase Grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "sheet" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("sheet")}
              className={`h-8 w-8 rounded-md cursor-pointer ${
                viewMode === "sheet"
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Contact Sheet (Dense Masonry)"
            >
              <Layers className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("table")}
              className={`h-8 w-8 rounded-md cursor-pointer ${
                viewMode === "table"
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Audit Table"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── 4. STUDIO TOOLBAR & FILTERS ───────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={
                activeTab === "imagekit"
                  ? "Filter by file name, product, or path..."
                  : "Filter by product name, alt text, or URL..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9.5 text-sm rounded-lg border-border/80 bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {activeTab === "imagekit" ? (
            <Select
              value={linkedFilter}
              onValueChange={(val) => setLinkedFilter((val as "all" | "linked" | "unlinked") || "all")}
            >
              <SelectTrigger className="w-full sm:w-52 h-9.5 text-sm rounded-lg border-border/80">
                <SelectValue placeholder="Assignment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">
                  All Vault Files ({ikFiles.length})
                </SelectItem>
                <SelectItem value="linked" className="text-sm">
                  Assigned to Product ({ikFiles.filter((f) => f.assignedProduct).length})
                </SelectItem>
                <SelectItem value="unlinked" className="text-sm">
                  Unassigned Assets ({ikFiles.filter((f) => !f.assignedProduct).length})
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <>
              <Select value={selectedProductFilter} onValueChange={(val) => setSelectedProductFilter(val || "all")}>
                <SelectTrigger className="w-full sm:w-64 h-9.5 text-sm rounded-lg border-border/80">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all" className="text-sm">
                    All Products ({assignedImages.length})
                  </SelectItem>
                  {products.map((p) => {
                    const count = assignedImages.filter((img) => img.product_id === p.id).length;
                    return (
                      <SelectItem key={p.id} value={p.id} className="text-sm">
                        {p.name} {count > 0 ? `(${count})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select
                value={primaryFilter}
                onValueChange={(val) => setPrimaryFilter((val as "all" | "primary" | "secondary") || "all")}
              >
                <SelectTrigger className="w-full sm:w-48 h-9.5 text-sm rounded-lg border-border/80">
                  <SelectValue placeholder="Cover Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">
                    All Catalog Images
                  </SelectItem>
                  <SelectItem value="primary" className="text-sm">
                    Primary Covers Only ({assignedImages.filter((i) => i.is_primary).length})
                  </SelectItem>
                  <SelectItem value="secondary" className="text-sm">
                    Pack & Angle Shots ({assignedImages.filter((i) => !i.is_primary).length})
                  </SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {searchQuery && (
          <div className="text-xs text-muted-foreground flex items-center gap-2 self-end sm:self-auto">
            <span>Filtered to {activeTab === "imagekit" ? filteredIkFiles.length : filteredAssignedImages.length} results</span>
            <button
              onClick={() => setSearchQuery("")}
              className="text-amber-600 hover:underline font-semibold cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* ── 5. TAB 1: IMAGEKIT VAULT WORKSPACE ────────────────────────────── */}
      {activeTab === "imagekit" && (
        <>
          {loadingIkMedia ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-border/70 bg-card p-3 space-y-3">
                  <div className="h-48 bg-muted/60 rounded-xl" />
                  <div className="h-4 bg-muted/70 rounded w-2/3" />
                  <div className="h-3.5 bg-muted/40 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : filteredIkFiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/60">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-3.5">
                <ImageIcon className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No matching ImageKit assets found</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                {searchQuery || linkedFilter !== "all"
                  ? "Adjust search or filters to see stored media."
                  : "Your ImageKit media vault is currently empty. Upload your first product photograph below."}
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                  className="text-sm h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer font-medium"
                >
                  <UploadCloud className="h-4 w-4 mr-2" /> Upload Media
                </Button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* ── SHOWCASE GRID ── */
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredIkFiles.map((file) => {
                const ratioLabel = getAspectRatioLabel(file.width, file.height);

                return (
                  <div
                    key={file.fileId}
                    className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3 shadow-xs transition-all hover:border-amber-500/50 hover:shadow-md"
                  >
                    {/* Visual Frame */}
                    <div
                      onClick={() =>
                        setInspectItem({
                          url: file.url,
                          title: file.name,
                          subtitle: file.filePath,
                          fileId: file.fileId,
                          width: file.width,
                          height: file.height,
                          size: file.size,
                          assignedProduct: file.assignedProduct,
                          rawImageKitItem: file,
                        })
                      }
                      className="relative h-52 w-full cursor-pointer overflow-hidden rounded-xl bg-stone-900/5 dark:bg-stone-900/40 border border-border/40 flex items-center justify-center"
                    >
                      {/* Checkered pattern background for transparent PNG/WebP */}
                      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]" />

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={file.thumbnailUrl || file.url}
                        alt={file.name}
                        loading="lazy"
                        className="h-full w-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Badges on Top */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                        {ratioLabel && (
                          <span className="rounded-md bg-black/65 px-2 py-0.5 text-xs font-mono font-medium text-white backdrop-blur-xs">
                            {ratioLabel}
                          </span>
                        )}
                      </div>

                      <div className="absolute top-2.5 right-2.5 pointer-events-none">
                        {file.assignedProduct ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/90 px-2.5 py-0.5 text-xs font-semibold text-white shadow-xs backdrop-blur-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            Assigned
                          </span>
                        ) : (
                          <span className="rounded-md bg-black/65 px-2 py-0.5 text-xs font-mono text-stone-200 backdrop-blur-xs">
                            Unassigned
                          </span>
                        )}
                      </div>

                      {/* Hover Quick Zoom Cue */}
                      <div className="absolute inset-0 bg-stone-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-900/85 text-white text-sm font-medium backdrop-blur-xs shadow-sm">
                          <Eye className="h-4 w-4" /> Inspect
                        </span>
                      </div>

                      {/* Bottom Info Bar inside image */}
                      <div className="absolute bottom-2 right-2 pointer-events-none">
                        <span className="rounded bg-black/65 px-2 py-0.5 text-xs font-mono text-stone-200 backdrop-blur-xs">
                          {Math.round(file.size / 1024)} KB
                        </span>
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="mt-3 space-y-2.5">
                      <div>
                        <p
                          className="font-semibold text-sm text-foreground truncate cursor-pointer hover:text-amber-600 transition-colors"
                          title={file.name}
                          onClick={() =>
                            setInspectItem({
                              url: file.url,
                              title: file.name,
                              subtitle: file.filePath,
                              fileId: file.fileId,
                              width: file.width,
                              height: file.height,
                              size: file.size,
                              assignedProduct: file.assignedProduct,
                              rawImageKitItem: file,
                            })
                          }
                        >
                          {file.name}
                        </p>

                        {file.assignedProduct ? (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                            <Package className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{file.assignedProduct.name}</span>
                            {file.assignedProduct.isPrimary && (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                                Cover
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground truncate font-medium">
                            Vault asset — not linked
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <Button
                          variant={file.assignedProduct ? "outline" : "default"}
                          size="sm"
                          onClick={() => setLinkImage(file)}
                          className={`h-8 text-xs font-semibold px-3 rounded-lg flex-1 cursor-pointer ${
                            file.assignedProduct
                              ? "border-border/80 text-muted-foreground hover:text-foreground hover:border-amber-500/50"
                              : "bg-amber-600 hover:bg-amber-700 text-white"
                          }`}
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />
                          {file.assignedProduct ? "Reassign" : "Assign to Product"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(file.url, file.fileId, "ImageKit CDN URL copied")}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Copy ImageKit CDN URL"
                        >
                          {copiedKey === file.fileId ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-sm">
                            <DropdownMenuItem
                              onClick={() =>
                                setInspectItem({
                                  url: file.url,
                                  title: file.name,
                                  subtitle: file.filePath,
                                  fileId: file.fileId,
                                  width: file.width,
                                  height: file.height,
                                  size: file.size,
                                  assignedProduct: file.assignedProduct,
                                  rawImageKitItem: file,
                                })
                              }
                              className="cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2" /> Inspect & Test Transforms
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => window.open(file.url, "_blank")}
                              className="cursor-pointer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" /> Open Raw File
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setLinkImage(file)}
                              className="cursor-pointer"
                            >
                              <Link2 className="h-4 w-4 mr-2" /> Assign to Product
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm(`Permanently delete "${file.name}" from ImageKit CDN vault?`)) {
                                  deleteIkFileMutation.mutate(file);
                                }
                              }}
                              className="text-red-600 focus:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete Asset
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === "sheet" ? (
            /* ── LIGHTROOM CONTACT SHEET ── */
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {filteredIkFiles.map((file) => (
                <div
                  key={file.fileId}
                  onClick={() =>
                    setInspectItem({
                      url: file.url,
                      title: file.name,
                      subtitle: file.filePath,
                      fileId: file.fileId,
                      width: file.width,
                      height: file.height,
                      size: file.size,
                      assignedProduct: file.assignedProduct,
                      rawImageKitItem: file,
                    })
                  }
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border/80 bg-stone-900/5 dark:bg-stone-900/50 p-1.5 transition-all hover:border-amber-500 hover:ring-2 hover:ring-amber-500/20"
                  title={`${file.name} (${Math.round(file.size / 1024)} KB)`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.thumbnailUrl || file.url}
                    alt={file.name}
                    loading="lazy"
                    className="h-full w-full object-cover rounded-lg group-hover:scale-105 transition-transform"
                  />
                  {file.assignedProduct && (
                    <span className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── INVENTORY TABLE ── */
            <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-16">Preview</th>
                      <th className="py-3 px-4">File Name & Path</th>
                      <th className="py-3 px-4">Assigned Product</th>
                      <th className="py-3 px-4">Dimensions</th>
                      <th className="py-3 px-4">File Size</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredIkFiles.map((file) => (
                      <tr key={file.fileId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4">
                          <div
                            onClick={() =>
                              setInspectItem({
                                url: file.url,
                                title: file.name,
                                subtitle: file.filePath,
                                fileId: file.fileId,
                                width: file.width,
                                height: file.height,
                                size: file.size,
                                assignedProduct: file.assignedProduct,
                                rawImageKitItem: file,
                              })
                            }
                            className="h-12 w-12 cursor-pointer rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={file.thumbnailUrl || file.url}
                              alt={file.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4 max-w-xs">
                          <p className="font-semibold text-foreground truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{file.filePath}</p>
                        </td>
                        <td className="py-2.5 px-4">
                          {file.assignedProduct ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs sm:text-sm">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="truncate">{file.assignedProduct.name}</span>
                              {file.assignedProduct.isPrimary && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.2 rounded font-bold border border-amber-500/20">
                                  Cover
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground font-medium">
                          {file.width && file.height ? `${file.width} × ${file.height}` : "—"}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground font-medium">
                          {Math.round(file.size / 1024)} KB
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLinkImage(file)}
                              className="h-8 text-xs font-semibold px-2.5 cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              <Link2 className="h-3.5 w-3.5 mr-1" />
                              {file.assignedProduct ? "Reassign" : "Assign"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(file.url, file.fileId, "URL Copied")}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {copiedKey === file.fileId ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Delete "${file.name}"?`)) {
                                  deleteIkFileMutation.mutate(file);
                                }
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 6. TAB 2: CATALOG PHOTOGRAPHY (ASSIGNED) ────────────────────── */}
      {activeTab === "assigned" && (
        <>
          {loadingImages ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-border/70 bg-card p-3 space-y-3">
                  <div className="h-48 bg-muted/60 rounded-xl" />
                  <div className="h-4 bg-muted/70 rounded w-2/3" />
                  <div className="h-3.5 bg-muted/40 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : filteredAssignedImages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/60">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-3.5">
                <ImageIcon className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No catalog photography matching filters</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                No product images match your current filter settings. Reset filters or assign photography from the ImageKit Vault.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredAssignedImages.map((img) => {
                return (
                  <div
                    key={img.id}
                    className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3 shadow-xs transition-all hover:border-amber-500/50 hover:shadow-md"
                  >
                    {/* Visual Frame */}
                    <div
                      onClick={() =>
                        setInspectItem({
                          url: img.public_url || img.storage_path,
                          title: img.product?.name || "Product Image",
                          subtitle: img.alt_text || img.storage_path,
                          assignedProduct: img.product ? { ...img.product, isPrimary: img.is_primary } : null,
                          rawAssignedItem: img,
                        })
                      }
                      className="relative h-52 w-full cursor-pointer overflow-hidden rounded-xl bg-stone-900/5 dark:bg-stone-900/40 border border-border/40 flex items-center justify-center"
                    >
                      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]" />

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.public_url || img.storage_path}
                        alt={img.alt_text || img.product?.name || "Product"}
                        loading="lazy"
                        className="h-full w-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Cover Badge */}
                      {img.is_primary && (
                        <div className="absolute top-2.5 left-2.5 pointer-events-none">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                            <Star className="h-3 w-3 fill-white" />
                            Primary Cover
                          </span>
                        </div>
                      )}

                      {/* Inspect Cue */}
                      <div className="absolute inset-0 bg-stone-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-900/85 text-white text-sm font-medium backdrop-blur-xs shadow-sm">
                          <Eye className="h-4 w-4" /> Inspect
                        </span>
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="mt-3 space-y-2.5">
                      <div>
                        <div className="flex items-start justify-between gap-1.5">
                          <p
                            className="font-semibold text-sm text-foreground truncate cursor-pointer hover:text-amber-600 transition-colors"
                            title={img.product?.name || "Unassigned"}
                            onClick={() =>
                              setInspectItem({
                                url: img.public_url || img.storage_path,
                                title: img.product?.name || "Product Image",
                                subtitle: img.alt_text || img.storage_path,
                                assignedProduct: img.product ? { ...img.product, isPrimary: img.is_primary } : null,
                                rawAssignedItem: img,
                              })
                            }
                          >
                            {img.product?.name || "Unassigned Product"}
                          </p>
                          {img.product?.slug && (
                            <Link
                              href={`/admin/products/${img.product_id}/edit`}
                              className="text-muted-foreground hover:text-amber-600 shrink-0 p-0.5"
                              title="Open Product Editor"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1 font-medium" title={img.alt_text || ""}>
                          {img.alt_text ? (
                            img.alt_text
                          ) : (
                            <span className="italic opacity-60">No alt text specified</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                        {!img.is_primary ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={setPrimaryMutation.isPending}
                            onClick={() => setPrimaryMutation.mutate(img)}
                            className="h-8 text-xs font-semibold px-2.5 rounded-lg flex-1 cursor-pointer border-border/80 text-muted-foreground hover:text-amber-600"
                          >
                            <Star className="h-3.5 w-3.5 mr-1" /> Set Cover
                          </Button>
                        ) : (
                          <span className="inline-flex h-8 items-center justify-center gap-1.5 text-xs font-bold px-2.5 rounded-lg flex-1 bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Check className="h-3.5 w-3.5" /> Active Cover
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(img.public_url || img.storage_path, img.id, "Image CDN URL copied")}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Copy ImageKit CDN URL"
                        >
                          {copiedKey === img.id ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditImage(img)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit Alt Text"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remove this image from ${img.product?.name || "product"}?`)) {
                              deleteAssignedMutation.mutate(img);
                            }
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 cursor-pointer"
                          title="Remove from Product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === "sheet" ? (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {filteredAssignedImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() =>
                    setInspectItem({
                      url: img.public_url || img.storage_path,
                      title: img.product?.name || "Product Image",
                      subtitle: img.alt_text || img.storage_path,
                      assignedProduct: img.product ? { ...img.product, isPrimary: img.is_primary } : null,
                      rawAssignedItem: img,
                    })
                  }
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border/80 bg-stone-900/5 dark:bg-stone-900/50 p-1.5 transition-all hover:border-amber-500 hover:ring-2 hover:ring-amber-500/20"
                  title={`${img.product?.name || "Product"} ${img.is_primary ? "(Cover)" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.public_url || img.storage_path}
                    alt={img.alt_text || "Product image"}
                    loading="lazy"
                    className="h-full w-full object-cover rounded-lg group-hover:scale-105 transition-transform"
                  />
                  {img.is_primary && (
                    <span className="absolute top-2 left-2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── AUDIT TABLE ── */
            <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-16">Preview</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Alt Text (English)</th>
                      <th className="py-3 px-4">Alt Text (Bengali)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredAssignedImages.map((img) => (
                      <tr key={img.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4">
                          <div
                            onClick={() =>
                              setInspectItem({
                                url: img.public_url || img.storage_path,
                                title: img.product?.name || "Product Image",
                                subtitle: img.alt_text || img.storage_path,
                                assignedProduct: img.product ? { ...img.product, isPrimary: img.is_primary } : null,
                                rawAssignedItem: img,
                              })
                            }
                            className="h-12 w-12 cursor-pointer rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.public_url || img.storage_path}
                              alt={img.alt_text || "Product image"}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4 max-w-xs font-semibold text-foreground">
                          {img.product?.name || "Unassigned"}
                        </td>
                        <td className="py-2.5 px-4">
                          {img.is_primary ? (
                            <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 text-amber-600 px-2 py-0.5 text-xs font-bold border border-amber-500/20">
                              <Star className="h-3 w-3 fill-amber-600" /> Primary Cover
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">Gallery Shot</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs max-w-xs truncate">
                          {img.alt_text || <span className="italic opacity-60">None</span>}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs max-w-xs truncate">
                          {img.alt_text_bn || <span className="italic opacity-60">None</span>}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!img.is_primary && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPrimaryMutation.mutate(img)}
                                className="h-8 text-xs font-semibold px-2.5 cursor-pointer"
                              >
                                Set Cover
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditImage(img)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Edit Alt Text"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(img.public_url || img.storage_path, img.id, "URL Copied")}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {copiedKey === img.id ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Remove photo from ${img.product?.name || "product"}?`)) {
                                  deleteAssignedMutation.mutate(img);
                                }
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 7. INTERACTIVE STUDIO INSPECTOR & LIGHTBOX MODAL ──────────────── */}
      <Dialog open={!!inspectItem} onOpenChange={(open) => !open && setInspectItem(null)}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border border-border bg-card">
          <DialogHeader className="px-6 py-4.5 border-b border-border/80 shrink-0 text-left bg-muted/15">
            <div className="flex items-center justify-between pr-8">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground truncate">
                  {inspectItem?.title}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate font-mono">
                  {inspectItem?.subtitle || inspectItem?.url}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {inspectItem && (
            <div className="flex-1 overflow-y-auto p-6 pb-10 grid gap-6 md:grid-cols-12">
              {/* Left Column: Visual Canvas */}
              <div className="md:col-span-7 flex flex-col items-center justify-center">
                <div className="relative w-full h-80 sm:h-96 rounded-xl border border-border/70 overflow-hidden bg-stone-900/5 dark:bg-stone-900/40 flex items-center justify-center p-4">
                  {/* Subtle Transparency Grid */}
                  <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]" />

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewTransformedUrl || inspectItem.url}
                    alt={inspectItem.title}
                    className="max-h-full max-w-full object-contain rounded-lg transition-all"
                  />

                  {inspectItem.assignedProduct?.isPrimary && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                      <Star className="h-3.5 w-3.5 fill-white" /> Primary Cover
                    </span>
                  )}
                </div>

                <div className="mt-3.5 flex items-center justify-between w-full text-xs sm:text-sm text-muted-foreground font-mono font-medium">
                  <span>
                    {inspectItem.width && inspectItem.height
                      ? `${inspectItem.width} × ${inspectItem.height} px (${getAspectRatioLabel(inspectItem.width, inspectItem.height)})`
                      : "ImageKit Optimized Asset"}
                  </span>
                  <span>{inspectItem.size ? `${Math.round(inspectItem.size / 1024)} KB` : ""}</span>
                </div>
              </div>

              {/* Right Column: Studio Controls & Metadata */}
              <div className="md:col-span-5 space-y-4">
                {/* 1-Click Code Snippets */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-foreground">CDN Delivery Link</span>
                    <button
                      onClick={() => handleCopy(previewTransformedUrl || inspectItem.url, "inspect-url", "CDN URL Copied")}
                      className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === "inspect-url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy URL
                    </button>
                  </div>
                  <Input
                    readOnly
                    value={previewTransformedUrl || inspectItem.url}
                    className="h-9 text-xs font-mono bg-background"
                  />

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleCopy(
                          `<img src="${previewTransformedUrl || inspectItem.url}" alt="${inspectItem.title}" />`,
                          "inspect-html",
                          "HTML Tag Copied"
                        )
                      }
                      className="h-8 text-xs font-medium rounded-lg flex-1 cursor-pointer"
                    >
                      <Code2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Copy HTML
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleCopy(
                          `![${inspectItem.title}](${previewTransformedUrl || inspectItem.url})`,
                          "inspect-md",
                          "Markdown Copied"
                        )
                      }
                      className="h-8 text-xs font-medium rounded-lg flex-1 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Markdown
                    </Button>
                  </div>
                </div>

                {/* Dynamic Transformations Playground */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Sliders className="h-4 w-4 text-amber-600" /> ImageKit Transforms
                    </span>
                    <button
                      onClick={() => {
                        setTransformWidth(800);
                        setTransformQuality(80);
                        setTransformFormat("auto");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Width Scale</Label>
                      <Select
                        value={String(transformWidth)}
                        onValueChange={(val) => setTransformWidth(Number(val))}
                      >
                        <SelectTrigger className="h-9 text-xs font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="300" className="text-xs">300px (Thumb)</SelectItem>
                          <SelectItem value="600" className="text-xs">600px (Grid)</SelectItem>
                          <SelectItem value="800" className="text-xs">800px (Standard)</SelectItem>
                          <SelectItem value="1200" className="text-xs">1200px (Hero)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Compression</Label>
                      <Select
                        value={String(transformQuality)}
                        onValueChange={(val) => setTransformQuality(Number(val))}
                      >
                        <SelectTrigger className="h-9 text-xs font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90" className="text-xs">90% (Lossless)</SelectItem>
                          <SelectItem value="80" className="text-xs">80% (Balanced)</SelectItem>
                          <SelectItem value="65" className="text-xs">65% (High Saving)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Product Assignment & Alt Text (If assigned item) */}
                {inspectItem.rawAssignedItem ? (
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                    <span className="text-xs sm:text-sm font-semibold text-foreground block">
                      Accessibility & SEO (Alt Text)
                    </span>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">English Description</Label>
                      <Input
                        value={inspectorAltEn}
                        onChange={(e) => setInspectorAltEn(e.target.value)}
                        placeholder="e.g. Pure Date Palm Jaggery 500g Jar"
                        className="h-9 text-sm bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Bengali Description (বাংলা)</Label>
                      <Input
                        value={inspectorAltBn}
                        onChange={(e) => setInspectorAltBn(e.target.value)}
                        placeholder="যেমন: খাঁটি পাটালি গুড় ৫০০ গ্রাম"
                        className="h-9 text-sm bg-background"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveInspectorAlt}
                      disabled={isSavingAlt}
                      className="w-full h-9 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer mt-1"
                    >
                      {isSavingAlt ? "Saving..." : "Save Descriptions"}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2.5">
                    <span className="text-xs sm:text-sm font-semibold text-foreground block">Catalog Link</span>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      This asset is currently stored in your ImageKit media vault. Assign it to any catalog product to display it in the storefront.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        const file = inspectItem.rawImageKitItem;
                        setInspectItem(null);
                        if (file) setLinkImage(file);
                      }}
                      className="w-full h-9 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer mt-1"
                    >
                      <Link2 className="h-4 w-4 mr-2" /> Assign to Product
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 8. SUB-DIALOGS ────────────────────────────────────────────────── */}
      <UploadImageDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        products={products}
      />

      <EditAltDialog
        image={editImage}
        open={!!editImage}
        onOpenChange={(open) => !open && setEditImage(null)}
      />

      <LinkImageDialog
        image={linkImage}
        open={!!linkImage}
        onOpenChange={(open) => !open && setLinkImage(null)}
        products={products}
      />
    </div>
  );
}
