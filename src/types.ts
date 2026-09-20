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
  playlistId?: string;
  playlistTitle?: string;
  providerId?: string;
  providerKind?: string;
  thumbnail?: string;
  /** Offline fallback: thumbnail cached locally as a data URL (no network needed). */
  thumbnailDataUrl?: string;
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

export type PlaybackQueue =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "recent" }
  | { kind: "genre"; category: string | null }
  | { kind: "playlist"; playlistId: string };

export interface RemoteTrackInfo {
  videoId?: string;
  uri?: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  index?: number;
}


export const INTERVAL_WORK_PRESETS = [25, 30, 40, 50, 60] as const;
export const INTERVAL_BREAK_PRESETS = [5, 10, 15, 20, 25] as const;

export interface MiniGoal {
  id: string;
  text: string;
  completed: boolean;
  subGoals?: MiniGoal[];
}

export type VoicePackId = "system" | "calm-female";

export interface TimerSettings {
  pauseWhenMusicPaused: boolean;
  kind: TimerKind;
  durationMinutes: number | null;
  workDurationMinutes: number;
  breakDurationMinutes: number;
  goal: string;
  userAboutMe?: string;
  miniGoals: MiniGoal[];
  breakMiniGoals?: MiniGoal[];
  /** Soft chime when an interval phase or finite timer ends. */
  phaseSoundEnabled: boolean;
  /** Optional spoken Polish cue for work/break transitions. */
  phaseVoiceEnabled: boolean;
  /** Local calm female ElevenLabs pack; speech synthesis remains the fallback. */
  voicePack: VoicePackId;
  /** Broadcast focus activity and countdown to Discord Rich Presence. */
  discordRpcEnabled: boolean;
  /** Minimize any app outside allowedApps while a session is active. */
  appLockEnabled: boolean;
  /** Lowercased process names (e.g. "chrome.exe") allowed during app lock. */
  allowedApps: string[];
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  pauseWhenMusicPaused: true,
  kind: "intervals",
  durationMinutes: 25,
  workDurationMinutes: 25,
  breakDurationMinutes: 5,
  goal: "",
  userAboutMe: "",
  miniGoals: [],
  breakMiniGoals: [],
  phaseSoundEnabled: true,
  phaseVoiceEnabled: true,
  voicePack: "calm-female",
  discordRpcEnabled: true,
  appLockEnabled: false,
  allowedApps: [],
};

export const PLAYBACK_RATES = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface PlayerSnapshot {
  currentTrackId: string | null;
  volume: number;
  mode: FocusMode;
  durationPreset: DurationPreset;
  timerSettings?: TimerSettings;
  playbackRate?: number;
  /** Loudness normalization (per-track gain from offline Web Audio analysis). */
  volumeNormalization?: boolean;
}

