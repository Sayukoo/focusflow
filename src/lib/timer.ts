import {
  DEFAULT_TIMER_SETTINGS,
  type MiniGoal,
  type TimerPhase,
  type TimerSettings,
} from "../types";

const MAX_TIMER_MINUTES = 24 * 60;
const MAX_GOAL_LENGTH = 160;
const MAX_MINI_GOAL_LENGTH = 120;
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

export function normalizeMiniGoalText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MINI_GOAL_LENGTH);
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
  const kind: TimerSettings["kind"] =
    requestedKind !== "infinite" && !goal ? "infinite" : requestedKind;
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
    miniGoals: kind === "infinite" ? [] : normalizeMiniGoals(candidate.miniGoals),
  };
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

    miniGoals.push({
      id,
      text,
      completed: candidate?.completed === true,
    });

    if (miniGoals.length >= MAX_MINI_GOALS) break;
  }

  return miniGoals;
}
