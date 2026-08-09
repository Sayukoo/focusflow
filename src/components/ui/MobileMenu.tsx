import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  formatFocusDuration,
  getPolishSessionsLabel,
  getWeeklyFocusStats,
  loadDailyGoalMinutes,
  saveDailyGoalMinutes,
  type FocusAnalyticsStore,
} from "../../lib/analytics";
import type { FocusAnalyticsSummary } from "../settings/ProfilePicker";
import { Icon } from "./Icon";
import { KaTeXTooltip } from "./KaTeXTooltip";

interface MobileMenuProps {
  open: boolean;
  profileLabel: string;
  durationLabel: string;
  trackCount: number;
  favoritesOnly: boolean;
  volume: number;
  isPlaying: boolean;
  windowPinned: boolean;
  windowPinAvailable: boolean;
  analyticsSummary?: FocusAnalyticsSummary;
  analyticsStore?: FocusAnalyticsStore;
  onClose: () => void;
  onOpenTimer: () => void;
  onOpenLibrary: () => void;
  onOpenProfiles: () => void;
  onOpenShortcuts?: () => void;
  onSetFavoritesOnly: (enabled: boolean) => void;
  onVolume: (value: number) => void;
  onTogglePlay: () => void | Promise<void>;
  onSetWindowPinned: (pinned: boolean) => void | Promise<void>;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function MobileMenu({
  open,
  profileLabel,
  durationLabel,
  trackCount,
  favoritesOnly,
  volume,
  isPlaying,
  windowPinned,
  windowPinAvailable,
  analyticsSummary,
  analyticsStore,
  onClose,
  onOpenTimer,
  onOpenLibrary,
  onOpenProfiles,
  onOpenShortcuts,
  onSetFavoritesOnly,
  onVolume,
  onTogglePlay,
  onSetWindowPinned,
}: MobileMenuProps) {
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
  const shouldReduceMotion = useReducedMotion() ?? false;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const activeElement = document.activeElement;
    previousFocusRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [open]);

  const restoreFocus = () => {
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    if (!previousFocus?.isConnected) return;
    previousFocus.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !menuRef.current) return;

    const focusableElements = Array.from(
      menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const activeIndex = focusableElements.indexOf(
      document.activeElement as HTMLElement,
    );
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (activeIndex === -1 || (event.shiftKey && activeIndex === 0)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && activeIndex === focusableElements.length - 1) {
      event.preventDefault();
      first.focus();
    }
  };

