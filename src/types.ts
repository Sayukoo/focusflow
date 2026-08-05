export type RemoteProvider = "youtube" | "spotify" | "soundcloud" | "tiktok";

export interface Track {
  id: string;
  title: string;
  filename: string;
  path: string;
  extension: string;
  source?: "managed" | "browser" | RemoteProvider;
  url?: string;
  videoId?: string;
  providerId?: string;
  providerKind?: string;
  thumbnail?: string;
  author?: string;
  category?: string;
}

export type FocusMode = "deep" | "energizing";

export type DurationPreset = "infinity" | 15 | 25 | 45 | 60;

export type TimerKind = "infinite" | "timer" | "intervals";
export type TimerUnit = "min" | "hr";

export interface TimerSettings {
  pauseWhenMusicPaused: boolean;
  kind: TimerKind;
  durationMinutes: number | null;
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  pauseWhenMusicPaused: true,
  kind: "timer",
  durationMinutes: 60,
};

export interface PlayerSnapshot {
  currentTrackId: string | null;
  volume: number;
  mode: FocusMode;
  durationPreset: DurationPreset;
  timerSettings?: TimerSettings;
}
