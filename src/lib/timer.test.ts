import { describe, expect, it } from "vitest";
import type { TimerSettings } from "../types";
import {
  createMiniGoals,
  createTimerClock,
  elapsedSecondsFromMs,
  getIntervalPhase,
  intervalDurationsMs,
  isFocusAnalyticsEligible,
  normalizeMiniGoalText,
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
      discordRpcEnabled: true,
      appLockEnabled: false,
      allowedApps: [],
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
      discordRpcEnabled: true,
      appLockEnabled: false,
      allowedApps: [],
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
      breakMiniGoals: [],
      phaseSoundEnabled: true,
      phaseVoiceEnabled: true,
      voicePack: "calm-female",
      discordRpcEnabled: true,
      appLockEnabled: false,
      allowedApps: [],
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

  it("preserves long mini-goal text without truncation", () => {
    const longText =
      "Wybierz jeden temat, który autentycznie Cię ciekawi (nie musi być idealnie naukowy, wystarczy, że jest dla Ciebie fascynujący i zachęca do dalszego researchu).";

    expect(normalizeMiniGoalText(longText)).toBe(longText);
    expect(createMiniGoals([longText])[0]?.text).toBe(longText);
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
      discordRpcEnabled: true,
      appLockEnabled: false,
      allowedApps: [],
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

  describe("isFocusAnalyticsEligible", () => {
    it("rejects untargeted or infinite sessions", () => {
      expect(isFocusAnalyticsEligible(null)).toBe(false);
      expect(isFocusAnalyticsEligible(undefined)).toBe(false);

      // Default settings with empty goal
      expect(
        isFocusAnalyticsEligible({
          kind: "intervals",
          goal: "",
          workDurationMinutes: 25,
          durationMinutes: 25,
          miniGoals: [],
        }),
      ).toBe(false);

      // Infinite mode should never count towards focus stats
      expect(
        isFocusAnalyticsEligible({
          kind: "infinite",
          goal: "",
          durationMinutes: null,
          workDurationMinutes: 25,
          miniGoals: [],
        }),
      ).toBe(false);

      // Even if infinite mode somehow has text, it remains ineligible because no duration is set
      expect(
        isFocusAnalyticsEligible({
          kind: "infinite",
          goal: "Relaxing with music",
          durationMinutes: null,
          workDurationMinutes: 25,
          miniGoals: [],
        }),
      ).toBe(false);
    });

    it("rejects sessions without a goal or with empty whitespace goal", () => {
      expect(
        isFocusAnalyticsEligible({
          kind: "timer",
          goal: "   ",
          durationMinutes: 30,
          workDurationMinutes: 25,
          miniGoals: [],
        }),
      ).toBe(false);

      expect(
        isFocusAnalyticsEligible({
          kind: "intervals",
          goal: "  \n\t  ",
          durationMinutes: 25,
          workDurationMinutes: 25,
          miniGoals: [],
        }),
      ).toBe(false);
    });

    it("accepts finite sessions with an active goal and positive minutes", () => {
      expect(
        isFocusAnalyticsEligible({
          kind: "timer",
          goal: "Finish project documentation",
          durationMinutes: 45,
          workDurationMinutes: 25,
          miniGoals: [],
        }),
      ).toBe(true);

      expect(
        isFocusAnalyticsEligible({
          kind: "intervals",
          goal: "Deep work session 1",
          durationMinutes: 25,
          workDurationMinutes: 25,
          miniGoals: [],
        }),
      ).toBe(true);
    });

    it("accepts sessions when subtasks/mini-goals are present even if main goal text is pending", () => {
      expect(
        isFocusAnalyticsEligible({
          kind: "intervals",
          goal: "",
          durationMinutes: 25,
          workDurationMinutes: 25,
          miniGoals: [
            { id: "g1", text: "Write intro paragraph", completed: false },
          ],
        }),
      ).toBe(true);
    });

    it("rejects timer mode if duration is zero or negative", () => {
      expect(
        isFocusAnalyticsEligible({
          kind: "timer",
          goal: "Test goal",
          durationMinutes: 0,
          workDurationMinutes: 25,
          miniGoals: [],
        }),
      ).toBe(false);
    });
  });
});
