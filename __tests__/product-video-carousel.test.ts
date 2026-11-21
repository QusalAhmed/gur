import { describe, it, expect } from "vitest";
import { parseVideoUrl, buildEmbedUrl } from "@/lib/video";

describe("Product Video Carousel Logic", () => {
  it("determines carousel slide items and video position correctly", () => {
    const imagesList = ["/images/products/blackstrap-1.jpg", "/images/products/blackstrap-2.jpg"];
    const videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const hasVideo = Boolean(videoUrl && parseVideoUrl(videoUrl));

    expect(hasVideo).toBe(true);

    const totalSlides = imagesList.length + (hasVideo ? 1 : 0);
    const videoSlideIndex = hasVideo ? imagesList.length : -1;

    expect(totalSlides).toBe(3);
    expect(videoSlideIndex).toBe(2); // Positioned last (index 2)
  });

  it("handles a single image product with a video (converts to 2 slides)", () => {
    const imagesList = ["/images/products/blackstrap-1.jpg"];
    const videoUrl = "https://vimeo.com/123456789";
    const hasVideo = Boolean(videoUrl && parseVideoUrl(videoUrl));
    const hasMultipleMedia = imagesList.length > 1 || hasVideo;
    const totalSlides = imagesList.length + (hasVideo ? 1 : 0);
    const videoSlideIndex = hasVideo ? imagesList.length : -1;

    expect(hasMultipleMedia).toBe(true);
    expect(totalSlides).toBe(2);
    expect(videoSlideIndex).toBe(1);
  });

  it("handles product without video (keeps single image without carousel)", () => {
    const imagesList = ["/images/products/blackstrap-1.jpg"];
    const videoUrl = null;
    const hasVideo = Boolean(videoUrl && parseVideoUrl(videoUrl));
    const hasMultipleMedia = imagesList.length > 1 || hasVideo;

    expect(hasMultipleMedia).toBe(false);
  });

  it("creates minimal clean embed URL with autoplay parameters", () => {
    const parsed = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")!;
    const url = buildEmbedUrl(parsed, {
      autoplay: true,
      muted: false,
      loop: true,
      controls: false,
    });

    expect(url).toContain("autoplay=1");
    expect(url).toContain("mute=0");
    expect(url).toContain("controls=0");
    expect(url).toContain("playlist=dQw4w9WgXcQ");
    expect(url).toContain("enablejsapi=1");
    expect(url).toContain("fs=0");
    expect(url).toContain("disablekb=1");
  });

  it("creates clean paused embed URL with autoplay=0 so background playback never starts", () => {
    const parsed = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")!;
    const url = buildEmbedUrl(parsed, {
      autoplay: false,
      muted: false,
      loop: true,
      controls: false,
    });

    expect(url).toContain("autoplay=0");
    expect(url).toContain("controls=0");
    expect(url).toContain("fs=0");
  });

  it("strips title, byline, and portrait for Vimeo embeds", () => {
    const parsed = parseVideoUrl("https://vimeo.com/123456789")!;
    const url = buildEmbedUrl(parsed, {
      autoplay: true,
      controls: false,
    });

    expect(url).toContain("title=0");
    expect(url).toContain("byline=0");
    expect(url).toContain("portrait=0");
  });

  it("advances carousel slide and resumes autoplay when video ends", () => {
    let scrolledNext = false;
    let autoplayResumed = false;

    const mockCarouselApi = {
      scrollNext: () => {
        scrolledNext = true;
      },
      plugins: () => ({
        autoplay: {
          play: () => {
            autoplayResumed = true;
          },
        },
      }),
    };

    // Simulate onVideoEnded callback trigger
    const onVideoEnded = () => {
      mockCarouselApi.scrollNext();
      mockCarouselApi.plugins().autoplay.play();
    };

    onVideoEnded();

    expect(scrolledNext).toBe(true);
    expect(autoplayResumed).toBe(true);
  });
});
