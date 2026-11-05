"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  FolderOpen,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { GalleryAsset, UploadedImage } from "./types";
import { formatBytes } from "./utils";

interface GalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selected: UploadedImage[]) => void;
  multiple?: boolean;
  bucket?: string;
  defaultFolder?: string;
}

function resolveInitialFolder(f?: string): string {
  if (!f || f === "all") return "all";
  if (f.startsWith("categories")) return "categories";
  if (f.startsWith("products")) return "products";
  return "all";
}

export function GalleryDialog({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  bucket = "general",
  defaultFolder = "all",
}: GalleryDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [assets, setAssets] = React.useState<GalleryAsset[]>([]);
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFolder, setActiveFolder] = React.useState<string>(() => resolveInitialFolder(defaultFolder));

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const folders = [
    { id: "all", label: "All Assets" },
    { id: "products", label: "Products" },
    { id: "categories", label: "Categories" },
    { id: "branding", label: "Branding" },
    { id: "avatars", label: "Avatars" },
  ];

  // Fetch files from ImageKit Media Library via server API route
  const loadStorageFiles = React.useCallback(
    async (folderId: string = activeFolder, search: string = searchQuery) => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const queryParams = new URLSearchParams();
        if (folderId && folderId !== "all") {
          queryParams.set("folder", folderId);
        }
        if (search.trim()) {
          queryParams.set("search", search.trim());
        }

        const res = await fetch(`/api/imagekit/files?${queryParams.toString()}`, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || `Failed to fetch files (HTTP ${res.status})`);
        }

        const items: GalleryAsset[] = (data.files || []).map((file: any) => ({
          name: file.name,
          path: file.publicUrl, // Store full ImageKit CDN URL as path
          publicUrl: file.publicUrl,
          size: file.size,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        }));

        setAssets(items);
      } catch (err: any) {
        console.warn("Failed to load ImageKit gallery files:", err);
        setErrorMessage(
          err?.message || "Failed to load files from ImageKit. Check API credentials in .env."
        );
        setAssets([]);
      } finally {
        setLoading(false);
      }
    },
    [activeFolder, searchQuery]
  );

  // Load files whenever the modal opens or active folder changes
  React.useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) return;
      loadStorageFiles(activeFolder);
    });

    return () => {
      isCancelled = true;
    };
  }, [open, activeFolder, loadStorageFiles]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedPaths(new Set());
      setSearchQuery("");
      setActiveFolder("all");
    }
    onOpenChange(nextOpen);
  };

  const toggleSelect = (asset: GalleryAsset) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (multiple) {
        if (next.has(asset.path)) {
          next.delete(asset.path);
        } else {
          next.add(asset.path);
        }
      } else {
        next.clear();
        next.add(asset.path);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const chosenAssets = assets.filter((a) => selectedPaths.has(a.path));
    const items: UploadedImage[] = chosenAssets.map((asset, idx) => ({
      id: `gallery-${Date.now()}-${idx}`,
      url: asset.publicUrl,
      path: asset.path,
      name: asset.name,
      size: asset.size,
      status: "success",
      progress: 100,
      sortOrder: idx,
      isPrimary: idx === 0,
    }));

    onSelect(items);
    onOpenChange(false);
  };

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery.trim()) return true;
    return asset.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border border-border bg-card">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  ImageKit Media Gallery
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Browse and select previously uploaded assets from ImageKit Media Library
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadStorageFiles(activeFolder)}
              disabled={loading}
              className="h-8 text-xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Controls: Search and Folder Tabs */}
          <div className="mt-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setActiveFolder(folder.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    activeFolder === folder.id
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {folder.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search file name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Gallery Content Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-2" />
              <p className="text-xs">Loading media assets from ImageKit Media Library...</p>
            </div>
          ) : errorMessage ? (
            <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">ImageKit Connection Notice</p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadStorageFiles(activeFolder)}
                className="text-xs cursor-pointer"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" /> Retry
              </Button>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">No media assets found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery
                  ? `No files matching "${searchQuery}"`
                  : `Folder "${activeFolder}" is currently empty in ImageKit.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredAssets.map((asset) => {
                const isSelected = selectedPaths.has(asset.path);
                return (
                  <div
                    key={asset.path}
                    onClick={() => toggleSelect(asset)}
                    onDoubleClick={() => {
                      if (!multiple) {
                        toggleSelect(asset);
                        setTimeout(handleConfirm, 50);
                      }
                    }}
                    className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all bg-card flex flex-col ${
                      isSelected
                        ? "border-amber-500 ring-2 ring-amber-500/20 shadow-md"
                        : "border-border hover:border-amber-500/50 hover:shadow-xs"
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="aspect-square bg-muted/20 relative flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.publicUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />

                      {/* Selected Overlay Checkmark */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-md">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      )}

                      {/* Hover Info Badge */}
                      {asset.size && (
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/70 text-white backdrop-blur-xs">
                          {formatBytes(asset.size)}
                        </span>
                      )}
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-2 text-left flex flex-col gap-0.5 border-t border-border/50 bg-background/50">
                      <p className="text-xs font-medium text-foreground truncate" title={asset.name}>
                        {asset.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate font-mono">
                        {asset.path}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {selectedPaths.size > 0 ? (
              <span className="text-foreground font-medium">
                {selectedPaths.size} asset{selectedPaths.size > 1 ? "s" : ""} selected
              </span>
            ) : (
              <span>Select an image to insert</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedPaths.size === 0}
              onClick={handleConfirm}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              Insert {selectedPaths.size > 0 ? `(${selectedPaths.size})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
