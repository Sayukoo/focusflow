import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchYouTubeMetadata,
  formatTimerLabel,
  findTrackIndex,
  isSupportedAudioFile,
  isTauriRuntime,
  loadFavoriteTrackIds,
  loadPlayerSnapshot,
  loadYouTubeTracks,
  nextTrackIndex,
  parseYouTubeVideoId,
  previousTrackIndex,
  savePlayerSnapshot,
  saveFavoriteTrackIds,
  saveYouTubeTracks,
  sanitizeTitle,
  uniqueFilename,
} from "../lib/audio";
import {
  DEFAULT_TIMER_SETTINGS,
  type FocusMode,
  type TimerKind,
  type TimerSettings,
  type Track,
} from "../types";

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
  const youtubeTracksRef = useRef<Track[]>(loadYouTubeTracks());
  const currentIdRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const timerSettingsRef = useRef<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const loadRequestRef = useRef(0);
  const lastRenderedProgressRef = useRef(0);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [musicDir, setMusicDir] = useState("");
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.72);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [youtubeSeekRequest, setYoutubeSeekRequest] = useState<{
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState<string[]>(loadFavoriteTrackIds);
  const [ready, setReady] = useState(false);
  const runningInTauri = useMemo(() => isTauriRuntime(), []);

  const currentIndex = useMemo(
    () => findTrackIndex(tracks, currentTrackId),
    [tracks, currentTrackId],
  );
  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;

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
    timerSettingsRef.current = timerSettings;
  }, [timerSettings]);

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

    if (track.source === "youtube") {
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
      if (autoplay) {
        setIsPlaying(true);
        setSessionStarted(true);
      }
      return;
    }

    setIsPlaying(false);
    audio.src =
      runningInTauri && track.source !== "browser"
        ? convertFileSrc(track.path)
        : track.path;
    audio.load();

    if (autoplay) {
      try {
        if (requestId !== loadRequestRef.current) return;
        await audio.play();
        setSessionStarted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [runningInTauri]);

  const refresh = useCallback(async () => {
    if (!runningInTauri) {
      const listed = [...browserTracksRef.current, ...youtubeTracksRef.current];
      setMusicDir("Browser preview · selected files");
      setTracks(listed);
      tracksRef.current = listed;
      return listed;
    }

    const [dir, localTracks] = await Promise.all([
      invoke<string>("get_music_dir"),
      invoke<Track[]>("list_tracks"),
    ]);
    const listed = [...localTracks, ...youtubeTracksRef.current];
    setMusicDir(dir);
    setTracks(listed);
    tracksRef.current = listed;
    return listed;
  }, [runningInTauri]);

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
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const list = tracksRef.current;
      const index = findTrackIndex(list, currentIdRef.current);
      const next = nextTrackIndex(index, list.length);
      if (next >= 0) {
        void loadTrack(list[next], true);
      } else {
        setIsPlaying(false);
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
    if (snapshot.mode === "deep" || snapshot.mode === "flow" || snapshot.mode === "calm") {
      setMode(snapshot.mode);
    }
    if (isTimerSettings(snapshot.timerSettings)) {
      setTimerSettings(snapshot.timerSettings);
    } else if (snapshot.durationPreset === "infinity") {
      setTimerSettings({
        ...DEFAULT_TIMER_SETTINGS,
        kind: "infinite",
        durationMinutes: null,
      });
    } else if (typeof snapshot.durationPreset === "number") {
      setTimerSettings({
        ...DEFAULT_TIMER_SETTINGS,
        durationMinutes: snapshot.durationPreset,
      });
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
  }, [loadTrack, refresh, runningInTauri]);

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
              timerSettings.durationMinutes === 45 ||
              timerSettings.durationMinutes === 60
            ? timerSettings.durationMinutes
            : 60,
      timerSettings,
    });
  }, [ready, currentTrackId, volume, mode, timerSettings]);

  useEffect(() => {
    saveFavoriteTrackIds(favoriteTrackIds);
  }, [favoriteTrackIds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const shouldAdvance =
      sessionStarted && (!timerSettings.pauseWhenMusicPaused || isPlaying);
    if (!shouldAdvance) return;

    const timer = window.setInterval(() => {
      setElapsed((value) => {
        if (
          timerSettings.kind !== "infinite" &&
          timerSettings.durationMinutes !== null &&
          value + 1 >= timerSettings.durationMinutes * 60
        ) {
          audioRef.current?.pause();
          setIsPlaying(false);
          setSessionStarted(false);
          return timerSettings.durationMinutes * 60;
        }
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, sessionStarted, timerSettings]);

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
      if (tracksRef.current.length === 0) {
        setLibraryOpen(true);
        setError("Add music to begin.");
        return;
      }
      await loadTrack(tracksRef.current[0], true);
      return;
    }

    if (activeTrack?.source === "youtube") {
      if (playingRef.current) {
        setIsPlaying(false);
        return;
      }

      if (
        timerSettings.kind !== "infinite" &&
        timerSettings.durationMinutes !== null &&
        elapsed >= timerSettings.durationMinutes * 60
      ) {
        setElapsed(0);
      }
      setIsPlaying(true);
      setSessionStarted(true);
      return;
    }

    if (audio.paused) {
      try {
        if (
          timerSettings.kind !== "infinite" &&
          timerSettings.durationMinutes !== null &&
          elapsed >= timerSettings.durationMinutes * 60
        ) {
          setElapsed(0);
        }
        await audio.play();
        setSessionStarted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } else {
      audio.pause();
    }
  }, [elapsed, loadTrack, timerSettings]);

  const playNext = useCallback(async (forceAutoplay = false) => {
    const list = tracksRef.current;
    const index = findTrackIndex(list, currentIdRef.current);
    const next = nextTrackIndex(index, list.length);
    if (next >= 0) {
      await loadTrack(
        list[next],
        forceAutoplay || playingRef.current || index < 0,
      );
    }
  }, [loadTrack]);

  const onYoutubeTime = useCallback((value: number) => {
    setProgress(value);
  }, []);

  const onYoutubeDuration = useCallback((value: number) => {
    setDuration(value);
  }, []);

  const onYoutubePlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (playing) setSessionStarted(true);
  }, []);

  const onYoutubeEnded = useCallback(() => {
    void playNext(true);
  }, [playNext]);

  const onYoutubeError = useCallback((message: string) => {
    setError(message);
    setIsPlaying(false);
  }, []);

  const playPrevious = useCallback(async () => {
    const audio = audioRef.current;
    const activeTrack = tracksRef.current.find(
      (track) => track.id === currentIdRef.current,
    );
    if (activeTrack?.source === "youtube" && progress > 3) {
      setYoutubeSeekRequest({
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
    const list = tracksRef.current;
    const index = findTrackIndex(list, currentIdRef.current);
    const prev = previousTrackIndex(index, list.length);
    if (prev >= 0) {
      await loadTrack(list[prev], playingRef.current);
    }
  }, [loadTrack, progress]);

  const seek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!Number.isFinite(value)) return;

    const activeTrack = tracksRef.current.find(
      (track) => track.id === currentIdRef.current,
    );
    if (activeTrack?.source === "youtube") {
      setYoutubeSeekRequest({
        value,
        token: Date.now() + Math.random(),
      });
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
    setFavoriteTrackIds((current) =>
      current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId],
    );
  }, []);

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
      const next = [...nextBrowserTracks, ...youtubeTracksRef.current];
      browserTracksRef.current = nextBrowserTracks;
      tracksRef.current = next;
      setTracks(next);
      setMusicDir("Browser preview · selected files");

      if (!currentIdRef.current && imported[0]) {
        await loadTrack(imported[0], false);
      }

      return imported;
    },
    [loadTrack],
  );

  const importManagedPaths = useCallback(
    async (paths: string[]) => {
      const imported = await invoke<Track[]>("import_tracks", { paths });
      const listed = await refresh();
      if (!currentIdRef.current) {
        const first = imported[0] ?? listed[0];
        if (first) {
          await loadTrack(first, false);
        }
      }
      return imported;
    },
    [loadTrack, refresh],
  );

  const addYouTubeLink = useCallback(
    async (value: string) => {
      const url = value.trim();
      const videoId = parseYouTubeVideoId(url);
      if (!videoId) {
        setError("Paste a valid YouTube video link.");
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const existing = youtubeTracksRef.current.find(
          (track) => track.videoId === videoId,
        );
        if (existing) {
          await loadTrack(existing, false);
          return;
        }

        const metadata = await fetchYouTubeMetadata(url, videoId);
        const remoteTrack: Track = {
          id: `youtube:${videoId}`,
          title: metadata.title,
          filename: metadata.title,
          path: url,
          extension: "youtube",
          source: "youtube",
          url,
          videoId,
          thumbnail: metadata.thumbnail,
          author: metadata.author,
        };

        youtubeTracksRef.current = [
          remoteTrack,
          ...youtubeTracksRef.current,
        ];
        saveYouTubeTracks(youtubeTracksRef.current);
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
    [loadTrack, refresh],
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
      try {
        const wasCurrent = track.id === currentIdRef.current;
        if (track.source === "youtube") {
          youtubeTracksRef.current = youtubeTracksRef.current.filter(
            (item) => item.id !== track.id,
          );
          saveYouTubeTracks(youtubeTracksRef.current);
          const listed = await refresh();

          if (wasCurrent) {
            audioRef.current?.pause();
            setIsPlaying(false);
            setSessionStarted(false);
            if (listed[0]) {
              await loadTrack(listed[0], false);
            } else {
              currentIdRef.current = null;
              setCurrentTrackId(null);
              setProgress(0);
              setDuration(0);
            }
          }
          return;
        }

        if (!runningInTauri && track.source === "browser") {
          URL.revokeObjectURL(track.path);
          const browserListed = browserTracksRef.current.filter(
            (item) => item.id !== track.id,
          );
          const listed = [...browserListed, ...youtubeTracksRef.current];
          browserTracksRef.current = browserListed;
          tracksRef.current = listed;
          setTracks(listed);

          if (wasCurrent) {
            audioRef.current?.pause();
            setSessionStarted(false);
            if (listed[0]) {
              await loadTrack(listed[0], false);
            } else {
              currentIdRef.current = null;
              setCurrentTrackId(null);
              audioRef.current?.removeAttribute("src");
              setProgress(0);
              setDuration(0);
            }
          }
          return;
        }

        await invoke("delete_track", { path: track.path });
        const listed = await refresh();
        if (wasCurrent) {
          audioRef.current?.pause();
          setSessionStarted(false);
          if (listed[0]) {
            await loadTrack(listed[0], false);
          } else {
            currentIdRef.current = null;
            setCurrentTrackId(null);
            if (audioRef.current) {
              audioRef.current.removeAttribute("src");
            }
            setProgress(0);
            setDuration(0);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [loadTrack, refresh, runningInTauri],
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

  const resetSession = useCallback(() => {
    setElapsed(0);
    setSessionStarted(false);
  }, []);

  const cycleMode = useCallback(() => {
    setMode((current) => {
      if (current === "deep") return "flow";
      if (current === "flow") return "calm";
      return "deep";
    });
  }, []);

  const updateTimerSettings = useCallback((next: TimerSettings) => {
    const durationMinutes =
      next.kind === "infinite"
        ? null
        : Math.min(
            24 * 60,
            Math.max(
              1,
              Math.round(
                next.durationMinutes ??
                  (next.kind === "intervals" ? 25 : DEFAULT_TIMER_SETTINGS.durationMinutes!),
              ),
            ),
          );

    const normalized = { ...next, durationMinutes };
    const previous = timerSettingsRef.current;
    timerSettingsRef.current = normalized;
    setTimerSettings(normalized);

    if (
      previous.kind !== normalized.kind ||
      previous.durationMinutes !== normalized.durationMinutes
    ) {
      setElapsed(0);
      setSessionStarted(false);
    }
  }, []);

  return {
    tracks,
    musicDir,
    currentTrack,
    favoriteTrackIds,
    currentTrackId,
    isPlaying,
    volume,
    progress,
    duration,
    elapsed,
    timerLabel: formatTimerLabel(elapsed, timerSettings),
    mode,
    timerSettings,
    timerSettingsOpen,
    libraryOpen,
    busy,
    error,
    ready,
    setLibraryOpen,
    setError,
    refresh,
    importTracks,
    addYouTubeLink,
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
    youtubeSeekRequest,
    onYoutubeTime,
    onYoutubeDuration,
    onYoutubePlaying,
    onYoutubeEnded,
    onYoutubeError,
    resetSession,
    cycleMode,
    updateTimerSettings,
    setTimerSettingsOpen,
  };
}

function isTimerSettings(value: unknown): value is TimerSettings {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<TimerSettings>;
  const validKind: TimerKind =
    candidate.kind === "infinite" ||
    candidate.kind === "timer" ||
    candidate.kind === "intervals"
      ? candidate.kind
      : "timer";

  return (
    validKind === candidate.kind &&
    typeof candidate.pauseWhenMusicPaused === "boolean" &&
    (candidate.durationMinutes === null ||
      (typeof candidate.durationMinutes === "number" &&
        Number.isFinite(candidate.durationMinutes) &&
        candidate.durationMinutes > 0))
  );
}
