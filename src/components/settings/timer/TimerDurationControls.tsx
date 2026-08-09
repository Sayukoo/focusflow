import { motion } from "framer-motion";
import {
  INTERVAL_BREAK_PRESETS,
  INTERVAL_WORK_PRESETS,
  type TimerSettings,
  type TimerUnit,
} from "../../../types";

const TIMER_PRESETS = [25, 45, 90] as const;

interface TimerDurationControlsProps {
  settings: TimerSettings;
  customAmount: string;
  customUnit: TimerUnit;
  shouldReduceMotion: boolean;
  onCustomAmountChange: (value: string) => void;
  onCustomUnitChange: (unit: TimerUnit) => void;
  onChoosePreset: (minutes: number) => void;
  onChooseIntervalPreset: (type: "work" | "break", minutes: number) => void;
  onApplyCustom: () => void;
}

export function TimerDurationControls({
  settings,
  customAmount,
  customUnit,
  shouldReduceMotion,
  onCustomAmountChange,
  onCustomUnitChange,
  onChoosePreset,
  onChooseIntervalPreset,
  onApplyCustom,
}: TimerDurationControlsProps) {
  if (settings.kind === "timer") {
    return (
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
              onClick={() => onChoosePreset(minutes)}
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
            onChange={(event) => onCustomAmountChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onApplyCustom();
            }}
            onBlur={onApplyCustom}
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
                onCustomUnitChange("min");
                if (customAmount) {
                  const hours = Number(customAmount);
                  onCustomAmountChange(
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
                onCustomUnitChange("hr");
                if (customAmount) {
                  const minutes = Number(customAmount);
                  onCustomAmountChange(
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
    );
  }

  if (settings.kind === "intervals") {
    return (
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
                onClick={() => onChooseIntervalPreset("work", minutes)}
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
                onClick={() => onChooseIntervalPreset("break", minutes)}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return null;
}
