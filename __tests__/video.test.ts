import { describe, it, expect } from "vitest";
import {
  extractYouTubeId,
  extractVimeoId,
  parseVideoUrl,
  buildEmbedUrl,
  isValidVideoUrl,
} from "@/lib/video";

describe("Video URL Parser & Embed Builder", () => {
  it("extracts YouTube video IDs correctly", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("dQw4w9WgXcQ");
  });

  it("extracts Vimeo video IDs correctly", () => {
    expect(extractVimeoId("https://vimeo.com/123456789")).toBe("123456789");
    expect(extractVimeoId("https://player.vimeo.com/video/123456789")).toBe("123456789");
  });

  it("parses video URLs into metadata", () => {
    const yt = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(yt).not.toBeNull();
    expect(yt?.provider).toBe("youtube");
    expect(yt?.id).toBe("dQw4w9WgXcQ");
    expect(yt?.thumbnailUrl).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");

    const vimeo = parseVideoUrl("https://vimeo.com/987654321");
    expect(vimeo).not.toBeNull();
    expect(vimeo?.provider).toBe("vimeo");
    expect(vimeo?.id).toBe("987654321");

    expect(parseVideoUrl("https://example.com/invalid")).toBeNull();
    expect(parseVideoUrl("")).toBeNull();
  });

  it("builds YouTube embed URL with loop and parameters", () => {
    const parsed = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")!;
    const embed = buildEmbedUrl(parsed, { autoplay: true, muted: false, loop: true });
    expect(embed).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embed).toContain("autoplay=1");
    expect(embed).toContain("mute=0");
    expect(embed).toContain("loop=1");
    expect(embed).toContain("playlist=dQw4w9WgXcQ");
  });

  it("validates video URLs correctly", () => {
    expect(isValidVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isValidVideoUrl("https://vimeo.com/123456789")).toBe(true);
    expect(isValidVideoUrl("not a video")).toBe(false);
  });
});
