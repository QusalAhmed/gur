"use client";

import * as React from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { FolderOpen, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToastNotificationPortal, ToastData } from "@/components/ui/toast-notification";
import { ImageUploaderProps, UploadedImage } from "./types";
import {
  calculateFileHash,
  compressImage,
  uploadToSupabaseWithProgress,
  normalizeValue,
  formatBytes,
} from "./utils";
import { SingleImagePreview } from "./single-image-preview";
import { SortableImageList } from "./sortable-image-list";
import { GalleryDialog } from "./gallery-dialog";

export function ImageUploader({
  value,
  onChange,
  multiple = false,
  maxFiles = 10,
  maxInputSizeBytes = 50 * 1024 * 1024, // 50MB raw file accept limit
  compressThresholdBytes = 5 * 1024 * 1024, // 5MB trigger threshold
  targetCompressedSizeMB = 2, // Compresses to ~2MB (guaranteed < 5MB)
  bucket = "catalog-images",
  folder = "general",
  compress = true,
  maxWidthOrHeight = 2048,
  compressQuality = 0.85,
  accept = {
    "image/*": [".jpeg", ".jpg", ".png", ".webp", ".avif"],
  },
  onRemove,
  onUpload,
  allowGallery = true,
  disabled = false,
  className = "",
  label,
  description,
  aspectRatio = "auto",
  showAltInput = false,
}: ImageUploaderProps) {
  // Internal state of uploaded items
  const [items, setItems] = React.useState<UploadedImage[]>(() => normalizeValue(value));
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [toast, setToast] = React.useState<ToastData | null>(null);

  // Sync internal state when external value changes
  React.useEffect(() => {
    queueMicrotask(() => {
      const normalized = normalizeValue(value);
      setItems((prev) => {
        // Avoid loops if already identical URLs/paths
        const prevKeys = prev.map((p) => p.url || p.path).join("|");
        const nextKeys = normalized.map((n) => n.url || n.path).join("|");
        if (prevKeys === nextKeys) return prev;
        return normalized;
      });
    });
  }, [value]);

  const showToast = (
    message: string,
    type: "warning" | "destructive" | "success" | "info" = "warning",
    title?: string
  ) => {
    setToast({
      message,
      type,
      title,
      duration: 5000,
    });
  };

  // Helper to commit state changes and call onChange
  const updateItems = React.useCallback(
    (newItems: UploadedImage[]) => {
      setItems(newItems);
      onChange?.(newItems);
    },
    [onChange]
  );

  /**
   * Core pipeline: Deduplication (Hash) -> Compression -> Upload with Progress
   */
  const processFiles = async (acceptedFiles: File[]) => {
    if (disabled || acceptedFiles.length === 0) return;

    if (!multiple && acceptedFiles.length > 1) {
      acceptedFiles = [acceptedFiles[0]];
    }

    if (multiple && items.length + acceptedFiles.length > maxFiles) {
      showToast(
        `Cannot add more than ${maxFiles} images. Selection trimmed.`,
        "warning"
      );
      acceptedFiles = acceptedFiles.slice(0, maxFiles - items.length);
    }

    // Step 1: Pre-calculate hashes and check for duplicates in the current selection
    const filesToUpload: { file: File; hash: string }[] = [];
    const currentHashes = new Set(
      items.map((i) => i.hash).filter((h): h is string => Boolean(h))
    );

    for (const file of acceptedFiles) {
      try {
        const hash = await calculateFileHash(file);

        // Check against current frontend items
        if (currentHashes.has(hash)) {
          showToast(
            `Duplicate ignored: "${file.name}" is already in your image selection.`,
            "warning",
            "Duplicate Image"
          );
          continue;
        }

        currentHashes.add(hash);
        filesToUpload.push({ file, hash });
      } catch (err) {
        console.warn("Could not calculate hash for file:", file.name, err);
        filesToUpload.push({ file, hash: `hash-${Date.now()}-${file.name}` });
      }
    }

    if (filesToUpload.length === 0) return;

    // Step 2: Initialize placeholder cards with "hashing / pending" status
    const startIndex = multiple ? items.length : 0;
    const initialPlaceholders: UploadedImage[] = filesToUpload.map(({ file, hash }, idx) => {
      const sortOrder = startIndex + idx;
      return {
        id: `local-${Date.now()}-${idx}`,
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        type: file.type,
        hash,
        progress: 0,
        status: "uploading",
        sortOrder,
        isPrimary: multiple ? sortOrder === 0 : true,
        file,
      };
    });

    const activeList = multiple ? [...items, ...initialPlaceholders] : initialPlaceholders;
    updateItems(activeList);

    // Step 3: Check server for existing asset with this hash (smart reuse)
    // and upload files in parallel with real-time percentage updates
    for (const { file, hash } of filesToUpload) {
      const placeholder = initialPlaceholders.find((p) => p.hash === hash);
      if (!placeholder) continue;

      try {
        let uploadFile = file;
        placeholder.originalSize = file.size;

        // Auto-compress from frontend if file exceeds 5MB (or if compress prop is enabled)
        const exceedsThreshold = file.size > compressThresholdBytes;
        if (exceedsThreshold || compress) {
          placeholder.status = "compressing";
          placeholder.progress = 10;
          setItems([...activeList]);

          uploadFile = await compressImage(file, {
            maxSizeMB: targetCompressedSizeMB,
            maxWidthOrHeight,
            quality: compressQuality,
            onProgress: (pct) => {
              placeholder.progress = pct;
              setItems([...activeList]);
            },
          });

          placeholder.compressedSize = uploadFile.size;

          // If original exceeded 5MB, notify user with exact size savings
          if (exceedsThreshold) {
            const savedPct = Math.round(
              ((file.size - uploadFile.size) / file.size) * 100
            );
            showToast(
              `Auto-compressed "${file.name}" from ${formatBytes(
                file.size
              )} to ${formatBytes(uploadFile.size)} (${savedPct}% reduction) before upload.`,
              "info",
              "Image Auto-Compressed"
            );
          }
        }

        placeholder.status = "uploading";
        placeholder.size = uploadFile.size;
        placeholder.progress = 0;

        // Perform upload with progress
        let uploadResult: { path: string; publicUrl: string; hash?: string };

        if (onUpload) {
          uploadResult = await onUpload(uploadFile, (pct) => {
            placeholder.progress = pct;
            setItems([...activeList]);
          });
        } else {
          // Default: upload to Supabase Storage with clean folder path
          const cleanBaseName = uploadFile.name
            .replace(/\.[^/.]+$/, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .slice(0, 30);
          const ext = uploadFile.name.split(".").pop()?.toLowerCase() || "webp";
          const storagePath = `${folder}/${Date.now()}-${cleanBaseName}.${ext}`;

          uploadResult = await uploadToSupabaseWithProgress(uploadFile, {
            bucket,
            path: storagePath,
            onProgress: (pct) => {
              placeholder.progress = pct;
              setItems([...activeList]);
            },
          });
        }

        // Finalize uploaded item
        placeholder.url = uploadResult.publicUrl;
        placeholder.path = uploadResult.path;
        placeholder.progress = 100;
        placeholder.status = "success";
        placeholder.hash = hash;
        delete placeholder.file; // release file reference

        updateItems([...activeList]);
      } catch (uploadError: unknown) {
        console.error("Upload error for file:", file.name, uploadError);
        const errMsg =
          uploadError instanceof Error
            ? uploadError.message
            : typeof uploadError === "object" && uploadError !== null && "message" in uploadError
            ? String((uploadError as { message: unknown }).message)
            : "Upload failed";
        placeholder.status = "error";
        placeholder.error = errMsg;
        updateItems([...activeList]);
        showToast(
          `Failed to upload "${file.name}": ${placeholder.error}`,
          "destructive",
          "Upload Error"
        );
      }
    }
  };

  // Rejection handler (e.g. raw file size > 50MB, invalid format)
  const handleDropRejected = (rejections: FileRejection[]) => {
    const errorMessages = rejections.map((r) => {
      const err = r.errors[0];
      if (err?.code === "file-too-large") {
        return `"${r.file.name}" exceeds the maximum allowed raw size of ${(
          maxInputSizeBytes /
          (1024 * 1024)
        ).toFixed(0)}MB.`;
      }
      return `"${r.file.name}": ${err?.message || "Invalid file"}`;
    });

    showToast(errorMessages.join(" "), "destructive", "File Rejected");
  };

  // React Dropzone hook
  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop: processFiles,
    onDropRejected: handleDropRejected,
    accept,
    maxSize: maxInputSizeBytes, // Accepts large raw files up to 50MB so they can be compressed
    multiple,
    disabled,
    noClick: false,
  });

  // Handle Remove Image
  const handleRemove = async (targetItem: UploadedImage) => {
    if (onRemove) {
      const shouldProceed = await onRemove(targetItem);
      if (shouldProceed === false) return;
    }

    const updated = items
      .filter((i) => i.id !== targetItem.id)
      .map((item, idx) => ({
        ...item,
        sortOrder: idx,
        isPrimary: idx === 0,
      }));

    updateItems(updated);
  };

  // Handle Reordering / Serialization in Multiple Mode
  const handleReorder = (newItems: UploadedImage[]) => {
    updateItems(newItems);
  };

  // Handle Promote to Primary (Serial #1)
  const handleSetPrimary = (targetItem: UploadedImage) => {
    const targetIdx = items.findIndex((i) => i.id === targetItem.id);
    if (targetIdx <= 0) return;

    const reordered = [...items];
    const [promoted] = reordered.splice(targetIdx, 1);
    reordered.unshift(promoted);

    const serialized = reordered.map((item, idx) => ({
      ...item,
      sortOrder: idx,
      isPrimary: idx === 0,
    }));

    updateItems(serialized);
  };

  // Handle Gallery Selection
  const handleGallerySelect = (selected: UploadedImage[]) => {
    if (!multiple) {
      if (selected[0]) {
        updateItems([selected[0]]);
      }
    } else {
      // Deduplicate gallery additions by url or path
      const existingUrls = new Set(items.map((i) => i.url));
      const newFromGallery = selected.filter((s) => !existingUrls.has(s.url));

      if (newFromGallery.length < selected.length) {
        showToast(
          "Some gallery images were already present in your selection.",
          "info"
        );
      }

      const combined = [...items, ...newFromGallery].map((item, idx) => ({
        ...item,
        sortOrder: idx,
        isPrimary: idx === 0,
      }));

      updateItems(combined);
    }
  };

  // Handle Alt Text Update
  const handleUpdateAltText = (targetItem: UploadedImage, altText: string) => {
    const updated = items.map((item) =>
      item.id === targetItem.id ? { ...item, altText } : item
    );
    updateItems(updated);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Toast Portal for Warnings & Errors */}
      <ToastNotificationPortal toast={toast} onDismiss={() => setToast(null)} />

      {/* Gallery Selection Modal */}
      {allowGallery && (
        <GalleryDialog
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          onSelect={handleGallerySelect}
          multiple={multiple}
          bucket={bucket}
          defaultFolder="all"
        />
      )}

      {/* Mode 1: Single Image Mode */}
      {!multiple ? (
        <SingleImagePreview
          item={items[0] || null}
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          onOpenGallery={() => setGalleryOpen(true)}
          onRemove={() => handleRemove(items[0])}
          disabled={disabled}
          label={label || "Upload Banner / Image"}
          description={
            description ||
            `Supports JPEG, PNG, WebP up to ${(maxInputSizeBytes / (1024 * 1024)).toFixed(0)}MB (files > 5MB auto-compressed).`
          }
          aspectRatio={aspectRatio}
          allowGallery={allowGallery}
        />
      ) : (
        /* Mode 2: Multiple Images Mode with Serialization (Reordering) */
        <div className="space-y-4">
          {/* Dropzone Top Header Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragActive
                ? "border-amber-500 bg-amber-500/10 scale-[0.99]"
                : "border-border hover:border-amber-500/60 bg-muted/15 hover:bg-muted/30"
            } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input {...getInputProps()} />

            <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2.5 text-amber-600">
              <UploadCloud className="h-5 w-5" />
            </div>

            <p className="text-xs font-semibold text-foreground">
              {isDragActive
                ? "Drop image files here to upload"
                : label || "Click or drag images to upload"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
              {description ||
                `JPEG, PNG, WebP up to ${(maxInputSizeBytes / (1024 * 1024)).toFixed(0)}MB (files > 5MB auto-compressed). Max ${maxFiles} images.`}
            </p>

            <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs cursor-pointer shadow-xs"
                disabled={disabled}
                onClick={openFileDialog}
              >
                <UploadCloud className="h-3.5 w-3.5 mr-1 text-amber-600" />
                Upload Images
              </Button>

              {allowGallery && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setGalleryOpen(true)}
                  disabled={disabled}
                  className="h-7 text-xs cursor-pointer shadow-xs"
                >
                  <FolderOpen className="h-3.5 w-3.5 mr-1 text-amber-600" />
                  Select from Gallery
                </Button>
              )}
            </div>
          </div>

          {/* Sortable & Reorderable Serialized Image Grid */}
          <SortableImageList
            items={items}
            onReorder={handleReorder}
            onRemove={handleRemove}
            onSetPrimary={handleSetPrimary}
            onUpdateAltText={handleUpdateAltText}
            showAltInput={showAltInput}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
