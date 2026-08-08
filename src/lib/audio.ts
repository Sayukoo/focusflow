import type {
  DurationPreset,
  RemoteProvider,
  TimerSettings,
  Track,
} from "../types";
import { getIntervalPhase } from "./timer";

const REMOTE_LIBRARY_KEY = "focusflow.remote-library";
const LEGACY_YOUTUBE_LIBRARY_KEY = "focusflow.youtube-library";
const FAVORITES_KEY = "focusflow.favorites";

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatRemaining(
  elapsedSeconds: number,
  preset: DurationPreset,
): string {
  if (preset === "infinity") {
    return formatClock(elapsedSeconds);
  }
  const remaining = Math.max(0, preset * 60 - elapsedSeconds);
  return formatClock(remaining);
}

export function formatTimerLabel(
  elapsedSeconds: number,
  settings: TimerSettings,
): string {
  if (settings.kind === "infinite" || settings.durationMinutes === null) {
    return formatClock(elapsedSeconds);
  }

  if (settings.kind === "intervals") {
    const phase = getIntervalPhase(elapsedSeconds * 1000, settings);
    return formatClock(Math.ceil(phase.phaseRemainingMs / 1000));
  }

  const remaining = Math.max(0, settings.durationMinutes * 60 - elapsedSeconds);
  return formatClock(remaining);
}

export function uniqueFilename(existing: string[], filename: string): string {
  if (!existing.includes(filename)) {
    return filename;
  }

  const dot = filename.lastIndexOf(".");
  const stem = dot === -1 ? filename : filename.slice(0, dot);
  const ext = dot === -1 ? "" : filename.slice(dot);

  let index = 1;
  while (existing.includes(`${stem} (${index})${ext}`)) {
    index += 1;
  }
  return `${stem} (${index})${ext}`;
}

export function nextTrackIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  return (current + 1) % length;
}

export function previousTrackIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  return (current - 1 + length) % length;
}

export function findTrackIndex(tracks: Track[], trackId: string | null): number {
  if (!trackId) return -1;
  return tracks.findIndex((track) => track.id === trackId);
}

export function sanitizeTitle(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  return stem.replace(/[_-]+/g, " ").trim() || "Untitled";
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;

  const tauriWindow = window as Window & {
    __TAURI_INTERNALS__?: unknown;
  };

  return (
    Boolean(tauriWindow.__TAURI_INTERNALS__) ||
    window.location.protocol === "tauri:" ||
    /tauri/i.test(window.navigator.userAgent)
  );
}

