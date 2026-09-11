import {
  DEFAULT_TIMER_SETTINGS,
  type MiniGoal,
  type TimerPhase,
  type TimerSettings,
} from "../types";

const MAX_TIMER_MINUTES = 24 * 60;
const MAX_GOAL_LENGTH = 300;
const MAX_MINI_GOALS = 5;

export interface TimerClock {
  elapsedMs: number;
  startedAtMs: number | null;
}

export interface IntervalDurations {
  workMs: number;
  breakMs: number;
}

export interface IntervalPhaseState {
  phase: TimerPhase;
  phaseElapsedMs: number;
  phaseRemainingMs: number;
  phaseDurationMs: number;
  cycleElapsedMs: number;
  cycleIndex: number;
}

export function createTimerClock(): TimerClock {
  return {
    elapsedMs: 0,
    startedAtMs: null,
  };
}

export function startTimerClock(clock: TimerClock, nowMs: number): void {
  if (clock.startedAtMs === null) {
    clock.startedAtMs = nowMs;
  }
}

export function pauseTimerClock(clock: TimerClock, nowMs: number): number {
  clock.elapsedMs = readTimerElapsedMs(clock, nowMs);
  clock.startedAtMs = null;
  return clock.elapsedMs;
}

export function resetTimerClock(clock: TimerClock): void {
  clock.elapsedMs = 0;
  clock.startedAtMs = null;
}

export function readTimerElapsedMs(clock: TimerClock, nowMs: number): number {
  if (clock.startedAtMs === null) return Math.max(0, clock.elapsedMs);
  return Math.max(
    0,
    clock.elapsedMs + Math.max(0, nowMs - clock.startedAtMs),
  );
}

export function elapsedSecondsFromMs(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / 1000);
}

export function normalizeGoal(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_GOAL_LENGTH);
}

export function normalizeUserAboutMe(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

export function normalizeMiniGoalText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

export function createMiniGoals(values: readonly string[]): MiniGoal[] {
  return normalizeMiniGoals(values);
}

export function resetMiniGoalProgress(miniGoals: readonly MiniGoal[]): MiniGoal[] {
  return miniGoals.map((miniGoal) => ({
    ...miniGoal,
    completed: false,
  }));
}

export const DEFAULT_BREAK_MINI_GOALS: MiniGoal[] = [
  { id: "break-1", text: "🫁 Oddychaj pudełkowo (4-4-4-4)", completed: false },
  { id: "break-2", text: "💧 Wypij szklankę wody", completed: false },
  { id: "break-3", text: "🪴 Wyjdź na balkon lub wyjrzyj przez okno", completed: false },
  { id: "break-4", text: "🧹 Posprzątaj biurko lub pokój", completed: false },
  { id: "break-5", text: "🧘 Rozciągnij kark, ramiona i plecy", completed: false },
  { id: "break-6", text: "💪 Zrób 10 pompek", completed: false },
];

export function normalizeTimerSettings(value: unknown): TimerSettings {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<TimerSettings>)
      : {};
  const requestedKind: TimerSettings["kind"] =
    candidate.kind === "infinite" ||
    candidate.kind === "timer" ||
    candidate.kind === "intervals"
      ? candidate.kind
      : DEFAULT_TIMER_SETTINGS.kind;
  const pauseWhenMusicPaused =
    typeof candidate.pauseWhenMusicPaused === "boolean"
      ? candidate.pauseWhenMusicPaused
      : DEFAULT_TIMER_SETTINGS.pauseWhenMusicPaused;
  const goal = normalizeGoal(candidate.goal);
  const userAboutMe = normalizeUserAboutMe(candidate.userAboutMe);
  const kind: TimerSettings["kind"] =
    requestedKind === "timer" && !goal ? "infinite" : requestedKind;
  const workDurationMinutes = normalizeMinutes(
    candidate.workDurationMinutes ??
      (requestedKind === "intervals" ? candidate.durationMinutes : undefined),
    DEFAULT_TIMER_SETTINGS.workDurationMinutes,
  );
  const breakDurationMinutes = normalizeMinutes(
    candidate.breakDurationMinutes,
    DEFAULT_TIMER_SETTINGS.breakDurationMinutes,
  );
  const durationMinutes =
    kind === "infinite"
      ? null
      : kind === "intervals"
        ? workDurationMinutes
        : normalizeMinutes(
            candidate.durationMinutes,
            DEFAULT_TIMER_SETTINGS.durationMinutes ?? 60,
          );

  return {
    pauseWhenMusicPaused,
    kind,
    durationMinutes,
    workDurationMinutes,
    breakDurationMinutes,
    goal: kind === "infinite" ? "" : goal,
    userAboutMe,
    miniGoals: kind === "infinite" ? [] : normalizeMiniGoals(candidate.miniGoals),
    breakMiniGoals: normalizeMiniGoals(candidate.breakMiniGoals),
    phaseSoundEnabled:
      typeof candidate.phaseSoundEnabled === "boolean"
        ? candidate.phaseSoundEnabled
        : DEFAULT_TIMER_SETTINGS.phaseSoundEnabled,
    phaseVoiceEnabled:
      typeof candidate.phaseVoiceEnabled === "boolean"
        ? candidate.phaseVoiceEnabled || candidate.voicePack === "system"
        : DEFAULT_TIMER_SETTINGS.phaseVoiceEnabled,
    voicePack:
      candidate.voicePack === "calm-female"
        ? candidate.voicePack
        : DEFAULT_TIMER_SETTINGS.voicePack,
    discordRpcEnabled:
      typeof candidate.discordRpcEnabled === "boolean"
        ? candidate.discordRpcEnabled
        : DEFAULT_TIMER_SETTINGS.discordRpcEnabled,
    appLockEnabled:
      typeof candidate.appLockEnabled === "boolean"
        ? candidate.appLockEnabled
        : DEFAULT_TIMER_SETTINGS.appLockEnabled,
    allowedApps: normalizeAllowedApps(candidate.allowedApps),
  };
}

