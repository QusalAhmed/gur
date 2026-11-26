"use client";

import type { ImageLoaderProps } from "next/image";
import { buildImageKitUrl } from "@/lib/imagekit/url";

/**
 * Returns true if the URL points to an ImageKit CDN origin that supports URL transforms.
 */
export function isImageKitUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    (url.startsWith("http://") || url.startsWith("https://")) &&
    url.includes("imagekit.io")
  );
}

/**
 * Custom Next.js Image loader that delegates resizing, quality, and format negotiation
 * directly to ImageKit CDN instead of double-optimizing through `/_next/image`.
 */
export function imageKitLoader({ src, width, quality }: ImageLoaderProps): string {
  return buildImageKitUrl(src, {
    width,
    quality: quality ?? 80,
    format: "auto",
  });
}
