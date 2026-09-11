import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  useEffect,
  memo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  type TimerKind,
  type TimerSettings as TimerSettingsState,
  type TimerUnit,
} from "../../types";
import {
  generateMiniGoalsDetailed,
  hasGeminiConfiguration,
} from "../../lib/gemini";
import {
  createMiniGoals,
  normalizeGoal,
  normalizeTimerSettings,
} from "../../lib/timer";
import type { MiniGoal } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";
import { TimerTypeTabs } from "./timer/TimerTypeTabs";
import { TimerDurationControls } from "./timer/TimerDurationControls";
import { TimerGoalSection } from "./timer/TimerGoalSection";
import { AppLockSection } from "./timer/AppLockSection";

interface TimerSettingsProps {
  open: boolean;
  settings: TimerSettingsState;
  /** Hide the type tabs and duration grid — used when a preset (e.g. the
   * 25/5 quick-start button) already decided those and only the goal is
   * left to fill in. */
  compact?: boolean;
  initialFocus?: "goal" | "subtask";
  onClose: () => void;
  onChange: (settings: TimerSettingsState) => void;
}

const TIMER_PRESETS = [25, 45, 90] as const;
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const TimerSettings = memo(function TimerSettings({
  open,
  settings: activeSettings,
  compact = false,
  initialFocus,
  onClose,
  onChange,
}: TimerSettingsProps) {
  const [draftSettings, setDraftSettings] = useState(activeSettings);
  const settings = draftSettings;
  const [customAmount, setCustomAmount] = useState("");
  const [customUnit, setCustomUnit] = useState<TimerUnit>("min");
  const [goalDraft, setGoalDraft] = useState(activeSettings.goal);
  const [goalError, setGoalError] = useState("");
  const [miniGoals, setMiniGoals] = useState<MiniGoal[]>([]);
  const [miniGoalsLoading, setMiniGoalsLoading] = useState(false);
  const [miniGoalsError, setMiniGoalsError] = useState("");
  const [clarificationQuestion, setClarificationQuestion] = useState("");
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const shouldReduceMotion = useReducedMotion() ?? false;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const goalInputRef = useRef<HTMLTextAreaElement | null>(null);
  const miniGoalsRequestRef = useRef<AbortController | null>(null);
  const miniGoalsRequestIdRef = useRef(0);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (settings.kind !== "timer") {
      setCustomAmount("");
      setCustomUnit("min");
      return;
    }
    const minutes = settings.durationMinutes ?? 60;
    if (TIMER_PRESETS.includes(minutes as (typeof TIMER_PRESETS)[number])) {
      setCustomUnit("min");
      setCustomAmount("");
      return;
    }
    const unit: TimerUnit = minutes >= 60 && minutes % 60 === 0 ? "hr" : "min";
    setCustomUnit(unit);
    setCustomAmount(String(unit === "hr" ? minutes / 60 : minutes));
  }, [open, settings.kind, settings.durationMinutes]);

  useEffect(() => {
    if (!open) return;
    if (activeSettings.kind === "infinite" && initialFocus === "goal") {
      setDraftSettings({
        ...activeSettings,
        kind: "intervals",
        durationMinutes: 25,
        workDurationMinutes: 25,
        breakDurationMinutes: 5,
      });
    } else {
      setDraftSettings(activeSettings);
    }
    setGoalDraft(activeSettings.goal);
    setGoalError("");
    setMiniGoals(activeSettings.miniGoals.map((miniGoal) => ({ ...miniGoal })));
    setMiniGoalsError("");
    setClarificationQuestion("");
    setClarificationAnswer("");
  }, [open, activeSettings, initialFocus]);

  useEffect(
    () => () => {
      miniGoalsRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    const activeElement = document.activeElement;
    previousFocusRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;
    const focusTimer = window.setTimeout(() => {
      if (initialFocus === "goal") {
        goalInputRef.current?.focus({ preventScroll: true });
      } else if (initialFocus === "subtask") {
        const subtaskInput = dialogRef.current?.querySelector<HTMLInputElement>(
          ".mini-goal-add-input",
        );
        if (subtaskInput) {
          subtaskInput.focus({ preventScroll: true });
        } else {
          goalInputRef.current?.focus({ preventScroll: true });
        }
      } else {
        closeButtonRef.current?.focus({ preventScroll: true });
      }
    }, 50);

    return () => window.clearTimeout(focusTimer);
  }, [open, initialFocus]);

  const restoreFocus = () => {
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    if (!previousFocus?.isConnected) return;
    previousFocus.focus({ preventScroll: true });
  };

  const handleModalKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
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

  const requireGoal = (): string | null => {
    const goal = normalizeGoal(goalDraft);
    if (!goal) {
      setGoalError("Enter a goal before choosing a finite timer.");
      window.setTimeout(() => goalInputRef.current?.focus(), 0);
      return null;
    }
    setGoalDraft(goal);
    setGoalError("");
    return goal;
  };

  const cancelMiniGoals = () => {
    miniGoalsRequestIdRef.current += 1;
    miniGoalsRequestRef.current?.abort();
    miniGoalsRequestRef.current = null;
    setMiniGoalsLoading(false);
  };

  useEffect(() => {
    if (open) return;
    miniGoalsRequestIdRef.current += 1;
    miniGoalsRequestRef.current?.abort();
    miniGoalsRequestRef.current = null;
    setMiniGoalsLoading(false);
  }, [open]);

  const requestMiniGoals = async (answer = "") => {
    const goal = requireGoal();
    if (!goal) return;

    cancelMiniGoals();
    const requestId = miniGoalsRequestIdRef.current;
    const controller = new AbortController();
    miniGoalsRequestRef.current = controller;
    setMiniGoals([]);
    setMiniGoalsError("");
    setMiniGoalsLoading(true);

    try {
      const generated = await generateMiniGoalsDetailed(
        goal,
        {
          kind: settings.kind === "intervals" ? "intervals" : "timer",
          workDurationMinutes:
            settings.kind === "intervals"
              ? settings.workDurationMinutes
              : settings.durationMinutes ?? 60,
          breakDurationMinutes:
            settings.kind === "intervals"
              ? settings.breakDurationMinutes
              : null,
          userAboutMe: settings.userAboutMe,
        },
        controller.signal,
        answer,
      );
      if (
        controller.signal.aborted ||
        requestId !== miniGoalsRequestIdRef.current
      ) {
        return;
      }
      if (generated.miniGoals.length === 0) {
        if (generated.clarifyingQuestion) {
          setClarificationQuestion(generated.clarifyingQuestion);
          setMiniGoalsError("");
          return;
        }
        setMiniGoalsError(
          hasGeminiConfiguration()
            ? "No mini-goals returned."
            : "Gemini setup required.",
        );
        return;
      }
      const finalGoal = generated.improvedGoal || goal;
      if (generated.improvedGoal) {
        setGoalDraft(generated.improvedGoal);
      }
      const generatedMiniGoals = createMiniGoals(generated.miniGoals);
      setClarificationQuestion("");
      setClarificationAnswer("");
      setMiniGoals(generatedMiniGoals);
      setDraftSettings((current) => ({
        ...current,
        goal: finalGoal,
        miniGoals: generatedMiniGoals,
      }));
    } catch {
      if (
        controller.signal.aborted ||
        requestId !== miniGoalsRequestIdRef.current
      ) {
        return;
      }
      setMiniGoalsError("Gemini request failed.");
    } finally {
      if (requestId === miniGoalsRequestIdRef.current) {
        setMiniGoalsLoading(false);
        miniGoalsRequestRef.current = null;
      }
    }
  };

  const commitFiniteSettings = (next: TimerSettingsState): void => {
    setClarificationQuestion("");
    setClarificationAnswer("");
    setDraftSettings({
      ...next,
      goal: normalizeGoal(goalDraft) || next.goal,
      miniGoals,
    });
  };

  const commitGoalDraft = () => {
    if (settings.kind === "infinite") {
      setGoalDraft(normalizeGoal(goalDraft));
      setGoalError("");
      return;
    }
    const goal = requireGoal();
    if (!goal) return;
    setDraftSettings({ ...settings, goal, miniGoals });
  };

  const handleDraftMiniGoalsChange = (next: MiniGoal[]) => {
    setMiniGoals(next);
    setDraftSettings((current) => ({
      ...current,
      miniGoals: next,
    }));
  };

  const handleClose = () => {
    cancelMiniGoals();
    setGoalError("");
    onClose();
  };

  const handleApply = () => {
    let effectiveSettings = settings;
    if (settings.kind === "infinite" && goalDraft.trim()) {
      effectiveSettings = {
        ...settings,
        kind: "intervals",
        durationMinutes: 25,
        workDurationMinutes: 25,
        breakDurationMinutes: 5,
      };
    }
    const goal = effectiveSettings.kind === "infinite" ? "" : requireGoal();
    if (effectiveSettings.kind !== "infinite" && !goal) return;
    const next = normalizeTimerSettings({
      ...effectiveSettings,
      goal,
      miniGoals: effectiveSettings.kind === "infinite" ? [] : miniGoals,
    });
    onChange(next);
    onClose();
  };

  const chooseKind = (kind: TimerKind) => {
    if (kind === "infinite") {
      cancelMiniGoals();
      setMiniGoals([]);
      setMiniGoalsError("");
      setClarificationQuestion("");
      setClarificationAnswer("");
      setGoalDraft("");
      setGoalError("");
      setDraftSettings({
        ...settings,
        kind,
        durationMinutes: null,
        goal: "",
        miniGoals: [],
      });
      return;
    }

    if (kind === "intervals") {
      const workDurationMinutes =
        settings.kind === "intervals"
          ? settings.workDurationMinutes
          : settings.durationMinutes ?? 25;
      const breakDurationMinutes =
        settings.kind === "intervals"
          ? settings.breakDurationMinutes
          : 5;
      commitFiniteSettings({
        ...settings,
        kind,
        durationMinutes: workDurationMinutes,
        workDurationMinutes,
        breakDurationMinutes,
      });
      return;
    }

    const fallback =
      settings.kind === "intervals"
        ? settings.workDurationMinutes
        : 45;
    commitFiniteSettings({
      ...settings,
      kind,
      durationMinutes:
        settings.kind === kind && settings.durationMinutes !== null
          ? settings.durationMinutes
          : fallback,
    });
  };

  const choosePreset = (minutes: number) => {
    commitFiniteSettings({
      ...settings,
      kind: "timer",
      durationMinutes: minutes,
    });
  };

  const chooseIntervalPreset = (
    type: "work" | "break",
    minutes: number,
  ) => {
    commitFiniteSettings({
      ...settings,
      kind: "intervals",
      durationMinutes:
        type === "work" ? minutes : settings.workDurationMinutes,
      workDurationMinutes:
        type === "work" ? minutes : settings.workDurationMinutes,
      breakDurationMinutes:
        type === "break" ? minutes : settings.breakDurationMinutes,
    });
  };

  const applyCustom = () => {
    if (settings.kind !== "timer") return;
    const amount = Number(customAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    commitFiniteSettings({
      ...settings,
      kind: "timer",
      durationMinutes: customUnit === "hr" ? amount * 60 : amount,
    });
  };

  const backdropTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: "easeOut" as const };
  const panelTransition = shouldReduceMotion
    ? { duration: 0 }
    : {
        type: "spring" as const,
        stiffness: 380,
        damping: 32,
        mass: 0.72,
      };

  return (
    <AnimatePresence initial={false} onExitComplete={restoreFocus}>
      {open ? (
        <motion.div
          key="timer-settings"
          className="timer-settings-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
        >
          <motion.button
            type="button"
            className="timer-settings-backdrop"
            aria-label="Close timer settings"
            tabIndex={-1}
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
          />
          <motion.section
            ref={dialogRef}
            id="timer-settings-dialog"
            className="timer-settings-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="timer-settings-title"
            aria-describedby="timer-settings-description"
            tabIndex={-1}
            onKeyDown={handleModalKeyDown}
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 0, y: 18, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10, scale: 0.98 }
            }
            transition={panelTransition}
            layout={!shouldReduceMotion}
          >
            <div className="timer-settings-atmosphere" aria-hidden="true" />
            <div className="timer-settings-close-wrap">
              <KaTeXTooltip formula="\text{Close timer settings}">
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="icon-btn ghost timer-settings-close"
                  aria-label="Close timer settings"
                  onClick={handleClose}
                >
                  <Icon name="close" />
                </button>
              </KaTeXTooltip>
            </div>
            <header className="timer-settings-header">
              <span id="timer-settings-title" className="timer-settings-title">
                Timer Settings
              </span>
            </header>

            <motion.div
              className="timer-settings-body"
              layout={!shouldReduceMotion}
            >
              {!compact ? (
                <>
                  <TimerTypeTabs
                    kind={settings.kind}
                    shouldReduceMotion={shouldReduceMotion}
                    onChooseKind={chooseKind}
                  />

                  <motion.div
                    className="timer-copy"
                    layout={!shouldReduceMotion ? "position" : false}
                  >
                    <h2>
                      {settings.kind === "infinite"
                        ? "Infinite"
                        : settings.kind === "intervals"
                          ? "Intervals"
                          : "Timer"}
                    </h2>
                    <p id="timer-settings-description">
                      {settings.kind === "infinite"
                        ? "No end time"
                        : settings.kind === "intervals"
                          ? "Work and break cycle"
                          : "Session duration"}
                    </p>
                  </motion.div>

                  <TimerDurationControls
                    settings={settings}
                    customAmount={customAmount}
                    customUnit={customUnit}
                    shouldReduceMotion={shouldReduceMotion}
                    onCustomAmountChange={setCustomAmount}
                    onCustomUnitChange={setCustomUnit}
                    onChoosePreset={choosePreset}
                    onChooseIntervalPreset={chooseIntervalPreset}
                    onApplyCustom={applyCustom}
                  />
                </>
              ) : null}

              <TimerGoalSection
                settings={settings}
                goalDraft={goalDraft}
                goalError={goalError}
                miniGoals={miniGoals}
                miniGoalsLoading={miniGoalsLoading}
                miniGoalsError={miniGoalsError}
                clarificationQuestion={clarificationQuestion}
                clarificationAnswer={clarificationAnswer}
                shouldReduceMotion={shouldReduceMotion}
                goalInputRef={goalInputRef}
                onGoalChange={(nextGoal) => {
                  setMiniGoalsError("");
                  setClarificationQuestion("");
                  setClarificationAnswer("");
                  setGoalDraft(nextGoal);
                  setDraftSettings((current) => ({
                    ...current,
                    goal: normalizeGoal(nextGoal),
                  }));
                  if (nextGoal.trim()) setGoalError("");
                }}
                onGoalCommit={commitGoalDraft}
                onRequestMiniGoals={requestMiniGoals}
                onClarificationAnswerChange={setClarificationAnswer}
                onMiniGoalsChange={handleDraftMiniGoalsChange}
              />

              <AppLockSection
                settings={draftSettings}
                onChange={(next) =>
                  setDraftSettings(normalizeTimerSettings(next))
                }
              />

              <div className="timer-settings-actions">
                <button
                  type="button"
                  className="timer-settings-cancel"
                  aria-label="Cancel timer settings"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="timer-settings-apply"
                  aria-label="Apply timer settings"
                  onClick={handleApply}
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}, (previous, next) => {
  if (previous.open !== next.open) return false;
  if (!previous.open) return true;
  return (
    previous.settings === next.settings &&
    previous.compact === next.compact &&
    previous.onClose === next.onClose &&
    previous.onChange === next.onChange
  );
});