export function isSupportedAudioFile(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return (
    Boolean(extension) &&
    ["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(extension as string)
  );
}

export function parseYouTubeVideoId(value: string): string | null {
  try {
    const candidate = value.trim();
    const parsed = new URL(
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? candidate
        : `https://${candidate}`,
    );
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | null = null;

    if (hostname === "youtu.be") {
      id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      id =
        parsed.searchParams.get("v") ??
        parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ??
        null;
    }

    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function parseYouTubePlaylistId(value: string): string | null {
  try {
    const url = toWebUrl(value);
    if (!url) return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be") {
      const list = url.searchParams.get("list");
      if (list && /^[\w-]+$/.test(list)) {
        return list;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface ParsedRemoteLink {
  provider: RemoteProvider;
  providerId: string;
  providerKind?: string;
  url: string;
}

export function parseRemoteLink(value: string): ParsedRemoteLink | null {
  const url = toWebUrl(value);
  if (!url) return null;

  const ytPlaylistId = parseYouTubePlaylistId(value);
  if (ytPlaylistId) {
    return {
      provider: "youtube",
      providerId: ytPlaylistId,
      providerKind: "playlist",
      url: url.toString(),
    };
  }

  const youtubeId = parseYouTubeVideoId(value);
  if (youtubeId) {
    return {
      provider: "youtube",
      providerId: youtubeId,
      providerKind: "video",
      url: url.toString(),
    };
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (hostname === "open.spotify.com" && pathParts.length >= 2) {
    const kindIndex = pathParts.findIndex((part) =>
      ["track", "album", "playlist", "episode", "show"].includes(part),
    );
    const kind = kindIndex >= 0 ? pathParts[kindIndex] : undefined;
    const id = kindIndex >= 0 ? pathParts[kindIndex + 1] : undefined;
    if (
      kind &&
      id &&
      /^[\w-]+$/.test(id)
    ) {
      return {
        provider: "spotify",
        providerId: id,
        providerKind: kind,
        url: url.toString(),
      };
    }
  }

  if (
    hostname === "soundcloud.com" ||
    hostname === "on.soundcloud.com"
  ) {
    if (pathParts.length >= 2 || hostname === "on.soundcloud.com") {
      return {
        provider: "soundcloud",
        providerId: hashRemoteUrl(url.toString()),
        url: url.toString(),
      };
    }
  }

  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) {
    const postId = url.pathname.match(/\/video\/(\d+)/)?.[1];
    if (postId || hostname === "vm.tiktok.com" || hostname === "vt.tiktok.com") {
      return {
        provider: "tiktok",
        providerId: postId ?? hashRemoteUrl(url.toString()),
        providerKind: "video",
        url: url.toString(),
      };
    }
  }

  return null;
}

export function isRemoteTrack(track: Track | null | undefined): boolean {
  return (
    track?.source === "youtube" ||
    track?.source === "spotify" ||
    track?.source === "soundcloud" ||
    track?.source === "tiktok"
  );
}

function toWebUrl(value: string): URL | null {
  try {
    const candidate = value.trim();
    if (!candidate) return null;
    return new URL(
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? candidate
        : `https://${candidate}`,
    );
  } catch {
    return null;
  }
}

function hashRemoteUrl(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

export async function fetchYouTubeMetadata(
  url: string,
  videoId: string,
): Promise<{ title: string; thumbnail: string; author?: string }> {
  const fallback = {
    title: `YouTube · ${videoId}`,
    thumbnail: youtubeThumbnail(videoId),
  };

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: controller.signal },
      );

      if (!response.ok) return fallback;
      const payload = (await response.json()) as {
        title?: string;
        thumbnail_url?: string;
        author_name?: string;
      };

      return {
        title: payload.title?.trim() || fallback.title,
        thumbnail: payload.thumbnail_url || fallback.thumbnail,
        author: payload.author_name?.trim() || undefined,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    return fallback;
  }
}

export async function fetchRemoteMetadata(
  url: string,
  link: ParsedRemoteLink,
): Promise<{
  title: string;
  thumbnail?: string;
  author?: string;
  providerId?: string;
}> {
  if (link.provider === "youtube") {
    return fetchYouTubeMetadata(url, link.providerId);
  }

  const providerLabel =
    link.provider === "spotify"
      ? "Spotify"
      : link.provider === "soundcloud"
        ? "SoundCloud"
        : "TikTok";
  const fallback = {
    title: `${providerLabel} · ${link.providerKind ?? "track"}`,
  };
  const endpoint =
    link.provider === "spotify"
      ? `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
      : link.provider === "soundcloud"
        ? `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`
        : `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) return fallback;
      const payload = (await response.json()) as {
        title?: string;
        thumbnail_url?: string;
        author_name?: string;
        author_url?: string;
        html?: string;
      };

      return {
        title: payload.title?.trim() || fallback.title,
        thumbnail: payload.thumbnail_url || undefined,
        author: payload.author_name?.trim() || undefined,
        providerId:
          link.provider === "tiktok"
            ? payload.html?.match(/data-video-id=["'](\d+)["']/)?.[1]
            : undefined,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    return fallback;
  }
}

export async function fetchYouTubePlaylistTracks(
  playlistId: string,
): Promise<Track[]> {
  const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let html = "";
    try {
      const response = await fetch(playlistUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
      });
      if (!response.ok) return [];
      html = await response.text();
    } finally {
      window.clearTimeout(timeout);
    }

    const items: Array<{
      videoId: string;
      title: string;
      author?: string;
      thumbnail?: string;
    }> = [];

    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (match) {
      try {
        const data = JSON.parse(match[1]) as Record<string, unknown>;

        function walk(obj: unknown) {
          if (!obj || typeof obj !== "object") return;
          const rec = obj as Record<string, unknown>;

          if (rec.playlistVideoRenderer && typeof rec.playlistVideoRenderer === "object") {
            const v = rec.playlistVideoRenderer as {
              videoId?: string;
              title?: { runs?: Array<{ text?: string }>; simpleText?: string };
              shortBylineText?: { runs?: Array<{ text?: string }> };
              ownerText?: { runs?: Array<{ text?: string }> };
              thumbnail?: { thumbnails?: Array<{ url?: string }> };
            };
            if (v.videoId && !items.some((item) => item.videoId === v.videoId)) {
              const title =
                v.title?.runs?.[0]?.text || v.title?.simpleText || `YouTube · ${v.videoId}`;
              const author =
                v.shortBylineText?.runs?.[0]?.text || v.ownerText?.runs?.[0]?.text || "YouTube";
              const thumbnail =
                v.thumbnail?.thumbnails?.slice(-1)[0]?.url || youtubeThumbnail(v.videoId);
              items.push({ videoId: v.videoId, title, author, thumbnail });
            }
          }

          if (rec.lockupViewModel && typeof rec.lockupViewModel === "object") {
            const lockup = rec.lockupViewModel as {
              contentId?: string;
              contentType?: string;
              metadata?: { lockupMetadataViewModel?: { title?: { content?: string } } };
              rendererContext?: { accessibilityContext?: { label?: string } };
            };
            if (
              lockup.contentId &&
              lockup.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" &&
              !items.some((item) => item.videoId === lockup.contentId)
            ) {
              const videoId = lockup.contentId;
              const metaTitle = lockup.metadata?.lockupMetadataViewModel?.title?.content;
              const labelTitle = lockup.rendererContext?.accessibilityContext?.label;
              const title =
                metaTitle || (labelTitle ? labelTitle.split(" by ")[0] : `YouTube · ${videoId}`);
              const thumbnail = youtubeThumbnail(videoId);
              items.push({ videoId, title, author: "YouTube", thumbnail });
            }
          }

          for (const key of Object.keys(rec)) {
            walk(rec[key]);
          }
        }

        walk(data);
      } catch {
        // fallback to regex extraction
      }
    }

    if (items.length === 0) {
      const watchMatches = [
        ...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g),
      ].map((m) => m[1]);
      const uniqueIds = [...new Set(watchMatches)];
      for (const videoId of uniqueIds) {
        items.push({
          videoId,
          title: `YouTube · ${videoId}`,
          thumbnail: youtubeThumbnail(videoId),
          author: "YouTube",
        });
      }
    }

    return items.map((item) => {
      const trackUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
      return {
        id: `youtube:${item.videoId}`,
        title: item.title,
        filename: item.title,
        path: trackUrl,
        extension: "youtube",
        source: "youtube" as const,
        url: trackUrl,
        videoId: item.videoId,
        providerId: item.videoId,
        providerKind: "video",
        thumbnail: item.thumbnail || youtubeThumbnail(item.videoId),
        author: item.author,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchSpotifyPlaylistTracks(
  url: string,
  _link: ParsedRemoteLink,
): Promise<Track[]> {
  const embedUrl = url.replace("open.spotify.com/", "open.spotify.com/embed/");
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let html = "";
    try {
      const response = await fetch(embedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: controller.signal,
      });
      if (!response.ok) return [];
      html = await response.text();
    } finally {
      window.clearTimeout(timeout);
    }

    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
    );
    if (!match) return [];

    const json = JSON.parse(match[1]) as Record<string, unknown>;
    const props = (json?.props as Record<string, unknown>)?.pageProps as Record<string, unknown>;
    const state = props?.state as Record<string, unknown>;
    const data = state?.data as Record<string, unknown>;
    const entity = data?.entity as {
      title?: string;
      name?: string;
      subtitle?: string;
      trackList?: Array<{
        uri?: string;
        uid?: string;
        id?: string;
        title?: string;
        name?: string;
        subtitle?: string;
        artists?: Array<{ name?: string }>;
      }>;
      tracks?: Array<{
        uri?: string;
        uid?: string;
        id?: string;
        title?: string;
        name?: string;
        subtitle?: string;
        artists?: Array<{ name?: string }>;
      }>;
    };

    if (!entity) return [];
    const trackList = entity.trackList || entity.tracks || [];

    return trackList.map((t) => {
      const spotifyId = t.uri
        ? t.uri.split(":")[2]
        : t.id || t.uid || hashRemoteUrl(t.title || t.name || "spotify");
      const trackUrl = spotifyId ? `https://open.spotify.com/track/${spotifyId}` : url;
      const title = t.title || t.name || "Spotify · track";
      const author =
        t.subtitle ||
        t.artists?.map((a) => a.name).filter(Boolean).join(", ") ||
        entity.subtitle ||
        "Spotify";

      return {
        id: `spotify:${spotifyId}`,
        title,
        filename: title,
        path: trackUrl,
        extension: "spotify",
        source: "spotify" as const,
        url: trackUrl,
        providerId: spotifyId,
        providerKind: "track",
        author,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchRemotePlaylistTracks(
  url: string,
  link: ParsedRemoteLink,
): Promise<Track[]> {
  if (link.provider === "youtube" && link.providerKind === "playlist") {
    return fetchYouTubePlaylistTracks(link.providerId);
  }
  if (
    link.provider === "spotify" &&
    (link.providerKind === "playlist" || link.providerKind === "album")
  ) {
    return fetchSpotifyPlaylistTracks(url, link);
  }
  return [];
}

export function loadRemoteTracks(): Track[] {
  try {
    const rawValues = [
      localStorage.getItem(REMOTE_LIBRARY_KEY),
      localStorage.getItem(LEGACY_YOUTUBE_LIBRARY_KEY),
    ].filter((value): value is string => Boolean(value));
    const tracks: Track[] = [];

    for (const raw of rawValues) {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const track of parsed) {
        if (isStoredRemoteTrack(track) && !tracks.some((item) => item.id === track.id)) {
          tracks.push(track);
        }
      }
    }

    return tracks;
  } catch {
    return [];
  }
}

export function saveRemoteTracks(tracks: Track[]): void {
  localStorage.setItem(REMOTE_LIBRARY_KEY, JSON.stringify(tracks));
}

export function loadYouTubeTracks(): Track[] {
  return loadRemoteTracks().filter((track) => track.source === "youtube");
}

export function saveYouTubeTracks(tracks: Track[]): void {
  saveRemoteTracks(tracks);
}

function isStoredRemoteTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Track;
  return (
    isRemoteTrack(track) &&
    typeof track.id === "string" &&
    typeof track.url === "string"
  );
}

export function loadFavoriteTrackIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveFavoriteTrackIds(ids: string[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...new Set(ids)]));
}

const STORAGE_KEY = "focusflow.player";

export function loadPlayerSnapshot(): Partial<{
  currentTrackId: string | null;
  volume: number;
  mode: string;
  durationPreset: DurationPreset | string;
  timerSettings: TimerSettings;
}> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function savePlayerSnapshot(snapshot: {
  currentTrackId: string | null;
  volume: number;
  mode: string;
  durationPreset: DurationPreset;
  timerSettings?: TimerSettings;
}): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
