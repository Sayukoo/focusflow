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
  INTERVAL_BREAK_PRESETS,
  INTERVAL_WORK_PRESETS,
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
import { MiniGoalChecklist } from "../tasks/MiniGoalChecklist";

interface TimerSettingsProps {
  open: boolean;
  settings: TimerSettingsState;
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
    setDraftSettings(activeSettings);
    setGoalDraft(activeSettings.goal);
    setGoalError("");
    setMiniGoals(activeSettings.miniGoals.map((miniGoal) => ({ ...miniGoal })));
    setMiniGoalsError("");
    setClarificationQuestion("");
    setClarificationAnswer("");
  }, [open, activeSettings]);

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
    const goal = settings.kind === "infinite" ? "" : requireGoal();
    if (settings.kind !== "infinite" && !goal) return;
    const next = normalizeTimerSettings({
      ...settings,
      goal,
      miniGoals: settings.kind === "infinite" ? [] : miniGoals,
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
              <div
                className="timer-tabs timer-tabs--primary"
                role="tablist"
                aria-label="Timer type"
              >
                <TimerTab
                  active={settings.kind === "intervals"}
                  icon="intervals"
                  label="Intervals"
                  reducedMotion={shouldReduceMotion}
                  onClick={() => chooseKind("intervals")}
                />
                <TimerTab
                  active={settings.kind === "timer"}
                  icon="stopwatch"
                  label="Timer"
                  reducedMotion={shouldReduceMotion}
                  onClick={() => chooseKind("timer")}
                />
                <TimerTab
                  active={settings.kind === "infinite"}
                  icon="infinity"
                  label="Infinite"
                  reducedMotion={shouldReduceMotion}
                  onClick={() => chooseKind("infinite")}
                />
              </div>

              <div
                className="timer-settings-toggle-strip"
                role="group"
                aria-label="Timer cue settings"
              >
                <KaTeXTooltip formula="\text{Pause when music pauses}">
                  <label className="timer-toggle-row">
                    <span>Pause</span>
                    <input
                      type="checkbox"
                      checked={settings.pauseWhenMusicPaused}
                      aria-label="Pause timer when music is paused"
                      onChange={(event) =>
                        setDraftSettings({
                          ...settings,
                          pauseWhenMusicPaused: event.target.checked,
                        })
                      }
                    />
                    <span className="switch-visual" aria-hidden="true">
                      <span />
                    </span>
                  </label>
                </KaTeXTooltip>

                <KaTeXTooltip formula="\text{Play a soft sound on phase changes}">
                  <label className="timer-toggle-row">
                    <span>Sound</span>
                    <input
                      type="checkbox"
                      checked={settings.phaseSoundEnabled}
                      aria-label="Play a soft sound on work and break transitions"
                      onChange={(event) =>
                        setDraftSettings({
                          ...settings,
                          phaseSoundEnabled: event.target.checked,
                        })
                      }
                    />
                    <span className="switch-visual" aria-hidden="true">
                      <span />
                    </span>
                  </label>
                </KaTeXTooltip>

                <KaTeXTooltip formula="\text{Play the calm female voice pack}">
                  <label className="timer-toggle-row">
                    <span>Voice</span>
                    <input
                      type="checkbox"
                      checked={settings.phaseVoiceEnabled}
                      aria-label="Speak Polish work and break announcements"
                      onChange={(event) =>
                        setDraftSettings({
                          ...settings,
                          phaseVoiceEnabled: event.target.checked,
                        })
                      }
                    />
                    <span className="switch-visual" aria-hidden="true">
                      <span />
                    </span>
                  </label>
                </KaTeXTooltip>
              </div>

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

              {settings.kind === "timer" ? (
                <>
                  <motion.div
                    className="timer-presets"
                    layout={!shouldReduceMotion ? "position" : false}
                  >
                    {TIMER_PRESETS.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className={
                          settings.durationMinutes === minutes
                            ? "timer-preset is-active"
                            : "timer-preset"
                        }
                        aria-label={`Timer duration ${minutes} minutes`}
                        aria-pressed={settings.durationMinutes === minutes}
                        onClick={() => choosePreset(minutes)}
                      >
                        {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`}
                      </button>
                    ))}
                  </motion.div>

                  <motion.div
                    className="timer-custom"
                    layout={!shouldReduceMotion ? "position" : false}
                  >
                    <input
                      type="number"
                      min="1"
                      max={customUnit === "hr" ? 24 : 1440}
                      placeholder="Custom amount"
                      value={customAmount}
                      aria-label="Custom timer amount"
                      onChange={(event) => setCustomAmount(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyCustom();
                      }}
                      onBlur={applyCustom}
                    />
                    <div
                      className="timer-unit-toggle"
                      role="group"
                      aria-label="Timer unit"
                    >
                      <button
                        type="button"
                        className={customUnit === "min" ? "is-active" : undefined}
                        aria-label="Minutes"
                        aria-pressed={customUnit === "min"}
                        onClick={() => {
                          setCustomUnit("min");
                          if (customAmount) {
                            const hours = Number(customAmount);
                            setCustomAmount(
                              String(Math.max(1, Math.round(hours * 60))),
                            );
                          }
                        }}
                      >
                        min
                      </button>
                      <button
                        type="button"
                        className={customUnit === "hr" ? "is-active" : undefined}
                        aria-label="Hours"
                        aria-pressed={customUnit === "hr"}
                        onClick={() => {
                          setCustomUnit("hr");
                          if (customAmount) {
                            const minutes = Number(customAmount);
                            setCustomAmount(
                              String(Math.max(1, Math.round(minutes / 60))),
                            );
                          }
                        }}
                      >
                        hrs
                      </button>
                    </div>
                  </motion.div>
                </>
              ) : null}

              {settings.kind === "intervals" ? (
                <motion.div
                  className="timer-interval-pairs"
                  layout={!shouldReduceMotion ? "position" : false}
                >
                  <motion.div
                    className="timer-interval-group"
                    layout={!shouldReduceMotion ? "position" : false}
                  >
                    <div className="timer-interval-heading">
                      <span>Work</span>
                      <strong>{settings.workDurationMinutes} min</strong>
                    </div>
                    <div
                      className="timer-interval-presets"
                      role="group"
                      aria-label="Work duration presets"
                    >
                      {INTERVAL_WORK_PRESETS.map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          className={
                            settings.workDurationMinutes === minutes
                              ? "timer-interval-preset is-active"
                              : "timer-interval-preset"
                          }
                          aria-label={`Work time ${minutes} minutes`}
                          aria-pressed={settings.workDurationMinutes === minutes}
                          onClick={() => chooseIntervalPreset("work", minutes)}
                        >
                          {minutes}m
                        </button>
                      ))}
                    </div>
                  </motion.div>
                  <motion.div
                    className="timer-interval-group"
                    layout={!shouldReduceMotion ? "position" : false}
                  >
                    <div className="timer-interval-heading">
                      <span>Break</span>
                      <strong>{settings.breakDurationMinutes} min</strong>
                    </div>
                    <div
                      className="timer-interval-presets"
                      role="group"
                      aria-label="Break duration presets"
                    >
                      {INTERVAL_BREAK_PRESETS.map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          className={
                            settings.breakDurationMinutes === minutes
                              ? "timer-interval-preset is-active"
                              : "timer-interval-preset"
                          }
                          aria-label={`Break time ${minutes} minutes`}
                          aria-pressed={settings.breakDurationMinutes === minutes}
                          onClick={() => chooseIntervalPreset("break", minutes)}
                        >
                          {minutes}m
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}

              <motion.div
                className="timer-goal-field"
                layout={!shouldReduceMotion ? "position" : false}
              >
                <div className="timer-goal-label-row">
                  <label htmlFor="timer-work-goal">
                    {settings.kind === "infinite" ? "Finite goal" : "Work goal"}
                  </label>
                  {settings.kind !== "infinite" ? (
                    <KaTeXTooltip
                      formula={
                        miniGoalsLoading
                          ? "\\text{Generating mini-goals}"
                          : "\\text{Generate mini-goals}"
                      }
                    >
                      <button
                        type="button"
                        className={
                          miniGoalsLoading
                            ? "mini-goals-icon-button is-loading"
                            : "mini-goals-icon-button"
                        }
                        aria-label={
                          miniGoalsLoading
                            ? "Generating mini goals"
                            : "Generate mini goals"
                        }
                        aria-busy={miniGoalsLoading}
                        disabled={miniGoalsLoading}
                        onClick={() => void requestMiniGoals()}
                      >
                        <Icon name="sparkles" size={15} />
                      </button>
                    </KaTeXTooltip>
                  ) : null}
                </div>
                <div className="timer-goal-input-wrap">
                  <textarea
                    ref={goalInputRef}
                    id="timer-work-goal"
                    rows={3}
                    maxLength={300}
                    placeholder="Required for finite mode"
                    value={goalDraft}
                    aria-label={
                      settings.kind === "infinite" ? "Finite goal" : "Work goal"
                    }
                    aria-invalid={Boolean(goalError)}
                    aria-describedby={goalError ? "timer-goal-error" : undefined}
                    required={settings.kind !== "infinite"}
                    onChange={(event) => {
                      const nextGoal = event.target.value;
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        commitGoalDraft();
                      }
                    }}
                    onBlur={commitGoalDraft}
                  />
                  <span aria-hidden="true">{goalDraft.length}/300</span>
                </div>
                {goalError ? (
                  <p id="timer-goal-error" className="timer-goal-error" role="alert">
                    {goalError}
                  </p>
                ) : null}
                {miniGoalsLoading ? (
                  <p className="mini-goals-status" role="status" aria-live="polite">
                    Generating…
                  </p>
                ) : null}
                {miniGoalsError ? (
                  <p className="mini-goals-status is-error" role="alert">
                    {miniGoalsError}
                  </p>
                ) : null}
                {clarificationQuestion ? (
                  <div className="mini-goals-clarification" role="group">
                    <p className="mini-goals-clarification-question">
                      {clarificationQuestion}
                    </p>
                    <div className="mini-goals-clarification-controls">
                      <input
                        type="text"
                        value={clarificationAnswer}
                        maxLength={240}
                        aria-label="Clarification answer"
                        placeholder="What should come first?"
                        onChange={(event) =>
                          setClarificationAnswer(event.target.value)
                        }
                      />
                      <button
                        type="button"
                        aria-label="Generate mini goals from clarification"
                        disabled={
                          miniGoalsLoading || !clarificationAnswer.trim()
                        }
                        onClick={() =>
                          void requestMiniGoals(clarificationAnswer)
                        }
                      >
                        Use answer
                      </button>
                    </div>
                  </div>
                ) : null}
                {miniGoals.length > 0 ? (
                  <div className="mini-goals-card" aria-label="Mini goals">
                    <div className="mini-goals-card-heading">
                      <Icon name="sparkles" size={14} />
                      <span>Mini goals</span>
                    </div>
                    <MiniGoalChecklist
                      items={miniGoals}
                      mainGoal={goalDraft}
                      userAboutMe={settings.userAboutMe}
                      workDurationMinutes={settings.workDurationMinutes}
                      label="Mini goals"
                      onChange={handleDraftMiniGoalsChange}
                    />
                  </div>
                ) : null}
              </motion.div>

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
    previous.onClose === next.onClose &&
    previous.onChange === next.onChange
  );
});

interface TimerTabProps {
  active: boolean;
  icon: "infinity" | "stopwatch" | "intervals";
  label: string;
  reducedMotion: boolean;
  onClick: () => void;
}

function TimerTab({
  active,
  icon,
  label,
  reducedMotion,
  onClick,
}: TimerTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      className={active ? "timer-tab is-active" : "timer-tab"}
      onClick={onClick}
    >
      {active ? (
        <motion.span
          className="timer-tab-indicator"
          layoutId="timer-tab-indicator"
          transition={reducedMotion ? { duration: 0 } : undefined}
          aria-hidden="true"
        />
      ) : null}
      <span className="timer-tab-content">
        <Icon name={icon} size={22} />
        <span>{label}</span>
      </span>
    </button>
  );
}
