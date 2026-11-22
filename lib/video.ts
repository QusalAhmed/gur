export type VideoProvider = "youtube" | "vimeo";

export interface ParsedVideo {
  provider: VideoProvider;
  id: string;
  originalUrl: string;
  thumbnailUrl?: string;
}

/**
 * Extracts YouTube Video ID from various URL patterns:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - https://m.youtube.com/watch?v=dQw4w9WgXcQ
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  // Pattern covering standard watch, embed, shorts, youtu.be, etc.
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
}

/**
 * Extracts Vimeo Video ID from URL patterns:
 * - https://vimeo.com/123456789
 * - https://player.vimeo.com/video/123456789
 */
export function extractVimeoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  const regex = /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|video\/|))(\d+)/i;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
}

/**
 * Parses a given video URL and returns metadata, provider, and video ID.
 */
export function parseVideoUrl(url?: string | null): ParsedVideo | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();

  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    return {
      provider: "youtube",
      id: ytId,
      originalUrl: trimmed,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    };
  }

  const vimeoId = extractVimeoId(trimmed);
  if (vimeoId) {
    return {
      provider: "vimeo",
      id: vimeoId,
      originalUrl: trimmed,
    };
  }

  return null;
}

/**
 * Builds an embed URL for YouTube or Vimeo with autoplay, mute, and loop parameters.
 */
export function buildEmbedUrl(
  parsed: ParsedVideo,
  options: {
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    origin?: string;
  } = {}
): string {
  const { autoplay = true, muted = false, loop = true, controls = false, origin } = options;

  if (parsed.provider === "youtube") {
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      mute: muted ? "1" : "0",
      controls: controls ? "1" : "0",
      loop: loop ? "1" : "0",
      playlist: parsed.id, // YouTube requires playlist parameter for loop to work
      playsinline: "1",
      modestbranding: "1",
      rel: "0",
      enablejsapi: "1",
      iv_load_policy: "3",
      fs: "0",
      disablekb: "1",
    });

    if (origin) {
      params.set("origin", origin);
    }

    return `https://www.youtube-nocookie.com/embed/${parsed.id}?${params.toString()}`;
  }

  if (parsed.provider === "vimeo") {
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      muted: muted ? "1" : "0",
      loop: loop ? "1" : "0",
      controls: controls ? "1" : "0",
      playsinline: "1",
      dnt: "1",
      title: "0",
      byline: "0",
      portrait: "0",
    });

    return `https://player.vimeo.com/video/${parsed.id}?${params.toString()}`;
  }

  return parsed.originalUrl;
}

/**
 * Quick validator for product form inputs.
 */
export function isValidVideoUrl(url?: string | null): boolean {
  return parseVideoUrl(url) !== null;
}
