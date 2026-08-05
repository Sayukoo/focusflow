export type RemoteProvider = "youtube" | "spotify" | "soundcloud" | "tiktok";

export type TrackMetadataValue = string | number | boolean | null;

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
  metadata?: Record<string, TrackMetadataValue>;
}

export type FocusMode = "deep" | "energizing";

export type DurationPreset =
  | "infinity"
  | 15
  | 25
  | 30
  | 40
  | 45
  | 50
  | 60
  | 120;

export type TimerKind = "infinite" | "timer" | "intervals";
export type TimerUnit = "min" | "hr";
export type TimerPhase = "work" | "break";

export const INTERVAL_WORK_PRESETS = [25, 30, 40, 50, 60] as const;
export const INTERVAL_BREAK_PRESETS = [5, 10, 15, 20, 25] as const;

export interface MiniGoal {
  id: string;
  text: string;
  completed: boolean;
}

export interface TimerSettings {
  pauseWhenMusicPaused: boolean;
  kind: TimerKind;
  durationMinutes: number | null;
  workDurationMinutes: number;
  breakDurationMinutes: number;
  goal: string;
  miniGoals: MiniGoal[];
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  pauseWhenMusicPaused: true,
  kind: "infinite",
  durationMinutes: null,
  workDurationMinutes: 25,
  breakDurationMinutes: 5,
  goal: "",
  miniGoals: [],
};

export interface PlayerSnapshot {
  currentTrackId: string | null;
  volume: number;
  mode: FocusMode;
  durationPreset: DurationPreset;
  timerSettings?: TimerSettings;
}
