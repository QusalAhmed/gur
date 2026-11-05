/**
 * Utility functions for ImageKit URL generation and dynamic image transformations.
 */

export interface ImageKitTransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  blur?: number; // 1-100
  cropMode?: "maintain_ratio" | "force" | "at_least" | "at_max";
}

/**
 * Builds an optimized ImageKit URL with transformation query parameters.
 * If the provided URL is not hosted on ImageKit, returns the original URL unaltered.
 *
 * @example
 * buildImageKitUrl(url, { width: 400, height: 400, quality: 80, format: "auto" })
 */
export function buildImageKitUrl(
  url: string | null | undefined,
  options: ImageKitTransformOptions = {}
): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;

  // Only apply ImageKit transformations if the URL is on ImageKit
  if (!url.includes("imagekit.io")) {
    return url;
  }

  const transforms: string[] = [];
  if (options.width) transforms.push(`w-${options.width}`);
  if (options.height) transforms.push(`h-${options.height}`);
  if (options.quality) transforms.push(`q-${options.quality}`);
  if (options.format) transforms.push(`f-${options.format}`);
  if (options.blur) transforms.push(`bl-${options.blur}`);
  if (options.cropMode) transforms.push(`cm-${options.cropMode}`);

  if (transforms.length === 0) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("tr", transforms.join(","));
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Resolves any image path or URL to a clean public URL.
 * Full URLs (ImageKit or external) are returned as-is.
 * Relative storage paths are prefixed with the ImageKit endpoint.
 */
export function resolveCdnImageUrl(
  path?: string | null,
  fallback: string = ""
): string {
  if (!path || !path.trim()) {
    return fallback;
  }

  const trimmed = path.trim();

  // Already a full URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Local static asset (e.g. /images/...)
  if (trimmed.startsWith("/images/") || trimmed.startsWith("/icons/")) {
    return trimmed;
  }

  // Relative storage path -> resolve to ImageKit CDN
  const endpoint = (
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/qusal"
  ).replace(/\/$/, "");

  const cleanPath = trimmed.replace(/^\//, "");
  return `${endpoint}/${cleanPath}`;
}


