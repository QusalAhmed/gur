"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { Volume2, VolumeX, Play, Pause, Film } from "lucide-react";
import { parseVideoUrl, buildEmbedUrl, type ParsedVideo } from "@/lib/video";
import { cn } from "@/lib/utils";

interface ProductVideoPlayerProps {
  videoUrl: string;
  productName: string;
  isActive: boolean;
  isSectionActive?: boolean;
  onPauseCarousel?: () => void;
  onResumeCarousel?: () => void;
}

export function ProductVideoPlayer({
  videoUrl,
  productName,
  isActive,
  isSectionActive = true,
  onPauseCarousel,
  onResumeCarousel,
}: ProductVideoPlayerProps) {
  const parsedVideo = useMemo<ParsedVideo | null>(() => parseVideoUrl(videoUrl), [videoUrl]);
  const [isDeferredLoaded, setIsDeferredLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showSoundPrompt, setShowSoundPrompt] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const userInteractedRef = useRef(false);

  // 1. Defer loading of video iframe until after page is fully rendered and browser is idle
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

  // PostMessage helpers for YouTube and Vimeo iframe APIs
  const postToPlayer = useCallback((command: "play" | "pause" | "mute" | "unmute") => {
    if (!iframeRef.current?.contentWindow || !parsedVideo) return;

    try {
      if (parsedVideo.provider === "youtube") {
        const cmdMap = {
          play: { event: "command", func: "playVideo", args: [] },
          pause: { event: "command", func: "pauseVideo", args: [] },
          mute: { event: "command", func: "mute", args: [] },
          unmute: { event: "command", func: "unMute", args: [] },
        };
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify(cmdMap[command]),
          "*"
        );
      } else if (parsedVideo.provider === "vimeo") {
        const cmdMap = {
          play: { method: "play" },
          pause: { method: "pause" },
          mute: { method: "setVolume", value: 0 },
          unmute: { method: "setVolume", value: 1 },
        };
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify(cmdMap[command]),
          "*"
        );
      }
    } catch {
      // Safe guard against iframe cross-origin postMessage errors
    }
  }, [parsedVideo]);

  // 2. Control play/pause and carousel rotation based on slide and section visibility
  useEffect(() => {
    if (!isDeferredLoaded) return;

    if (isActive && isSectionActive) {
      // Slide is active: pause carousel rotation so user can watch video
      onPauseCarousel?.();
      postToPlayer("play");
      setIsPlaying(true);

      // Attempt unmuted play first if user interacted or initial attempt
      if (!isMuted) {
        postToPlayer("unmute");
      }
    } else {
      // Not on video slide: pause video and resume normal carousel rotation
      postToPlayer("pause");
      setIsPlaying(false);
      onResumeCarousel?.();
    }
  }, [isActive, isSectionActive, isDeferredLoaded, onPauseCarousel, onResumeCarousel, postToPlayer, isMuted]);

  // Listen for YouTube/Vimeo messages to detect state or blocked autoplay
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data);
        // YouTube event info
        if (data.event === "infoDelivery" && data.info) {
          if (typeof data.info.muted === "boolean") {
            setIsMuted(data.info.muted);
            if (!data.info.muted) {
              setShowSoundPrompt(false);
            }
          }
        }
      } catch {
        // Ignore unparseable messages from other windows/extensions
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleToggleSound = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    userInteractedRef.current = true;
    if (isMuted || showSoundPrompt) {
      postToPlayer("unmute");
      setIsMuted(false);
      setShowSoundPrompt(false);
    } else {
      postToPlayer("mute");
      setIsMuted(true);
    }
  };

  const handleTogglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isPlaying) {
      postToPlayer("pause");
      setIsPlaying(false);
    } else {
      postToPlayer("play");
      setIsPlaying(true);
      if (!isMuted) {
        postToPlayer("unmute");
      }
    }
  };

  if (!parsedVideo) return null;

  // Initial embed URL starts with autoplay=1, muted=0 (attempt unmuted autoplay)
  const embedUrl = buildEmbedUrl(parsedVideo, {
    autoplay: true,
    muted: false,
    loop: true,
    controls: false,
  });

  return (
    <div className="relative w-full h-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-black drop-shadow-[0_15px_22px_rgba(120,53,15,0.22)] select-none">
      {/* 3. Placeholder / Thumbnail before deferred iframe load */}
      {!isDeferredLoaded && (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-stone-900 text-amber-200">
          {parsedVideo.thumbnailUrl ? (
            <Image
              src={parsedVideo.thumbnailUrl}
              alt={`${productName} video preview`}
              fill
              unoptimized
              className="object-cover opacity-80"
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

      {/* 4. Deferred Iframe */}
      {isDeferredLoaded && (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={`${productName} Showcase Video`}
          className="absolute inset-0 w-full h-full border-0 pointer-events-auto"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      )}

      {/* 5. Minimal Interactive Controls Overlay (Sound Toggle & Play/Pause) */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleSound}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md shadow-md transition-all touch-manipulation",
            showSoundPrompt || isMuted
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

      {/* 6. Animated "Tap for Sound" prominent pill if browser blocked unmuted autoplay */}
      {showSoundPrompt && isActive && (
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
