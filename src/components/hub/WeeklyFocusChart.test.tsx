import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeeklyFocusChart } from "./WeeklyFocusChart";
import {
  addFocusTime,
  createDefaultAnalyticsStore,
  getLocalDateString,
  recordCompletedSession,
} from "../../lib/analytics";

describe("WeeklyFocusChart", () => {
  it("renders 7-day bar chart with daily values and streak", () => {
    const today = getLocalDateString();
    let store = createDefaultAnalyticsStore();

    // Add 2 hours and 1 session to today
    store = addFocusTime(store, 7200, today);
    store = recordCompletedSession(store, today);

    // Add 30 mins to yesterday
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getLocalDateString(yesterdayDate);
    store = addFocusTime(store, 1800, yesterday);
    store = recordCompletedSession(store, yesterday);

    const { container } = render(<WeeklyFocusChart store={store} />);

    // Header total check
    expect(screen.getByText(/2h 30m skupienia/)).toBeInTheDocument();
    expect(screen.getByText(/2 sesje/)).toBeInTheDocument();
    expect(screen.getByText(/2d/)).toBeInTheDocument();

    // 7 column check
    const columns = container.querySelectorAll(".analytics-bar-col");
    expect(columns).toHaveLength(7);

    // Today column check
    const todayCol = container.querySelector(".analytics-bar-col.is-today");
    expect(todayCol).toBeInTheDocument();
    expect(todayCol?.querySelector(".analytics-bar-val")?.textContent).toBe("2h");

    // Check bar fills: today has height, inactive day has 0%
    const fills = container.querySelectorAll(".analytics-bar-fill");
    expect(fills).toHaveLength(7);

    const todayFill = todayCol?.querySelector(".analytics-bar-fill") as HTMLElement;
    expect(todayFill.style.height).toBe("100%"); // Today is the max (2h)

    // Non-active day check
    const inactiveCol = Array.from(columns).find(
      (col) => !col.classList.contains("is-today") && col.querySelector(".analytics-bar-val")?.textContent === "—",
    );
    expect(inactiveCol).toBeDefined();
    const inactiveFill = inactiveCol?.querySelector(".analytics-bar-fill") as HTMLElement;
    expect(inactiveFill.style.height).toBe("0%");
  });

  it("handles completely empty analytics store without errors", () => {
    const store = createDefaultAnalyticsStore();
    const { container } = render(<WeeklyFocusChart store={store} />);

    expect(screen.getByText(/0m skupienia/)).toBeInTheDocument();
    expect(screen.getByText(/0 sesji/)).toBeInTheDocument();

    const columns = container.querySelectorAll(".analytics-bar-col");
    expect(columns).toHaveLength(7);

    // All days should show "—" and 0% height
    columns.forEach((col) => {
      expect(col.querySelector(".analytics-bar-val")?.textContent).toBe("—");
      const fill = col.querySelector(".analytics-bar-fill") as HTMLElement;
      expect(fill.style.height).toBe("0%");
    });
  });
});
