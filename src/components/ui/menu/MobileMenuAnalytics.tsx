import { useMemo, useState } from "react";
import {
  formatFocusDuration,
  getPolishSessionsLabel,
  getWeeklyFocusStats,
  loadDailyGoalMinutes,
  saveDailyGoalMinutes,
  type FocusAnalyticsStore,
} from "../../../lib/analytics";
import type { FocusAnalyticsSummary } from "../../settings/ProfilePicker";
import { Icon } from "../Icon";
import { KaTeXTooltip } from "../KaTeXTooltip";

interface MobileMenuAnalyticsProps {
  analyticsSummary?: FocusAnalyticsSummary;
  analyticsStore?: FocusAnalyticsStore;
}

export function MobileMenuAnalytics({
  analyticsSummary,
  analyticsStore,
}: MobileMenuAnalyticsProps) {
  const [dailyGoalMins, setDailyGoalMins] = useState(() =>
    loadDailyGoalMinutes(),
  );

  const weeklyStats = useMemo(() => {
    if (!analyticsStore) return null;
    return getWeeklyFocusStats(analyticsStore);
  }, [analyticsStore]);

  const handleSelectGoalMins = (mins: number) => {
    setDailyGoalMins(mins);
    saveDailyGoalMinutes(mins);
  };

  const todaySeconds = analyticsSummary?.todaySeconds ?? 0;
  const targetSeconds = dailyGoalMins * 60;
  const goalProgressPercent = Math.min(
    100,
    Math.round((todaySeconds / Math.max(1, targetSeconds)) * 100),
  );
  const isGoalCompleted = todaySeconds >= targetSeconds && targetSeconds > 0;
  const streakDays = analyticsSummary?.streakDays ?? 0;

  return (
    <section
      className="mobile-menu-section mobile-menu-analytics-section"
      aria-label="Statystyki skupienia"
    >
      <div className="mobile-menu-section-heading">
        <span>Statystyki</span>
        {weeklyStats && weeklyStats.totalWeeklySeconds > 0 ? (
          <output title="Łączny czas skupienia w tym tygodniu">
            W tym tygodniu: {formatFocusDuration(weeklyStats.totalWeeklySeconds)}
          </output>
        ) : null}
      </div>
      <div className="profile-analytics-card">
        <div className="profile-analytics-top-row">
          <div className="profile-analytics-streak" title="Seria dni z rzędu">
            <span
              className={`streak-flame-icon ${streakDays > 0 ? "is-active" : ""}`}
              aria-hidden="true"
            >
              <Icon name="flame" size={16} />
            </span>
            <span className="streak-badge">
              {streakDays > 0 ? `${streakDays}d` : "0d"}
            </span>
          </div>

          <div
            className="daily-goal-stats-badge"
            title="Dzienny cel Deep Work"
          >
            🎯 {formatFocusDuration(todaySeconds)} /{" "}
            {formatFocusDuration(targetSeconds)}
          </div>
        </div>

        {weeklyStats ? (
          <div className="analytics-chart-wrap" aria-label="7-day focus chart">
            <div className="analytics-chart-bars">
              {weeklyStats.days.map((day) => {
                const heightPercent = Math.min(
                  100,
                  Math.max(
                    8,
                    Math.round(
                      (day.focusTimeSeconds / weeklyStats.maxSeconds) * 100,
                    ),
                  ),
                );
                const formattedDuration = formatFocusDuration(
                  day.focusTimeSeconds,
                );
                const dayTitle = `${day.date} (${day.dayLabel}): ${formattedDuration} · ${getPolishSessionsLabel(day.sessionsCount)}`;
                return (
                  <KaTeXTooltip
                    key={day.date}
                    formula={`\\text{${day.dayLabel}: ${formattedDuration} (${day.sessionsCount} sesj.)}`}
                  >
                    <div
                      className={`analytics-bar-col ${day.isToday ? "is-today" : ""}`}
                      title={dayTitle}
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
        ) : null}

        <div className="daily-goal-card">
          <div className="daily-goal-progress-wrap">
            <div className="daily-goal-progress-track">
              <div
                className={`daily-goal-progress-fill ${isGoalCompleted ? "is-completed" : ""}`}
                style={{ width: `${goalProgressPercent}%` }}
              />
            </div>
          </div>

          {isGoalCompleted ? (
            <div className="daily-goal-trophy-badge" role="status">
              <span className="trophy-emoji">🏆</span>
              <span>Cel Dnia Osiągnięty!</span>
            </div>
          ) : null}

          <div className="daily-goal-presets">
            {[60, 120, 180, 240].map((mins) => {
              const label = `${mins / 60}h`;
              const active = dailyGoalMins === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  className={`daily-goal-chip ${active ? "is-active" : ""}`}
                  onClick={() => handleSelectGoalMins(mins)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
