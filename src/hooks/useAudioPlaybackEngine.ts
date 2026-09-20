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

/* Loudness normalization constants (Web Audio offline analysis). */
const TARGET_RMS = 0.16;
const GAIN_FLOOR = 0.75;
const GAIN_CEIL = 1.6;
const PEAK_CEIL = 0.98;
const ANALYSIS_MAX_BYTES = 12 * 1024 * 1024;
const ANALYSIS_MAX_SECONDS = 90;
const GAIN_CACHE_KEY = "focusflow.track-gains";
const GAIN_CACHE_LIMIT = 300;

type SlotKey = "a" | "b";

interface UseAudioPlaybackEngineOptions {
  runningInTauri: boolean;
  startSession: () => void;
  duckingMultiplier: number;
  /** Master switch for loudness normalization (persisted by the caller). */
  normalizationEnabled: boolean;
}

function loadGainCache(): Map<string, number> {
  try {
    const raw = localStorage.getItem(GAIN_CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, { g?: number }>;
    const map = new Map<string, number>();
    for (const [id, entry] of Object.entries(parsed ?? {})) {
      if (entry && typeof entry.g === "number" && Number.isFinite(entry.g)) {
        map.set(id, entry.g);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function persistGainCache(cache: Map<string, number>): void {
  try {
    // Map preserves insertion order — drop the oldest entries over the cap.
    if (cache.size > GAIN_CACHE_LIMIT) {
      for (const id of [...cache.keys()].slice(0, cache.size - GAIN_CACHE_LIMIT)) {
        cache.delete(id);
      }
    }
    const payload: Record<string, { g: number }> = {};
    cache.forEach((gain, id) => {
      payload[id] = { g: gain };
    });
    localStorage.setItem(GAIN_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Storage restricted — normalization still works for this session.
  }
}

/**
 * Computes a ReplayGain-style multiplier for an audio file using the Web
 * Audio API: decodeAudioData → RMS + peak analysis → gain toward TARGET_RMS,
 * peak-limited to avoid clipping. Returns NaN when the source can't be
 * analyzed (unsupported container, truncated slice, no Web Audio).
 */
async function computeNormalizationGain(
  buffer: ArrayBuffer,
): Promise<number> {
  const Ctx =
    window.OfflineAudioContext ??
    (window as unknown as {
      webkitOfflineAudioContext?: typeof OfflineAudioContext;
    }).webkitOfflineAudioContext;
  if (!Ctx) return Number.NaN;

  const context = new Ctx(1, 44100, 44100);
  const audio = await context.decodeAudioData(buffer);

  const maxSamples = Math.min(audio.length, ANALYSIS_MAX_SECONDS * audio.sampleRate);
  // Stride keeps large files fast; loudness estimates don't need every sample.
  const stride = maxSamples > 60 * audio.sampleRate ? 2 : 1;
  let sumSquares = 0;
  let counted = 0;
  let peak = 0;

  for (
    let channel = 0;
    channel < Math.min(2, audio.numberOfChannels);
    channel += 1
  ) {
    const data = audio.getChannelData(channel);
    for (let index = 0; index < maxSamples; index += stride) {
      const value = data[index];
      sumSquares += value * value;
      const abs = value < 0 ? -value : value;
      if (abs > peak) peak = abs;
      counted += 1;
    }
  }

  if (!counted || counted === 0) return Number.NaN;
  const rms = Math.sqrt(sumSquares / counted);
  if (rms < 0.0005 || peak < 0.0005) return Number.NaN;

  let gain = TARGET_RMS / rms;
  gain = Math.min(gain, PEAK_CEIL / peak);
  gain = Math.min(GAIN_CEIL, Math.max(GAIN_FLOOR, gain));
  return Math.round(gain * 1000) / 1000;
}

export function useAudioPlaybackEngine({
  runningInTauri,
  startSession,
  duckingMultiplier,
  normalizationEnabled,
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
     No MediaElementSource graph is used on purpose — routing Tauri asset
     protocol media through Web Audio risks CORS-tainted silence. Loudness
     normalization measures files OFFLINE via decodeAudioData instead. */
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
  const normalizationRef = useRef(normalizationEnabled);
  const normGainsRef = useRef<Map<string, number>>(loadGainCache());
  const analyzingRef = useRef<Set<string>>(new Set());
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
      let gain = 1;
      if (normalizationRef.current) {
        const id = slotTrackIdRef.current[slot];
        const cached = id ? normGainsRef.current.get(id) : undefined;
        if (typeof cached === "number") gain = cached;
      }
      el.volume = Math.min(1, Math.max(0, baseVolume() * level * gain));
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

  /* ---- Loudness normalization (offline Web Audio analysis) -------------- */

  const requestNormalization = useCallback(
    (track: Track) => {
      if (!normalizationRef.current) return;
      if (isRemoteTrack(track)) return; // remote streams aren't measurable
      const id = track.id;
      if (normGainsRef.current.has(id) || analyzingRef.current.has(id)) return;
      analyzingRef.current.add(id);

      void (async () => {
        try {
          const url =
            runningInTauri && track.source !== "browser"
              ? convertFileSrc(track.path)
              : track.path;
          let response: Response | null = null;
          try {
            response = await fetch(url);
          } catch {
            response = null;
          }
          if (!response || !response.ok) return;
          let buffer = await response.arrayBuffer();
          if (buffer.byteLength > ANALYSIS_MAX_BYTES) {
            buffer = buffer.slice(0, ANALYSIS_MAX_BYTES);
          }
          const gain = await computeNormalizationGain(buffer);
          if (Number.isFinite(gain)) {
            normGainsRef.current.set(id, gain);
            persistGainCache(normGainsRef.current);
            (["a", "b"] as SlotKey[]).forEach((slot) => {
              if (slotTrackIdRef.current[slot] === id) applySlotVolume(slot);
            });
          }
        } catch {
          // Offline / corrupt / unsupported — leave gain neutral for this id.
        } finally {
          analyzingRef.current.delete(id);
        }
      })();
    },
    [applySlotVolume, runningInTauri],
  );

  useEffect(() => {
    normalizationRef.current = normalizationEnabled;
    (["a", "b"] as SlotKey[]).forEach((slot) => applySlotVolume(slot));
  }, [applySlotVolume, normalizationEnabled]);

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

      requestNormalization(track);

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
      requestNormalization,
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
