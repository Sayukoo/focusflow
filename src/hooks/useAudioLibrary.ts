import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchRemoteMetadata,
  fetchRemotePlaylistTracks,
  formatTimerLabel,
  findTrackIndex,
  isSupportedAudioFile,
  isTauriRuntime,
  isRemoteTrack,
  loadPlayerSnapshot,
  loadRemoteTracks,
  nextTrackIndex,
  parseRemoteLink,
  previousTrackIndex,
  savePlayerSnapshot,
  saveRemoteTracks,
  sanitizeTitle,
  uniqueFilename,
} from "../lib/audio";
import {
  createTimerClock,
  elapsedSecondsFromMs,
  getIntervalPhase,
  normalizeTimerSettings,
  pauseTimerClock,
  readTimerElapsedMs,
  resetMiniGoalProgress,
  resetTimerClock,
  startTimerClock,
  timerLimitMs,
  type TimerClock,
} from "../lib/timer";
import { announcePhaseTransition } from "../lib/phaseCues";
import { getTrackCategory } from "../lib/gemini";
import {
  DEFAULT_TIMER_SETTINGS,
  type FocusMode,
  type PlaybackQueue,
  type TimerPhase,
  type TimerSettings,
  type Track,
} from "../types";
import {
  addFocusTime,
  calculateStreak,
  formatDailyFocusSummary,
  getTodayStats,
  loadAnalyticsStore,
  recordCompletedSession,
  saveAnalyticsStore,
  type FocusAnalyticsStore,
} from "../lib/analytics";
import {
  addCustomProfile,
  assignTracksToProfile,
  deleteCustomProfile,
  getProfileFavoriteIds,
  getProfileTrackIds,
  isTrackSharedWithAnotherProfile,
  loadProfileStore,
  reconcileProfileTracks,
  removeTracksFromProfile,
  removeTracksFromProfiles,
  saveProfileStore,
  setActiveProfile,
  toggleProfileFavorite,
  type ProfileStore,
} from "../lib/profiles";

const AUDIO_FILTERS = [
  {
    name: "Audio",
    extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"],
  },
];

