import { useState, type DragEvent } from "react";
import type { Track } from "../types";
import { Icon } from "./Icon";
import { KaTeXTooltip } from "./KaTeXTooltip";

interface MusicLibraryProps {
  open: boolean;
  tracks: Track[];
  currentTrackId: string | null;
  musicDir: string;
  busy: boolean;
  onClose: () => void;
  onImport: () => void;
  onAddLink: (url: string) => void;
  onDropFiles: (files: File[]) => void;
  onRefresh: () => void;
  onOpenFolder: () => void;
  onSelect: (trackId: string) => void;
  onRemove: (track: Track) => void;
}

export function MusicLibrary({
  open,
  tracks,
  currentTrackId,
  musicDir,
  busy,
  onClose,
  onImport,
  onAddLink,
  onDropFiles,
  onRefresh,
  onOpenFolder,
  onSelect,
  onRemove,
}: MusicLibraryProps) {
  const [dragActive, setDragActive] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  if (!open) return null;

  const escapedDir = musicDir.replace(/\\/g, "\\\\");

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!busy) setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (!busy) {
      onDropFiles(Array.from(event.dataTransfer.files));
    }
  };

  return (
    <div className="library-overlay" role="dialog" aria-modal="true" aria-label="Library">
      <button className="library-backdrop" aria-label="Close library" onClick={onClose} />
      <aside className="library-panel library-manager">
        <header className="library-header">
          <div className="library-heading">
            <span className="library-glyph" aria-hidden="true">
              <Icon name="folder-open" size={22} />
            </span>
            <div>
              <strong className="library-title">Music folder</strong>
              <span className="library-breadcrumb">FocusFlow / music</span>
            </div>
          </div>

          <div className="library-actions">
            <KaTeXTooltip formula="\text{Upload audio files}">
              <button
                type="button"
                className="icon-btn"
                aria-label="Upload audio files"
                disabled={busy}
                onClick={onImport}
              >
                <Icon name="plus" size={19} />
              </button>
            </KaTeXTooltip>
            <KaTeXTooltip formula="\text{Add a YouTube link}">
              <button
                type="button"
                className={linkOpen ? "icon-btn is-active" : "icon-btn"}
                aria-label="Add YouTube link"
                disabled={busy}
                onClick={() => setLinkOpen((value) => !value)}
              >
                <Icon name="link" size={18} />
              </button>
            </KaTeXTooltip>
            <KaTeXTooltip formula="\text{Refresh folder}">
              <button
                type="button"
                className="icon-btn"
                aria-label="Refresh folder"
                disabled={busy}
                onClick={onRefresh}
              >
                <Icon name="refresh" size={18} />
              </button>
            </KaTeXTooltip>
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
              <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                <Icon name="close" size={18} />
              </button>
            </KaTeXTooltip>
          </div>
        </header>

        <div
          className={dragActive ? "library-dropzone is-dragging" : "library-dropzone"}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="dropzone-icon" aria-hidden="true">
            <Icon name="folder-open" size={25} />
            <Icon name="plus" size={12} />
          </span>
          <strong>{dragActive ? "Release to upload" : "Drop music here"}</strong>
          <span className="dropzone-hint">or</span>
          <button
            type="button"
            className="upload-button"
            disabled={busy}
            onClick={onImport}
          >
            <Icon name="plus" size={16} />
            Upload files
          </button>
          <small>MP3 · WAV · OGG · FLAC · M4A · AAC</small>
        </div>

        {linkOpen ? (
          <form
            className="link-import-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!linkValue.trim() || busy) return;
              onAddLink(linkValue);
              setLinkValue("");
              setLinkOpen(false);
            }}
          >
            <div className="link-import-heading">
              <Icon name="link" size={16} />
              <span>Add YouTube link</span>
            </div>
            <div className="link-import-controls">
              <input
                type="url"
                value={linkValue}
                placeholder="https://youtube.com/watch?v=..."
                aria-label="YouTube link"
                onChange={(event) => setLinkValue(event.target.value)}
              />
              <button type="submit" disabled={busy || !linkValue.trim()}>
                Add
              </button>
            </div>
          </form>
        ) : null}

        <div className="library-toolbar">
          <span className="library-toolbar-title">Files</span>
          <span className="library-toolbar-count">{tracks.length} items</span>
        </div>

        {tracks.length === 0 ? (
          <div className="library-empty library-empty--manager">
            <Icon name="music" size={28} />
            <span>Your folder is empty</span>
          </div>
        ) : (
          <div className="library-grid">
            {tracks.map((track) => {
              const active = track.id === currentTrackId;
              return (
                <article
                  key={track.id}
                  className={active ? "track-card is-active" : "track-card"}
                >
                  <KaTeXTooltip formula={`\\text{Play }${escapeTex(track.title)}`}>
                    <button
                      type="button"
                      className="track-card-main"
                      aria-label={`Play ${track.title}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => onSelect(track.id)}
                    >
                      <span
                        className="track-card-art"
                        aria-hidden="true"
                        style={
                          track.thumbnail
                            ? {
                                backgroundImage: `linear-gradient(135deg, rgba(14, 25, 45, 0.18), rgba(17, 9, 28, 0.5)), url("${track.thumbnail}")`,
                              }
                            : undefined
                        }
                      >
                        <Icon name="music" size={25} />
                        <span className="track-card-play">
                          <Icon name="play" size={12} />
                        </span>
                      </span>
                      <span className="track-card-title">{track.title}</span>
                      <span className="track-card-meta">
                        {track.source === "youtube"
                          ? `${track.author ?? "YouTube"} · link`
                          : `${track.extension.toUpperCase()} · local file`}
                      </span>
                    </button>
                  </KaTeXTooltip>
                  <KaTeXTooltip
                    formula={`\\text{Remove }\\texttt{${escapeTex(track.filename)}}`}
                  >
                    <button
                      type="button"
                      className="track-card-delete"
                      aria-label={`Remove ${track.title}`}
                      disabled={busy}
                      onClick={() => onRemove(track)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </KaTeXTooltip>
                </article>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}
