"use client";

import * as React from "react";
import {
  UploadCloud,
  Trash2,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UploadedImage } from "./types";
import { formatBytes } from "./utils";
import type { DropzoneRootProps, DropzoneInputProps } from "react-dropzone";

interface SingleImagePreviewProps {
  item: UploadedImage | null;
  getRootProps: <T extends DropzoneRootProps>(props?: T) => T;
  getInputProps: <T extends DropzoneInputProps>(props?: T) => T;
  isDragActive: boolean;
  onOpenGallery?: () => void;
  onRemove: () => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  aspectRatio?: "square" | "video" | "wide" | "auto";
  allowGallery?: boolean;
}

export function SingleImagePreview({
  item,
  getRootProps,
  getInputProps,
  isDragActive,
  onOpenGallery,
  onRemove,
  disabled = false,
  label = "Upload Image",
  description = "Supports JPEG, PNG, WebP, AVIF up to 5MB.",
  aspectRatio = "auto",
  allowGallery = true,
}: SingleImagePreviewProps) {
  const isUploading =
    item?.status === "uploading" ||
    item?.status === "compressing" ||
    item?.status === "hashing";

  // Aspect ratio class mapping
  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square max-w-[200px]"
      : aspectRatio === "video"
      ? "aspect-video max-w-[360px]"
      : aspectRatio === "wide"
      ? "aspect-[21/9] max-w-[420px]"
      : "aspect-auto max-h-[220px]";

  if (!item || !item.url) {
    return (
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-amber-500 bg-amber-500/10 scale-[0.99]"
            : "border-border hover:border-amber-500/60 bg-muted/15 hover:bg-muted/30"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />

        <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 text-amber-600 transition-transform group-hover:scale-110">
          <UploadCloud className="h-6 w-6" />
        </div>

        <p className="text-sm font-semibold text-foreground">
          {isDragActive ? "Drop image here to upload" : label}
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {description}
        </p>

        <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer shadow-xs"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              // react-dropzone handles trigger on root click, but if clicked button directly:
              const rootEl = e.currentTarget.closest('[role="presentation"]');
              if (rootEl) (rootEl as HTMLElement).click();
            }}
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1 text-amber-600" />
            Choose File
          </Button>

          {allowGallery && onOpenGallery && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGallery();
              }}
              disabled={disabled}
              className="h-8 text-xs cursor-pointer shadow-xs text-muted-foreground hover:text-foreground"
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1 text-amber-600" />
              Select from Gallery
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 transition-all shadow-xs">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Preview Frame */}
        <div
          className={`relative rounded-lg overflow-hidden border border-border bg-muted/20 shrink-0 w-full sm:w-auto flex items-center justify-center ${aspectClass}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.name || "Preview"}
            className="w-full h-full object-cover max-h-[180px] rounded-lg"
          />

          {/* Progress / Status Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-white text-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500 mb-1.5" />
              <p className="text-xs font-semibold">
                {item.status === "compressing"
                  ? `Compressing ${item.progress ? `${item.progress}%` : "..."}`
                  : item.status === "hashing"
                  ? "Verifying hash..."
                  : `Uploading ${item.progress || 0}%`}
              </p>
              {(item.status === "uploading" || item.status === "compressing") && typeof item.progress === "number" && (
                <div className="w-full max-w-[120px] bg-white/20 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error Overlay */}
          {item.status === "error" && (
            <div className="absolute inset-0 bg-destructive/80 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-white text-center">
              <AlertCircle className="h-6 w-6 text-white mb-1" />
              <p className="text-xs font-semibold">Upload failed</p>
              <p className="text-[10px] text-white/80 line-clamp-2 mt-0.5">
                {item.error || "Please try again"}
              </p>
            </div>
          )}
        </div>

        {/* Info & Action Controls */}
        <div className="flex-1 min-w-0 text-center sm:text-left space-y-2 w-full">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <p className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                {item.name || (item.path ? item.path.split("/").pop() : "Uploaded Image")}
              </p>
              {item.status === "success" && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0"
                >
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> Ready
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
              {item.path || item.url}
            </p>
            {item.size && (
              <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                <span>Size: {formatBytes(item.size)}</span>
                {item.originalSize && item.originalSize > item.size && (
                  <span className="text-emerald-600 font-medium">
                    (auto-compressed from {formatBytes(item.originalSize)})
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isUploading}
                className="h-7 text-xs cursor-pointer shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1 text-amber-600" />
                Change Image
              </Button>
            </div>

            {allowGallery && onOpenGallery && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenGallery}
                disabled={disabled || isUploading}
                className="h-7 text-xs cursor-pointer shadow-xs"
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1 text-amber-600" />
                Gallery
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={disabled || isUploading}
              className="h-7 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