export function useAudioLibrary() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const browserTracksRef = useRef<Track[]>([]);
  const remoteTracksRef = useRef<Track[]>(loadRemoteTracks());
  const [profileStore, setProfileStore] = useState<ProfileStore>(() =>
    loadProfileStore(),
  );
  const profileStoreRef = useRef<ProfileStore>(profileStore);
  const activeProfileIdRef = useRef(profileStore.activeProfileId);
  const currentIdRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const playbackQueueRef = useRef<PlaybackQueue>({ kind: "all" });
  const favoriteTrackIdsRef = useRef<string[]>(
    getProfileFavoriteIds(profileStore),
  );
  const timerSettingsRef = useRef<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const timerClockRef = useRef<TimerClock>(createTimerClock());
  const sessionStartedRef = useRef(false);
  const voiceCueSequenceRef = useRef(0);
  const lastAnnouncedPhaseRef = useRef<{
    kind: TimerSettings["kind"];
    phase: TimerPhase | "complete" | null;
    cycleIndex: number | null;
  }>({ kind: DEFAULT_TIMER_SETTINGS.kind, phase: null, cycleIndex: null });
  const volumeRef = useRef(0.72);
  const duckingMultiplierRef = useRef(1.0);
  const [duckingMultiplier, setDuckingMultiplier] = useState(1.0);
  const loadRequestRef = useRef(0);
  const profileSwitchRequestRef = useRef(0);
  const lastRenderedProgressRef = useRef(0);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [musicDir, setMusicDir] = useState("");
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.72);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [remoteSeekRequest, setRemoteSeekRequest] = useState<{
    value: number;
    token: number;
  } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<FocusMode>("deep");
  const [timerSettings, setTimerSettings] =
    useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState<string[]>(() =>
    getProfileFavoriteIds(profileStore),
  );
  const [playbackQueue, setPlaybackQueueState] = useState<PlaybackQueue>({
    kind: "all",
  });
  const [ready, setReady] = useState(false);
  const runningInTauri = useMemo(() => isTauriRuntime(), []);
  const favoritesOnly = playbackQueue.kind === "favorites";

  const setPlayingState = useCallback((playing: boolean) => {
    playingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const setSessionActive = useCallback((active: boolean) => {
    sessionStartedRef.current = active;
    setSessionStarted(active);
  }, []);

  const [analyticsStore, setAnalyticsStore] = useState<FocusAnalyticsStore>(() =>
    loadAnalyticsStore(),
  );
  const analyticsStoreRef = useRef<FocusAnalyticsStore>(analyticsStore);
  const lastAnalyticsTickRef = useRef<number | null>(null);

  useEffect(() => {
    analyticsStoreRef.current = analyticsStore;
  }, [analyticsStore]);

  const commitAnalyticsStore = useCallback((next: FocusAnalyticsStore) => {
    analyticsStoreRef.current = next;
    setAnalyticsStore(next);
    saveAnalyticsStore(next);
  }, []);

  const commitProfileStore = useCallback((next: ProfileStore) => {
    if (profileStoresEqual(profileStoreRef.current, next)) return;
    profileStoreRef.current = next;
    activeProfileIdRef.current = next.activeProfileId;
    setProfileStore(next);
    setFavoriteTrackIds(getProfileFavoriteIds(next));
    favoriteTrackIdsRef.current = getProfileFavoriteIds(next);
    saveProfileStore(next);
  }, []);

  const filterTracksForProfile = useCallback(
    (allTracks: Track[], profileId = activeProfileIdRef.current) => {
      const profileTrackIds = new Set(
        getProfileTrackIds(profileStoreRef.current, profileId),
      );
      return allTracks.filter((track) => profileTrackIds.has(track.id));
    },
    [],
  );

  const currentIndex = useMemo(
    () => findTrackIndex(tracks, currentTrackId),
    [tracks, currentTrackId],
  );
  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;
  const filterTracksForQueue = useCallback((queue: PlaybackQueue) => {
    if (queue.kind === "favorites") {
      return tracksRef.current.filter((track) =>
        favoriteTrackIdsRef.current.includes(track.id),
      );
    }
    if (queue.kind === "recent") {
      return [...tracksRef.current].reverse();
    }
    if (queue.kind === "genre") {
      return tracksRef.current.filter((track) => {
        const category = getTrackCategory(track);
        return queue.category === null ? !category : category === queue.category;
      });
    }
    return tracksRef.current;
  }, []);
  const getPlaybackTracks = useCallback(
    () => filterTracksForQueue(playbackQueueRef.current),
    [filterTracksForQueue],
  );

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentIdRef.current = currentTrackId;
  }, [currentTrackId]);

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    favoriteTrackIdsRef.current = favoriteTrackIds;
  }, [favoriteTrackIds]);

  useEffect(() => {
    timerSettingsRef.current = timerSettings;
  }, [timerSettings]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const resetPhaseCueBaseline = useCallback((settings: TimerSettings, elapsedMs = 0) => {
    if (settings.kind !== "intervals") {
      lastAnnouncedPhaseRef.current = {
        kind: settings.kind,
        phase: null,
        cycleIndex: null,
      };
      return;
    }
    const phaseState = getIntervalPhase(elapsedMs, settings);
    lastAnnouncedPhaseRef.current = {
      kind: "intervals",
      phase: phaseState.phase,
      cycleIndex: phaseState.cycleIndex,
    };
  }, []);

  const announceTimerCue = useCallback(
    (
      phase: TimerPhase | "complete",
      settings: TimerSettings,
      cycleIndex = 0,
    ) => {
      if (!settings.phaseSoundEnabled && !settings.phaseVoiceEnabled) return;
      const voiceCueId = ++voiceCueSequenceRef.current;
      const musicAudio = audioRef.current;
      const duckMusic = () => {
        if (
          !settings.phaseVoiceEnabled ||
          voiceCueId !== voiceCueSequenceRef.current
        ) {
          return;
        }
        duckingMultiplierRef.current = 0.2;
        setDuckingMultiplier(0.2);
        if (musicAudio && !musicAudio.paused) {
          musicAudio.volume = Math.max(0, volumeRef.current * 0.2);
        }
      };
      const restoreMusic = () => {
        if (voiceCueId !== voiceCueSequenceRef.current) {
          return;
        }
        duckingMultiplierRef.current = 1.0;
        setDuckingMultiplier(1.0);
        if (musicAudio && audioRef.current === musicAudio) {
          musicAudio.volume = volumeRef.current;
        }
      };
      void announcePhaseTransition({
        phase,
        breakDurationMinutes: settings.breakDurationMinutes,
        cycleIndex,
        soundEnabled: settings.phaseSoundEnabled,
        voiceEnabled: settings.phaseVoiceEnabled,
        voicePack: settings.voicePack,
        volume: volumeRef.current,
        onVoiceStart: duckMusic,
        onVoiceEnd: restoreMusic,
      });
    },
    [],
  );

  const startSession = useCallback(() => {
    const wasActive = sessionStartedRef.current;
    setSessionActive(true);
    if (!wasActive) {
      announceTimerCue("work", timerSettingsRef.current, 0);
    }
  }, [announceTimerCue, setSessionActive]);

  useEffect(() => {
    const activeProfile = profileStore.profiles.find(
      (profile) => profile.id === profileStore.activeProfileId,
    );
    setMode(activeProfile?.theme ?? "deep");
  }, [profileStore]);

  const loadTrack = useCallback(async (track: Track, autoplay: boolean) => {
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
  }, [runningInTauri, setPlayingState, startSession]);

  const refresh = useCallback(async () => {
    if (!runningInTauri) {
      const allTracks = [
        ...browserTracksRef.current,
        ...remoteTracksRef.current,
      ];
      const nextProfileStore = reconcileProfileTracks(
        profileStoreRef.current,
        allTracks.map((track) => track.id),
      );
      commitProfileStore(nextProfileStore);
      const listed = filterTracksForProfile(allTracks);
      setMusicDir("Browser preview · selected files");
      setTracks(listed);
      tracksRef.current = listed;
      return listed;
    }

    const [dir, localTracks] = await Promise.all([
      invoke<string>("get_music_dir"),
      invoke<Track[]>("list_tracks"),
    ]);
    const allTracks = [...localTracks, ...remoteTracksRef.current];
    const nextProfileStore = reconcileProfileTracks(
      profileStoreRef.current,
      allTracks.map((track) => track.id),
    );
    commitProfileStore(nextProfileStore);
    const listed = filterTracksForProfile(allTracks);
    setMusicDir(dir);
    setTracks(listed);
    tracksRef.current = listed;
    return listed;
  }, [
    commitProfileStore,
    filterTracksForProfile,
    runningInTauri,
  ]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => {
      const nextProgress = audio.currentTime || 0;
      if (
        audio.paused ||
        nextProgress === 0 ||
        nextProgress - lastRenderedProgressRef.current >= 0.35
      ) {
        lastRenderedProgressRef.current = nextProgress;
        setProgress(nextProgress);
      }
    };
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlayingState(true);
    const onPause = () => setPlayingState(false);
    const onEnded = () => {
      const list = getPlaybackTracks();
      const index = findTrackIndex(list, currentIdRef.current);
      const next = nextTrackIndex(index, list.length);
      if (next >= 0) {
        void loadTrack(list[next], true);
      } else {
        setPlayingState(false);
        setProgress(0);
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
      setVolumeState(nextVolume);
      audio.volume = nextVolume;
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
        const listed = await refresh();
        const preferred =
          typeof snapshot.currentTrackId === "string"
            ? listed.find((track) => track.id === snapshot.currentTrackId)
            : listed[0];
        if (preferred) {
          await loadTrack(preferred, false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setReady(true);
      }
    })();

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [
    getPlaybackTracks,
    loadTrack,
    refresh,
    runningInTauri,
    setPlayingState,
  ]);

  useEffect(() => {
    if (!ready) return;
    savePlayerSnapshot({
      currentTrackId,
      volume,
      mode,
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
    });
  }, [ready, currentTrackId, volume, mode, timerSettings]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.min(1, Math.max(0, volume * duckingMultiplier));
    }
  }, [volume, duckingMultiplier]);

  const syncTimerClock = useCallback(() => {
    const nowMs = Date.now();
    const shouldAdvance =
      sessionStartedRef.current &&
      (!timerSettingsRef.current.pauseWhenMusicPaused || playingRef.current);

    if (shouldAdvance) {
      startTimerClock(timerClockRef.current, nowMs);
    } else {
      pauseTimerClock(timerClockRef.current, nowMs);
    }
  }, []);

  useEffect(() => {
    sessionStartedRef.current = sessionStarted;
  }, [sessionStarted]);

  useEffect(() => {
    syncTimerClock();
  }, [isPlaying, sessionStarted, syncTimerClock, timerSettings]);

  useEffect(() => {
    const tick = () => {
      const nowMs = Date.now();
      const settings = timerSettingsRef.current;
      const shouldAdvance =
        sessionStartedRef.current &&
        (!settings.pauseWhenMusicPaused || playingRef.current);

      const isFocusing = playingRef.current || sessionStartedRef.current;

      if (!shouldAdvance) {
        pauseTimerClock(timerClockRef.current, nowMs);
      } else {
        startTimerClock(timerClockRef.current, nowMs);
      }

      if (!isFocusing) {
        lastAnalyticsTickRef.current = null;
        return;
      }

      const elapsedMs = readTimerElapsedMs(timerClockRef.current, nowMs);

      const isWorkPhase =
        settings.kind !== "intervals" ||
        getIntervalPhase(elapsedMs, settings).phase === "work";

      if (isWorkPhase) {
        if (lastAnalyticsTickRef.current !== null) {
          const diffSec = Math.floor(
            (nowMs - lastAnalyticsTickRef.current) / 1000,
          );
          if (diffSec >= 1) {
            lastAnalyticsTickRef.current =
              nowMs - ((nowMs - lastAnalyticsTickRef.current) % 1000);
            commitAnalyticsStore(
              addFocusTime(analyticsStoreRef.current, diffSec),
            );
          }
        } else {
          lastAnalyticsTickRef.current = nowMs;
        }
      } else {
        lastAnalyticsTickRef.current = null;
      }

      if (!shouldAdvance) return;

      const limitMs = timerLimitMs(settings);

      if (limitMs !== null && elapsedMs >= limitMs) {
        timerClockRef.current.elapsedMs = limitMs;
        timerClockRef.current.startedAtMs = null;
        setElapsed(elapsedSecondsFromMs(limitMs));
        audioRef.current?.pause();
        setPlayingState(false);
        setSessionActive(false);
        const baseline = lastAnnouncedPhaseRef.current;
        if (baseline.kind !== "timer" || baseline.phase !== "complete") {
          lastAnnouncedPhaseRef.current = {
            kind: "timer",
            phase: "complete",
            cycleIndex: null,
          };
          commitAnalyticsStore(
            recordCompletedSession(analyticsStoreRef.current),
          );
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
              commitAnalyticsStore(
                recordCompletedSession(analyticsStoreRef.current),
              );
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
  }, [announceTimerCue, setPlayingState, setSessionActive]);

  const selectTrack = useCallback(
    async (trackId: string, autoplay = false) => {
      const track = tracksRef.current.find((item) => item.id === trackId);
      if (!track) return;
      await loadTrack(track, autoplay);
    },
    [loadTrack],
  );

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const activeTrack = tracksRef.current.find(
      (track) => track.id === currentIdRef.current,
    );

    if (!currentIdRef.current) {
      const queue = getPlaybackTracks();
      if (queue.length === 0) {
        setLibraryOpen(true);
        setError(
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
        setError(err instanceof Error ? err.message : String(err));
      }
    } else {
      audio.pause();
    }
  }, [
    elapsed,
    getPlaybackTracks,
    loadTrack,
    setPlayingState,
    startSession,
    timerSettings,
  ]);

  const playNext = useCallback(async (forceAutoplay = false) => {
    const list = getPlaybackTracks();
    const index = findTrackIndex(list, currentIdRef.current);
    const next = nextTrackIndex(index, list.length);
    if (next >= 0) {
      await loadTrack(
        list[next],
        forceAutoplay || playingRef.current || index < 0,
      );
    }
  }, [getPlaybackTracks, loadTrack]);

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

  const onRemotePlaying = useCallback((playing: boolean) => {
    setPlayingState(playing);
    if (playing) startSession();
  }, [setPlayingState, startSession]);

  const onRemoteEnded = useCallback(() => {
    void playNext(true);
  }, [playNext]);

  const onRemoteError = useCallback((message: string) => {
    setError(message);
    setPlayingState(false);
  }, [setPlayingState]);

  const playPrevious = useCallback(async () => {
    const audio = audioRef.current;
    const activeTrack = tracksRef.current.find(
      (track) => track.id === currentIdRef.current,
    );
    if (isRemoteTrack(activeTrack) && progress > 3) {
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
      await loadTrack(list[prev], playingRef.current);
    }
  }, [getPlaybackTracks, loadTrack, progress]);

  const seek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!Number.isFinite(value)) return;

    const activeTrack = tracksRef.current.find(
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

  const toggleFavorite = useCallback((trackId: string) => {
    const next = toggleProfileFavorite(
      profileStoreRef.current,
      activeProfileIdRef.current,
      trackId,
    );
    commitProfileStore(next);
  }, [commitProfileStore]);

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
      void loadTrack(selectedTrack, true);
    },
    [filterTracksForQueue, loadTrack, setPlayingState, setSessionActive],
  );

  const setFavoritesQueue = useCallback((enabled: boolean) => {
    const nextQueue: PlaybackQueue = enabled
      ? { kind: "favorites" }
      : { kind: "all" };
    playbackQueueRef.current = nextQueue;
    setPlaybackQueueState(nextQueue);
    if (!enabled) return;

    const firstFavorite = tracksRef.current.find((track) =>
      favoriteTrackIdsRef.current.includes(track.id),
    );
    if (!firstFavorite) {
      audioRef.current?.pause();
      setPlayingState(false);
      setSessionActive(false);
      setError("Favorite a track to build this queue.");
      return;
    }

    const current = tracksRef.current.find(
      (track) => track.id === currentIdRef.current,
    );
    if (!current || !favoriteTrackIdsRef.current.includes(current.id)) {
      void loadTrack(firstFavorite, playingRef.current);
    }
  }, [loadTrack, setPlayingState, setSessionActive]);

  const pickBrowserFiles = useCallback((directory = false) => {
    return new Promise<File[]>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".mp3,.wav,.ogg,.flac,.m4a,.aac,audio/*";
      if (directory) {
        input.setAttribute("webkitdirectory", "");
      }

      input.addEventListener(
        "change",
        () => resolve(Array.from(input.files ?? [])),
        { once: true },
      );
      input.addEventListener("cancel", () => resolve([]), { once: true });
      input.click();
    });
  }, []);

  const addBrowserFiles = useCallback(
    async (files: File[]) => {
      const supported = files.filter(isSupportedAudioFile);
      if (supported.length === 0) {
        setError("Choose MP3, WAV, OGG, FLAC, M4A or AAC files.");
        return [];
      }

      const existingNames = browserTracksRef.current.map((track) => track.filename);
      const imported = supported.map((file) => {
        const filename = uniqueFilename(existingNames, file.name);
        existingNames.push(filename);
        const path = URL.createObjectURL(file);
        const extension = filename.split(".").pop()?.toLowerCase() ?? "";
        return {
          id: path,
          title: sanitizeTitle(filename),
          filename,
          path,
          extension,
          source: "browser" as const,
        };
      });

      const nextBrowserTracks = [...browserTracksRef.current, ...imported];
      const nextProfileStore = assignTracksToProfile(
        profileStoreRef.current,
        activeProfileIdRef.current,
        imported.map((track) => track.id),
      );
      commitProfileStore(nextProfileStore);
      const next = filterTracksForProfile([
        ...nextBrowserTracks,
        ...remoteTracksRef.current,
      ]);
      browserTracksRef.current = nextBrowserTracks;
      tracksRef.current = next;
      setTracks(next);
      setMusicDir("Browser preview · selected files");

      if (!currentIdRef.current && imported[0]) {
        await loadTrack(imported[0], false);
      }

      return imported;
    },
    [commitProfileStore, filterTracksForProfile, loadTrack],
  );

  const importManagedPaths = useCallback(
    async (paths: string[]) => {
      const imported = await invoke<Track[]>("import_tracks", { paths });
      const nextProfileStore = assignTracksToProfile(
        profileStoreRef.current,
        activeProfileIdRef.current,
        imported.map((track) => track.id),
      );
      commitProfileStore(nextProfileStore);
      const listed = await refresh();
      if (!currentIdRef.current) {
        const first = imported[0] ?? listed[0];
        if (first) {
          await loadTrack(first, false);
        }
      }
      return imported;
    },
    [commitProfileStore, loadTrack, refresh],
  );

  const addRemoteLink = useCallback(
    async (value: string) => {
      const url = value.trim();
      const parsed = parseRemoteLink(url);
      if (!parsed) {
        setError("Paste a valid YouTube, Spotify, SoundCloud or TikTok link.");
        return;
      }

      setBusy(true);
      setError(null);
      try {
        if (
          parsed.providerKind === "playlist" ||
          parsed.providerKind === "album"
        ) {
          const fetchedPlaylistTracks = await fetchRemotePlaylistTracks(url, parsed);
          if (fetchedPlaylistTracks.length === 0) {
            const metadata = await fetchRemoteMetadata(url, parsed);
            const providerId = metadata.providerId ?? parsed.providerId;
            const remoteTrack: Track = {
              id: `${parsed.provider}:${providerId}`,
              title: metadata.title,
              filename: metadata.title,
              path: url,
              extension: parsed.provider,
              source: parsed.provider,
              url,
              videoId: parsed.provider === "youtube" ? providerId : undefined,
              providerId,
              providerKind: parsed.providerKind,
              thumbnail: metadata.thumbnail,
              author: metadata.author,
            };
            fetchedPlaylistTracks.push(remoteTrack);
          }

          const newTracks: Track[] = [];
          for (const track of fetchedPlaylistTracks) {
            const existing = remoteTracksRef.current.find(
              (item) => item.id === track.id || item.url === track.url,
            );
            if (!existing) {
              newTracks.push(track);
            }
          }

          if (newTracks.length > 0) {
            remoteTracksRef.current = [
              ...newTracks,
              ...remoteTracksRef.current,
            ];
            saveRemoteTracks(remoteTracksRef.current);
          }

          const allPlaylistIds = fetchedPlaylistTracks.map((t: Track) => {
            const found = remoteTracksRef.current.find(
              (item) => item.id === t.id || item.url === t.url,
            );
            return found ? found.id : t.id;
          });

          commitProfileStore(
            assignTracksToProfile(
              profileStoreRef.current,
              activeProfileIdRef.current,
              allPlaylistIds,
            ),
          );
          const listed = await refresh();
          const firstAdded = listed.find((track) => track.id === allPlaylistIds[0]);
          if (firstAdded && !currentIdRef.current) {
            await loadTrack(firstAdded, false);
          }
          return;
        }

        const existing = remoteTracksRef.current.find(
          (track) =>
            track.source === parsed.provider &&
            (track.url === url ||
              track.providerId === parsed.providerId ||
              (parsed.provider === "youtube" &&
                track.videoId === parsed.providerId)),
        );
        if (existing) {
          commitProfileStore(
            assignTracksToProfile(
              profileStoreRef.current,
              activeProfileIdRef.current,
              [existing.id],
            ),
          );
          const listed = await refresh();
          await loadTrack(
            listed.find((track) => track.id === existing.id) ?? existing,
            false,
          );
          return;
        }

        const metadata = await fetchRemoteMetadata(url, parsed);
        const providerId = metadata.providerId ?? parsed.providerId;
        const remoteTrack: Track = {
          id: `${parsed.provider}:${providerId}`,
          title: metadata.title,
          filename: metadata.title,
          path: url,
          extension: parsed.provider,
          source: parsed.provider,
          url,
          videoId:
            parsed.provider === "youtube" ? providerId : undefined,
          providerId,
          providerKind: parsed.providerKind,
          thumbnail: metadata.thumbnail,
          author: metadata.author,
        };

        remoteTracksRef.current = [
          remoteTrack,
          ...remoteTracksRef.current,
        ];
        saveRemoteTracks(remoteTracksRef.current);
        commitProfileStore(
          assignTracksToProfile(
            profileStoreRef.current,
            activeProfileIdRef.current,
            [remoteTrack.id],
          ),
        );
        const listed = await refresh();
        const added = listed.find((track) => track.id === remoteTrack.id);
        if (added) {
          await loadTrack(added, false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [commitProfileStore, loadTrack, refresh],
  );

  const importTracks = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!runningInTauri) {
        const files = await pickBrowserFiles();
        await addBrowserFiles(files);
        return;
      }

      const selected = await open({
        multiple: true,
        filters: AUDIO_FILTERS,
        title: "Import music",
      });
      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      await importManagedPaths(paths);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    addBrowserFiles,
    importManagedPaths,
    pickBrowserFiles,
    runningInTauri,
  ]);

  useEffect(() => {
    if (!runningInTauri) return;

    let active = true;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;

        setBusy(true);
        setError(null);
        void importManagedPaths(event.payload.paths)
          .catch((err) => {
            setError(err instanceof Error ? err.message : String(err));
          })
          .finally(() => setBusy(false));
      })
      .then((stopListening) => {
        if (active) {
          unlisten = stopListening;
        } else {
          stopListening();
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [importManagedPaths, runningInTauri]);

  const importDroppedFiles = useCallback(
    async (files: File[]) => {
      if (runningInTauri) {
        const paths = files
          .map((file) => (file as File & { path?: string }).path)
          .filter((path): path is string => Boolean(path));
        if (paths.length > 0) {
          setBusy(true);
          setError(null);
          try {
            await importManagedPaths(paths);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await addBrowserFiles(files);
      } finally {
        setBusy(false);
      }
    },
    [addBrowserFiles, importManagedPaths, runningInTauri],
  );

  const removeTrack = useCallback(
    async (track: Track) => {
      setBusy(true);
      setError(null);
      const wasCurrent = track.id === currentIdRef.current;
      const profileId = activeProfileIdRef.current;
      let storageChanged = false;
      let membershipChanged = false;

      const detachCurrent = () => {
        if (!wasCurrent) return;
        audioRef.current?.pause();
        setPlayingState(false);
        setSessionActive(false);
        audioRef.current?.removeAttribute("src");
        audioRef.current?.load();
      };

      const selectReplacement = async () => {
        if (!wasCurrent) return;
        const nextTrack = getPlaybackTracks()[0];
        if (nextTrack) {
          await loadTrack(nextTrack, false);
          return;
        }

        currentIdRef.current = null;
        setCurrentTrackId(null);
        audioRef.current?.removeAttribute("src");
        audioRef.current?.load();
        setProgress(0);
        setDuration(0);
        lastRenderedProgressRef.current = 0;
      };

      try {
        // Release the active media source before deleting a file. Windows can
        // otherwise keep the file locked while the Tauri command runs.
        detachCurrent();

        const profileAfterRemoval = removeTracksFromProfile(
          profileStoreRef.current,
          profileId,
          [track.id],
        );
        const removeFromStorage = !isTrackSharedWithAnotherProfile(
          profileAfterRemoval,
          profileId,
          track.id,
        );
        const nextProfileStore = removeFromStorage
          ? removeTracksFromProfiles(profileAfterRemoval, [track.id])
          : profileAfterRemoval;

        if (isRemoteTrack(track)) {
          if (removeFromStorage) {
            const nextRemoteTracks = remoteTracksRef.current.filter(
              (item) => item.id !== track.id,
            );
            saveRemoteTracks(nextRemoteTracks);
            remoteTracksRef.current = nextRemoteTracks;
            storageChanged = true;
          }
          commitProfileStore(nextProfileStore);
          membershipChanged = true;
          await refresh();
          await selectReplacement();
          return;
        }

        if (!runningInTauri && track.source === "browser") {
          const browserListed = removeFromStorage
            ? browserTracksRef.current.filter((item) => item.id !== track.id)
            : browserTracksRef.current;
          if (removeFromStorage) URL.revokeObjectURL(track.path);
          const listed = [...browserListed, ...remoteTracksRef.current];
          browserTracksRef.current = browserListed;
          storageChanged = removeFromStorage;
          commitProfileStore(nextProfileStore);
          membershipChanged = true;
          const visible = filterTracksForProfile(listed);
          tracksRef.current = visible;
          setTracks(visible);
          await selectReplacement();
          return;
        }

        if (removeFromStorage) {
          await invoke("delete_track", { path: track.path });
          storageChanged = true;
        }
        commitProfileStore(nextProfileStore);
        membershipChanged = true;
        await refresh();
        await selectReplacement();
      } catch (err) {
        if (wasCurrent && !storageChanged && !membershipChanged) {
          await loadTrack(track, false).catch(() => undefined);
        }
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [
      commitProfileStore,
      filterTracksForProfile,
      getPlaybackTracks,
      loadTrack,
      refresh,
      runningInTauri,
      setPlayingState,
      setSessionActive,
    ],
  );

  const openMusicFolder = useCallback(async () => {
    try {
      if (!runningInTauri) {
        setBusy(true);
        setError(null);
        const files = await pickBrowserFiles(true);
        await addBrowserFiles(files);
        return;
      }

      await invoke("open_music_dir");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!runningInTauri) {
        setBusy(false);
      }
    }
  }, [addBrowserFiles, pickBrowserFiles, runningInTauri]);

  const switchProfile = useCallback(
    async (profileId: string) => {
      const profile = profileStoreRef.current.profiles.find(
        (item) => item.id === profileId,
      );
      if (!profile || profile.id === activeProfileIdRef.current) {
        setProfilePickerOpen(false);
        return;
      }

      const requestId = profileSwitchRequestRef.current + 1;
      profileSwitchRequestRef.current = requestId;
      const previousTrackId = currentIdRef.current;
      setBusy(true);
      setError(null);
      audioRef.current?.pause();
      setPlayingState(false);
      setSessionActive(false);
      playbackQueueRef.current = { kind: "all" };
      setPlaybackQueueState({ kind: "all" });
      setProfilePickerOpen(false);

      try {
        commitProfileStore(
          setActiveProfile(profileStoreRef.current, profile.id),
        );
        const listed = await refresh();
        if (requestId !== profileSwitchRequestRef.current) return;

        if (previousTrackId && listed.some((track) => track.id === previousTrackId)) {
          return;
        }

        currentIdRef.current = null;
        setCurrentTrackId(null);
        setProgress(0);
        setDuration(0);
        audioRef.current?.removeAttribute("src");
      } catch (err) {
        if (requestId === profileSwitchRequestRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (requestId === profileSwitchRequestRef.current) {
          setBusy(false);
        }
      }
    },
    [commitProfileStore, refresh, setPlayingState, setSessionActive],
  );

  const createProfile = useCallback(
    async (name: string) => {
      const result = addCustomProfile(profileStoreRef.current, name);
      if (!result.profile) return false;
      commitProfileStore(result.store);
      await switchProfile(result.profile.id);
      return true;
    },
    [commitProfileStore, switchProfile],
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      const wasActive = profileStoreRef.current.activeProfileId === profileId;
      const next = deleteCustomProfile(profileStoreRef.current, profileId);
      if (next === profileStoreRef.current) return;
      if (wasActive) {
        await switchProfile("deep-work");
        commitProfileStore(
          deleteCustomProfile(profileStoreRef.current, profileId),
        );
        return;
      }
      commitProfileStore(next);
    },
    [commitProfileStore, switchProfile],
  );

  const resetSession = useCallback(() => {
    resetTimerClock(timerClockRef.current);
    setElapsed(0);
    setSessionActive(false);
    resetPhaseCueBaseline(timerSettingsRef.current, 0);
    const settings = timerSettingsRef.current;
    if (settings.miniGoals.some((miniGoal) => miniGoal.completed)) {
      const resetSettings = {
        ...settings,
        miniGoals: resetMiniGoalProgress(settings.miniGoals),
      };
      timerSettingsRef.current = resetSettings;
      setTimerSettings(resetSettings);
    }
  }, [resetPhaseCueBaseline, setSessionActive]);

  const updateTimerSettings = useCallback((next: TimerSettings) => {
    const normalized = normalizeTimerSettings(next);
    const previous = timerSettingsRef.current;
    const timerDefinitionChanged =
      previous.kind !== normalized.kind ||
      previous.durationMinutes !== normalized.durationMinutes ||
      previous.workDurationMinutes !== normalized.workDurationMinutes ||
      previous.breakDurationMinutes !== normalized.breakDurationMinutes;
    const nextSettings =
      timerDefinitionChanged || previous.goal !== normalized.goal
        ? {
            ...normalized,
            miniGoals: resetMiniGoalProgress(normalized.miniGoals),
          }
        : normalized;
    timerSettingsRef.current = nextSettings;
    setTimerSettings(nextSettings);

    if (timerDefinitionChanged) {
      resetTimerClock(timerClockRef.current);
      setElapsed(0);
      resetPhaseCueBaseline(nextSettings, 0);
      setSessionActive(sessionStartedRef.current || playingRef.current);
    }
  }, [resetPhaseCueBaseline, setSessionActive]);

  const timerLabel = formatTimerLabel(elapsed, timerSettings);

  useEffect(() => {
    document.title = `${timerLabel} · FocusFlow`;
  }, [timerLabel]);

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
    [todayStats.focusTimeSeconds, todayStats.sessionsCount, streakDays],
  );

  const currentPhase: TimerPhase = useMemo(() => {
    if (timerSettings.kind === "intervals") {
      return getIntervalPhase(elapsed * 1000, timerSettings).phase;
    }
    return "work";
  }, [elapsed, timerSettings]);

  const setLibraryOpenSafe = useCallback((open: boolean) => {
    setLibraryOpen(open);
    if (open) {
      setProfilePickerOpen(false);
      setTimerSettingsOpen(false);
    }
  }, []);

  const setProfilePickerOpenSafe = useCallback((open: boolean) => {
    setProfilePickerOpen(open);
    if (open) {
      setLibraryOpen(false);
      setTimerSettingsOpen(false);
    }
  }, []);

  const setTimerSettingsOpenSafe = useCallback((open: boolean) => {
    setTimerSettingsOpen(open);
    if (open) {
      setLibraryOpen(false);
      setProfilePickerOpen(false);
    }
  }, []);

  return {
    tracks,
    musicDir,
    currentTrack,
    profiles: profileStore.profiles,
    activeProfileId: profileStore.activeProfileId,
    analyticsSummary,
    analyticsStore,
    profilePickerOpen,
    favoriteTrackIds,
    currentTrackId,
    isPlaying,
    volume: Math.min(1, Math.max(0, volume * duckingMultiplier)),
    progress,
    duration,
    elapsed,
    currentPhase,
    timerLabel,
    mode,
    timerSettings,
    timerSettingsOpen,
    libraryOpen,
    busy,
    error,
    ready,
    browserMode: !runningInTauri,
    setLibraryOpen: setLibraryOpenSafe,
    setProfilePickerOpen: setProfilePickerOpenSafe,
    switchProfile,
    createProfile,
    deleteProfile,
    setError,
    refresh,
    importTracks,
    addRemoteLink,
    importDroppedFiles,
    removeTrack,
    openMusicFolder,
    selectTrack,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleFavorite,
    playQueue,
    favoritesOnly,
    setFavoritesOnly: setFavoritesQueue,
    remoteSeekRequest,
    onRemoteTime,
    onRemoteDuration,
    onRemotePlaying,
    onRemoteEnded,
    onRemoteError,
    resetSession,
    updateTimerSettings,
    setTimerSettingsOpen: setTimerSettingsOpenSafe,
  };
}

function profileStoresEqual(left: ProfileStore, right: ProfileStore): boolean {
  if (
    left.activeProfileId !== right.activeProfileId ||
    left.migrationComplete !== right.migrationComplete ||
    left.profiles.length !== right.profiles.length
  ) {
    return false;
  }

  for (let index = 0; index < left.profiles.length; index += 1) {
    const a = left.profiles[index];
    const b = right.profiles[index];
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.kind !== b.kind ||
      a.theme !== b.theme
    ) {
      return false;
    }
  }

  return profileMapsEqual(left.trackIdsByProfile, right.trackIdsByProfile)
    && profileMapsEqual(
      left.favoriteIdsByProfile,
      right.favoriteIdsByProfile,
    );
}

function profileMapsEqual(
  left: Record<string, string[]>,
  right: Record<string, string[]>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    if (!(key in right)) return false;
    const leftValues = left[key] ?? [];
    const rightValues = right[key] ?? [];
    return (
      leftValues.length === rightValues.length &&
      leftValues.every((value, index) => value === rightValues[index])
    );
  });
}
