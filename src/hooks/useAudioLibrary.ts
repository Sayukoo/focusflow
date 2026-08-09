import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  findTrackIndex,
  isRemoteTrack,
  isTauriRuntime,
  loadPlayerSnapshot,
  nextTrackIndex,
  previousTrackIndex,
  savePlayerSnapshot,
} from "../lib/audio";
import {
  elapsedSecondsFromMs,
  getIntervalPhase,
  normalizeTimerSettings,
  pauseTimerClock,
  readTimerElapsedMs,
  resetMiniGoalProgress,
  resetTimerClock,
  startTimerClock,
  timerLimitMs,
} from "../lib/timer";
import {
  calculateStreak,
  formatDailyFocusSummary,
  getTodayStats,
} from "../lib/analytics";
import { getTrackCategory } from "../lib/gemini";
import {
  DEFAULT_TIMER_SETTINGS,
  type PlaybackQueue,
  type TimerSettings,
} from "../types";
import { useAnalyticsTracker } from "./useAnalyticsTracker";
import { useAudioPlaybackEngine } from "./useAudioPlaybackEngine";
import { useProfileManager } from "./useProfileManager";
import { useTimerEngine } from "./useTimerEngine";
import { useTrackLibrary } from "./useTrackLibrary";

export function useAudioLibrary() {
  const {
    profileStore,
    profileStoreRef,
    activeProfileIdRef,
    favoriteTrackIds,
    favoriteTrackIdsRef,
    commitProfileStore,
    selectProfile,
    createProfile,
    deleteProfile,
    toggleFavorite,
  } = useProfileManager();

  const {
    analyticsStore,
    trackFocusTick,
    resetAnalyticsTick,
    recordSessionCompletion,
  } = useAnalyticsTracker();

  const {
    timerSettings,
    setTimerSettings,
    timerSettingsRef,
    timerClockRef,
    sessionStarted,
    sessionStartedRef,
    setSessionActive,
    elapsed,
    setElapsed,
    lastAnnouncedPhaseRef,
    duckingMultiplier,
    announceTimerCue,
    startSession,
  } = useTimerEngine({
    getAudioElement: () => engine.audioRef.current,
    getVolume: () => engine.volumeRef.current,
  });

  const runningInTauri = useMemo(() => isTauriRuntime(), []);

  const engine = useAudioPlaybackEngine({
    runningInTauri,
    startSession,
    duckingMultiplier,
  });

  const library = useTrackLibrary({
    profileStoreRef,
    activeProfileIdRef,
    commitProfileStore,
    loadTrack: engine.loadTrack,
    currentIdRef: engine.currentIdRef,
  });

  const playbackQueueRef = useRef<PlaybackQueue>({ kind: "all" });
  const [playbackQueue, setPlaybackQueueState] = useState<PlaybackQueue>({
    kind: "all",
  });

  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);

  const favoritesOnly = playbackQueue.kind === "favorites";

  const currentIndex = useMemo(
    () => findTrackIndex(library.tracks, engine.currentTrackId),
    [library.tracks, engine.currentTrackId],
  );
  const currentTrack = currentIndex >= 0 ? library.tracks[currentIndex] : null;

  const todayStats = getTodayStats(analyticsStore);
  const streakDays = calculateStreak(analyticsStore);
  const analyticsSummary = useMemo(
    () => ({
      todaySummary: formatDailyFocusSummary(
        todayStats.focusTimeSeconds,
        todayStats.sessionsCount,
      ),
      streakDays,
      todaySeconds: todayStats.focusTimeSeconds,
      todaySessions: todayStats.sessionsCount,
    }),
    [analyticsStore, streakDays, todayStats.focusTimeSeconds, todayStats.sessionsCount],
  );

  const filterTracksForQueue = useCallback(
    (queue: PlaybackQueue) => {
      if (queue.kind === "favorites") {
        return library.tracksRef.current.filter((track) =>
          favoriteTrackIdsRef.current.includes(track.id),
        );
      }
      if (queue.kind === "recent") {
        return [...library.tracksRef.current].reverse();
      }
      if (queue.kind === "genre") {
        return library.tracksRef.current.filter((track) => {
          const category = getTrackCategory(track);
          return queue.category === null
            ? !category
            : category === queue.category;
        });
      }
      return library.tracksRef.current;
    },
    [favoriteTrackIdsRef, library.tracksRef],
  );

  const getPlaybackTracks = useCallback(
    () => filterTracksForQueue(playbackQueueRef.current),
    [filterTracksForQueue],
  );

  useEffect(() => {
    const activeProfile = profileStore.profiles.find(
      (profile) => profile.id === profileStore.activeProfileId,
    );
    engine.setMode(activeProfile?.theme ?? "deep");
  }, [profileStore, engine]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    engine.audioRef.current = audio;

    const onTime = () => {
      const nextProgress = audio.currentTime || 0;
      if (
        audio.paused ||
        nextProgress === 0 ||
        nextProgress - engine.lastRenderedProgressRef.current >= 0.35
      ) {
        engine.lastRenderedProgressRef.current = nextProgress;
        engine.setProgress(nextProgress);
      }
    };
    const onMeta = () =>
      engine.setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => engine.setPlayingState(true);
    const onPause = () => engine.setPlayingState(false);
    const onEnded = () => {
      const list = getPlaybackTracks();
      const index = findTrackIndex(list, engine.currentIdRef.current);
      const next = nextTrackIndex(index, list.length);
      if (next >= 0) {
        void engine.loadTrack(list[next], true);
      } else {
        engine.setPlayingState(false);
        engine.setProgress(0);
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    const snapshot = loadPlayerSnapshot();
    if (typeof snapshot.volume === "number") {
      const nextVolume = Math.min(1, Math.max(0, snapshot.volume));
      engine.setVolumeState(nextVolume);
      audio.volume = nextVolume;
    }
    if (typeof snapshot.playbackRate === "number") {
      const restoredRate = Math.min(2.0, Math.max(0.5, snapshot.playbackRate));
      engine.setPlaybackRateState(restoredRate);
      engine.playbackRateRef.current = restoredRate;
      audio.playbackRate = restoredRate;
    }
    if (snapshot.timerSettings !== undefined) {
      const restoredSettings = normalizeTimerSettings(snapshot.timerSettings);
      timerSettingsRef.current = restoredSettings;
      setTimerSettings(restoredSettings);
      lastAnnouncedPhaseRef.current = {
        kind: restoredSettings.kind,
        phase:
          restoredSettings.kind === "intervals"
            ? getIntervalPhase(0, restoredSettings).phase
            : null,
        cycleIndex: restoredSettings.kind === "intervals" ? 0 : null,
      };
    } else if (snapshot.durationPreset === "infinity") {
      const restoredSettings = normalizeTimerSettings({
        ...DEFAULT_TIMER_SETTINGS,
        kind: "infinite",
        durationMinutes: null,
      });
      timerSettingsRef.current = restoredSettings;
      setTimerSettings(restoredSettings);
      lastAnnouncedPhaseRef.current = {
        kind: "infinite",
        phase: null,
        cycleIndex: null,
      };
    } else if (typeof snapshot.durationPreset === "number") {
      const restoredSettings = normalizeTimerSettings({
        ...DEFAULT_TIMER_SETTINGS,
        durationMinutes: snapshot.durationPreset,
      });
      timerSettingsRef.current = restoredSettings;
      setTimerSettings(restoredSettings);
      lastAnnouncedPhaseRef.current = {
        kind: restoredSettings.kind,
        phase:
          restoredSettings.kind === "intervals"
            ? getIntervalPhase(0, restoredSettings).phase
            : null,
        cycleIndex: restoredSettings.kind === "intervals" ? 0 : null,
      };
    }

    (async () => {
      try {
        if (runningInTauri) {
          await invoke("ensure_music_dir");
        }
        const listed = await library.refresh();
        const preferred =
          typeof snapshot.currentTrackId === "string"
            ? listed.find((track) => track.id === snapshot.currentTrackId)
            : listed[0];
        if (preferred) {
          await engine.loadTrack(preferred, false);
        }
      } catch (err) {
        library.setError(err instanceof Error ? err.message : String(err));
      } finally {
        engine.setReady(true);
      }
    })();

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      engine.audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!engine.ready) return;
    savePlayerSnapshot({
      currentTrackId: engine.currentTrackId,
      volume: engine.volume,
      mode: engine.mode,
      durationPreset:
        timerSettings.kind === "infinite"
          ? "infinity"
          : timerSettings.durationMinutes === 15 ||
              timerSettings.durationMinutes === 25 ||
              timerSettings.durationMinutes === 30 ||
              timerSettings.durationMinutes === 40 ||
              timerSettings.durationMinutes === 45 ||
              timerSettings.durationMinutes === 50 ||
              timerSettings.durationMinutes === 60 ||
              timerSettings.durationMinutes === 120
            ? timerSettings.durationMinutes
            : 60,
      timerSettings,
      playbackRate: engine.playbackRate,
    });
  }, [
    engine.ready,
    engine.currentTrackId,
    engine.volume,
    engine.mode,
    timerSettings,
    engine.playbackRate,
  ]);

  const syncTimerClock = useCallback(() => {
    const nowMs = Date.now();
    const shouldAdvance =
      sessionStartedRef.current &&
      (!timerSettingsRef.current.pauseWhenMusicPaused ||
        engine.playingRef.current);

    if (shouldAdvance) {
      startTimerClock(timerClockRef.current, nowMs);
    } else {
      pauseTimerClock(timerClockRef.current, nowMs);
    }
  }, [engine.playingRef, sessionStartedRef, timerClockRef, timerSettingsRef]);

  useEffect(() => {
    syncTimerClock();
  }, [engine.isPlaying, sessionStarted, syncTimerClock, timerSettings]);

  useEffect(() => {
    const tick = () => {
      const nowMs = Date.now();
      const settings = timerSettingsRef.current;
      const shouldAdvance =
        sessionStartedRef.current &&
        (!settings.pauseWhenMusicPaused || engine.playingRef.current);

      const isFocusing =
        engine.playingRef.current || sessionStartedRef.current;

      if (!shouldAdvance) {
        pauseTimerClock(timerClockRef.current, nowMs);
      } else {
        startTimerClock(timerClockRef.current, nowMs);
      }

      if (!isFocusing) {
        resetAnalyticsTick();
        return;
      }

      const elapsedMs = readTimerElapsedMs(timerClockRef.current, nowMs);

      const isWorkPhase =
        settings.kind !== "intervals" ||
        getIntervalPhase(elapsedMs, settings).phase === "work";

      trackFocusTick(nowMs, isWorkPhase);

      if (!shouldAdvance) return;

      const limitMs = timerLimitMs(settings);

      if (limitMs !== null && elapsedMs >= limitMs) {
        timerClockRef.current.elapsedMs = limitMs;
        timerClockRef.current.startedAtMs = null;
        setElapsed(elapsedSecondsFromMs(limitMs));
        engine.audioRef.current?.pause();
        engine.setPlayingState(false);
        setSessionActive(false);
        const baseline = lastAnnouncedPhaseRef.current;
        if (baseline.kind !== "timer" || baseline.phase !== "complete") {
          lastAnnouncedPhaseRef.current = {
            kind: "timer",
            phase: "complete",
            cycleIndex: null,
          };
          recordSessionCompletion();
          announceTimerCue("complete", settings);
        }
        return;
      }

      if (settings.kind === "intervals") {
        const phaseState = getIntervalPhase(elapsedMs, settings);
        const baseline = lastAnnouncedPhaseRef.current;
        const phaseChanged =
          baseline.kind !== "intervals" ||
          baseline.phase !== phaseState.phase ||
          baseline.cycleIndex !== phaseState.cycleIndex;
        if (phaseChanged) {
          const isInitialBaseline =
            baseline.kind !== "intervals" || baseline.phase === null;
          lastAnnouncedPhaseRef.current = {
            kind: "intervals",
            phase: phaseState.phase,
            cycleIndex: phaseState.cycleIndex,
          };
          if (!isInitialBaseline) {
            if (baseline.phase === "work") {
              recordSessionCompletion();
            }
            announceTimerCue(
              phaseState.phase,
              settings,
              phaseState.cycleIndex,
            );
          }
        }
      }

      const nextElapsed = elapsedSecondsFromMs(elapsedMs);
      setElapsed((value) => (value === nextElapsed ? value : nextElapsed));
    };

    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [
    announceTimerCue,
    engine,
    lastAnnouncedPhaseRef,
    recordSessionCompletion,
    resetAnalyticsTick,
    setElapsed,
    setSessionActive,
    sessionStartedRef,
    timerClockRef,
    timerSettingsRef,
    trackFocusTick,
  ]);

  const selectTrack = useCallback(
    async (trackId: string, autoplay = false) => {
      const track = library.tracksRef.current.find(
        (item) => item.id === trackId,
      );
      if (!track) return;
      await engine.loadTrack(track, autoplay);
    },
    [engine, library.tracksRef],
  );

  const togglePlay = useCallback(async () => {
    const audio = engine.audioRef.current;
    if (!audio) return;

    const activeTrack = library.tracksRef.current.find(
      (track) => track.id === engine.currentIdRef.current,
    );

    if (!engine.currentIdRef.current) {
      const queue = getPlaybackTracks();
      if (queue.length === 0) {
        setLibraryOpen(true);
        library.setError(
          playbackQueueRef.current.kind === "favorites"
            ? "Add a favorite to start this queue."
            : "Add music to begin.",
        );
        return;
      }
      await engine.loadTrack(queue[0], true);
      return;
    }

    if (isRemoteTrack(activeTrack)) {
      if (engine.playingRef.current) {
        engine.setPlayingState(false);
        return;
      }

      if (
        timerSettings.kind === "timer" &&
        timerSettings.durationMinutes !== null &&
        elapsed >= timerSettings.durationMinutes * 60
      ) {
        resetTimerClock(timerClockRef.current);
        setElapsed(0);
      }
      engine.setPlayingState(true);
      startSession();
      return;
    }

    if (audio.paused) {
      try {
        if (
          timerSettings.kind === "timer" &&
          timerSettings.durationMinutes !== null &&
          elapsed >= timerSettings.durationMinutes * 60
        ) {
          resetTimerClock(timerClockRef.current);
          setElapsed(0);
        }
        await audio.play();
        startSession();
      } catch (err) {
        library.setError(err instanceof Error ? err.message : String(err));
      }
    } else {
      audio.pause();
    }
  }, [
    elapsed,
    engine,
    getPlaybackTracks,
    library,
    setElapsed,
    startSession,
    timerClockRef,
    timerSettings,
  ]);

  const playNext = useCallback(
    async (forceAutoplay = false) => {
      const list = getPlaybackTracks();
      const index = findTrackIndex(list, engine.currentIdRef.current);
      const next = nextTrackIndex(index, list.length);
      if (next >= 0) {
        await engine.loadTrack(
          list[next],
          forceAutoplay || engine.playingRef.current || index < 0,
        );
      }
    },
    [engine, getPlaybackTracks],
  );

  const playPrevious = useCallback(async () => {
    const audio = engine.audioRef.current;
    const activeTrack = library.tracksRef.current.find(
      (track) => track.id === engine.currentIdRef.current,
    );
    if (isRemoteTrack(activeTrack) && engine.progress > 3) {
      engine.setRemoteSeekRequest({
        value: 0,
        token: Date.now() + Math.random(),
      });
      engine.setProgress(0);
      return;
    }
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      engine.lastRenderedProgressRef.current = 0;
      engine.setProgress(0);
      return;
    }
    const list = getPlaybackTracks();
    const index = findTrackIndex(list, engine.currentIdRef.current);
    const prev = previousTrackIndex(index, list.length);
    if (prev >= 0) {
      await engine.loadTrack(list[prev], engine.playingRef.current);
    }
  }, [engine, getPlaybackTracks, library.tracksRef]);

  const playQueue = useCallback(
    (queue: PlaybackQueue, trackId: string | null = null) => {
      const list = filterTracksForQueue(queue);
      playbackQueueRef.current = queue;
      setPlaybackQueueState(queue);

      if (list.length === 0) {
        engine.audioRef.current?.pause();
        engine.setPlayingState(false);
        setSessionActive(false);
        library.setError(
          queue.kind === "favorites"
            ? "Favorite a track to build this queue."
            : "No tracks in this queue.",
        );
        return;
      }

      const selectedTrack =
        (trackId ? list.find((track) => track.id === trackId) : null) ??
        list[0];
      void engine.loadTrack(selectedTrack, true);
    },
    [engine, filterTracksForQueue, library, setSessionActive],
  );

  const setFavoritesQueue = useCallback(
    (enabled: boolean) => {
      const nextQueue: PlaybackQueue = enabled
        ? { kind: "favorites" }
        : { kind: "all" };
      playbackQueueRef.current = nextQueue;
      setPlaybackQueueState(nextQueue);
      if (!enabled) return;

      const firstFavorite = library.tracksRef.current.find((track) =>
        favoriteTrackIdsRef.current.includes(track.id),
      );
      if (!firstFavorite) {
        engine.audioRef.current?.pause();
        engine.setPlayingState(false);
        setSessionActive(false);
        library.setError("Favorite a track to build this queue.");
        return;
      }

      const current = library.tracksRef.current.find(
        (track) => track.id === engine.currentIdRef.current,
      );
      if (!current || !favoriteTrackIdsRef.current.includes(current.id)) {
        void engine.loadTrack(firstFavorite, engine.playingRef.current);
      }
    },
    [engine, favoriteTrackIdsRef, library, setSessionActive],
  );

  const onRemoteEnded = useCallback(() => {
    void playNext(true);
  }, [playNext]);

  const currentPhase = useMemo(() => {
    if (timerSettings.kind !== "intervals") return undefined;
    const elapsedMs = elapsed * 1000;
    return getIntervalPhase(elapsedMs, timerSettings).phase;
  }, [elapsed, timerSettings]);

  const timerLabel = useMemo(() => {
    const elapsedMs = elapsed * 1000;

    if (timerSettings.kind === "infinite") {
      const s = Math.floor(elapsed);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) {
        const rh = h;
        const rm = m % 60;
        const rs = s % 60;
        return `${rh}:${rm.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}`;
      }
      return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    }

    if (timerSettings.kind === "intervals") {
      const phaseState = getIntervalPhase(elapsedMs, timerSettings);
      const s = Math.floor(phaseState.phaseRemainingMs / 1000);
      const m = Math.floor(s / 60);
      return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    }

    const durationMinutes = timerSettings.durationMinutes ?? 60;
    const totalMs = durationMinutes * 60 * 1000;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const s = Math.floor(remainingMs / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      const rh = h;
      const rm = m % 60;
      const rs = s % 60;
      return `${rh}:${rm.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  }, [elapsed, timerSettings]);

  const resetSession = useCallback(() => {
    resetTimerClock(timerClockRef.current);
    setElapsed(0);
    setTimerSettings((prev) => ({
      ...prev,
      miniGoals: resetMiniGoalProgress(prev.miniGoals),
      breakMiniGoals: prev.breakMiniGoals
        ? resetMiniGoalProgress(prev.breakMiniGoals)
        : [],
    }));
  }, [setElapsed, setTimerSettings, timerClockRef]);

  const updateTimerSettings = useCallback(
    (next: TimerSettings) => {
      const normalized = normalizeTimerSettings(next);
      timerSettingsRef.current = normalized;
      setTimerSettings(normalized);

      const elapsedMs = readTimerElapsedMs(timerClockRef.current, Date.now());
      lastAnnouncedPhaseRef.current = {
        kind: normalized.kind,
        phase:
          normalized.kind === "intervals"
            ? getIntervalPhase(elapsedMs, normalized).phase
            : null,
        cycleIndex:
          normalized.kind === "intervals"
            ? getIntervalPhase(elapsedMs, normalized).cycleIndex
            : null,
      };
    },
    [lastAnnouncedPhaseRef, setTimerSettings, timerSettingsRef],
  );

  return {
    tracks: library.tracks,
    musicDir: library.musicDir,
    currentTrack,
    currentTrackId: engine.currentTrackId,
    profiles: profileStore.profiles,
    activeProfileId: profileStore.activeProfileId,
    analyticsSummary,
    analyticsStore,
    profilePickerOpen,
    favoriteTrackIds,
    favoritesOnly,
    isPlaying: engine.isPlaying,
    volume: engine.volume,
    progress: engine.progress,
    duration: engine.duration,
    elapsed,
    currentPhase,
    timerLabel,
    mode: engine.mode,
    timerSettings,
    timerSettingsOpen,
    libraryOpen,
    busy: library.busy,
    error: engine.error ?? library.error,
    ready: engine.ready,
    browserMode: !runningInTauri,
    setLibraryOpen,
    setProfilePickerOpen,
    switchProfile: selectProfile,
    createProfile,
    deleteProfile,
    setError: library.setError,
    refresh: library.refresh,
    importTracks: library.importTracks,
    addRemoteLink: library.addRemoteLink,
    importDroppedFiles: library.dropFiles,
    removeTrack: library.removeTrack,
    openMusicFolder: library.openMusicFolder,
    selectTrack,
    togglePlay,
    playNext,
    playPrevious,
    seek: (value: number) => engine.seek(value, library.tracks),
    setVolume: engine.setVolume,
    playbackRate: engine.playbackRate,
    setPlaybackRate: engine.setPlaybackRate,
    toggleFavorite,
    playQueue,
    setFavoritesOnly: setFavoritesQueue,
    remoteSeekRequest: engine.remoteSeekRequest,
    onRemoteTime: engine.onRemoteTime,
    onRemoteDuration: engine.onRemoteDuration,
    onRemotePlaying: engine.onRemotePlaying,
    onRemoteEnded,
    onRemoteError: engine.onRemoteError,
    resetSession,
    updateTimerSettings,
    setTimerSettingsOpen,
  };
}
