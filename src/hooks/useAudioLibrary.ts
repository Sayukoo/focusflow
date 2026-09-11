import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stopAppLock } from "../lib/appLock";
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
  isFocusAnalyticsEligible,
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
    selectProfile: rawSelectProfile,
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

  const [volumeNormalization, setVolumeNormalizationState] = useState(true);
  const setVolumeNormalization = useCallback((enabled: boolean) => {
    setVolumeNormalizationState(Boolean(enabled));
  }, []);
  const toggleVolumeNormalization = useCallback(() => {
    setVolumeNormalizationState((value) => !value);
  }, []);

  const runningInTauri = useMemo(() => isTauriRuntime(), []);

  const engine = useAudioPlaybackEngine({
    runningInTauri,
    startSession,
    duckingMultiplier,
    normalizationEnabled: volumeNormalization,
  });

  // Stable per-field bindings (the engine object itself is a fresh literal
  // every render, but each of these members is a stable ref/callback).
  const {
    audioRef,
    currentIdRef,
    playingRef,
    lastRenderedProgressRef,
    setPlayingState,
    setProgress,
    setRemoteSeekRequest,
  } = engine;
  const { loadTrack } = engine;

  useEffect(() => {
    return () => {
      void stopAppLock();
    };
  }, []);

  const library = useTrackLibrary({
    profileStoreRef,
    activeProfileIdRef,
    commitProfileStore,
    loadTrack: engine.loadTrack,
    currentIdRef: engine.currentIdRef,
  });
  const { setError } = library;

  const playbackQueueRef = useRef<PlaybackQueue>({ kind: "all" });
  const [playbackQueue, setPlaybackQueueState] = useState<PlaybackQueue>({
    kind: "all",
  });

  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);

  const openHub = useCallback(() => {
    setHubOpen(true);
  }, []);

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
        // PERF: Set lookup instead of includes per track.
        const favoriteIds = new Set(favoriteTrackIdsRef.current);
        return library.tracksRef.current.filter((track) =>
          favoriteIds.has(track.id),
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

  // Element creation, playback listeners and near-end auto-crossfade live in
  // useAudioPlaybackEngine now. Here we only restore persisted settings and
  // kick off the initial library load.
  useEffect(() => {
    const snapshot = loadPlayerSnapshot();
    if (typeof snapshot.volume === "number") {
      const nextVolume = Math.min(1, Math.max(0, snapshot.volume));
      engine.setVolumeState(nextVolume);
      if (engine.audioRef.current) {
        engine.audioRef.current.volume = nextVolume;
      }
    }
    if (typeof snapshot.playbackRate === "number") {
      const restoredRate = Math.min(2.0, Math.max(0.5, snapshot.playbackRate));
      engine.setPlaybackRate(restoredRate);
    }
    if (typeof snapshot.volumeNormalization === "boolean") {
      setVolumeNormalization(snapshot.volumeNormalization);
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
  }, []);

  // Keep the engine's auto-advance resolver fresh every render (cheap ref
  // write) so near-end crossfade always follows the active playback queue.
  useEffect(() => {
    engine.resolveAutoNextRef.current = () => {
      const list = filterTracksForQueue(playbackQueueRef.current);
      const index = findTrackIndex(list, engine.currentIdRef.current);
      const next = nextTrackIndex(index, list.length);
      return next >= 0 ? list[next] : null;
    };
  });

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
      volumeNormalization,
    });
  }, [
    engine.ready,
    engine.currentTrackId,
    engine.volume,
    engine.mode,
    timerSettings,
    engine.playbackRate,
    volumeNormalization,
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

      const isEligible = isFocusAnalyticsEligible(settings);
      const canTrackStats = shouldAdvance && isFocusing && isEligible;

      if (!canTrackStats) {
        resetAnalyticsTick();
      } else {
        const elapsedMs = readTimerElapsedMs(timerClockRef.current, nowMs);
        const isWorkPhase =
          settings.kind !== "intervals" ||
          getIntervalPhase(elapsedMs, settings).phase === "work";
        trackFocusTick(nowMs, isWorkPhase);
      }

      if (!shouldAdvance) return;

      const elapsedMs = readTimerElapsedMs(timerClockRef.current, nowMs);
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
          if (isEligible) {
            recordSessionCompletion();
          }
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
            if (baseline.phase === "work" && isEligible) {
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

  // PERF: depend on the specific stable engine refs/callbacks instead of the
  // whole `engine` object (a fresh literal every render). Depending on `engine`
  // made these callbacks change identity ~3×/second during playback, which
  // defeated every memo() below and re-rendered the entire tree per tick.
  const selectTrack = useCallback(
    async (trackId: string, autoplay = false) => {
      const track = library.tracksRef.current.find(
        (item) => item.id === trackId,
      );
      if (!track) return;
      await loadTrack(track, autoplay);
    },
    [library.tracksRef, loadTrack],
  );

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const activeTrack = library.tracksRef.current.find(
      (track) => track.id === currentIdRef.current,
    );

    if (!currentIdRef.current) {
      const queue = getPlaybackTracks();
      if (queue.length === 0) {
        openHub();
        library.setError(
          playbackQueueRef.current.kind === "favorites"
            ? "Add a favorite to start this queue."
            : "Add music to begin.",
        );
        return;
      }
      await loadTrack(queue[0], true);
      return;
    }

    if (isRemoteTrack(activeTrack)) {
      if (playingRef.current) {
        setPlayingState(false);
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
      setPlayingState(true);
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
    audioRef,
    currentIdRef,
    elapsed,
    getPlaybackTracks,
    library.setError,
    library.tracksRef,
    loadTrack,
    openHub,
    playingRef,
    setElapsed,
    setPlayingState,
    startSession,
    timerClockRef,
    timerSettings,
  ]);

  const playNext = useCallback(
    async (forceAutoplay = false) => {
      const list = getPlaybackTracks();
      const index = findTrackIndex(list, currentIdRef.current);
      const next = nextTrackIndex(index, list.length);
      if (next >= 0) {
        await loadTrack(
          list[next],
          forceAutoplay || playingRef.current || index < 0,
          "manual",
        );
      }
    },
    [currentIdRef, getPlaybackTracks, loadTrack, playingRef],
  );

  const playPrevious = useCallback(async () => {
    const audio = audioRef.current;
    const activeTrack = library.tracksRef.current.find(
      (track) => track.id === currentIdRef.current,
    );
    if (isRemoteTrack(activeTrack) && lastRenderedProgressRef.current > 3) {
      setRemoteSeekRequest({
        value: 0,
        token: Date.now() + Math.random(),
      });
      setProgress(0);
      return;
    }
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      lastRenderedProgressRef.current = 0;
      setProgress(0);
      return;
    }
    const list = getPlaybackTracks();
    const index = findTrackIndex(list, currentIdRef.current);
    const prev = previousTrackIndex(index, list.length);
    if (prev >= 0) {
      await loadTrack(list[prev], playingRef.current, "manual");
    }
  }, [
    audioRef,
    currentIdRef,
    getPlaybackTracks,
    lastRenderedProgressRef,
    library.tracksRef,
    loadTrack,
    playingRef,
    setProgress,
    setRemoteSeekRequest,
  ]);

  const playQueue = useCallback(
    (queue: PlaybackQueue, trackId: string | null = null) => {
      const list = filterTracksForQueue(queue);
      playbackQueueRef.current = queue;
      setPlaybackQueueState(queue);

      if (list.length === 0) {
        audioRef.current?.pause();
        setPlayingState(false);
        setSessionActive(false);
        setError(
          queue.kind === "favorites"
            ? "Favorite a track to build this queue."
            : "No tracks in this queue.",
        );
        return;
      }

      const selectedTrack =
        (trackId ? list.find((track) => track.id === trackId) : null) ??
        list[0];
      void loadTrack(selectedTrack, true, "manual");
    },
    [audioRef, filterTracksForQueue, loadTrack, setError, setPlayingState, setSessionActive],
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
        audioRef.current?.pause();
        setPlayingState(false);
        setSessionActive(false);
        setError("Favorite a track to build this queue.");
        return;
      }

      const current = library.tracksRef.current.find(
        (track) => track.id === currentIdRef.current,
      );
      if (!current || !favoriteTrackIdsRef.current.includes(current.id)) {
        void loadTrack(firstFavorite, playingRef.current, "manual");
      }
    },
    [
      audioRef,
      currentIdRef,
      favoriteTrackIdsRef,
      library.tracksRef,
      loadTrack,
      playingRef,
      setError,
      setPlayingState,
      setSessionActive,
    ],
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

  const seek = useCallback(
    (value: number) => {
      engine.seek(value, library.tracks);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable members only
    [engine.seek, library.tracks],
  );

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

  const switchProfile = useCallback(
    async (profileId: string) => {
      rawSelectProfile(profileId);
      const activeProfile = profileStoreRef.current.profiles.find(
        (profile) => profile.id === profileId,
      );
      engine.setMode(activeProfile?.theme ?? "deep");

      const listed = await library.switchActiveProfile(profileId);

      // Check if current track belongs to the new profile
      const isCurrentInNewProfile = listed.some(
        (t) => t.id === engine.currentIdRef.current,
      );

      if (!isCurrentInNewProfile && listed.length > 0) {
        const nextTrack = listed[0];
        await engine.loadTrack(nextTrack, engine.playingRef.current, "manual");
      }
    },
    [engine, library, profileStoreRef, rawSelectProfile],
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
    hubOpen,
    favoriteTrackIds,
    favoritesOnly,
    isPlaying: engine.isPlaying,
    volume: engine.volume,
    duckingMultiplier,
    progress: engine.progress,
    duration: engine.duration,
    elapsed,
    currentPhase,
    timerLabel,
    mode: engine.mode,
    timerSettings,
    timerSettingsOpen,
    busy: library.busy,
    error: engine.error ?? library.error,
    ready: engine.ready,
    browserMode: !runningInTauri,
    setHubOpen,
    openHub,
    switchProfile,
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
    seek,
    setVolume: engine.setVolume,
    playbackRate: engine.playbackRate,
    setPlaybackRate: engine.setPlaybackRate,
    volumeNormalization,
    toggleVolumeNormalization,
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