const MAX_ALLOWED_APPS = 25;

function normalizeAllowedApps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim().toLowerCase().slice(0, 260);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (seen.size >= MAX_ALLOWED_APPS) break;
  }
  return Array.from(seen);
}

export function intervalDurationsMs(settings: TimerSettings): IntervalDurations {
  return {
    workMs:
      normalizeMinutes(
        settings.workDurationMinutes ?? settings.durationMinutes,
        DEFAULT_TIMER_SETTINGS.workDurationMinutes,
      ) * 60_000,
    breakMs:
      normalizeMinutes(
        settings.breakDurationMinutes,
        DEFAULT_TIMER_SETTINGS.breakDurationMinutes,
      ) * 60_000,
  };
}

export function getIntervalPhase(
  elapsedMs: number,
  settings: TimerSettings,
): IntervalPhaseState {
  const { workMs, breakMs } = intervalDurationsMs(settings);
  const cycleMs = workMs + breakMs;
  const safeElapsedMs = Math.max(0, elapsedMs);
  const cycleElapsedMs = safeElapsedMs % cycleMs;
  const cycleIndex = Math.floor(safeElapsedMs / cycleMs);

  if (cycleElapsedMs < workMs) {
    return {
      phase: "work",
      phaseElapsedMs: cycleElapsedMs,
      phaseRemainingMs: workMs - cycleElapsedMs,
      phaseDurationMs: workMs,
      cycleElapsedMs,
      cycleIndex,
    };
  }

  const breakElapsedMs = cycleElapsedMs - workMs;
  return {
    phase: "break",
    phaseElapsedMs: breakElapsedMs,
    phaseRemainingMs: breakMs - breakElapsedMs,
    phaseDurationMs: breakMs,
    cycleElapsedMs,
    cycleIndex,
  };
}

export function timerLimitMs(settings: TimerSettings): number | null {
  if (
    settings.kind === "infinite" ||
    settings.kind === "intervals" ||
    settings.durationMinutes === null
  ) {
    return null;
  }
  return normalizeMinutes(
    settings.durationMinutes,
    DEFAULT_TIMER_SETTINGS.durationMinutes ?? 60,
  ) * 60_000;
}

function normalizeMinutes(value: unknown, fallback: number): number {
  const amount =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(MAX_TIMER_MINUTES, Math.max(1, Math.round(amount)));
}

function normalizeMiniGoals(value: unknown): MiniGoal[] {
  if (!Array.isArray(value)) return [];

  const usedIds = new Set<string>();
  const miniGoals: MiniGoal[] = [];

  for (const [index, item] of value.entries()) {
    const isLegacyText = typeof item === "string";
    const candidate =
      item && typeof item === "object"
        ? (item as Partial<MiniGoal>)
        : null;
    const text = normalizeMiniGoalText(isLegacyText ? item : candidate?.text);
    if (!text) continue;

    const requestedId =
      typeof candidate?.id === "string" ? candidate.id.trim().slice(0, 80) : "";
    const baseId = requestedId || `mini-goal-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    const rawSubGoals = Array.isArray(candidate?.subGoals)
      ? candidate.subGoals
      : undefined;
    const subGoals = rawSubGoals ? normalizeMiniGoals(rawSubGoals) : undefined;

    miniGoals.push({
      id,
      text,
      completed: candidate?.completed === true,
      ...(subGoals && subGoals.length > 0 ? { subGoals } : {}),
    });

    if (miniGoals.length >= MAX_MINI_GOALS) break;
  }

  return miniGoals;
}

/**
 * Returns true only when a focus goal has been explicitly set AND the session
 * is in a finite mode with a valid duration (not infinite and not untargeted).
 */
export function isFocusAnalyticsEligible(
  settings?: Pick<
    TimerSettings,
    "kind" | "goal" | "durationMinutes" | "workDurationMinutes" | "miniGoals"
  > | null,
): boolean {
  if (!settings) return false;
  const hasGoal = Boolean(
    (settings.goal && settings.goal.trim().length > 0) ||
      (settings.miniGoals &&
        settings.miniGoals.some((g) => g.text && g.text.trim().length > 0)),
  );
  if (!hasGoal) return false;
  if (settings.kind === "infinite") return false;
  if (settings.kind === "timer") {
    return (settings.durationMinutes ?? 0) > 0;
  }
  if (settings.kind === "intervals") {
    return settings.workDurationMinutes > 0;
  }
  return false;
}
