import { afterEach, describe, expect, it, vi } from "vitest";
import {
  announcePhaseTransition,
  playMiniGoalCompletionChime,
  playSoftPhaseChime,
  playVoicePackCue,
  speakPhaseCue,
} from "./phaseCues";
import { voiceCueFileForPhase, voicePackAssetUrl } from "./voicePacks";

describe("phase cues", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no-ops safely when Web Audio is unavailable", async () => {
    await expect(playSoftPhaseChime("break", 0.5)).resolves.toBeUndefined();
    await expect(playMiniGoalCompletionChime(0.65)).resolves.toBeUndefined();
  });

  it("speaks a Polish break announcement when speech synthesis exists", () => {
    class MockUtterance {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel,
        speak,
        getVoices: () => [],
      },
    });

    speakPhaseCue("break", 5);
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toContain("przerwa");
    expect(utterance.text).toContain("5");
    expect(utterance.lang).toBe("pl-PL");
  });

  it("respects disabled sound and voice flags", async () => {
    const speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak,
        getVoices: () => [],
      },
    });

    await announcePhaseTransition({
      phase: "work",
      soundEnabled: false,
      voiceEnabled: false,
    });
    expect(speak).not.toHaveBeenCalled();
  });

  it("maps voice pack files and falls back when a pack file is missing", async () => {
    expect(voiceCueFileForPhase("work", 0)).toBe("session-start.mp3");
    expect(voiceCueFileForPhase("work", 1)).toBe("work-start.mp3");
    expect(voiceCueFileForPhase("break")).toBe("break-start.mp3");
    expect(voicePackAssetUrl("calm-female", "break-start.mp3")).toBe(
      "/audio/voices/calm-female/break-start.mp3",
    );
    expect(voicePackAssetUrl("system", "break-start.mp3")).toBeNull();

    class MockUtterance {
      text: string;
      lang = "";
      constructor(text: string) {
        this.text = text;
      }
    }
    const speak = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak,
        getVoices: () => [],
      },
    });

    class FailingAudio {
      volume = 1;
      currentTime = 0;
      addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
      ) {
        if (type === "error") {
          queueMicrotask(() => {
            if (typeof listener === "function") listener(new Event("error"));
          });
        }
      }
      pause() {}
      play() {
        return Promise.reject(new Error("missing"));
      }
    }
    vi.stubGlobal("Audio", FailingAudio);

    await announcePhaseTransition({
      phase: "break",
      breakDurationMinutes: 5,
      soundEnabled: false,
      voiceEnabled: true,
      voicePack: "calm-female",
    });

    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("plays a local voice pack file when available", async () => {
    class PackAudio {
      volume = 1;
      currentTime = 0;
      private listeners = new Map<string, Array<() => void>>();

      addEventListener(type: string, listener: () => void) {
        const current = this.listeners.get(type) ?? [];
        current.push(listener);
        this.listeners.set(type, current);
      }

      pause() {}

      play() {
        queueMicrotask(() => {
          for (const listener of this.listeners.get("ended") ?? []) listener();
        });
        return Promise.resolve();
      }
    }

    vi.stubGlobal("Audio", PackAudio);
    await expect(
      playVoicePackCue("calm-female", "work", 0.5, 1),
    ).resolves.toBe(true);
  });

  it("invokes onVoiceStart and onVoiceEnd callbacks during voice announcements", async () => {
    class PackAudio {
      volume = 1;
      currentTime = 0;
      private listeners = new Map<string, Array<() => void>>();

      addEventListener(type: string, listener: () => void) {
        const current = this.listeners.get(type) ?? [];
        current.push(listener);
        this.listeners.set(type, current);
      }

      pause() {}

      play() {
        queueMicrotask(() => {
          for (const listener of this.listeners.get("ended") ?? []) listener();
        });
        return Promise.resolve();
      }
    }

    vi.stubGlobal("Audio", PackAudio);

    const onVoiceStart = vi.fn();
    const onVoiceEnd = vi.fn();

    await announcePhaseTransition({
      phase: "work",
      soundEnabled: false,
      voiceEnabled: true,
      voicePack: "calm-female",
      onVoiceStart,
      onVoiceEnd,
    });

    expect(onVoiceStart).toHaveBeenCalledTimes(1);
    expect(onVoiceEnd).toHaveBeenCalledTimes(1);
  });
});
