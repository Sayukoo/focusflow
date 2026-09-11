import type {
  DurationPreset,
  RemoteProvider,
  TimerSettings,
  Track,
} from "../types";
import { DEFAULT_LOFI_TRACKS, DEFAULT_PHONK_TRACKS } from "./defaultTracks";
import { getIntervalPhase } from "./timer";

const REMOTE_LIBRARY_KEY = "focusflow.remote-library";
const LEGACY_YOUTUBE_LIBRARY_KEY = "focusflow.youtube-library";
const FAVORITES_KEY = "focusflow.favorites";
// Bumped from "focusflow.lofi-pack-seeded" so the broken 24/7 livestream
// pack below gets replaced with standalone tracks even for installs that
// already ran the old seeding pass.
const LOFI_PACK_SEEDED_KEY = "focusflow.lofi-pack-seeded-v2";
const PHONK_PACK_SEEDED_KEY = "focusflow.phonk-pack-seeded-v1";

// Video IDs from the old "24/7 lofi radio" default pack. Those are YouTube
// live streams, not fixed-length videos — once the underlying live session
// rotates or ends the embedded player is left with no audio, so they're
// purged from any library that still has them saved locally.
const LEGACY_LIVE_TRACK_IDS = new Set(
  [
    "5qap5aO4i9A",
    "jfKfPfyJRdk",
    "7NOSDKb0HlU",
    "CFGLoQIhmow",
    "8b3fqIBrNW0",
    "7ccH8u8fj8Y",
    "i43tkaTXtwI",
    "n61ULEU7CO0",
    "-FlxM_0S2lA",
    "5yx6BWlEVcY",
    "Liv0MXUPiqo",
    "B1ggnlaiHkQ",
    "amTJUg8-AhI",
    "LoUrZk9hI-o",
    "fg_R967cUBI",
    "sF80I-TQiW0",
    "7TgS-e0mJaY",
    "WeBYtv2Bv7c",
    "vL4AypJbhkE",
    "kJMRpId0H50",
  ].map((videoId) => `youtube:${videoId}`),
);

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
  videoId?: string;
  playlistId?: string;
}

