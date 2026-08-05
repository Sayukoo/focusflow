import { useEffect, useState } from "react";
import type { TimerKind, TimerSettings, TimerUnit } from "../types";
import { Icon } from "./Icon";
import { KaTeXTooltip } from "./KaTeXTooltip";

interface TimerSettingsProps {
  open: boolean;
  settings: TimerSettings;
  onClose: () => void;
  onChange: (settings: TimerSettings) => void;
}

const TIMER_PRESETS = [30, 60, 120] as const;

export function TimerSettings({
  open,
  settings,
  onClose,
  onChange,
}: TimerSettingsProps) {
  const [customAmount, setCustomAmount] = useState("");
  const [customUnit, setCustomUnit] = useState<TimerUnit>("min");

  useEffect(() => {
    if (!open) return;
    const minutes = settings.durationMinutes ?? 60;
    if (TIMER_PRESETS.includes(minutes as (typeof TIMER_PRESETS)[number])) {
      setCustomUnit("min");
      setCustomAmount("");
      return;
    }
    const unit: TimerUnit = minutes >= 60 && minutes % 60 === 0 ? "hr" : "min";
    setCustomUnit(unit);
    setCustomAmount(String(unit === "hr" ? minutes / 60 : minutes));
  }, [open, settings.durationMinutes]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const chooseKind = (kind: TimerKind) => {
    if (kind === "infinite") {
      onChange({
        ...settings,
        kind,
        durationMinutes: null,
      });
      return;
    }

    const fallback = kind === "intervals" ? 25 : 60;
    onChange({
      ...settings,
      kind,
      durationMinutes:
        settings.kind === kind && settings.durationMinutes !== null
          ? settings.durationMinutes
          : fallback,
    });
  };

  const choosePreset = (minutes: number) => {
    onChange({
      ...settings,
      kind: "timer",
      durationMinutes: minutes,
    });
  };

  const applyCustom = () => {
    const amount = Number(customAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    onChange({
      ...settings,
      kind: "timer",
      durationMinutes: customUnit === "hr" ? amount * 60 : amount,
    });
  };

  return (
    <div className="timer-settings-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="timer-settings-backdrop"
        aria-label="Close timer settings"
        onClick={onClose}
      />
      <section className="timer-settings-card">
        <div className="timer-settings-atmosphere" aria-hidden="true" />
        <header className="timer-settings-header">
          <span className="timer-settings-title">Timer Settings</span>
          <KaTeXTooltip formula="\text{Close timer settings}">
            <button
              type="button"
              className="icon-btn ghost"
              aria-label="Close timer settings"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </KaTeXTooltip>
        </header>

        <label className="timer-toggle-row">
          <span>Pause timer when music is paused</span>
          <input
            type="checkbox"
            checked={settings.pauseWhenMusicPaused}
            onChange={(event) =>
              onChange({
                ...settings,
                pauseWhenMusicPaused: event.target.checked,
              })
            }
          />
          <span className="switch-visual" aria-hidden="true">
            <span />
          </span>
        </label>

        <div className="timer-tabs" role="tablist" aria-label="Timer type">
          <TimerTab
            active={settings.kind === "infinite"}
            icon="infinity"
            label="INFINITE"
            onClick={() => chooseKind("infinite")}
          />
          <TimerTab
            active={settings.kind === "timer"}
            icon="stopwatch"
            label="TIMER"
            onClick={() => chooseKind("timer")}
          />
          <TimerTab
            active={settings.kind === "intervals"}
            icon="intervals"
            label="INTERVALS"
            onClick={() => chooseKind("intervals")}
          />
        </div>

        <div className="timer-copy">
          <h2>Set Timer</h2>
          <p>Select when you&apos;d like the music to stop playing</p>
        </div>

        <div className="timer-presets">
          {TIMER_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={
                settings.kind === "timer" && settings.durationMinutes === minutes
                  ? "timer-preset is-active"
                  : "timer-preset"
              }
              onClick={() => choosePreset(minutes)}
            >
              {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`}
            </button>
          ))}
        </div>

        <div className="timer-custom">
          <input
            type="number"
            min="1"
            max={customUnit === "hr" ? 24 : 1440}
            placeholder="Custom Amount"
            value={customAmount}
            aria-label="Custom timer amount"
            onChange={(event) => setCustomAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyCustom();
            }}
            onBlur={applyCustom}
          />
          <div className="timer-unit-toggle" role="group" aria-label="Timer unit">
            <button
              type="button"
              className={customUnit === "min" ? "is-active" : undefined}
              onClick={() => {
                setCustomUnit("min");
                if (customAmount) {
                  const hours = Number(customAmount);
                  setCustomAmount(String(Math.max(1, Math.round(hours * 60))));
                }
              }}
            >
              min
            </button>
            <button
              type="button"
              className={customUnit === "hr" ? "is-active" : undefined}
              onClick={() => {
                setCustomUnit("hr");
                if (customAmount) {
                  const minutes = Number(customAmount);
                  setCustomAmount(String(Math.max(1, Math.round(minutes / 60))));
                }
              }}
            >
              hrs
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

interface TimerTabProps {
  active: boolean;
  icon: "infinity" | "stopwatch" | "intervals";
  label: string;
  onClick: () => void;
}

function TimerTab({ active, icon, label, onClick }: TimerTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? "timer-tab is-active" : "timer-tab"}
      onClick={onClick}
    >
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  );
}
