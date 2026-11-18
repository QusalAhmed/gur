import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveNotificationSoundVariant,
  playNotificationChime,
  setNotificationSoundMuted,
} from "@/lib/audio/notification-chime";

describe("Notification Sound Routing", () => {
  describe("resolveNotificationSoundVariant", () => {
    it("maps order_created (placed orders and incomplete leads) to 'order' coin-drop", () => {
      expect(resolveNotificationSoundVariant("order_created")).toBe("order");
      expect(resolveNotificationSoundVariant({ type: "order_created" })).toBe("order");
    });

    it("maps all non-order_created notifications to 'default' synthesized chime", () => {
      expect(resolveNotificationSoundVariant("order_status_changed")).toBe("default");
      expect(resolveNotificationSoundVariant("customer_inquiry")).toBe("default");
      expect(resolveNotificationSoundVariant("low_stock")).toBe("default");
      expect(resolveNotificationSoundVariant("system_alert")).toBe("default");
    });

    it("prioritizes 'order' when a batch contains both order_created and other notifications", () => {
      expect(
        resolveNotificationSoundVariant([
          { type: "customer_inquiry" },
          { type: "order_created" },
          { type: "order_status_changed" },
        ])
      ).toBe("order");

      expect(
        resolveNotificationSoundVariant([
          { type: "customer_inquiry" },
          { type: "order_status_changed" },
          { type: "low_stock" },
        ])
      ).toBe("default");
    });
  });

  describe("playNotificationChime", () => {
    const originalWindow = globalThis.window;
    const originalAudio = globalThis.Audio;
    const originalLocalStorage = globalThis.localStorage;

    let audioPlayMock: ReturnType<typeof vi.fn>;
    let audioInstances: Array<{ src: string; currentTime: number }>;
    let oscStartMock: ReturnType<typeof vi.fn>;
    let storageMap: Map<string, string>;

    beforeEach(() => {
      storageMap = new Map<string, string>();
      audioInstances = [];
      audioPlayMock = vi.fn().mockResolvedValue(undefined);
      oscStartMock = vi.fn();

      const mockLocalStorage = {
        getItem: (key: string) => storageMap.get(key) ?? null,
        setItem: (key: string, val: string) => {
          storageMap.set(key, val);
        },
        removeItem: (key: string) => {
          storageMap.delete(key);
        },
      };

      const makeOsc = () => ({
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: oscStartMock,
        stop: vi.fn(),
      });

      const makeGain = () => ({
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      });

      class MockAudioContext {
        state = "running";
        currentTime = 0;
        destination = {};
        resume = vi.fn().mockResolvedValue(undefined);
        createOscillator = vi.fn(makeOsc);
        createGain = vi.fn(makeGain);
      }

      class MockAudio {
        src: string;
        preload = "";
        volume = 1;
        currentTime = 0;
        load = vi.fn();
        play = audioPlayMock;
        constructor(src: string) {
          this.src = src;
          audioInstances.push(this);
        }
      }

      vi.stubGlobal("localStorage", mockLocalStorage);
      vi.stubGlobal("Audio", MockAudio);
      vi.stubGlobal("window", {
        AudioContext: MockAudioContext,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      if (originalWindow !== undefined) globalThis.window = originalWindow;
      if (originalAudio !== undefined) globalThis.Audio = originalAudio;
      if (originalLocalStorage !== undefined) globalThis.localStorage = originalLocalStorage;
    });

    it("plays universfield-coin-drop.mp3 for 'order' notifications", () => {
      playNotificationChime("order");

      expect(audioPlayMock).toHaveBeenCalledTimes(1);
      expect(audioInstances[0]?.src).toBe("/audio/universfield-coin-drop.mp3");
      expect(oscStartMock).not.toHaveBeenCalled();
    });

    it("plays the two-tone synthesized chime (and NOT the coin-drop MP3) for 'default' notifications", () => {
      playNotificationChime("default");

      expect(audioPlayMock).not.toHaveBeenCalled();
      expect(oscStartMock).toHaveBeenCalledTimes(2);
    });

    it("plays nothing for either variant when muted", () => {
      setNotificationSoundMuted(true);

      playNotificationChime("order");
      playNotificationChime("default");

      expect(audioPlayMock).not.toHaveBeenCalled();
      expect(oscStartMock).not.toHaveBeenCalled();
    });
  });
});