  const panelTransition = shouldReduceMotion
    ? { duration: 0 }
    : {
        type: "spring" as const,
        stiffness: 380,
        damping: 34,
        mass: 0.72,
      };
  const backdropTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: "easeOut" as const };

  return (
    <AnimatePresence initial={false} onExitComplete={restoreFocus}>
      {open ? (
        <motion.div
          key="mobile-menu"
          className="mobile-menu-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
        >
          <motion.button
            type="button"
            className="mobile-menu-backdrop"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
          />
          <motion.aside
            ref={menuRef}
            id="mobile-menu"
            className="mobile-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 0, x: "1.5rem" }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: "1rem" }
            }
            transition={panelTransition}
          >
            <header className="mobile-menu-header">
              <div className="mobile-menu-brand">
                <span className="mobile-menu-eyebrow">
                  <span className="mobile-menu-dot" aria-hidden="true" />
                  FOCUSFLOW
                </span>
                <strong id="mobile-menu-title">Quick controls</strong>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="icon-btn ghost mobile-menu-close"
                aria-label="Close menu"
                onClick={onClose}
              >
                <Icon name="close" size={18} />
              </button>
            </header>

            <nav className="mobile-menu-list" aria-label="Quick controls">
              <button
                type="button"
                className={`mobile-menu-item mobile-menu-item--session ${isPlaying ? "is-playing" : ""}`}
                onClick={() => void onTogglePlay()}
              >
                <span className="mobile-menu-item-icon" aria-hidden="true">
                  <Icon name={isPlaying ? "pause" : "play"} size={19} />
                </span>
                <span className="mobile-menu-item-copy">
                  <strong>{isPlaying ? "Pause session" : "Start session"}</strong>
                  <small>Timer + audio</small>
                </span>
                <Icon name="chevron-down" size={16} className="mobile-menu-arrow" />
              </button>

              <button
                type="button"
                className="mobile-menu-item mobile-menu-item--timer"
                onClick={onOpenTimer}
              >
                <span className="mobile-menu-item-icon" aria-hidden="true">
                  <Icon name="stopwatch" size={20} />
                </span>
                <span className="mobile-menu-item-copy">
                  <strong>Timer</strong>
                  <small>{durationLabel}</small>
                </span>
                <Icon name="chevron-down" size={16} className="mobile-menu-arrow" />
              </button>

              <button
                type="button"
                className="mobile-menu-item mobile-menu-item--library"
                onClick={onOpenLibrary}
              >
                <span className="mobile-menu-item-icon" aria-hidden="true">
                  <Icon name="library" size={20} />
                </span>
                <span className="mobile-menu-item-copy">
                  <strong>Music library</strong>
                  <small>{trackCount} tracks</small>
                </span>
                <Icon name="chevron-down" size={16} className="mobile-menu-arrow" />
              </button>

              <button
                type="button"
                className="mobile-menu-item mobile-menu-item--profile"
                onClick={onOpenProfiles}
              >
                <span
                  className="mobile-menu-item-icon mobile-menu-profile-dot"
                  aria-hidden="true"
                />
                <span className="mobile-menu-item-copy">
                  <strong>Profile</strong>
                  <small>{profileLabel}</small>
                </span>
                <Icon name="chevron-down" size={16} className="mobile-menu-arrow" />
              </button>

              <button
                type="button"
                className={
                  favoritesOnly
                    ? "mobile-menu-item mobile-menu-item--favorites is-active"
                    : "mobile-menu-item mobile-menu-item--favorites"
                }
                aria-pressed={favoritesOnly}
                onClick={() => onSetFavoritesOnly(!favoritesOnly)}
              >
                <span className="mobile-menu-item-icon" aria-hidden="true">
                  <Icon name="heart" size={19} />
                </span>
                <span className="mobile-menu-item-copy">
                  <strong>Favorites queue</strong>
                  <small>{favoritesOnly ? "Enabled" : "All tracks"}</small>
                </span>
                <span
                  className="mobile-menu-check"
                  aria-hidden="true"
                >
                  {favoritesOnly ? <Icon name="check" size={16} /> : null}
                </span>
              </button>

              {onOpenShortcuts ? (
                <button
                  type="button"
                  className="mobile-menu-item mobile-menu-item--shortcuts"
                  onClick={() => {
                    onClose();
                    onOpenShortcuts();
                  }}
                >
                  <span className="mobile-menu-item-icon" aria-hidden="true">
                    <Icon name="keyboard" size={19} />
                  </span>
                  <span className="mobile-menu-item-copy">
                    <strong>Skróty klawiszowe</strong>
                    <small>Pomoc & hotkeye (?)</small>
                  </span>
                  <Icon name="chevron-down" size={16} className="mobile-menu-arrow" />
                </button>
              ) : null}
            </nav>

            <section className="mobile-menu-section" aria-label="Audio">
              <div className="mobile-menu-section-heading">
                <span>Audio</span>
                <output>{Math.round(volume * 100)}%</output>
              </div>
              <label className="mobile-menu-volume">
                <Icon name="volume" size={18} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  aria-label="Volume"
                  onChange={(event) => onVolume(Number(event.target.value))}
                />
              </label>
            </section>

            <section className="mobile-menu-section" aria-label="Window">
              <button
                type="button"
                className={
                  windowPinned
                    ? "mobile-menu-item mobile-menu-pin is-active"
                    : "mobile-menu-item mobile-menu-pin"
                }
                aria-pressed={windowPinned}
                disabled={!windowPinAvailable}
                onClick={() => void onSetWindowPinned(!windowPinned)}
              >
                <span className="mobile-menu-item-icon" aria-hidden="true">
                  <Icon name="pin" size={19} />
                </span>
                <span className="mobile-menu-item-copy">
                  <strong>
                    {windowPinned ? "Unpin window" : "Pin top-right"}
                  </strong>
                  <small>
                    {windowPinAvailable
                      ? "Always on top"
                      : "Desktop Tauri only"}
                  </small>
                </span>
                <span className="mobile-menu-check" aria-hidden="true">
                  {windowPinned ? <Icon name="check" size={16} /> : null}
                </span>
              </button>
            </section>

            <section className="mobile-menu-section mobile-menu-analytics-section" aria-label="Statystyki skupienia">
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
                    <span className="streak-badge">{streakDays > 0 ? `${streakDays}d` : "0d"}</span>
                  </div>

                  <div className="daily-goal-stats-badge" title="Dzienny cel Deep Work">
                    🎯 {formatFocusDuration(todaySeconds)} / {formatFocusDuration(targetSeconds)}
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
                        const formattedDuration = formatFocusDuration(day.focusTimeSeconds);
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
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
