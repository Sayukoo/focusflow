import type { ReactElement } from "react";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface HeaderControlsProps {
  windowPinned: boolean;
  windowPinAvailable?: boolean;
  onSetWindowPinned: (pinned: boolean) => void | Promise<void>;
  onToggleLibrary: (open: boolean) => void;
  onToggleProfilePicker: (open: boolean) => void;
}

export function HeaderControls({
  windowPinned,
  onSetWindowPinned,
  onToggleLibrary,
  onToggleProfilePicker,
}: HeaderControlsProps): ReactElement {
  return (
    <div className="focus-top-right">
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
          className="icon-btn ghost"
          aria-label="Open music library"
          onClick={() => onToggleLibrary(true)}
        >
          <Icon name="folder-open" size={18} />
        </button>
      </KaTeXTooltip>

      <KaTeXTooltip formula="\text{Account \& Profiles}">
        <button
          type="button"
          className="icon-btn ghost"
          aria-label="Account & Profiles"
          onClick={() => onToggleProfilePicker(true)}
        >
          <Icon name="user" size={18} />
        </button>
      </KaTeXTooltip>
    </div>
  );
}
