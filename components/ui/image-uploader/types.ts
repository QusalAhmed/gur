"use client";

export type UploadStatus = "idle" | "hashing" | "compressing" | "uploading" | "success" | "error";

export interface UploadedImage {
  id: string; // Unique client or database ID
  url: string; // Public URL or temporary blob preview URL
  path?: string; // Storage path in bucket (e.g. "categories/slug/file.webp")
  hash?: string; // SHA-256 hexadecimal hash for deduplication
  name?: string; // Original or sanitized file name
  altText?: string; // SEO and accessibility alt text
  size?: number; // Current file size in bytes
  originalSize?: number; // Raw file size before client-side compression
  compressedSize?: number; // Size after compression
  type?: string; // MIME type (e.g. "image/webp", "image/png")
  progress?: number; // Upload progress 0 to 100
  status?: UploadStatus;
  error?: string;
  isPrimary?: boolean; // True for serial #1 / primary cover image
  sortOrder?: number; // 0-based or 1-based serial index
  file?: File; // Reference to original/compressed File if still local
}

export interface ImageUploaderProps {
  /**
   * Controlled value: single image, array of images, string URL/path, or null
   */
  value?: UploadedImage[] | UploadedImage | string | string[] | null;

  /**
   * Called whenever items are added, uploaded, reordered, or removed
   */
  onChange?: (items: UploadedImage[]) => void;

  /**
   * Single or multiple image mode
   * @default false
   */
  multiple?: boolean;

  /**
   * Maximum allowed files in multiple mode
   * @default 10
   */
  maxFiles?: number;

  /**
   * Maximum raw file size in bytes accepted by dropzone before rejecting
   * @default 52428800 (50MB)
   */
  maxInputSizeBytes?: number;

  /**
   * File size threshold in bytes above which automatic compression is triggered
   * @default 5242880 (5MB)
   */
  compressThresholdBytes?: number;

  /**
   * Target maximum size in MB for compressed output (e.g. 2MB or 4.5MB)
   * Guaranteed to be under compressThresholdBytes
   * @default 2
   */
  targetCompressedSizeMB?: number;

  /**
   * Maximum allowed file size for backward compatibility
   * @default 5242880 (5MB)
   */
  maxSizeBytes?: number;

  /**
   * Supabase Storage bucket name
   * @default "catalog-images"
   */
  bucket?: string;

  /**
   * Target folder inside storage bucket
   * @default "general"
   */
  folder?: string;

  /**
   * Automatically compress / resize images client-side before upload
   * @default true
   */
  compress?: boolean;

  /**
   * Maximum width or height for compression resizing
   * @default 2048
   */
  maxWidthOrHeight?: number;

  /**
   * Compression quality (0 to 1)
   * @default 0.85
   */
  compressQuality?: number;

  /**
   * Accepted MIME types map for react-dropzone
   * @default { "image/*": [".jpeg", ".jpg", ".png", ".webp", ".avif", ".svg"] }
   */
  accept?: Record<string, string[]>;

  /**
   * Callback invoked when an image is removed by the user
   * Return false to prevent removal from local state
   */
  onRemove?: (item: UploadedImage) => Promise<boolean | void> | boolean | void;

  /**
   * Custom upload function. If provided, overrides default Supabase Storage upload.
   */
  onUpload?: (
    file: File,
    onProgress: (percent: number) => void
  ) => Promise<{ path: string; publicUrl: string; hash?: string }>;

  /**
   * Allow user to open the Gallery modal to pick previously uploaded assets
   * @default true
   */
  allowGallery?: boolean;

  /**
   * Disable interaction
   */
  disabled?: boolean;

  /**
   * Optional custom CSS class name
   */
  className?: string;

  /**
   * Label text
   */
  label?: string;

  /**
   * Description / help text
   */
  description?: string;

  /**
   * Show inline Alt Text (SEO & Accessibility) input for each image in multiple mode
   * @default false
   */
  showAltInput?: boolean;

  /**
   * Aspect ratio hint for single preview: e.g. "video" (16/9), "square" (1/1), "auto"
   * @default "auto"
   */
  aspectRatio?: "square" | "video" | "wide" | "auto";
}

export interface GalleryAsset {
  name: string;
  id?: string;
  path: string;
  publicUrl: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
}

