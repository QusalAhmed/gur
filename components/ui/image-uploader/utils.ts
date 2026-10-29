"use client";

import imageCompression from "browser-image-compression";
import { supabase } from "@/lib/supabase/client";
import { UploadedImage } from "./types";

/**
 * Computes SHA-256 binary hash of a File/Blob using Web Crypto API.
 * Fast, standard, and zero external dependency.
 */
export async function calculateFileHash(file: Blob | File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digestBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Formats byte size into human-readable format (e.g. 1.2 MB).
 */
export function formatBytes(bytes?: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Compresses an image in the browser.
 * Uses 'browser-image-compression' (Web Worker + iterative target size reduction)
 * to guarantee that files exceeding 5MB are compressed under the target threshold.
 * Falls back gracefully to HTML5 Canvas if needed.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxSizeMB = 2,
    maxWidthOrHeight = 2048,
    quality = 0.85,
    onProgress,
  } = options;

  // Don't compress SVGs or non-images
  if (!file.type.startsWith("image/") || file.type.includes("svg")) {
    return file;
  }

  // If already under 400KB and is webp, keep untouched
  if (file.size < 400 * 1024 && file.type === "image/webp") {
    return file;
  }

  try {
    const compressionOptions = {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker: typeof window !== "undefined" && typeof Worker !== "undefined",
      fileType: "image/webp",
      initialQuality: quality,
      onProgress: (percent: number) => {
        onProgress?.(percent);
      },
    };

    const compressedBlob = await imageCompression(file, compressionOptions);

    // If compression produced a blob that is larger, return original
    if (compressedBlob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const ext = compressedBlob.type === "image/webp" ? "webp" : "jpg";
    const newName = `${baseName}.${ext}`;

    return new File([compressedBlob], newName, {
      type: compressedBlob.type || "image/webp",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("browser-image-compression failed, falling back to canvas:", error);
    return compressImageCanvasFallback(file, { maxWidthOrHeight, quality });
  }
}

/**
 * Canvas fallback for client-side image compression.
 */
function compressImageCanvasFallback(
  file: File,
  options: { maxWidthOrHeight?: number; quality?: number }
): Promise<File> {
  const { maxWidthOrHeight = 2048, quality = 0.85 } = options;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Calculate scaled dimensions while preserving aspect ratio
      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = Math.round((height * maxWidthOrHeight) / width);
          width = maxWidthOrHeight;
        } else {
          width = Math.round((width * maxWidthOrHeight) / height);
          height = maxWidthOrHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // Fallback to original
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const targetMime = "image/webp";

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const newName = `${baseName}.webp`;
          const compressedFile = new File([blob], newName, {
            type: targetMime,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Direct upload to Supabase Storage with XMLHttpRequest for accurate 0-100% progress tracking.
 * Falls back to standard Supabase client upload if XHR is blocked by network constraints.
 */
export async function uploadToSupabaseWithProgress(
  file: File,
  options: {
    bucket: string;
    path: string;
    onProgress: (percent: number) => void;
  }
): Promise<{ path: string; publicUrl: string }> {
  const { bucket, path, onProgress } = options;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcfuqyidcxsqyjzmwxiw.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_dUobc3BkcfqlCtWKRWPBEw_hSCeOUF0";

  // Check if we have an active authenticated session
  let authBearer = supabaseAnonKey;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.access_token) {
      authBearer = sessionData.session.access_token;
    }
  } catch {
    // Session retrieval non-critical, use anon key
  }

  // Attempt XHR upload for real progress events
  try {
    const uploadResult = await new Promise<{ path: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      // Supabase Storage REST endpoint for object upload
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(
        bucket
      )}/${path.split("/").map(encodeURIComponent).join("/")}`;

      xhr.open("POST", uploadUrl, true);
      xhr.setRequestHeader("apikey", supabaseAnonKey);
      xhr.setRequestHeader("Authorization", `Bearer ${authBearer}`);
      xhr.setRequestHeader("x-upsert", "true");
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve({ path });
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.message || errData.error || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Storage upload failed with HTTP status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during XHR upload"));
      };

      xhr.send(file);
    });

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadResult.path);

    return {
      path: uploadResult.path,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (xhrError) {
    console.warn("XHR upload failed, falling back to Supabase client:", xhrError);

    // Fallback: Standard Supabase client upload
    onProgress(30);
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

    if (error) {
      throw error;
    }

    onProgress(100);
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return {
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  }
}

/**
 * Normalizes any external value format into standard UploadedImage[] array.
 */
export function normalizeValue(
  val?: UploadedImage[] | UploadedImage | string | string[] | null
): UploadedImage[] {
  if (!val) return [];

  if (Array.isArray(val)) {
    return val
      .map((item, idx) => {
        if (typeof item === "string") {
          return {
            id: `img-${idx}-${Date.now()}`,
            url: item,
            path: item.startsWith("http") ? undefined : item,
            status: "success" as const,
            progress: 100,
            sortOrder: idx,
            isPrimary: idx === 0,
          };
        }
        return {
          ...item,
          sortOrder: item.sortOrder ?? idx,
          isPrimary: item.isPrimary ?? idx === 0,
          status: item.status ?? "success",
          progress: item.progress ?? 100,
        };
      })
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  if (typeof val === "string") {
    return [
      {
        id: `img-single-${Date.now()}`,
        url: val,
        path: val.startsWith("http") ? undefined : val,
        status: "success",
        progress: 100,
        sortOrder: 0,
        isPrimary: true,
      },
    ];
  }

  return [
    {
      ...val,
      sortOrder: val.sortOrder ?? 0,
      isPrimary: val.isPrimary ?? true,
      status: val.status ?? "success",
      progress: val.progress ?? 100,
    },
  ];
}

