import { describe, expect, it, beforeEach } from "vitest";
import {
  addFocusTime,
  calculateStreak,
  createDefaultAnalyticsStore,
  formatDailyFocusSummary,
  formatFocusDuration,
  getLocalDateString,
  getPolishSessionsLabel,
  getTodayStats,
  getWeeklyFocusStats,
  loadAnalyticsStore,
  recordCompletedSession,
  saveAnalyticsStore,
} from "./analytics";

describe("analytics module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("formatFocusDuration", () => {
    it("formats 0 seconds as 0m", () => {
      expect(formatFocusDuration(0)).toBe("0m");
    });

    it("formats minutes correctly", () => {
      expect(formatFocusDuration(45 * 60)).toBe("45m");
      expect(formatFocusDuration(50)).toBe("0m");
      expect(formatFocusDuration(90)).toBe("1m");
    });

    it("formats hours and minutes correctly", () => {
      expect(formatFocusDuration(2 * 3600 + 15 * 60)).toBe("2h 15m");
      expect(formatFocusDuration(2 * 3600)).toBe("2h");
    });
  });

  describe("getPolishSessionsLabel", () => {
    it("handles singular (1 sesja)", () => {
      expect(getPolishSessionsLabel(1)).toBe("1 sesja");
    });

    it("handles 2-4 sesje", () => {
      expect(getPolishSessionsLabel(2)).toBe("2 sesje");
      expect(getPolishSessionsLabel(3)).toBe("3 sesje");
      expect(getPolishSessionsLabel(4)).toBe("4 sesje");
      expect(getPolishSessionsLabel(22)).toBe("22 sesje");
    });

    it("handles 0 or 5+ sesji", () => {
      expect(getPolishSessionsLabel(0)).toBe("0 sesji");
      expect(getPolishSessionsLabel(5)).toBe("5 sesji");
      expect(getPolishSessionsLabel(12)).toBe("12 sesji");
      expect(getPolishSessionsLabel(14)).toBe("14 sesji");
      expect(getPolishSessionsLabel(25)).toBe("25 sesji");
    });
  });

  describe("formatDailyFocusSummary", () => {
    it("formats full summary in Polish", () => {
      expect(formatDailyFocusSummary(2 * 3600 + 15 * 60, 5)).toBe(
        "Dzisiaj: 2h 15m skupienia · 5 sesji",
      );
      expect(formatDailyFocusSummary(45 * 60, 1)).toBe(
        "Dzisiaj: 45m skupienia · 1 sesja",
      );
      expect(formatDailyFocusSummary(0, 0)).toBe(
        "Dzisiaj: 0m skupienia · 0 sesji",
      );
    });
  });

  describe("store CRUD and tracking", () => {
    it("creates default store", () => {
      const store = createDefaultAnalyticsStore();
      expect(store.version).toBe(1);
      expect(store.history).toEqual({});
    });

    it("saves and loads store from localStorage", () => {
      let store = createDefaultAnalyticsStore();
      store = addFocusTime(store, 120, "2026-08-07");
      store = recordCompletedSession(store, "2026-08-07");
      saveAnalyticsStore(store);

      const loaded = loadAnalyticsStore();
      expect(loaded.history["2026-08-07"]).toEqual({
        date: "2026-08-07",
        focusTimeSeconds: 120,
        sessionsCount: 1,
      });
    });

    it("adds focus time and records sessions for today", () => {
      const today = getLocalDateString();
      let store = createDefaultAnalyticsStore();
      store = addFocusTime(store, 300);
      store = addFocusTime(store, 600);
      store = recordCompletedSession(store);

      const stats = getTodayStats(store, today);
      expect(stats.focusTimeSeconds).toBe(900);
      expect(stats.sessionsCount).toBe(1);
    });

    it("loads store from legacy storage key if present", () => {
      localStorage.setItem(
        "brainfm.analytics",
        JSON.stringify({
          history: {
            "2026-08-07": { date: "2026-08-07", focusTimeSeconds: 1800, sessionsCount: 2 },
          },
        }),
      );

      const loaded = loadAnalyticsStore();
      expect(loaded.history["2026-08-07"]).toEqual({
        date: "2026-08-07",
        focusTimeSeconds: 1800,
        sessionsCount: 2,
      });
    });
  });

  describe("calculateStreak", () => {
    it("returns 0 if no history", () => {
      const store = createDefaultAnalyticsStore();
      expect(calculateStreak(store, "2026-08-07")).toBe(0);
    });

    it("calculates 1 day streak when active today", () => {
      let store = createDefaultAnalyticsStore();
      store = addFocusTime(store, 600, "2026-08-07");
      expect(calculateStreak(store, "2026-08-07")).toBe(1);
    });

    it("calculates multi-day streak ending today", () => {
      let store = createDefaultAnalyticsStore();
      store = addFocusTime(store, 600, "2026-08-05");
      store = addFocusTime(store, 600, "2026-08-06");
      store = addFocusTime(store, 600, "2026-08-07");
      expect(calculateStreak(store, "2026-08-07")).toBe(3);
    });

    it("retains streak from yesterday if user hasn't focused yet today", () => {
      let store = createDefaultAnalyticsStore();
      store = addFocusTime(store, 600, "2026-08-05");
      store = addFocusTime(store, 600, "2026-08-06");
      // 2026-08-07 has no entries yet
      expect(calculateStreak(store, "2026-08-07")).toBe(2);
    });

    it("breaks streak if a day is missed", () => {
      let store = createDefaultAnalyticsStore();
      store = addFocusTime(store, 600, "2026-08-03"); // missed 2026-08-04
      store = addFocusTime(store, 600, "2026-08-05");
      store = addFocusTime(store, 600, "2026-08-06");
      expect(calculateStreak(store, "2026-08-06")).toBe(2);
    });
  });

  describe("getWeeklyFocusStats", () => {
    it("returns 7 days of stats with proper day labels and sums", () => {
      let store = createDefaultAnalyticsStore();
      store = addFocusTime(store, 3600, "2026-08-06"); // 1 hour
      store = recordCompletedSession(store, "2026-08-06");
      store = addFocusTime(store, 1800, "2026-08-07"); // 30 mins
      store = recordCompletedSession(store, "2026-08-07");

      const stats = getWeeklyFocusStats(store, "2026-08-07");
      expect(stats.days).toHaveLength(7);
      expect(stats.days[6].isToday).toBe(true);
      expect(stats.days[6].focusTimeSeconds).toBe(1800);
      expect(stats.days[5].focusTimeSeconds).toBe(3600);
      expect(stats.totalWeeklySeconds).toBe(5400);
      expect(stats.totalWeeklySessions).toBe(2);
    });
  });
});