export function parseRemoteLink(value: string): ParsedRemoteLink | null {
  const url = toWebUrl(value);
  if (!url) return null;

  const ytPlaylistId = parseYouTubePlaylistId(value);
  const youtubeId = parseYouTubeVideoId(value);

  if (ytPlaylistId) {
    return {
      provider: "youtube",
      providerId: ytPlaylistId,
      providerKind: "playlist",
      url: url.toString(),
      playlistId: ytPlaylistId,
      videoId: youtubeId ?? undefined,
    };
  }

  if (youtubeId) {
    return {
      provider: "youtube",
      providerId: youtubeId,
      providerKind: "video",
      url: url.toString(),
      videoId: youtubeId,
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
  return youTubeThumbnailUrl(videoId, "hq");
}

export function youTubeThumbnailUrl(
  videoId: string,
  quality: "hq" | "mq" = "hq",
): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${quality}default.jpg`;
}

/* --------------------------------------------------------------------------
   OFFLINE MODE FOR YOUTUBE TRACKS
   Metadata (title/author/category) is already persisted in localStorage;
   here we additionally cache the thumbnail itself as a compact data URL so
   the library and backdrop render fully offline. Uses mqdefault (~320x180,
   a dozen KB) — it is only ever shown blurred or in small cards.
   -------------------------------------------------------------------------- */

const THUMBNAIL_FETCH_TIMEOUT_MS = 8000;
const THUMBNAIL_MAX_BYTES = 400_000;

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

export async function fetchThumbnailDataUrl(
  url: string,
): Promise<string | null> {
  try {
    if (!/^https?:\/\//i.test(url)) return null;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      THUMBNAIL_FETCH_TIMEOUT_MS,
    );
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.size > THUMBNAIL_MAX_BYTES) {
        return null;
      }
      return await blobToDataUrl(blob);
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

/**
 * Downloads missing thumbnails for cached YouTube tracks (bounded concurrency)
 * and returns an updated array — changed tracks are shallow clones so React
 * memoization notices them. Returns null when there was nothing to add.
 */
export async function hydrateYouTubeThumbnails(
  tracks: Track[],
): Promise<Track[] | null> {
  const missing = tracks.filter(
    (track) =>
      track.source === "youtube" &&
      track.videoId &&
      !track.thumbnailDataUrl,
  );
  if (missing.length === 0) return null;

  const dataUrls = new Map<string, string>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < missing.length) {
      const track = missing[cursor];
      cursor += 1;
      if (!track.videoId) continue;
      const dataUrl = await fetchThumbnailDataUrl(
        youTubeThumbnailUrl(track.videoId, "mq"),
      );
      if (dataUrl && !dataUrls.has(track.videoId)) {
        dataUrls.set(track.videoId, dataUrl);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (dataUrls.size === 0) return null;

  return tracks.map((track) => {
    const dataUrl = track.videoId ? dataUrls.get(track.videoId) : undefined;
    return dataUrl ? { ...track, thumbnailDataUrl: dataUrl } : track;
  });
}

export async function fetchYouTubeMetadata(
  url: string,
  providerId: string,
  link?: ParsedRemoteLink | null,
): Promise<{ title: string; thumbnail?: string; author?: string }> {
  const isPlaylist =
    link?.providerKind === "playlist" || !/^[\w-]{11}$/.test(providerId);
  const videoId =
    link?.videoId && /^[\w-]{11}$/.test(link.videoId)
      ? link.videoId
      : !isPlaylist && /^[\w-]{11}$/.test(providerId)
        ? providerId
        : undefined;

  const fallback = {
    title: isPlaylist ? "Playlista YouTube" : `YouTube · ${providerId}`,
    thumbnail: videoId ? youtubeThumbnail(videoId) : undefined,
  };

  const oembedUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : url;

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(oembedUrl)}&format=json`,
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
    return fetchYouTubeMetadata(url, link.providerId, link);
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

async function fetchHtml(targetUrl: string, timeoutMs = 12000): Promise<string> {
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const content = await invoke<string>("fetch_url_content", { url: targetUrl });
      if (content && content.trim()) return content;
    } catch {
      // Fall back to standard fetch if Tauri command is unavailable
    }
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    return await response.text();
  } finally {
    window.clearTimeout(timeout);
  }
}

