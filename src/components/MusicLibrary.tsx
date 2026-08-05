import { memo, useEffect, useState, type DragEvent } from "react";
import type { Track } from "../types";
import { Icon } from "./Icon";
import { KaTeXTooltip } from "./KaTeXTooltip";

interface MusicLibraryProps {
  open: boolean;
  tracks: Track[];
  activeProfileName: string;
  currentTrackCategory: string | null;
  currentTrackId: string | null;
  favoriteTrackIds: string[];
  favoritesOnly: boolean;
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
  onToggleFavorite: (trackId: string) => void;
  onSetFavoritesOnly: (enabled: boolean) => void;
}

type LibraryTab = "featured" | "genres" | "favorites" | "recent";

export const MusicLibrary = memo(function MusicLibrary({
  open,
  tracks,
  activeProfileName,
  currentTrackCategory,
  currentTrackId,
  favoriteTrackIds,
  favoritesOnly,
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
  onToggleFavorite,
  onSetFavoritesOnly,
}: MusicLibraryProps) {
  const [dragActive, setDragActive] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    favoritesOnly ? "favorites" : "featured",
  );
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(
    currentTrackId,
  );

  useEffect(() => {
    if (favoritesOnly) setActiveTab("favorites");
  }, [favoritesOnly]);

  useEffect(() => {
    setActiveTab("featured");
  }, [activeProfileName]);

  useEffect(() => {
    setExpandedTrackId(currentTrackId);
  }, [currentTrackId]);

  if (!open) return null;

  const escapedDir = musicDir.replace(/\\/g, "\\\\");
  const visibleTracks =
    activeTab === "favorites"
      ? tracks.filter((track) => favoriteTrackIds.includes(track.id))
      : activeTab === "genres"
        ? [...tracks].sort((a, b) =>
            `${a.category ?? ""}${a.title}`.localeCompare(
              `${b.category ?? ""}${b.title}`,
            ),
          )
        : activeTab === "recent"
          ? [...tracks].reverse()
          : tracks;

  const selectTab = (tab: LibraryTab) => {
    setActiveTab(tab);
    onSetFavoritesOnly(tab === "favorites");
  };

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
              <strong className="library-title">{activeProfileName}</strong>
              <span className="library-breadcrumb">FocusFlow / profile music</span>
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
            <KaTeXTooltip formula="\text{Add a streaming link}">
              <button
                type="button"
                className={linkOpen ? "icon-btn is-active" : "icon-btn"}
                aria-label="Add YouTube, Spotify, SoundCloud or TikTok link"
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
              <span>Add streaming link</span>
            </div>
            <div className="link-import-controls">
              <input
                type="url"
                value={linkValue}
                placeholder="YouTube · Spotify · SoundCloud · TikTok URL"
                aria-label="YouTube, Spotify, SoundCloud or TikTok link"
                onChange={(event) => setLinkValue(event.target.value)}
              />
              <button type="submit" disabled={busy || !linkValue.trim()}>
                Add
              </button>
            </div>
          </form>
        ) : null}

        <div className="library-tabs" role="tablist" aria-label="Music library views">
          {(
            [
              ["featured", "Wyróżniony"],
              ["genres", "Gatunki"],
              ["favorites", "Ulubione"],
              ["recent", "Ostatni"],
            ] as const
          ).map(([tab, label]) => (
            <button
              type="button"
              role="tab"
              key={tab}
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "is-active" : undefined}
              onClick={() => selectTab(tab)}
            >
              {tab === "favorites" ? <Icon name="heart" size={13} /> : null}
              {label}
            </button>
          ))}
        </div>

        <div className="library-toolbar">
          <h2 className="library-section-title">
            {activeTab === "favorites" ? "Moje Ulubione" : activeProfileName}
          </h2>
          <span className="library-toolbar-count">{visibleTracks.length} items</span>
        </div>

        {visibleTracks.length === 0 ? (
          <div className="library-empty library-empty--manager">
            <Icon name="music" size={28} />
            <span>
              {activeTab === "favorites"
                ? "No favorite tracks"
                : "Your profile is empty"}
            </span>
          </div>
        ) : (
          <div className="library-grid">
            {visibleTracks.map((track) => {
              const active = track.id === currentTrackId;
              const expanded = track.id === expandedTrackId;
              const favorite = favoriteTrackIds.includes(track.id);
              return (
                <article
                  key={track.id}
                  className={[
                    "track-card",
                    active ? "is-active" : "",
                    expanded ? "is-expanded" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <KaTeXTooltip
                    placement="top"
                    formula="\text{Play}"
                  >
                    <button
                      type="button"
                      className="track-card-main"
                      aria-label={`Play ${track.title}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        setExpandedTrackId(track.id);
                        onSelect(track.id);
                      }}
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
                          : track.source === "spotify"
                            ? `${track.author ?? "Spotify"} · ${track.providerKind ?? "link"}`
                            : track.source === "soundcloud"
                              ? `${track.author ?? "SoundCloud"} · link`
                              : track.source === "tiktok"
                                ? `${track.author ?? "TikTok"} · link`
                                : `${track.extension.toUpperCase()} · local file`}
                      </span>
                    </button>
                  </KaTeXTooltip>
                  {expanded ? (
                    <div className="track-card-details">
                      <div className="track-detail-grid">
                        <div>
                          <span>KATEGORIA</span>
                          <strong>
                            {track.category ??
                              (active ? currentTrackCategory : null) ??
                              "AI pending"}
                          </strong>
                        </div>
                        <div>
                          <span>ŹRÓDŁO</span>
                          <strong>
                            {track.source
                              ? `${track.source} stream`
                              : `${track.extension.toUpperCase()} local`}
                          </strong>
                        </div>
                        <div>
                          <span>AUTOR</span>
                          <strong>{track.author ?? "FocusFlow library"}</strong>
                        </div>
                        <div>
                          <span>AKTYWNOŚĆ</span>
                          <strong>{activeProfileName}</strong>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <KaTeXTooltip
                    placement="left"
                    formula={favorite ? "\\text{Remove favorite}" : "\\text{Add favorite}"}
                  >
                    <button
                      type="button"
                      className={
                        favorite
                          ? "track-card-favorite is-favorite"
                          : "track-card-favorite"
                      }
                      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                      aria-pressed={favorite}
                      onClick={() => onToggleFavorite(track.id)}
                    >
                      <Icon name="heart" size={14} />
                    </button>
                  </KaTeXTooltip>
                  <KaTeXTooltip
                    placement="left"
                    formula={`\\text{Delete from profile:}~\\texttt{${escapeTex(track.filename)}}`}
                  >
                    <button
                      type="button"
                      className="track-card-delete"
                      aria-label={`Delete ${track.title} from ${activeProfileName}`}
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(track);
                      }}
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
}, (previous, next) => {
  if (previous.open !== next.open) return false;
  if (!previous.open) return true;
  return (
    previous.tracks === next.tracks &&
    previous.activeProfileName === next.activeProfileName &&
    previous.currentTrackCategory === next.currentTrackCategory &&
    previous.currentTrackId === next.currentTrackId &&
    previous.favoriteTrackIds === next.favoriteTrackIds &&
    previous.favoritesOnly === next.favoritesOnly &&
    previous.musicDir === next.musicDir &&
    previous.busy === next.busy &&
    previous.onClose === next.onClose &&
    previous.onImport === next.onImport &&
    previous.onAddLink === next.onAddLink &&
    previous.onDropFiles === next.onDropFiles &&
    previous.onRefresh === next.onRefresh &&
    previous.onOpenFolder === next.onOpenFolder &&
    previous.onSelect === next.onSelect &&
    previous.onRemove === next.onRemove &&
    previous.onToggleFavorite === next.onToggleFavorite &&
    previous.onSetFavoritesOnly === next.onSetFavoritesOnly
  );
});

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}
