"use client";

import type { AdminNotification, NotificationType } from "@/types/notification";

const SOUND_STORAGE_KEY = "gur_admin_sound_muted";
const COIN_DROP_AUDIO_SRC = "/audio/universfield-coin-drop.mp3";

export type NotificationSoundVariant = "order" | "default";

let sharedAudioCtx: AudioContext | null = null;
let sharedAudioElement: HTMLAudioElement | null = null;
let audioUnlocked = false;

/**
 * Determines which sound variant to play for a notification (or batch of newly arrived notifications).
 * - All `order_created` notifications (new placed orders + incomplete order leads) -> "order" (coin drop MP3)
 * - All other notifications (FB messages/comments, status changes, low stock, system) -> "default" (two-tone chime)
 * When multiple notifications arrive in the same sync cycle, any `order_created` takes priority.
 */
export function resolveNotificationSoundVariant(
  input:
    | NotificationType
    | Pick<AdminNotification, "type">
    | Array<Pick<AdminNotification, "type">>
): NotificationSoundVariant {
  if (Array.isArray(input)) {
    return input.some((n) => n.type === "order_created") ? "order" : "default";
  }
  const type = typeof input === "string" ? input : input.type;
  return type === "order_created" ? "order" : "default";
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtxClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtxClass();
    }

    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;

  if (!sharedAudioElement) {
    try {
      sharedAudioElement = new Audio(COIN_DROP_AUDIO_SRC);
      sharedAudioElement.preload = "auto";
      sharedAudioElement.volume = 0.85;
    } catch {
      sharedAudioElement = null;
    }
  }

  return sharedAudioElement;
}

// Global user gesture unlocker for modern browser autoplay policies
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // 1. Initialize & resume AudioContext on first user interaction so synthesized chimes always play
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // 2. Warm up HTML5 Audio element for order coin-drop MP3
    const audio = getAudioElement();
    if (audio) {
      audio.load();
    }

    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };

  window.addEventListener("click", unlockAudio, { once: true, passive: true });
  window.addEventListener("keydown", unlockAudio, { once: true, passive: true });
  window.addEventListener("touchstart", unlockAudio, { once: true, passive: true });
}

/**
 * Check if notification sound is muted
 */
export function isNotificationSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Toggle or set notification sound mute state
 */
export function setNotificationSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, muted ? "true" : "false");
  } catch {}
}

function scheduleTwoToneChime(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.2);

    // Tone 2: G#5 (830.61 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(830.61, now + 0.09);

    gain2.gain.setValueAtTime(0.001, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.09);
    osc2.stop(now + 0.5);
  } catch {
    // Audio context play error handled silently
  }
}

/**
 * Synthesizes a clean two-tone chime (E5 -> G#5) via Web Audio API
 */
function playSynthesizedChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => scheduleTwoToneChime(ctx))
      .catch(() => {});
    return;
  }

  scheduleTwoToneChime(ctx);
}

/**
 * Plays the appropriate notification sound:
 * - `"order"`: plays `/audio/universfield-coin-drop.mp3` (falls back to synthesized chime if blocked)
 * - `"default"`: plays the built-in two-tone synthesized chime (E5 -> G#5)
 */
export function playNotificationChime(variant: NotificationSoundVariant = "default"): void {
  if (typeof window === "undefined") return;
  if (isNotificationSoundMuted()) return;

  if (variant === "order") {
    const audio = getAudioElement();
    if (audio) {
      try {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            // If HTML5 audio is blocked by browser autoplay policy, fall back to synthesized chime
            console.debug(
              "[Notification Chime] MP3 play blocked or failed, falling back to synthesized chime:",
              err
            );
            playSynthesizedChime();
          });
          return;
        }
        return;
      } catch {
        // Fall through to synthesized chime fallback
      }
    }
  }

  playSynthesizedChime();
}
