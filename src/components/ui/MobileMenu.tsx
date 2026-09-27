import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  memo,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { FocusAnalyticsStore } from "../../lib/analytics";
import type { FocusAnalyticsSummary } from "../settings/ProfilePicker";
import { Icon } from "./Icon";
import { MobileMenuAnalytics } from "./menu/MobileMenuAnalytics";

interface MobileMenuProps {
  open: boolean;
  profileLabel: string;
  durationLabel: string;
  trackCount: number;
  favoritesOnly: boolean;
  volume: number;
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

// PERF: memo — parent re-renders every timer tick; the menu is almost always
// closed, so skip its whole framer-motion tree unless something changed.
export const MobileMenu = memo(function MobileMenu({
  open,
  profileLabel,
  durationLabel,
  trackCount,
  favoritesOnly,
  volume,
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
  onSetWindowPinned,
}: MobileMenuProps) {
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

            <nav className="mobile-menu-grid" aria-label="Quick controls">
              <button
                type="button"
                className="mobile-menu-icon-btn"
                onClick={onOpenTimer}
                title={`Timer — ${durationLabel}`}
                aria-label={`Timer — ${durationLabel}`}
              >
                <span className="mobile-menu-icon-btn-icon" aria-hidden="true">
                  <Icon name="stopwatch" size={20} />
                </span>
                <span className="mobile-menu-icon-btn-label">Timer</span>
              </button>

              <button
                type="button"
                className="mobile-menu-icon-btn"
                onClick={onOpenLibrary}
                title={`Music library — ${trackCount} tracks`}
                aria-label={`Music library — ${trackCount} tracks`}
              >
                <span className="mobile-menu-icon-btn-icon" aria-hidden="true">
                  <Icon name="library" size={20} />
                </span>
                <span className="mobile-menu-icon-btn-label">Library</span>
              </button>

              <button
                type="button"
                className="mobile-menu-icon-btn"
                onClick={onOpenProfiles}
                title={`Profile — ${profileLabel}`}
                aria-label={`Profile — ${profileLabel}`}
              >
                <span className="mobile-menu-icon-btn-icon" aria-hidden="true">
                  <Icon name="user" size={19} />
                </span>
                <span className="mobile-menu-icon-btn-label">Profile</span>
              </button>

              <button
                type="button"
                className={
                  favoritesOnly
                    ? "mobile-menu-icon-btn is-active"
                    : "mobile-menu-icon-btn"
                }
                aria-pressed={favoritesOnly}
                onClick={() => onSetFavoritesOnly(!favoritesOnly)}
                title={favoritesOnly ? "Favorites only — on" : "Favorites only — off"}
                aria-label={favoritesOnly ? "Favorites only — on" : "Favorites only — off"}
              >
                <span className="mobile-menu-icon-btn-icon" aria-hidden="true">
                  <Icon name="heart" size={19} />
                </span>
                <span className="mobile-menu-icon-btn-label">Favs</span>
                <span
                  className="mobile-menu-icon-btn-dot"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                className={
                  windowPinned
                    ? "mobile-menu-icon-btn is-active"
                    : "mobile-menu-icon-btn"
                }
                aria-pressed={windowPinned}
                disabled={!windowPinAvailable}
                onClick={() => void onSetWindowPinned(!windowPinned)}
                title={
                  windowPinAvailable
                    ? windowPinned
                      ? "Unpin window"
                      : "Pin top-right — always on top"
                    : "Pin available in desktop app only"
                }
                aria-label={
                  windowPinned ? "Unpin window" : "Pin window on top"
                }
              >
                <span className="mobile-menu-icon-btn-icon" aria-hidden="true">
                  <Icon name="pin" size={19} />
                </span>
                <span className="mobile-menu-icon-btn-label">Pin</span>
                <span
                  className="mobile-menu-icon-btn-dot"
                  aria-hidden="true"
                />
              </button>

              {onOpenShortcuts ? (
                <button
                  type="button"
                  className="mobile-menu-icon-btn"
                  onClick={() => {
                    onClose();
                    onOpenShortcuts();
                  }}
                  title="Keyboard shortcuts (?)"
                  aria-label="Keyboard shortcuts"
                >
                  <span className="mobile-menu-icon-btn-icon" aria-hidden="true">
                    <Icon name="keyboard" size={19} />
                  </span>
                  <span className="mobile-menu-icon-btn-label">Keys</span>
                </button>
              ) : null}
            </nav>

            <section className="mobile-menu-volume-row" aria-label="Volume">
              <Icon name="volume" size={17} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volume"
                onChange={(event) => onVolume(Number(event.target.value))}
              />
              <output>{Math.round(volume * 100)}%</output>
            </section>

            <MobileMenuAnalytics
              analyticsSummary={analyticsSummary}
              analyticsStore={analyticsStore}
            />
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
});
