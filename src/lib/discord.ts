import { isTauriRuntime } from "./audio";
import { getIntervalPhase } from "./timer";
import type { TimerSettings, Track } from "../types";

export interface DiscordPresencePayload {
  details?: string;
  state?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
}

export async function sendDiscordPresenceUpdate(
  payload: DiscordPresencePayload,
): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("update_discord_presence", { payload });
  } catch {
    // Ignore native IPC errors gracefully if Discord isn't reachable
  }
}

export async function sendDiscordPresenceClear(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("clear_discord_presence");
  } catch {
    // Ignore native IPC errors gracefully
  }
}

export function buildDiscordPresencePayload(params: {
  isPlaying: boolean;
  isPaused: boolean;
  elapsedMs: number;
  settings: TimerSettings;
  currentTrack?: Track | null;
}): DiscordPresencePayload | null {
  const { isPlaying, isPaused, elapsedMs, settings, currentTrack } = params;

  if (!settings.discordRpcEnabled) {
    return null;
  }

  const goalText = settings.goal.trim() || "Głęboka praca";
  const nowSec = Math.floor(Date.now() / 1000);

  // If timer is infinite
  if (settings.kind === "infinite" || settings.durationMinutes === null) {
    if (!isPlaying && !isPaused) {
      return {
        details: "FocusFlow",
        state: "Ready to focus",
        largeImageKey: "app_icon",
        largeImageText: "FocusFlow",
      };
    }

    const trackInfo = currentTrack ? ` • ${currentTrack.title}` : "";
    return {
      details: `Focusing: ${goalText}`,
      state: isPaused ? `Paused${trackInfo}` : `Deep Work${trackInfo}`,
      startTimestamp: isPlaying ? Math.floor((Date.now() - elapsedMs) / 1000) : undefined,
      largeImageKey: "app_icon",
      largeImageText: "FocusFlow",
      smallImageKey: isPaused ? "pause" : "focus",
      smallImageText: isPaused ? "Paused" : "Focusing",
    };
  }

  // Intervals timer
  if (settings.kind === "intervals") {
    const phaseInfo = getIntervalPhase(elapsedMs, settings);
    const isWork = phaseInfo.phase === "work";
    const phaseRemainingSec = Math.ceil(phaseInfo.phaseRemainingMs / 1000);
    const endTimestamp = isPlaying ? nowSec + phaseRemainingSec : undefined;

    const completedGoals = settings.miniGoals.filter((g) => g.completed).length;
    const totalGoals = settings.miniGoals.length;
    const goalStatus =
      totalGoals > 0 ? ` (${completedGoals}/${totalGoals} tasks)` : "";

    if (isPaused) {
      return {
        details: `Focusing: ${goalText}`,
        state: `Paused • ${isWork ? "Work" : "Break"}${goalStatus}`,
        largeImageKey: "app_icon",
        largeImageText: "FocusFlow",
        smallImageKey: "pause",
        smallImageText: "Paused",
      };
    }

    if (isWork) {
      return {
        details: `Focusing: ${goalText}`,
        state: `Głęboka praca${goalStatus}`,
        endTimestamp,
        largeImageKey: "app_icon",
        largeImageText: "FocusFlow",
        smallImageKey: "focus",
        smallImageText: "Focus Phase",
      };
    }

    return {
      details: "Przerwa ☕",
      state: "Regeneracja i odpoczynek",
      endTimestamp,
      largeImageKey: "app_icon",
      largeImageText: "FocusFlow",
      smallImageKey: "break",
      smallImageText: "Break Phase",
    };
  }

  // Fixed Timer
  const totalMs = (settings.durationMinutes ?? 25) * 60_000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const endTimestamp = isPlaying ? nowSec + remainingSec : undefined;

  if (isPaused) {
    return {
      details: `Focusing: ${goalText}`,
      state: "Focus Paused",
      largeImageKey: "app_icon",
      largeImageText: "FocusFlow",
      smallImageKey: "pause",
      smallImageText: "Paused",
    };
  }

  return {
    details: `Focusing: ${goalText}`,
    state: "Session in progress",
    endTimestamp,
    largeImageKey: "app_icon",
    largeImageText: "FocusFlow",
    smallImageKey: "focus",
    smallImageText: "Focusing",
  };
}
