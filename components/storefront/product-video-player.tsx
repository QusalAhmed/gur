"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  const [hasRequestedLoad, setHasRequestedLoad] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [hasPlaybackFailed, setHasPlaybackFailed] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAttemptingPlayRef = useRef(false);
  const isRetryingMutedRef = useRef(false);
  const hasPlaybackSucceededRef = useRef(false);
  const hasTriedMutedFallbackRef = useRef(false);
  const wasCarouselPausedRef = useRef(false);
  const shouldPlayRef = useRef(false);
  const isPausedByUserRef = useRef(false);
  const isMutedRef = useRef(false);

  // IntersectionObserver to verify product slide is physically in the browser viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const frameId = requestAnimationFrame(() => setIsInViewport(true));
      return () => cancelAnimationFrame(frameId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Both section state from container and viewport intersection must confirm card visibility
  const isCardVisible = Boolean(isSectionActive && isInViewport);
  const shouldPlay = Boolean(isCardVisible && isActive);
  const shouldMountPlayer = Boolean(
    hasRequestedLoad || (isInViewport && isSectionActive && isActive)
  );
  const isPlayerMounted = isDeferredLoaded || shouldMountPlayer;

  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
    isPausedByUserRef.current = isPausedByUser;
    isMutedRef.current = isMuted;
  }, [shouldPlay, isPausedByUser, isMuted]);

  const clearReadyTimer = useCallback(() => {
    if (readyTimerRef.current !== null) {
      clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearReadyTimer();
  }, [clearReadyTimer]);

  const attemptPlay = useCallback(async () => {
    const player = playerRef.current;
    if (
      !player ||
      !shouldPlayRef.current ||
      isPausedByUserRef.current ||
      isAttemptingPlayRef.current
    ) {
      return;
    }

    isAttemptingPlayRef.current = true;
    try {
      try {
        if (typeof player.currentTime === "number" && player.ended) {
          player.currentTime = 0;
        }
      } catch {}

      const playPromise = player.play?.();
      if (playPromise && typeof playPromise.then === "function") {
        await playPromise;
      }

      if (!shouldPlayRef.current || isPausedByUserRef.current) {
        player.pause?.();
        return;
      }

      hasPlaybackSucceededRef.current = true;
      setHasPlaybackFailed(false);
      setIsPlaying(true);
    } catch {
      if (!shouldPlayRef.current || isPausedByUserRef.current) return;

      // Fall back to muted autoplay when browsers block unmuted playback prior to user gesture
      if (!isMutedRef.current && !hasTriedMutedFallbackRef.current) {
        hasTriedMutedFallbackRef.current = true;
        isRetryingMutedRef.current = true;
        isMutedRef.current = true;
        setIsMuted(true);
        try {
          if ("muted" in player) {
            player.muted = true;
          }
          const retryPromise = player.play?.();
          if (retryPromise && typeof retryPromise.then === "function") {
            await retryPromise;
          }
          if (!shouldPlayRef.current || isPausedByUserRef.current) {
            player.pause?.();
            return;
          }
          hasPlaybackSucceededRef.current = true;
          setHasPlaybackFailed(false);
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
          setHasPlaybackFailed(true);
        } finally {
          isRetryingMutedRef.current = false;
        }
      } else {
        setIsPlaying(false);
        setHasPlaybackFailed(true);
      }
    } finally {
      isAttemptingPlayRef.current = false;
    }
  }, []);

  const handlePlayerReady = useCallback(() => {
    clearReadyTimer();
    // Yield slightly past custom-element load() microtask setup before invoking play()
    readyTimerRef.current = setTimeout(() => {
      readyTimerRef.current = null;
      void attemptPlay();
    }, 60);
  }, [attemptPlay, clearReadyTimer]);

  // 1. Persist player mount once activated by viewport/slide visibility or user interaction
  useEffect(() => {
    if (isDeferredLoaded || !shouldMountPlayer) return;
    const frameId = requestAnimationFrame(() => {
      setIsDeferredLoaded(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, [isDeferredLoaded, shouldMountPlayer]);

  // 2. Control play/pause and carousel rotation based on slide and card visibility
  useEffect(() => {
    if (!isPlayerMounted) return;

    if (shouldPlay) {
      wasCarouselPausedRef.current = true;
      onPauseCarousel?.();
      if (!isPausedByUserRef.current) {
        void attemptPlay();
      }
    } else {
      clearReadyTimer();
      hasPlaybackSucceededRef.current = false;
      hasTriedMutedFallbackRef.current = false;
      try {
        playerRef.current?.pause?.();
      } catch {}
      const frameId = requestAnimationFrame(() => {
        setIsPlaying(false);
        setHasPlaybackFailed(false);
        if (!isActive) {
          isPausedByUserRef.current = false;
          setIsPausedByUser(false);
        }
      });
      if (wasCarouselPausedRef.current && !isActive) {
        wasCarouselPausedRef.current = false;
        onResumeCarousel?.();
      }
      return () => cancelAnimationFrame(frameId);
    }
  }, [
    shouldPlay,
    isActive,
    isPlayerMounted,
    onPauseCarousel,
    onResumeCarousel,
    attemptPlay,
    clearReadyTimer,
  ]);

  const handleActivatePlayer = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHasUserInteracted(true);
    setHasRequestedLoad(true);
    setIsDeferredLoaded(true);
    hasTriedMutedFallbackRef.current = false;
    isPausedByUserRef.current = false;
    setIsPausedByUser(false);
    setHasPlaybackFailed(false);
    setIsPlaying(true);
    shouldPlayRef.current = true;
    wasCarouselPausedRef.current = true;
    onPauseCarousel?.();
    void attemptPlay();
  };

  const handleToggleSound = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHasUserInteracted(true);
    const nextMuted = !isMuted;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (!isPlayerMounted && isActive) {
      setHasRequestedLoad(true);
    }
    const player = playerRef.current;
    if (player) {
      try {
        if ("muted" in player) {
          player.muted = nextMuted;
        }
        if ("volume" in player) {
          player.volume = nextMuted ? 0 : 1;
        }
      } catch {}
    }
  };

  const handleTogglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHasUserInteracted(true);
    if (!isPlayerMounted) {
      handleActivatePlayer(e);
      return;
    }
    if (isPlaying) {
      isPausedByUserRef.current = true;
      setIsPausedByUser(true);
      setIsPlaying(false);
      try {
        playerRef.current?.pause?.();
      } catch {}
    } else {
      hasTriedMutedFallbackRef.current = false;
      isPausedByUserRef.current = false;
      setIsPausedByUser(false);
      setHasPlaybackFailed(false);
      setIsPlaying(true);
      shouldPlayRef.current = true;
      wasCarouselPausedRef.current = true;
      onPauseCarousel?.();
      void attemptPlay();
    }
  };

  if (!parsedVideo && !videoUrl) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-2xl overflow-hidden bg-black shadow-md border border-stone-200/40 dark:border-stone-800 select-none"
    >
      {/* 3. Placeholder / Thumbnail before deferred player load */}
      {!isPlayerMounted && (
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
          <button
            type="button"
            onClick={handleActivatePlayer}
            aria-label={`Play ${productName} video`}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/90 text-stone-900 flex items-center justify-center shadow-md backdrop-blur-xs hover:bg-white transition-colors">
              <Play className="w-6 h-6 ml-0.5 fill-current" />
            </div>
          </button>
        </div>
      )}

      {/* 4. Deferred ReactPlayer (Fills 100% of container) */}
      {isPlayerMounted && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden [&>youtube-video]:w-full [&>youtube-video]:h-full [&>youtube-video]:block [&>vimeo-video]:w-full [&>vimeo-video]:h-full [&>vimeo-video]:block [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&_video]:w-full [&_video]:h-full [&_video]:object-cover">
          <ReactPlayer
            ref={playerRef}
            src={effectiveVideoSrc}
            autoPlay
            playing={shouldPlay && !isPausedByUser}
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
            onReady={handlePlayerReady}
            onPlay={() => {
              if (!shouldPlayRef.current || isPausedByUserRef.current) {
                try {
                  playerRef.current?.pause?.();
                } catch {}
                return;
              }
              setHasPlaybackFailed(false);
              setIsPlaying(true);
              wasCarouselPausedRef.current = true;
              onPauseCarousel?.();
            }}
            onPause={() => {
              if (isRetryingMutedRef.current) return;
              if (!shouldPlayRef.current || isPausedByUserRef.current) {
                setIsPlaying(false);
                return;
              }
              if (!hasPlaybackSucceededRef.current && !hasTriedMutedFallbackRef.current) {
                if (isAttemptingPlayRef.current) {
                  return;
                }
                hasTriedMutedFallbackRef.current = true;
                isRetryingMutedRef.current = true;
                isMutedRef.current = true;
                setIsMuted(true);
                const player = playerRef.current;
                if (player) {
                  try {
                    if ("muted" in player) {
                      player.muted = true;
                    }
                  } catch {}
                }
                isRetryingMutedRef.current = false;
                void attemptPlay();
                return;
              }
              if (hasPlaybackSucceededRef.current) {
                isPausedByUserRef.current = true;
                setIsPausedByUser(true);
              }
              setIsPlaying(false);
            }}
            onEnded={() => {
              hasPlaybackSucceededRef.current = false;
              hasTriedMutedFallbackRef.current = false;
              wasCarouselPausedRef.current = false;
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
              if (isRetryingMutedRef.current) return;
              const target = e?.target;
              if (target) {
                const mutedNow = Boolean(target.muted || target.volume === 0);
                isMutedRef.current = mutedNow;
                setIsMuted(mutedNow);
              }
            }}
          />

          {/* Pause overlay icon when paused or autoplay needs manual tap */}
          {!isPlaying && (!shouldPlay || isPausedByUser || hasPlaybackFailed) && (
            <div
              onClick={handleTogglePlay}
              className="absolute inset-0 bg-black/35 backdrop-blur-[1px] flex items-center justify-center cursor-pointer pointer-events-auto transition-opacity"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/90 text-stone-900 flex items-center justify-center shadow-md backdrop-blur-xs hover:bg-white transition-colors">
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
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-md transition-colors touch-manipulation",
            isMuted
              ? "bg-stone-900/80 text-stone-200 hover:bg-stone-900 border border-white/20"
              : "bg-black/60 text-white hover:bg-black/80 border border-white/10"
          )}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-stone-300" />
              <span className="hidden xs:inline">সাউন্ড শুনুন</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
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

      {/* 6. Tap for Sound pill if video is muted */}
      {isMuted && isActive && !hasUserInteracted && (
        <div
          onClick={handleToggleSound}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 cursor-pointer pointer-events-auto bg-stone-900/90 hover:bg-stone-900 text-white px-3 py-1.5 rounded-full shadow-md border border-white/20 flex items-center gap-1.5 text-xs font-medium transition-colors backdrop-blur-xs"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>সাউন্ড অন করতে ট্যাপ করুন</span>
        </div>
      )}
    </div>
  );
}
