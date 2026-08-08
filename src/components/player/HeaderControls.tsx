import { useState, useRef, useEffect, type ReactElement } from "react";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface HeaderControlsProps {
  windowPinned: boolean;
  windowPinAvailable?: boolean;
  volume?: number;
  onVolume?: (volume: number) => void;
  onSetWindowPinned: (pinned: boolean) => void | Promise<void>;
  onToggleLibrary: (open: boolean) => void;
  onToggleProfilePicker: (open: boolean) => void;
  onOpenMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export function HeaderControls({
  windowPinned,
  volume = 1,
  onVolume,
  onSetWindowPinned,
  onToggleLibrary,
  onToggleProfilePicker,
  onOpenMobileMenu,
  mobileMenuOpen = false,
}: HeaderControlsProps): ReactElement {
  const [showVolumePopover, setShowVolumePopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showVolumePopover) return;
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowVolumePopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showVolumePopover]);

  const volumePct = Math.round(volume * 100);

  return (
    <div className="focus-top-right">
      <div className="header-volume-wrapper volume-pin-control" ref={popoverRef}>
        <KaTeXTooltip formula={`\\text{Głośność: ${volumePct}\\%}`}>
          <button
            type="button"
            className="icon-btn ghost header-volume-btn"
            aria-label={`Volume ${volumePct}%`}
            onClick={() => setShowVolumePopover((prev) => !prev)}
          >
            <Icon name="volume" size={18} />
          </button>
        </KaTeXTooltip>

        {showVolumePopover && (
          <div className="header-volume-popover">
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
            <span className="header-volume-text">{volumePct}%</span>
          </div>
        )}
      </div>

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

      <KaTeXTooltip formula="\text{Music library}">
        <button
          type="button"
          className="icon-btn ghost music-library-btn"
          aria-label="Open music library"
          onClick={() => onToggleLibrary(true)}
        >
          <Icon name="music-library" size={18} />
        </button>
      </KaTeXTooltip>

      <KaTeXTooltip formula="\text{Account \& Profiles}">
        <button
          type="button"
          className="icon-btn ghost profile-btn"
          aria-label="Account & Profiles"
          onClick={() => onToggleProfilePicker(true)}
        >
          <Icon name="user" size={18} />
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
}
