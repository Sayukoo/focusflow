import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { isRemoteTrack } from "../lib/audio";
import type { FocusMode, Track } from "../types";

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
  const volumeRef = useRef(0.72);
  const playbackRateRef = useRef(1.0);
  const loadRequestRef = useRef(0);
  const lastRenderedProgressRef = useRef(0);

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.72);
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

  const getAudioElement = useCallback(() => audioRef.current, []);
  const getVolume = useCallback(() => volumeRef.current, []);

  const setPlayingState = useCallback((playing: boolean) => {
    playingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const loadTrack = useCallback(
    async (track: Track, autoplay: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;

      const requestId = loadRequestRef.current + 1;
      loadRequestRef.current = requestId;
      audio.pause();
      currentIdRef.current = track.id;
      setCurrentTrackId(track.id);
      setProgress(0);
      setDuration(0);
      lastRenderedProgressRef.current = 0;

      if (isRemoteTrack(track)) {
        audio.removeAttribute("src");
        audio.load();
        playingRef.current = autoplay;
        setPlayingState(false);
        if (autoplay) {
          setPlayingState(true);
          startSession();
        }
        return;
      }

      setPlayingState(false);
      audio.src =
        runningInTauri && track.source !== "browser"
          ? convertFileSrc(track.path)
          : track.path;
      audio.playbackRate = playbackRateRef.current;
      audio.load();

      if (autoplay) {
        try {
          if (requestId !== loadRequestRef.current) return;
          await audio.play();
          startSession();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [runningInTauri, setPlayingState, startSession],
  );

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
    setProgress(value);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(Math.min(1, Math.max(0, value)));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const nextRate = Math.min(2.0, Math.max(0.5, rate));
    playbackRateRef.current = nextRate;
    setPlaybackRateState(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
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

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.min(1, Math.max(0, volume * duckingMultiplier));
      audio.playbackRate = playbackRate;
    }
  }, [volume, duckingMultiplier, playbackRate]);

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
  };
}
