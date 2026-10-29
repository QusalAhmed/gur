"use client";

import * as React from "react";
import {
  GripVertical,
  Star,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UploadedImage } from "./types";
import { formatBytes } from "./utils";

interface SortableImageListProps {
  items: UploadedImage[];
  onReorder: (newItems: UploadedImage[]) => void;
  onRemove: (item: UploadedImage) => void;
  onSetPrimary: (item: UploadedImage) => void;
  onUpdateAltText?: (item: UploadedImage, altText: string) => void;
  showAltInput?: boolean;
  disabled?: boolean;
}

export function SortableImageList({
  items,
  onReorder,
  onRemove,
  onSetPrimary,
  onUpdateAltText,
  showAltInput = false,
  disabled = false,
}: SortableImageListProps) {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Set a transparent drag image or standard ghost
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === targetIndex || disabled) {
      setDraggedIndex(null);
      return;
    }

    const updated = [...items];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    // Update sortOrder and isPrimary flags
    const serialized = updated.map((item, idx) => ({
      ...item,
      sortOrder: idx,
      isPrimary: idx === 0,
    }));

    onReorder(serialized);
    setDraggedIndex(null);
  };

  const handleMove = (currentIndex: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= items.length || disabled) return;
    const updated = [...items];
    const [movedItem] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    const serialized = updated.map((item, idx) => ({
      ...item,
      sortOrder: idx,
      isPrimary: idx === 0,
    }));

    onReorder(serialized);
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span className="font-medium text-foreground">
          {items.length} image{items.length > 1 ? "s" : ""} selected &middot; Drag to change serial order
        </span>
        <span className="text-[11px]">First item is Primary Cover</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {items.map((img, index) => {
          const isPrimary = index === 0 || img.isPrimary;
          const isDragging = draggedIndex === index;
          const isOver = dragOverIndex === index;
          const isUploading =
            img.status === "uploading" ||
            img.status === "compressing" ||
            img.status === "hashing";

          return (
            <div
              key={img.id || index}
              draggable={!disabled && !isUploading}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`group relative rounded-xl border overflow-hidden bg-card transition-all flex flex-col ${
                isPrimary
                  ? "border-amber-500 shadow-sm ring-2 ring-amber-500/20"
                  : "border-border hover:border-muted-foreground/40"
              } ${isDragging ? "opacity-40 scale-95" : ""} ${
                isOver ? "border-amber-500 border-dashed scale-102" : ""
              }`}
            >
              {/* Image Preview Container */}
              <div className="aspect-square bg-muted/20 relative flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name || `Serial #${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Serial Badge Top-Left */}
                <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                  {isPrimary ? (
                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[10px] font-semibold px-1.5 py-0 shadow-sm">
                      <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                      #1 Primary
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-black/65 text-white backdrop-blur-xs text-[10px] font-mono px-1.5 py-0 border-0"
                    >
                      #{index + 1}
                    </Badge>
                  )}
                </div>

                {/* Drag Handle Top-Right */}
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <div
                    title="Drag to reorder serial"
                    className="h-6 w-6 rounded bg-black/60 text-white backdrop-blur-xs flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-black/80 transition-colors"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                </div>

                {/* Progress / Status Overlay */}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-white text-center z-20">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500 mb-1" />
                    <p className="text-xs font-semibold">
                      {img.status === "compressing"
                        ? `Compressing ${img.progress ? `${img.progress}%` : ""}`
                        : img.status === "hashing"
                        ? "Hashing"
                        : `${img.progress || 0}%`}
                    </p>
                    {(img.status === "uploading" || img.status === "compressing") && (
                      <div className="w-full max-w-[80px] bg-white/20 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div
                          className="bg-amber-500 h-1 rounded-full transition-all"
                          style={{ width: `${img.progress || 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Error Overlay */}
                {img.status === "error" && (
                  <div className="absolute inset-0 bg-destructive/85 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-white text-center z-20">
                    <AlertCircle className="h-5 w-5 mb-1" />
                    <p className="text-[10px] font-semibold line-clamp-2">
                      {img.error || "Failed"}
                    </p>
                  </div>
                )}

                {/* Bottom Overlay: Move Controls & Quick Make Primary */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-white z-10">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0 || disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(index, index - 1);
                      }}
                      title="Move backward in serial order"
                      className="h-6 w-6 rounded bg-black/50 hover:bg-amber-600 disabled:opacity-30 disabled:hover:bg-black/50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1 || disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(index, index + 1);
                      }}
                      title="Move forward in serial order"
                      className="h-6 w-6 rounded bg-black/50 hover:bg-amber-600 disabled:opacity-30 disabled:hover:bg-black/50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetPrimary(img);
                      }}
                      title="Set as Serial #1 (Primary Cover)"
                      className="px-1.5 py-0.5 text-[10px] rounded bg-amber-600 hover:bg-amber-500 font-medium transition-colors cursor-pointer"
                    >
                      Make #1
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(img);
                    }}
                    title="Remove image"
                    className="h-6 w-6 rounded bg-destructive/80 hover:bg-destructive flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Card Footer Info */}
              <div className="p-2 text-left space-y-1.5 border-t border-border/60 bg-muted/10">
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="truncate font-medium text-foreground max-w-[90px]" title={img.name}>
                    {img.name || `Serial #${index + 1}`}
                  </span>
                  {img.size && (
                    <span
                      className={`text-[10px] shrink-0 font-mono ${
                        img.originalSize && img.originalSize > img.size
                          ? "text-emerald-600 font-semibold"
                          : "text-muted-foreground"
                      }`}
                      title={
                        img.originalSize && img.originalSize > img.size
                          ? `Auto-compressed from ${formatBytes(img.originalSize)}`
                          : undefined
                      }
                    >
                      {formatBytes(img.size)}
                    </span>
                  )}
                </div>

                {showAltInput && (
                  <Input
                    placeholder="Alt text (SEO)..."
                    value={img.altText || ""}
                    disabled={disabled}
                    onChange={(e) => onUpdateAltText?.(img, e.target.value)}
                    className="h-6 text-[10px] px-1.5 py-0"
                    title="Image alt text for search engine optimization and accessibility"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
