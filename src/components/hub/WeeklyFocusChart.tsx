import { useMemo } from "react";
import {
  calculateStreak,
  formatFocusDuration,
  getPolishSessionsLabel,
  getWeeklyFocusStats,
  type FocusAnalyticsStore,
} from "../../lib/analytics";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface WeeklyFocusChartProps {
  store: FocusAnalyticsStore;
}

/**
 * Seven-day focus-time bar chart for the hub panel. Pure CSS bars reusing the
 * analytics chart primitives from the mobile menu — no chart library needed.
 */
export function WeeklyFocusChart({ store }: WeeklyFocusChartProps) {
  const weekly = useMemo(() => getWeeklyFocusStats(store), [store]);
  const streakDays = useMemo(() => calculateStreak(store), [store]);

  return (
    <section
      className="hub-section hub-section--stats"
      aria-label="Statystyki tygodnia"
    >
      <div className="hub-stats-header">
        <h3 className="hub-stats-title">
          <Icon name="chart-bar" size={14} />
          Statystyki tygodnia
        </h3>
        <div className="hub-stats-meta">
          <span className="hub-stats-total">
            {formatFocusDuration(weekly.totalWeeklySeconds)} skupienia
          </span>
          <span aria-hidden="true">·</span>
          <span>{getPolishSessionsLabel(weekly.totalWeeklySessions)}</span>
          <span
            className={
              streakDays > 0 ? "hub-stats-streak is-active" : "hub-stats-streak"
            }
            title="Seria dni z rzędu"
          >
            <Icon name="flame" size={13} />
            {streakDays}d
          </span>
        </div>
      </div>

      <div
        className="analytics-chart-wrap hub-analytics-chart"
        role="img"
        aria-label={`Wykres skupienia z ostatnich 7 dni: ${formatFocusDuration(
          weekly.totalWeeklySeconds,
        )}`}
      >
        <div className="analytics-chart-bars">
          {weekly.days.map((day) => {
            const heightPercent = Math.min(
              100,
              Math.max(
                8,
                Math.round((day.focusTimeSeconds / weekly.maxSeconds) * 100),
              ),
            );
            const formattedDuration = formatFocusDuration(day.focusTimeSeconds);
            return (
              <KaTeXTooltip
                key={day.date}
                formula={`\\text{${day.dayLabel}: ${formattedDuration} (${day.sessionsCount} sesj.)}`}
              >
                <div
                  className={`analytics-bar-col ${day.isToday ? "is-today" : ""}`}
                  title={`${day.date}: ${formattedDuration}`}
                >
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="analytics-bar-label">{day.dayLabel}</span>
                </div>
              </KaTeXTooltip>
            );
          })}
        </div>
      </div>
    </section>
  );
}
