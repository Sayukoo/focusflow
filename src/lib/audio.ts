import type { DurationPreset, TimerSettings, Track } from "../types";

const YOUTUBE_LIBRARY_KEY = "focusflow.youtube-library";
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

export function loadYouTubeTracks(): Track[] {
  try {
    const raw = localStorage.getItem(YOUTUBE_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (track): track is Track =>
        Boolean(
          track &&
            typeof track === "object" &&
            (track as Track).source === "youtube" &&
            typeof (track as Track).id === "string" &&
            typeof (track as Track).url === "string" &&
            typeof (track as Track).videoId === "string",
        ),
    );
  } catch {
    return [];
  }
}

export function saveYouTubeTracks(tracks: Track[]): void {
  localStorage.setItem(YOUTUBE_LIBRARY_KEY, JSON.stringify(tracks));
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
