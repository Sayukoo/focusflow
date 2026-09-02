import { memo, useMemo } from "react";
import {
  formatFocusDuration,
  loadDailyGoalMinutes,
} from "../../lib/analytics";
import { Icon } from "../ui/Icon";

interface FocusStatsBadgeProps {
  streakDays: number;
  todaySeconds: number;
}

/**
 * One-line motivation corner: "🔥 12d · 3h 20m" with a hairline daily-goal
 * progress bar underneath. Deliberately NOT a dashboard — a single quiet
 * glanceable line that lives in the top-left corner.
 */
export const FocusStatsBadge = memo(function FocusStatsBadge({
  streakDays,
  todaySeconds,
}: FocusStatsBadgeProps) {
  const dailyGoalSeconds = useMemo(() => loadDailyGoalMinutes() * 60, []);

  const goalPercent = Math.min(
    100,
    Math.round((todaySeconds / Math.max(1, dailyGoalSeconds)) * 100),
  );
  const goalDone = dailyGoalSeconds > 0 && todaySeconds >= dailyGoalSeconds;

  const title = `Seria: ${streakDays} dni z rzędu · Dzisiaj: ${formatFocusDuration(
    todaySeconds,
  )} z celu ${formatFocusDuration(dailyGoalSeconds)} (${goalPercent}%)`;

  return (
    <div
      className="focus-stats-badge"
      title={title}
      aria-label={`Seria ${streakDays} dni, dzisiaj ${formatFocusDuration(
        todaySeconds,
      )}, dzienny cel ${goalPercent}%`}
    >
      <div className="focus-stats-badge-line">
        <span
          className={`focus-stats-flame ${streakDays > 0 ? "is-active" : ""}`}
          aria-hidden="true"
        >
          <Icon name="flame" size={13} />
        </span>
        <span className="focus-stats-streak">{streakDays}d</span>
        <span className="focus-stats-sep" aria-hidden="true">
          ·
        </span>
        <span className="focus-stats-today">
          {formatFocusDuration(todaySeconds)}
          {goalDone ? " 🏆" : ""}
        </span>
      </div>
      <div
        className="focus-stats-goal-track"
        role="progressbar"
        aria-valuenow={goalPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Dzienny cel skupienia"
      >
        <div
          className={`focus-stats-goal-fill ${goalDone ? "is-completed" : ""}`}
          style={{ width: `${goalPercent}%` }}
        />
      </div>
    </div>
  );
});
