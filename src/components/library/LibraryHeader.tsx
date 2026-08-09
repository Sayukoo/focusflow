import { memo } from "react";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface LibraryHeaderProps {
  activeProfileName: string;
  musicDir: string;
  busy: boolean;
  onOpenFolder: () => void;
  onClose: () => void;
}

export const LibraryHeader = memo(function LibraryHeader({
  activeProfileName,
  musicDir,
  busy,
  onOpenFolder,
  onClose,
}: LibraryHeaderProps) {
  const escapedDir = musicDir.replace(/\\/g, "\\\\");

  return (
    <header className="library-header">
      <div className="library-heading">
        <span className="library-glyph" aria-hidden="true">
          <Icon name="music-library" size={22} />
        </span>
        <div>
          <strong className="library-title">{activeProfileName}</strong>
          <span className="library-breadcrumb">FocusFlow / profile music</span>
        </div>
      </div>

      <div className="library-actions">
        <KaTeXTooltip formula={`\\text{Open in Explorer:}~\\texttt{${escapedDir}}`}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Open folder in Explorer"
            disabled={busy}
            onClick={onOpenFolder}
          >
            <Icon name="folder" size={18} />
          </button>
        </KaTeXTooltip>
        <KaTeXTooltip formula="\text{Close}">
          <button
            type="button"
            className="icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </KaTeXTooltip>
      </div>
    </header>
  );
});
