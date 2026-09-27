import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { isRemoteTrack } from "../lib/audio";
import type { FocusMode, Track } from "../types";

/**
 * How many seconds before a track ends the automatic crossfade into the next
 * queued track begins. Manual skip/next uses a much shorter fade.
 */
export const AUTO_CROSSFADE_SECONDS = 3;
const MANUAL_FADE_MS = 450;
const AUTO_FADE_MS = AUTO_CROSSFADE_SECONDS * 1000;

type SlotKey = "a" | "b";

interface UseAudioPlaybackEngineOptions {
  runningInTauri: boolean;
  startSession: () => void;
  duckingMultiplier: number;
}

export function useAudioPlaybackEngine({
  runningInTauri,
  startSession,
  duckingMultiplier,
}: UseAudioPlaybackEngineOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const volumeRef = useRef(1.0);
  const playbackRateRef = useRef(1.0);
  const loadRequestRef = useRef(0);
  const lastRenderedProgressRef = useRef(0);

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1.0);
  const [playbackRate, setPlaybackRateState] = useState(1.0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [remoteSeekRequest, setRemoteSeekRequest] = useState<{
    value: number;
    token: number;
  } | null>(null);
  const [mode, setMode] = useState<FocusMode>("deep");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- Dual-slot architecture (crossfade) ------------------------------- */
  /* Two long-lived <audio> elements alternate: while slot A plays, the next
     track loads into slot B and both fade via per-element volume ramps.
     Tracks always play with their original dynamics — no loudness processing. */
  const elementsRef = useRef<Partial<Record<SlotKey, HTMLAudioElement>>>({});
  const activeSlotRef = useRef<SlotKey>("a");
  const slotTrackIdRef = useRef<Record<SlotKey, string | null>>({
    a: null,
    b: null,
  });
  const slotLevelRef = useRef<Record<SlotKey, number>>({ a: 1, b: 1 });
  const fadeRef = useRef<{
    raf: number | null;
    startMs: number;
    durationMs: number;
    out: SlotKey;
    inn: SlotKey;
  } | null>(null);
  const duckingRef = useRef(duckingMultiplier);
  /** Assigned by useAudioLibrary each render; resolves the auto-advance pick. */
  const resolveAutoNextRef = useRef<() => Track | null>(() => null);

  const getAudioElement = useCallback(() => audioRef.current, []);
  const getVolume = useCallback(() => volumeRef.current, []);

  const setPlayingState = useCallback((playing: boolean) => {
    playingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const baseVolume = useCallback(
    () => Math.min(1, Math.max(0, volumeRef.current * duckingRef.current)),
    [],
  );

  const applySlotVolume = useCallback(
    (slot: SlotKey, levelOverride?: number) => {
      const el = elementsRef.current[slot];
      if (!el) return;
      const level = levelOverride ?? slotLevelRef.current[slot];
      el.volume = Math.min(1, Math.max(0, baseVolume() * level));
    },
    [baseVolume],
  );

  const stopFade = useCallback(() => {
    const fade = fadeRef.current;
    if (fade?.raf != null) window.cancelAnimationFrame(fade.raf);
    fadeRef.current = null;
  }, []);

  /** Smoothstep volume ramp between the outgoing and incoming slots. */
  const startFade = useCallback(
    (out: SlotKey, inn: SlotKey, durationMs: number) => {
      stopFade();
      const fade = {
        raf: 0,
        startMs: performance.now(),
        durationMs: Math.max(80, durationMs),
        out,
        inn,
      };
      slotLevelRef.current[out] = 1;
      slotLevelRef.current[inn] = 0;
      applySlotVolume(out, 1);
      applySlotVolume(inn, 0);

      const step = () => {
        if (fadeRef.current !== fade) return;
        const t = Math.min(
          1,
          (performance.now() - fade.startMs) / fade.durationMs,
        );
        const eased = t * t * (3 - 2 * t);
        slotLevelRef.current[fade.inn] = eased;
        slotLevelRef.current[fade.out] = 1 - eased;
        applySlotVolume(fade.inn, eased);
        applySlotVolume(fade.out, 1 - eased);
        if (t >= 1) {
          fadeRef.current = null;
          const outEl = elementsRef.current[fade.out];
          outEl?.pause();
          slotLevelRef.current[fade.out] = 1;
          applySlotVolume(fade.out);
          return;
        }
        fade.raf = window.requestAnimationFrame(step);
      };
      fade.raf = window.requestAnimationFrame(step);
      fadeRef.current = fade;
    },
    [applySlotVolume, stopFade],
  );

  /** Instantly stop every slot except `keep` (and any in-flight fade). */
  const hardStopSlotsExcept = useCallback(
    (keep: SlotKey) => {
      stopFade();
      (["a", "b"] as SlotKey[]).forEach((slot) => {
        if (slot === keep) return;
        const el = elementsRef.current[slot];
        if (el) {
          el.pause();
          try {
            el.currentTime = 0;
          } catch {
            // Not seekable yet — fine.
          }
        }
        slotTrackIdRef.current[slot] = null;
        slotLevelRef.current[slot] = 1;
        applySlotVolume(slot);
      });
    },
    [applySlotVolume, stopFade],
  );

  /* ---- Element lifecycle ------------------------------------------------ */

  const prepareSlot = useCallback(
    (slot: SlotKey, track: Track): HTMLAudioElement | null => {
      const el = elementsRef.current[slot];
      if (!el) return null;
      el.crossOrigin = "anonymous";
      el.src =
        runningInTauri && track.source !== "browser"
          ? convertFileSrc(track.path)
          : track.path;
      el.playbackRate = playbackRateRef.current;
      slotTrackIdRef.current[slot] = track.id;
      slotLevelRef.current[slot] = 1;
      applySlotVolume(slot);
      el.load();
      return el;
    },
    [applySlotVolume, runningInTauri],
  );

  const loadTrack = useCallback(
    async (track: Track, autoplay: boolean, fadeMode?: "auto" | "manual") => {
      if (!elementsRef.current.a && !elementsRef.current.b) return;

      if (isRemoteTrack(track)) {
        stopFade();
        (["a", "b"] as SlotKey[]).forEach((slot) => {
          const el = elementsRef.current[slot];
          if (el) {
            el.pause();
            el.removeAttribute("src");
            try {
              el.load();
            } catch {
              // Already reset.
            }
          }
          slotTrackIdRef.current[slot] = null;
        });
        currentIdRef.current = track.id;
        setCurrentTrackId(track.id);
        setProgress(0);
        setDuration(0);
        lastRenderedProgressRef.current = 0;
        playingRef.current = autoplay;
        setPlayingState(false);
        if (autoplay) {
          setPlayingState(true);
          startSession();
        }
        return;
      }

      const requestId = ++loadRequestRef.current;
      const outSlot = activeSlotRef.current;
      // Crossfade only makes sense while something is actually audible.
      const wantFade = Boolean(fadeMode) && playingRef.current;
      const inSlot = wantFade ? (outSlot === "a" ? "b" : "a") : outSlot;

      if (wantFade) {
        stopFade();
      } else {
        hardStopSlotsExcept(outSlot);
      }

      const el = prepareSlot(inSlot, track);
      if (!el) return;

      currentIdRef.current = track.id;
      setCurrentTrackId(track.id);
      setProgress(0);
      setDuration(0);
      lastRenderedProgressRef.current = 0;
      activeSlotRef.current = inSlot;
      audioRef.current = el;

      if (autoplay) {
        setPlayingState(true);
        if (wantFade) {
          startFade(
            outSlot,
            inSlot,
            fadeMode === "auto" ? AUTO_FADE_MS : MANUAL_FADE_MS,
          );
        }
        try {
          if (requestId !== loadRequestRef.current) return;
          await el.play();
          if (requestId !== loadRequestRef.current) return;
          startSession();
        } catch (err) {
          if (requestId !== loadRequestRef.current) return;
          setError(err instanceof Error ? err.message : String(err));
          setPlayingState(false);
        }
      } else {
        setPlayingState(false);
        if (wantFade) {
          const outEl = elementsRef.current[outSlot];
          outEl?.pause();
        }
      }
    },
    [
      hardStopSlotsExcept,
      prepareSlot,
      setPlayingState,
      startFade,
      startSession,
      stopFade,
    ],
  );

  /* Long-lived element wiring: listeners are attached once per slot and
     ignore events from whichever slot is currently fading OUT. */
  useEffect(() => {
    const makeHandler =
      (slot: SlotKey, handler: (el: HTMLAudioElement) => void) =>
      () => {
        const el = elementsRef.current[slot];
        if (el) handler(el);
      };

    const isFadingOut = (slot: SlotKey) => fadeRef.current?.out === slot;

    const handleTime = (slot: SlotKey) =>
      makeHandler(slot, (el) => {
        if (slot !== activeSlotRef.current || isFadingOut(slot)) return;
        const nextProgress = el.currentTime || 0;
        if (
          el.paused ||
          nextProgress === 0 ||
          nextProgress - lastRenderedProgressRef.current >= 0.35
        ) {
          lastRenderedProgressRef.current = nextProgress;
          setProgress(nextProgress);
        }

        // Auto crossfade shortly before the track ends.
        const dur = Number.isFinite(el.duration) ? el.duration : 0;
        if (
          !el.paused &&
          !fadeRef.current &&
          dur > AUTO_CROSSFADE_SECONDS + 1 &&
          el.currentTime >= dur - AUTO_CROSSFADE_SECONDS
        ) {
          const next = resolveAutoNextRef.current();
          if (next && next.id !== currentIdRef.current) {
            void loadTrack(next, true, "auto");
          }
        }
      });

    const handleMeta = (slot: SlotKey) =>
      makeHandler(slot, (el) => {
        if (slot !== activeSlotRef.current) return;
        setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      });

    const handlePlay = (slot: SlotKey) =>
      makeHandler(slot, () => {
        if (isFadingOut(slot)) return;
        if (slot === activeSlotRef.current) setPlayingState(true);
      });

    const handlePause = (slot: SlotKey) =>
      makeHandler(slot, () => {
        if (isFadingOut(slot)) return;
        if (slot === activeSlotRef.current) setPlayingState(false);
      });

    const handleEnded = (slot: SlotKey) =>
      makeHandler(slot, () => {
        if (slot !== activeSlotRef.current || isFadingOut(slot)) return;
        const next = resolveAutoNextRef.current();
        if (next) {
          void loadTrack(next, true, "auto");
        } else {
          setPlayingState(false);
          setProgress(0);
          lastRenderedProgressRef.current = 0;
        }
      });

    const handleError = (slot: SlotKey) =>
      makeHandler(slot, (el) => {
        if (slot !== activeSlotRef.current || !el.currentSrc) return;
        setError("Nie udało się odtworzyć tego pliku audio.");
        setPlayingState(false);
      });

    const createSlot = (slot: SlotKey): HTMLAudioElement => {
      const el = new Audio();
      el.preload = "metadata";
      el.addEventListener("timeupdate", handleTime(slot));
      el.addEventListener("loadedmetadata", handleMeta(slot));
      el.addEventListener("play", handlePlay(slot));
      el.addEventListener("pause", handlePause(slot));
      el.addEventListener("ended", handleEnded(slot));
      el.addEventListener("error", handleError(slot));
      return el;
    };

    elementsRef.current.a = createSlot("a");
    elementsRef.current.b = createSlot("b");
    audioRef.current = elementsRef.current.a;

    return () => {
      (["a", "b"] as SlotKey[]).forEach((slot) => {
        const el = elementsRef.current[slot];
        elementsRef.current[slot] = undefined;
        if (!el) return;
        el.pause();
        el.removeAttribute("src");
      });
      stopFade();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only wiring
  }, []);

  /* ---- Remote player bridge (unchanged surface) ------------------------- */

  const onRemoteTime = useCallback((value: number) => {
    if (
      !Number.isFinite(value) ||
      (value !== 0 &&
        value >= lastRenderedProgressRef.current &&
        value - lastRenderedProgressRef.current < 0.35)
    ) {
      return;
    }
    lastRenderedProgressRef.current = value;
    setProgress(value);
  }, []);

  const onRemoteDuration = useCallback((value: number) => {
    if (Number.isFinite(value) && value > 0) {
      setDuration(value);
    }
  }, []);

  const onRemotePlaying = useCallback(
    (playing: boolean) => {
      setPlayingState(playing);
      if (playing) startSession();
    },
    [setPlayingState, startSession],
  );

  const onRemoteError = useCallback(
    (message: string) => {
      setError(message);
      setPlayingState(false);
    },
    [setPlayingState],
  );

  const seek = useCallback((value: number, tracks: Track[]) => {
    const audio = audioRef.current;
    if (!Number.isFinite(value)) return;

    const activeTrack = tracks.find(
      (track) => track.id === currentIdRef.current,
    );
    if (isRemoteTrack(activeTrack)) {
      setRemoteSeekRequest({
        value,
        token: Date.now() + Math.random(),
      });
      lastRenderedProgressRef.current = value;
      setProgress(value);
      return;
    }

    if (!audio) return;
    audio.currentTime = value;
    lastRenderedProgressRef.current = value;
    setProgress(value);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(Math.min(1, Math.max(0, value)));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const nextRate = Math.min(2.0, Math.max(0.5, rate));
    playbackRateRef.current = nextRate;
    setPlaybackRateState(nextRate);
    (["a", "b"] as SlotKey[]).forEach((slot) => {
      const el = elementsRef.current[slot];
      if (el) el.playbackRate = nextRate;
    });
  }, []);

  useEffect(() => {
    currentIdRef.current = currentTrackId;
  }, [currentTrackId]);

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Volume / ducking / rate apply to BOTH slots so fades stay balanced even
  // when the user changes settings mid-crossfade.
  useEffect(() => {
    duckingRef.current = duckingMultiplier;
    (["a", "b"] as SlotKey[]).forEach((slot) => applySlotVolume(slot));
    (["a", "b"] as SlotKey[]).forEach((slot) => {
      const el = elementsRef.current[slot];
      if (el) el.playbackRate = playbackRate;
    });
  }, [volume, duckingMultiplier, playbackRate, applySlotVolume]);

  return {
    audioRef,
    currentTrackId,
    setCurrentTrackId,
    currentIdRef,
    isPlaying,
    setIsPlaying,
    playingRef,
    volume,
    setVolumeState,
    volumeRef,
    playbackRate,
    setPlaybackRateState,
    playbackRateRef,
    progress,
    setProgress,
    duration,
    setDuration,
    remoteSeekRequest,
    setRemoteSeekRequest,
    mode,
    setMode,
    ready,
    setReady,
    error,
    setError,
    getAudioElement,
    getVolume,
    setPlayingState,
    loadTrack,
    onRemoteTime,
    onRemoteDuration,
    onRemotePlaying,
    onRemoteError,
    seek,
    setVolume,
    setPlaybackRate,
    lastRenderedProgressRef,
    resolveAutoNextRef,
  };
}
