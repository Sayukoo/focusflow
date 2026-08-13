import { useEffect, useRef, useState } from "react";
import type { TimerSettings } from "../../types";
import { AppLockSection } from "../settings/timer/AppLockSection";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface AppLockButtonProps {
  settings: TimerSettings;
  onChange: (next: TimerSettings) => void;
}

export function AppLockButton({ settings, onChange }: AppLockButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="app-lock-popover-wrap" ref={wrapRef}>
      <KaTeXTooltip
        formula={
          settings.appLockEnabled
            ? "\\text{Block other apps: on}"
            : "\\text{Block other apps}"
        }
      >
        <button
          type="button"
          className={
            settings.appLockEnabled
              ? "icon-btn ghost app-lock-btn is-active"
              : "icon-btn ghost app-lock-btn"
          }
          aria-label="Block other apps during focus sessions"
          aria-pressed={settings.appLockEnabled}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          🔒
        </button>
      </KaTeXTooltip>

      {open ? (
        <div
          className="app-lock-popover"
          role="dialog"
          aria-label="Block other apps settings"
        >
          <AppLockSection settings={settings} onChange={onChange} />
        </div>
      ) : null}
    </div>
  );
}
