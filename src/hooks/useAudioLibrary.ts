import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchRemoteMetadata,
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
  DEFAULT_TIMER_SETTINGS,
  type FocusMode,
  type TimerKind,
  type TimerSettings,
  type Track,
} from "../types";
import {
  addCustomProfile,
  assignTracksToProfile,
  deleteCustomProfile,
  getProfileFavoriteIds,
  getProfileTrackIds,
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
  const favoritesOnlyRef = useRef(false);
  const favoriteTrackIdsRef = useRef<string[]>(
    getProfileFavoriteIds(profileStore),
  );
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
  const [favoritesOnly, setFavoritesOnlyState] = useState(false);
  const [ready, setReady] = useState(false);
  const runningInTauri = useMemo(() => isTauriRuntime(), []);

  const commitProfileStore = useCallback((next: ProfileStore) => {
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
  const getPlaybackTracks = useCallback(() => {
    if (!favoritesOnlyRef.current) return tracksRef.current;
    return tracksRef.current.filter((track) =>
      favoriteTrackIdsRef.current.includes(track.id),
    );
  }, []);

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
    favoritesOnlyRef.current = favoritesOnly;
  }, [favoritesOnly]);

  useEffect(() => {
    timerSettingsRef.current = timerSettings;
  }, [timerSettings]);

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
      setIsPlaying(false);
      if (autoplay) {
        setIsPlaying(true);
        setSessionStarted(true);
      }
      return;
    }

    playingRef.current = false;
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
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const list = getPlaybackTracks();
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
  }, [getPlaybackTracks, loadTrack, refresh, runningInTauri]);

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
      const queue = getPlaybackTracks();
      if (queue.length === 0) {
        setLibraryOpen(true);
        setError(
          favoritesOnlyRef.current
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
        playingRef.current = false;
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
      playingRef.current = true;
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
  }, [elapsed, getPlaybackTracks, loadTrack, timerSettings]);

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
    playingRef.current = playing;
    setIsPlaying(playing);
    if (playing) setSessionStarted(true);
  }, []);

  const onRemoteEnded = useCallback(() => {
    void playNext(true);
  }, [playNext]);

  const onRemoteError = useCallback((message: string) => {
    setError(message);
    playingRef.current = false;
    setIsPlaying(false);
  }, []);

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

  const setFavoritesQueue = useCallback((enabled: boolean) => {
    favoritesOnlyRef.current = enabled;
    setFavoritesOnlyState(enabled);
    if (!enabled) return;

    const firstFavorite = tracksRef.current.find((track) =>
      favoriteTrackIdsRef.current.includes(track.id),
    );
    if (!firstFavorite) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setSessionStarted(false);
      setError("Favorite a track to build this queue.");
      return;
    }

    const current = tracksRef.current.find(
      (track) => track.id === currentIdRef.current,
    );
    if (!current || !favoriteTrackIdsRef.current.includes(current.id)) {
      void loadTrack(firstFavorite, playingRef.current);
    }
  }, [loadTrack]);

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
      try {
        const wasCurrent = track.id === currentIdRef.current;
        const profileAfterRemoval = removeTracksFromProfile(
          profileStoreRef.current,
          activeProfileIdRef.current,
          [track.id],
        );
        const sharedWithAnotherProfile = Object.entries(
          profileAfterRemoval.trackIdsByProfile,
        ).some(
          ([profileId, ids]) =>
            profileId !== activeProfileIdRef.current && ids.includes(track.id),
        );
        const removeFromStorage = !sharedWithAnotherProfile;
        const clearCurrent = async () => {
          if (!wasCurrent) return;
          audioRef.current?.pause();
          playingRef.current = false;
          setIsPlaying(false);
          setSessionStarted(false);
          const nextTrack = getPlaybackTracks()[0];
          if (nextTrack) {
            await loadTrack(nextTrack, false);
          } else {
            currentIdRef.current = null;
            setCurrentTrackId(null);
            if (!isRemoteTrack(track)) {
              audioRef.current?.removeAttribute("src");
            }
            setProgress(0);
            setDuration(0);
          }
        };

        if (isRemoteTrack(track)) {
          if (removeFromStorage) {
            remoteTracksRef.current = remoteTracksRef.current.filter(
              (item) => item.id !== track.id,
            );
            saveRemoteTracks(remoteTracksRef.current);
          }
          commitProfileStore(
            removeFromStorage
              ? removeTracksFromProfiles(profileAfterRemoval, [track.id])
              : profileAfterRemoval,
          );
          await refresh();
          await clearCurrent();
          return;
        }

        if (!runningInTauri && track.source === "browser") {
          const browserListed = removeFromStorage
            ? browserTracksRef.current.filter((item) => item.id !== track.id)
            : browserTracksRef.current;
          if (removeFromStorage) URL.revokeObjectURL(track.path);
          const listed = [...browserListed, ...remoteTracksRef.current];
          browserTracksRef.current = browserListed;
          commitProfileStore(
            removeFromStorage
              ? removeTracksFromProfiles(profileAfterRemoval, [track.id])
              : profileAfterRemoval,
          );
          const visible = filterTracksForProfile(listed);
          tracksRef.current = visible;
          setTracks(visible);
          await clearCurrent();
          return;
        }

        if (removeFromStorage) {
          await invoke("delete_track", { path: track.path });
        }
        commitProfileStore(
          removeFromStorage
            ? removeTracksFromProfiles(profileAfterRemoval, [track.id])
            : profileAfterRemoval,
        );
        await refresh();
        await clearCurrent();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [commitProfileStore, filterTracksForProfile, loadTrack, refresh, runningInTauri],
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

      audioRef.current?.pause();
      playingRef.current = false;
      currentIdRef.current = null;
      setCurrentTrackId(null);
      setIsPlaying(false);
      setSessionStarted(false);
      setProgress(0);
      setDuration(0);
      audioRef.current?.removeAttribute("src");
      audioRef.current?.load();
      favoritesOnlyRef.current = false;
      setFavoritesOnlyState(false);
      setProfilePickerOpen(false);

      commitProfileStore(
        setActiveProfile(profileStoreRef.current, profile.id),
      );
      setMode(profile.theme);
      const listed = await refresh();
      if (listed[0]) {
        await loadTrack(listed[0], false);
      }
    },
    [commitProfileStore, loadTrack, refresh],
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
    setElapsed(0);
    setSessionStarted(false);
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
      setSessionStarted((started) => started || playingRef.current);
    }
  }, []);

  const timerLabel = formatTimerLabel(elapsed, timerSettings);

  useEffect(() => {
    document.title = `${timerLabel} · FocusFlow`;
  }, [timerLabel]);

  return {
    tracks,
    musicDir,
    currentTrack,
    profiles: profileStore.profiles,
    activeProfileId: profileStore.activeProfileId,
    profilePickerOpen,
    favoriteTrackIds,
    currentTrackId,
    isPlaying,
    volume,
    progress,
    duration,
    elapsed,
    timerLabel,
    mode,
    timerSettings,
    timerSettingsOpen,
    libraryOpen,
    busy,
    error,
    ready,
    setLibraryOpen,
    setProfilePickerOpen,
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