function extractYtInitialData(html: string): Record<string, unknown> | null {
  const marker = "ytInitialData = ";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  const jsonStart = html.indexOf("{", startIdx + marker.length);
  if (jsonStart === -1) return null;

  const scriptEnd = html.indexOf("</script>", jsonStart);
  let jsonSlice = scriptEnd !== -1 ? html.slice(jsonStart, scriptEnd).trim() : html.slice(jsonStart).trim();

  if (jsonSlice.endsWith(";")) {
    jsonSlice = jsonSlice.slice(0, -1).trim();
  }

  try {
    return JSON.parse(jsonSlice) as Record<string, unknown>;
  } catch {
    // If there was extra content before </script>, find balanced braces
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;
    const maxLen = scriptEnd !== -1 ? scriptEnd : Math.min(html.length, jsonStart + 5_000_000);

    for (let i = jsonStart; i < maxLen; i++) {
      const char = html[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{") depth++;
        else if (char === "}") {
          depth--;
          if (depth === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      try {
        return JSON.parse(html.slice(jsonStart, endIdx)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function fetchYouTubePlaylistTracks(
  playlistId: string,
): Promise<Track[]> {
  const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
  try {
    const html = await fetchHtml(playlistUrl);
    if (!html) return [];

    const items: Array<{
      videoId: string;
      title: string;
      author?: string;
      thumbnail?: string;
    }> = [];

    const data = extractYtInitialData(html);
    if (data) {
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
          if (
            v.videoId &&
            /^[\w-]{11}$/.test(v.videoId) &&
            !items.some((item) => item.videoId === v.videoId)
          ) {
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
            /^[\w-]{11}$/.test(lockup.contentId) &&
            lockup.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" &&
            !items.some((item) => item.videoId === lockup.contentId)
          ) {
            const videoId = lockup.contentId;
            const metaTitle = lockup.metadata?.lockupMetadataViewModel?.title?.content;
            const labelTitle = lockup.rendererContext?.accessibilityContext?.label;
            const title =
              metaTitle ||
              (labelTitle
                ? labelTitle.split(/\s+\d+\s+minutes|\s+by\s+/i)[0]
                : `YouTube · ${videoId}`);
            const thumbnail = youtubeThumbnail(videoId);
            items.push({ videoId, title: title.trim(), author: "YouTube", thumbnail });
          }
        }

        for (const key of Object.keys(rec)) {
          walk(rec[key]);
        }
      }

      walk(data);
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
      const trackUrl = `https://www.youtube.com/watch?v=${item.videoId}&list=${playlistId}`;
      return {
        id: `youtube:${item.videoId}`,
        title: item.title,
        filename: item.title,
        path: trackUrl,
        extension: "youtube",
        source: "youtube" as const,
        url: trackUrl,
        videoId: item.videoId,
        playlistId,
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
    let tracks: Track[] = [];

    for (const raw of rawValues) {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const track of parsed) {
        if (isStoredRemoteTrack(track) && !tracks.some((item) => item.id === track.id)) {
          tracks.push(track);
        }
      }
    }

    const hadLegacyLiveTracks = tracks.some((track) =>
      LEGACY_LIVE_TRACK_IDS.has(track.id),
    );
    if (hadLegacyLiveTracks) {
      tracks = tracks.filter((track) => !LEGACY_LIVE_TRACK_IDS.has(track.id));
    }

    let seededNewPack = false;

    if (localStorage.getItem(LOFI_PACK_SEEDED_KEY) !== "true") {
      const existingIds = new Set(tracks.map((track) => track.id));
      const additions = DEFAULT_LOFI_TRACKS.filter(
        (track) => !existingIds.has(track.id),
      ).map((track) => ({ ...track }));
      tracks.push(...additions);
      localStorage.setItem(LOFI_PACK_SEEDED_KEY, "true");
      seededNewPack = true;
    }

    if (localStorage.getItem(PHONK_PACK_SEEDED_KEY) !== "true") {
      const existingIds = new Set(tracks.map((track) => track.id));
      const additions = DEFAULT_PHONK_TRACKS.filter(
        (track) => !existingIds.has(track.id),
      ).map((track) => ({ ...track }));
      tracks.push(...additions);
      localStorage.setItem(PHONK_PACK_SEEDED_KEY, "true");
      seededNewPack = true;
    }

    if (hadLegacyLiveTracks || seededNewPack) {
      saveRemoteTracks(tracks);
    }

    return tracks;
  } catch {
    return [];
  }
}

// Keep the persisted remote library comfortably below the ~5MB
// localStorage quota; drop cached data-URL thumbnails (oldest entries first)
// when the payload would exceed this budget.
const REMOTE_LIBRARY_MAX_JSON_BYTES = 3_500_000;

export function saveRemoteTracks(tracks: Track[]): void {
  let payload = tracks;
  let json = JSON.stringify(payload);
  if (json.length > REMOTE_LIBRARY_MAX_JSON_BYTES) {
    payload = [...tracks];
    for (
      let index = payload.length - 1;
      index >= 0 && json.length > REMOTE_LIBRARY_MAX_JSON_BYTES;
      index -= 1
    ) {
      if (payload[index].thumbnailDataUrl) {
        payload[index] = { ...payload[index], thumbnailDataUrl: undefined };
        json = JSON.stringify(payload);
      }
    }
  }
  try {
    localStorage.setItem(REMOTE_LIBRARY_KEY, json);
  } catch {
    // Storage might be full or restricted — keep the in-memory library working.
  }
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
  playbackRate: number;
  volumeNormalization: boolean;
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
  playbackRate?: number;
  volumeNormalization?: boolean;
}): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
