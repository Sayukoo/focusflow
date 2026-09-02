import { memo, type ReactElement, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface HeaderControlsProps {
  windowPinned: boolean;
  windowPinAvailable?: boolean;
  volume?: number;
  onVolume?: (volume: number) => void;
  onSetWindowPinned: (pinned: boolean) => void | Promise<void>;
  onOpenHub: () => void;
  onOpenTimerSettings?: () => void;
  onOpenMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
  leading?: ReactNode;
  /** Zen mode: hide everything except the timer and the goal. */
  zenMode?: boolean;
  onToggleZen?: () => void;
}

// PERF: memo — parent re-renders every timer tick; header is static between ticks.
export const HeaderControls = memo(function HeaderControls({
  windowPinned,
  volume = 1,
  onVolume,
  onSetWindowPinned,
  onOpenHub,
  onOpenTimerSettings,
  onOpenMobileMenu,
  mobileMenuOpen = false,
  leading,
  zenMode = false,
  onToggleZen,
}: HeaderControlsProps): ReactElement {
  const volumePct = Math.round(volume * 100);

  return (
    <div className="focus-top-right">
      {leading}
      {windowPinned && (
        <div className="header-volume-wrapper volume-pin-control">
          <KaTeXTooltip formula={`\\text{Głośność: ${volumePct}\\%}`}>
            <div className="volume header-volume-inline" aria-label="Volume strip">
              <Icon name="volume" size={18} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                style={{ "--vol": `${volumePct}%` } as React.CSSProperties}
                aria-label="Volume slider"
                onChange={(e) => onVolume?.(Number(e.target.value))}
                onInput={(e) => onVolume?.(Number(e.currentTarget.value))}
              />
            </div>
          </KaTeXTooltip>
        </div>
      )}

      {onToggleZen && (
        <KaTeXTooltip
          wrapperClassName="zen-control"
          formula={
            zenMode
              ? "\\text{Wyjdź z trybu Zen}"
              : "\\text{Tryb Zen: tylko timer}"
          }
        >
          <button
            type="button"
            className={
              zenMode
                ? "icon-btn ghost zen-toggle-btn is-active"
                : "icon-btn ghost zen-toggle-btn"
            }
            aria-label={zenMode ? "Exit Zen mode" : "Zen mode — timer only"}
            aria-pressed={zenMode}
            onClick={onToggleZen}
          >
            <Icon name="zen" size={18} />
          </button>
        </KaTeXTooltip>
      )}

      <KaTeXTooltip
        wrapperClassName="window-pin-control"
        formula={
          windowPinned ? "\\text{Odpinij okno (unpin)}" : "\\text{Przypnij okno (pin)}"
        }
      >
        <button
          type="button"
          className={
            windowPinned
              ? "icon-btn ghost window-pin-btn is-active"
              : "icon-btn ghost window-pin-btn"
          }
          aria-label={
            windowPinned
              ? "Unpin window from top right"
              : "Pin window to top right"
          }
          aria-pressed={windowPinned}
          onClick={() => void onSetWindowPinned(!windowPinned)}
        >
          <Icon name="pin" size={18} />
        </button>
      </KaTeXTooltip>

      <KaTeXTooltip formula="\text{Timer}">
        <button
          type="button"
          className="icon-btn ghost timer-header-btn"
          aria-label="Open timer settings"
          onClick={onOpenTimerSettings}
        >
          <Icon name="stopwatch" size={18} />
        </button>
      </KaTeXTooltip>

      <KaTeXTooltip formula="\text{Centrum: muzyka · profile · biblioteka}">
        <button
          type="button"
          className="icon-btn ghost hub-open-btn"
          aria-label="Open hub — music, profiles and library"
          onClick={() => onOpenHub()}
        >
          <Icon name="library" size={18} />
        </button>
      </KaTeXTooltip>

      {onOpenMobileMenu && (
        <KaTeXTooltip wrapperClassName="menu-pin-control" formula="\text{Navigation menu}">
          <button
            type="button"
            className="mobile-menu-trigger"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-controls="mobile-menu"
            aria-expanded={mobileMenuOpen}
            onClick={onOpenMobileMenu}
          >
            <Icon name="menu" size={19} />
          </button>
        </KaTeXTooltip>
      )}
    </div>
  );
});

