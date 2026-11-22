"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Volume2, VolumeX, Play, Pause, Film } from "lucide-react";
import { parseVideoUrl, type ParsedVideo } from "@/lib/video";
import { cn } from "@/lib/utils";

// Dynamically import ReactPlayer with SSR disabled to guarantee zero SSR hydration mismatches
const ReactPlayer = dynamic(() => import("react-player"), {
  ssr: false,
});

interface ProductVideoPlayerProps {
  videoUrl: string;
  productName: string;
  isActive: boolean;
  isSectionActive?: boolean;
  onPauseCarousel?: () => void;
  onResumeCarousel?: () => void;
  onVideoEnded?: () => void;
}

export function ProductVideoPlayer({
  videoUrl,
  productName,
  isActive,
  isSectionActive = true,
  onPauseCarousel,
  onResumeCarousel,
  onVideoEnded,
}: ProductVideoPlayerProps) {
  const parsedVideo = useMemo<ParsedVideo | null>(() => parseVideoUrl(videoUrl), [videoUrl]);

  // Use privacy-enhanced YouTube embed to suppress extraneous Google tracking & attestation calls
  const effectiveVideoSrc = useMemo(() => {
    if (parsedVideo?.provider === "youtube") {
      return `https://www.youtube-nocookie.com/embed/${parsedVideo.id}`;
    }
    return videoUrl;
  }, [parsedVideo, videoUrl]);

  const [isDeferredLoaded, setIsDeferredLoaded] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  // IntersectionObserver to verify product card is physically in the browser viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting && entry.intersectionRatio > 0.2);
      },
      { threshold: [0, 0.2, 0.5, 0.8] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Both section state from container and viewport intersection must confirm card visibility
  const isCardVisible = Boolean(isSectionActive && isInViewport);
  const shouldPlay = Boolean(isCardVisible && isActive);

  // 1. Defer loading of video player until after page is fully rendered and browser is idle
  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: ReturnType<typeof setTimeout>;
    if ("requestIdleCallback" in window) {
      const idleHandle = (window as any).requestIdleCallback(
        () => {
          setIsDeferredLoaded(true);
        },
        { timeout: 3500 }
      );
      return () => {
        if ("cancelIdleCallback" in window) {
          (window as any).cancelIdleCallback(idleHandle);
        }
      };
    } else {
      timeoutId = setTimeout(() => {
        setIsDeferredLoaded(true);
      }, 1500);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // 2. Control play/pause and carousel rotation based on slide and card visibility
  useEffect(() => {
    if (!isDeferredLoaded) return;

    if (shouldPlay) {
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.currentTime === "number" && playerRef.current.ended) {
            playerRef.current.currentTime = 0;
          }
        } catch {}
      }
      setIsPlaying(true);
      onPauseCarousel?.();
    } else {
      setIsPlaying(false);
      onResumeCarousel?.();
    }
  }, [shouldPlay, isDeferredLoaded, onPauseCarousel, onResumeCarousel]);

  const handleToggleSound = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHasUserInteracted(true);
    setIsMuted((prev) => !prev);
  };

  const handleTogglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsPlaying((prev) => !prev);
  };

  if (!parsedVideo && !videoUrl) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden bg-black drop-shadow-[0_15px_22px_rgba(120,53,15,0.22)] select-none"
    >
      {/* 3. Placeholder / Thumbnail before deferred player load */}
      {!isDeferredLoaded && (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-stone-900 text-amber-200 overflow-hidden">
          {parsedVideo?.thumbnailUrl ? (
            <Image
              src={parsedVideo.thumbnailUrl}
              alt={`${productName} video preview`}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 512px"
            />
          ) : (
            <Film className="w-12 h-12 text-amber-400/60 animate-pulse" />
          )}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-500/90 text-amber-950 flex items-center justify-center shadow-lg transform transition-transform hover:scale-105">
              <Play className="w-6 h-6 ml-0.5 fill-current" />
            </div>
          </div>
        </div>
      )}

      {/* 4. Deferred ReactPlayer (Fills 100% of container) */}
      {isDeferredLoaded && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden [&>youtube-video]:w-full [&>youtube-video]:h-full [&>youtube-video]:block [&>vimeo-video]:w-full [&>vimeo-video]:h-full [&>vimeo-video]:block [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&_video]:w-full [&_video]:h-full [&_video]:object-cover">
          <ReactPlayer
            ref={playerRef}
            src={effectiveVideoSrc}
            playing={shouldPlay && isPlaying}
            muted={isMuted}
            volume={isMuted ? 0 : 1}
            loop={false}
            controls={false}
            playsInline
            width="100%"
            height="100%"
            className="w-full h-full pointer-events-auto"
            config={
              parsedVideo?.provider === "youtube"
                ? {
                    youtube: {
                      rel: 0,
                      iv_load_policy: 3,
                      enablejsapi: 1,
                    },
                  }
                : parsedVideo?.provider === "vimeo"
                ? {
                    vimeo: {
                      dnt: true,
                      title: false,
                      byline: false,
                      portrait: false,
                    },
                  }
                : undefined
            }
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
            onPlay={() => {
              setIsPlaying(true);
              onPauseCarousel?.();
            }}
            onPause={() => {
              setIsPlaying(false);
            }}
            onEnded={() => {
              setIsPlaying(false);
              if (playerRef.current) {
                try {
                  if (typeof playerRef.current.currentTime === "number") {
                    playerRef.current.currentTime = 0;
                  }
                } catch {}
              }
              onVideoEnded?.();
              onResumeCarousel?.();
            }}
            onVolumeChange={(e: any) => {
              const target = e?.target;
              if (target) {
                setIsMuted(Boolean(target.muted || target.volume === 0));
              }
            }}
          />

          {/* Pause overlay icon when paused */}
          {!isPlaying && (
            <div
              onClick={handleTogglePlay}
              className="absolute inset-0 bg-black/35 backdrop-blur-[1px] flex items-center justify-center cursor-pointer pointer-events-auto transition-opacity"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-500/90 text-amber-950 flex items-center justify-center shadow-lg transform transition-transform hover:scale-105">
                <Play className="w-6 h-6 ml-0.5 fill-current" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Minimal Interactive Controls Overlay (Sound Toggle & Play/Pause) */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleSound}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md shadow-md transition-all touch-manipulation",
            isMuted
              ? "bg-amber-500/95 text-stone-950 hover:bg-amber-400 ring-2 ring-amber-300/80 animate-pulse"
              : "bg-black/60 text-white hover:bg-black/80"
          )}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-4 h-4 text-stone-950" />
              <span className="hidden xs:inline">সাউন্ড শুনুন</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden xs:inline">সাউন্ড চালু</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleTogglePlay}
          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center shadow-md transition-all touch-manipulation"
          aria-label={isPlaying ? "Pause video" : "Play video"}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />}
        </button>
      </div>

      {/* 6. Animated "Tap for Sound" prominent pill ONLY if video is confirmed to be muted */}
      {isMuted && isActive && !hasUserInteracted && (
        <div
          onClick={handleToggleSound}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 cursor-pointer pointer-events-auto bg-amber-500/95 hover:bg-amber-400 text-stone-950 px-3.5 py-1.5 rounded-full shadow-lg border border-amber-300 flex items-center gap-2 text-xs font-bold transition-all transform hover:scale-105"
        >
          <Volume2 className="w-4 h-4 animate-bounce" />
          <span>সাউন্ড অন করতে ট্যাপ করুন</span>
        </div>
      )}
    </div>
  );
}
