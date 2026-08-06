import { describe, expect, it } from "vitest";
import type { TimerSettings } from "../types";
import {
  createMiniGoals,
  createTimerClock,
  elapsedSecondsFromMs,
  getIntervalPhase,
  intervalDurationsMs,
  normalizeTimerSettings,
  pauseTimerClock,
  readTimerElapsedMs,
  resetMiniGoalProgress,
  startTimerClock,
  timerLimitMs,
} from "./timer";

describe("timer clock", () => {
  it("uses wall-clock deltas instead of interval tick counts", () => {
    const clock = createTimerClock();

    startTimerClock(clock, 10_000);
    expect(readTimerElapsedMs(clock, 12_750)).toBe(2_750);
    expect(elapsedSecondsFromMs(readTimerElapsedMs(clock, 12_750))).toBe(2);

    pauseTimerClock(clock, 13_400);
    expect(clock).toEqual({ elapsedMs: 3_400, startedAtMs: null });

    startTimerClock(clock, 20_000);
    expect(readTimerElapsedMs(clock, 21_250)).toBe(4_650);
  });

  it("does not restart an already running clock", () => {
    const clock = createTimerClock();

    startTimerClock(clock, 1_000);
    startTimerClock(clock, 4_000);

    expect(readTimerElapsedMs(clock, 5_000)).toBe(4_000);
  });

  it("calculates finite timer limits", () => {
    const timer: TimerSettings = {
      kind: "timer",
      durationMinutes: 25,
      pauseWhenMusicPaused: true,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      goal: "",
      miniGoals: [],
      phaseSoundEnabled: true,
      phaseVoiceEnabled: false,
      voicePack: "system",
    };
    const infinite: TimerSettings = {
      kind: "infinite",
      durationMinutes: null,
      pauseWhenMusicPaused: true,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      goal: "",
      miniGoals: [],
      phaseSoundEnabled: true,
      phaseVoiceEnabled: false,
      voicePack: "system",
    };

    expect(timerLimitMs(timer)).toBe(1_500_000);
    expect(timerLimitMs(infinite)).toBeNull();
  });

  it("normalizes legacy settings and safe work goals", () => {
    const normalized = normalizeTimerSettings({
      kind: "intervals",
      durationMinutes: 30,
      pauseWhenMusicPaused: false,
      goal: "  Draft   the outline\nfor tomorrow  ",
    });

    expect(normalized).toEqual({
      kind: "intervals",
      durationMinutes: 30,
      pauseWhenMusicPaused: false,
      workDurationMinutes: 30,
      breakDurationMinutes: 5,
      goal: "Draft the outline for tomorrow",
      userAboutMe: "",
      miniGoals: [],
      phaseSoundEnabled: true,
      phaseVoiceEnabled: true,
      voicePack: "calm-female",
    });
  });

  it("normalizes and retains userAboutMe context", () => {
    const normalized = normalizeTimerSettings({
      kind: "intervals",
      durationMinutes: 25,
      userAboutMe: "  Senior   Developer. React & Node.js  ",
    });

    expect(normalized.userAboutMe).toBe("Senior Developer. React & Node.js");
  });

  it("falls back to goal-free infinite mode for invalid finite storage", () => {
    expect(
      normalizeTimerSettings({
        kind: "timer",
        durationMinutes: 60,
        pauseWhenMusicPaused: true,
        goal: "   ",
      }),
    ).toMatchObject({
      kind: "infinite",
      durationMinutes: null,
      goal: "",
    });
  });

  it("migrates generated text and preserves mini-goal progress safely", () => {
    const generated = createMiniGoals([
      "  Open   the document ",
      "Write the first heading",
    ]);
    const restored = normalizeTimerSettings({
      kind: "timer",
      durationMinutes: 25,
      goal: "Finish the outline",
      miniGoals: [
        { ...generated[0], completed: true },
        generated[1],
      ],
    });

    expect(restored.miniGoals).toEqual([
      { id: "mini-goal-1", text: "Open the document", completed: true },
      { id: "mini-goal-2", text: "Write the first heading", completed: false },
    ]);
    expect(resetMiniGoalProgress(restored.miniGoals)).toEqual([
      { id: "mini-goal-1", text: "Open the document", completed: false },
      { id: "mini-goal-2", text: "Write the first heading", completed: false },
    ]);
  });

  it("derives deterministic work and break phases from wall-clock elapsed time", () => {
    const settings: TimerSettings = {
      kind: "intervals",
      durationMinutes: 25,
      pauseWhenMusicPaused: true,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      goal: "",
      miniGoals: [],
      phaseSoundEnabled: true,
      phaseVoiceEnabled: false,
      voicePack: "system",
    };

    expect(intervalDurationsMs(settings)).toEqual({
      workMs: 25 * 60_000,
      breakMs: 5 * 60_000,
    });
    expect(getIntervalPhase(0, settings)).toMatchObject({
      phase: "work",
      phaseElapsedMs: 0,
      phaseRemainingMs: 25 * 60_000,
      cycleIndex: 0,
    });
    expect(getIntervalPhase(25 * 60_000, settings)).toMatchObject({
      phase: "break",
      phaseElapsedMs: 0,
      phaseRemainingMs: 5 * 60_000,
      cycleIndex: 0,
    });
    expect(getIntervalPhase(30 * 60_000, settings)).toMatchObject({
      phase: "work",
      phaseElapsedMs: 0,
      phaseRemainingMs: 25 * 60_000,
      cycleIndex: 1,
    });
    expect(timerLimitMs(settings)).toBeNull();
  });

  it("preserves cue toggles and defaults missing cue fields", () => {
    expect(
      normalizeTimerSettings({
        kind: "intervals",
        durationMinutes: 25,
        goal: "Stay focused",
        phaseSoundEnabled: false,
        phaseVoiceEnabled: true,
        voicePack: "calm-female",
      }),
    ).toMatchObject({
      phaseSoundEnabled: false,
      phaseVoiceEnabled: true,
      voicePack: "calm-female",
    });
    expect(
      normalizeTimerSettings({
        kind: "timer",
        durationMinutes: 45,
        goal: "Stay focused",
      }),
    ).toMatchObject({
      phaseSoundEnabled: true,
      phaseVoiceEnabled: true,
      voicePack: "calm-female",
    });
    expect(
      normalizeTimerSettings({
        kind: "intervals",
        durationMinutes: 25,
        phaseVoiceEnabled: false,
        voicePack: "system",
      }),
    ).toMatchObject({
      phaseVoiceEnabled: true,
      voicePack: "calm-female",
    });
  });
});
