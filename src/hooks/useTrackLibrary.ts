import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  fetchRemoteMetadata,
  fetchRemotePlaylistTracks,
  hydrateYouTubeThumbnails,
  isSupportedAudioFile,
  isTauriRuntime,
  loadRemoteTracks,
  parseRemoteLink,
  sanitizeTitle,
  saveRemoteTracks,
  uniqueFilename,
} from "../lib/audio";
import { DEFAULT_PHONK_TRACK_IDS } from "../lib/defaultTracks";
import {
  assignTracksToProfile,
  getProfileTrackIds,
  isTrackSharedWithAnotherProfile,
  reconcileProfileTracks,
  removeTracksFromProfile,
  removeTracksFromProfiles,
  type ProfileStore,
} from "../lib/profiles";
import type { Track } from "../types";

// Phonk starter tracks default into the Energizing profile instead of
// whichever profile happens to be active when the library first loads.
const DEFAULT_PROFILE_BY_TRACK_ID: Record<string, string> = Object.fromEntries(
  DEFAULT_PHONK_TRACK_IDS.map((trackId) => [trackId, "energizing"]),
);

const AUDIO_FILTERS = [
  {
    name: "Audio",
    extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"],
  },
];

interface UseTrackLibraryOptions {
  profileStoreRef: React.MutableRefObject<ProfileStore>;
  activeProfileIdRef: React.MutableRefObject<string>;
  commitProfileStore: (next: ProfileStore) => void;
  loadTrack: (track: Track, autoplay: boolean) => Promise<void>;
  currentIdRef: React.MutableRefObject<string | null>;
}

export function useTrackLibrary({
  profileStoreRef,
  activeProfileIdRef,
  commitProfileStore,
  loadTrack,
  currentIdRef,
}: UseTrackLibraryOptions) {
  const tracksRef = useRef<Track[]>([]);
  const browserTracksRef = useRef<Track[]>([]);
  const remoteTracksRef = useRef<Track[]>(loadRemoteTracks());

  const [tracks, setTracks] = useState<Track[]>([]);
  const [musicDir, setMusicDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runningInTauri = useMemo(() => isTauriRuntime(), []);

  const filterTracksForProfile = useCallback(
    (allTracks: Track[], profileId = activeProfileIdRef.current) => {
      const profileTrackIds = new Set(
        getProfileTrackIds(profileStoreRef.current, profileId),
      );
      return allTracks.filter((track) => profileTrackIds.has(track.id));
    },
    [activeProfileIdRef, profileStoreRef],
  );

  // OFFLINE MODE: download missing YouTube thumbnails as compact data URLs
  // (bounded concurrency) so the library renders fully without network.
  // Runs in the background; re-renders only tracks that gained a thumbnail.
  const hydrateRemoteThumbnails = useCallback(async () => {
    const next = await hydrateYouTubeThumbnails(remoteTracksRef.current);
    if (!next) return;
    remoteTracksRef.current = next;
    saveRemoteTracks(next);
    const locals = runningInTauri
      ? await invoke<Track[]>("list_tracks").catch(() => [] as Track[])
      : browserTracksRef.current;
    const listed = filterTracksForProfile([...locals, ...next]);
    tracksRef.current = listed;
    setTracks(listed);
  }, [filterTracksForProfile, runningInTauri]);

  const refresh = useCallback(async () => {
    if (!runningInTauri) {
      const allTracks = [
        ...browserTracksRef.current,
        ...remoteTracksRef.current,
      ];
      const nextProfileStore = reconcileProfileTracks(
        profileStoreRef.current,
        allTracks.map((track) => track.id),
        DEFAULT_PROFILE_BY_TRACK_ID,
      );
      commitProfileStore(nextProfileStore);
      const listed = filterTracksForProfile(allTracks);
      setMusicDir("Browser preview · selected files");
      setTracks(listed);
      tracksRef.current = listed;
      void hydrateRemoteThumbnails();
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
      DEFAULT_PROFILE_BY_TRACK_ID,
    );
    commitProfileStore(nextProfileStore);
    const listed = filterTracksForProfile(allTracks);
    setMusicDir(dir);
    setTracks(listed);
    tracksRef.current = listed;
    void hydrateRemoteThumbnails();
    return listed;
  }, [
    commitProfileStore,
    filterTracksForProfile,
    hydrateRemoteThumbnails,
    profileStoreRef,
    runningInTauri,
  ]);

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
    [
      activeProfileIdRef,
      commitProfileStore,
      currentIdRef,
      filterTracksForProfile,
      loadTrack,
      profileStoreRef,
    ],
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
    [activeProfileIdRef, commitProfileStore, currentIdRef, loadTrack, profileStoreRef, refresh],
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
          videoId: parsed.provider === "youtube" ? providerId : undefined,
          providerId,
          providerKind: parsed.providerKind,
          thumbnail: metadata.thumbnail,
          author: metadata.author,
        };

        remoteTracksRef.current = [remoteTrack, ...remoteTracksRef.current];
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
    [activeProfileIdRef, commitProfileStore, currentIdRef, loadTrack, profileStoreRef, refresh],
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
  }, [addBrowserFiles, importManagedPaths, pickBrowserFiles, runningInTauri]);

  const dropFiles = useCallback(
    async (files: File[]) => {
      setBusy(true);
      setError(null);
      try {
        if (!runningInTauri) {
          await addBrowserFiles(files);
          return;
        }

        const rawPaths = files
          .map((file) => ("path" in file && typeof file.path === "string" ? file.path : ""))
          .filter(Boolean);

        if (rawPaths.length > 0) {
          await importManagedPaths(rawPaths);
          return;
        }

        await addBrowserFiles(files);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [addBrowserFiles, importManagedPaths, runningInTauri],
  );

  const openMusicFolder = useCallback(async () => {
    if (!runningInTauri) return;
    setBusy(true);
    setError(null);
    try {
      await invoke("open_music_dir");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [runningInTauri]);

  const removeTrack = useCallback(
    async (track: Track) => {
      setBusy(true);
      setError(null);
      try {
        const currentProfileId = activeProfileIdRef.current;
        const sharedWithOtherProfile = isTrackSharedWithAnotherProfile(
          profileStoreRef.current,
          currentProfileId,
          track.id,
        );

        if (track.source === "browser") {
          browserTracksRef.current = browserTracksRef.current.filter(
            (item) => item.id !== track.id,
          );
        } else if (track.source !== "managed") {
          if (!sharedWithOtherProfile) {
            remoteTracksRef.current = remoteTracksRef.current.filter(
              (item) => item.id !== track.id,
            );
            saveRemoteTracks(remoteTracksRef.current);
          }
        } else if (runningInTauri && !sharedWithOtherProfile) {
          await invoke("delete_track", { trackId: track.id });
        }

        const nextStore = sharedWithOtherProfile
          ? removeTracksFromProfile(profileStoreRef.current, currentProfileId, [track.id])
          : removeTracksFromProfiles(profileStoreRef.current, [track.id]);

        commitProfileStore(nextStore);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [activeProfileIdRef, commitProfileStore, profileStoreRef, refresh, runningInTauri],
  );

  return {
    tracks,
    setTracks,
    tracksRef,
    browserTracksRef,
    remoteTracksRef,
    musicDir,
    setMusicDir,
    busy,
    setBusy,
    error,
    setError,
    runningInTauri,
    filterTracksForProfile,
    refresh,
    importTracks,
    addRemoteLink,
    dropFiles,
    openMusicFolder,
    removeTrack,
  };
}
