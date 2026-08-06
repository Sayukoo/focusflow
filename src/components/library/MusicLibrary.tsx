import { memo, useEffect, useMemo, useState, type DragEvent } from "react";
import { getTrackCategory, type TrackCategory } from "../../lib/gemini";
import type { PlaybackQueue, Track } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface MusicLibraryProps {
  open: boolean;
  tracks: Track[];
  activeProfileName: string;
  currentTrackCategory: TrackCategory | null;
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
  onPlayQueue: (queue: PlaybackQueue, trackId: string | null) => void;
}

type LibraryTab = "featured" | "genres" | "favorites" | "recent";
type GenreFilter = TrackCategory | "all" | "uncategorized";

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
  onOpenFolder,
  onSelect,
  onRemove,
  onToggleFavorite,
  onPlayQueue,
}: MusicLibraryProps) {
  const [dragActive, setDragActive] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    favoritesOnly ? "favorites" : "featured",
  );
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(
    currentTrackId,
  );
  const [genreFilter, setGenreFilter] = useState<GenreFilter>("all");

  useEffect(() => {
    if (favoritesOnly) setActiveTab("favorites");
  }, [favoritesOnly]);

  useEffect(() => {
    setActiveTab("featured");
    setGenreFilter("all");
  }, [activeProfileName]);

  useEffect(() => {
    setExpandedTrackId(currentTrackId);
  }, [currentTrackId]);

  const categoryByTrack = useMemo(() => {
    return new Map(
      tracks.map((track) => [
        track.id,
        getTrackCategory(track) ??
          (track.id === currentTrackId ? currentTrackCategory : null),
      ]),
    );
  }, [currentTrackCategory, currentTrackId, tracks]);

  const genreOptions = useMemo(
    () =>
      [
        ...new Set(
          [...categoryByTrack.values()].filter(
            (category): category is TrackCategory => Boolean(category),
          ),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [categoryByTrack],
  );

  const hasUncategorizedTracks = useMemo(
    () => tracks.some((track) => !categoryByTrack.get(track.id)),
    [categoryByTrack, tracks],
  );

  useEffect(() => {
    if (activeTab !== "genres" || genreFilter === "all") return;
    const filterStillAvailable =
      genreFilter === "uncategorized"
        ? hasUncategorizedTracks
        : genreOptions.includes(genreFilter);
    if (!filterStillAvailable) setGenreFilter("all");
  }, [activeTab, genreFilter, genreOptions, hasUncategorizedTracks]);

  if (!open) return null;

  const escapedDir = musicDir.replace(/\\/g, "\\\\");
  const baseTracks =
    activeTab === "favorites"
      ? tracks.filter((track) => favoriteTrackIds.includes(track.id))
      : tracks;
  const visibleTracks =
    activeTab === "genres"
      ? baseTracks
          .filter((track) => {
            const category = categoryByTrack.get(track.id);
            if (genreFilter === "all") return true;
            if (genreFilter === "uncategorized") return !category;
            return category === genreFilter;
          })
          .sort((a, b) => {
            const categoryA = categoryByTrack.get(a.id) ?? "";
            const categoryB = categoryByTrack.get(b.id) ?? "";
            return `${categoryA}${a.title}`.localeCompare(`${categoryB}${b.title}`);
          })
      : activeTab === "recent"
        ? [...baseTracks].reverse()
        : baseTracks;
  const selectedQueue: PlaybackQueue =
    activeTab === "favorites"
      ? { kind: "favorites" }
      : activeTab === "recent"
        ? { kind: "recent" }
        : activeTab === "genres" && genreFilter !== "all"
          ? {
              kind: "genre",
              category: genreFilter === "uncategorized" ? null : genreFilter,
            }
          : { kind: "all" };
  const playQueueLabel =
    activeTab === "favorites"
      ? "Play favorites"
      : activeTab === "recent"
        ? "Play recent tracks"
        : activeTab === "genres" && genreFilter !== "all"
          ? `Play ${
              genreFilter === "uncategorized"
                ? "uncategorized"
                : formatCategory(genreFilter)
            } tracks`
          : "Play profile tracks";

  const selectTab = (tab: LibraryTab) => {
    setActiveTab(tab);
    if (tab !== "genres") setGenreFilter("all");
  };

  const selectGenre = (category: TrackCategory) => {
    setActiveTab("genres");
    setGenreFilter(category);
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

  const submitLink = (value: string) => {
    const url = value.trim();
    if (!url || busy) return;
    onAddLink(url);
    setLinkValue("");
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
          <input
            className="dropzone-link-input"
            type="url"
            value={linkValue}
            placeholder="Paste a music link"
            aria-label="Paste a YouTube, Spotify, SoundCloud or TikTok link"
            disabled={busy}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitLink(event.currentTarget.value);
              }
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text");
              if (!pasted.trim()) return;
              event.preventDefault();
              submitLink(pasted);
            }}
          />
          <button
            type="button"
            className="upload-button"
            disabled={busy}
            onClick={onImport}
          >
            <Icon name="plus" size={16} />
            Upload files
          </button>
        </div>

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

        {activeTab === "genres" ? (
          <div className="library-genre-filters" role="listbox" aria-label="Genres">
            <KaTeXTooltip formula="\text{All genres}">
              <button
                type="button"
                role="option"
                aria-label="All genres"
                aria-selected={genreFilter === "all"}
                className={genreFilter === "all" ? "is-active" : undefined}
                onClick={() => setGenreFilter("all")}
              >
                Wszystkie
              </button>
            </KaTeXTooltip>
            {genreOptions.map((category) => (
              <KaTeXTooltip
                key={category}
                formula={`\\text{Genre:}~\\text{${escapeTex(formatCategory(category))}}`}
              >
                <button
                  type="button"
                  role="option"
                  aria-label={`Filter genre ${formatCategory(category)}`}
                  aria-selected={genreFilter === category}
                  className={genreFilter === category ? "is-active" : undefined}
                  onClick={() => setGenreFilter(category)}
                >
                  {formatCategory(category)}
                </button>
              </KaTeXTooltip>
            ))}
            {hasUncategorizedTracks ? (
              <KaTeXTooltip formula="\text{Tracks without a genre}">
                <button
                  type="button"
                  role="option"
                  aria-label="Tracks without a genre"
                  aria-selected={genreFilter === "uncategorized"}
                  className={
                    genreFilter === "uncategorized" ? "is-active" : undefined
                  }
                  onClick={() => setGenreFilter("uncategorized")}
                >
                  Bez kategorii
                </button>
              </KaTeXTooltip>
            ) : null}
          </div>
        ) : null}

        <div className="library-toolbar">
          <h2 className="library-section-title">
            {activeTab === "favorites"
              ? "Moje Ulubione"
              : activeTab === "genres" && genreFilter !== "all"
                ? genreFilter === "uncategorized"
                  ? "Bez kategorii"
                  : formatCategory(genreFilter)
                : activeTab === "genres"
                  ? "Gatunki"
                  : activeProfileName}
          </h2>
          <div className="library-toolbar-actions">
            <span className="library-toolbar-count">
              {visibleTracks.length} items
            </span>
            <KaTeXTooltip formula={`\\text{${escapeTex(playQueueLabel)}}`}>
              <button
                type="button"
                className="library-queue-play"
                aria-label={playQueueLabel}
                disabled={busy || visibleTracks.length === 0}
                onClick={() =>
                  onPlayQueue(selectedQueue, visibleTracks[0]?.id ?? null)
                }
              >
                <Icon name="play" size={13} />
              </button>
            </KaTeXTooltip>
          </div>
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
              const category = categoryByTrack.get(track.id) ?? null;
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
                      <span className="track-card-meta track-card-author">
                        {track.author ?? getSourceLabel(track)}
                      </span>
                    </button>
                  </KaTeXTooltip>
                  {expanded ? (
                    <div className="track-card-details">
                      <div className="track-detail-grid">
                        <div>
                          <span>GATUNEK</span>
                          {category ? (
                            <KaTeXTooltip
                              placement="bottom"
                              formula={`\\text{Filter genre:}~\\text{${escapeTex(formatCategory(category))}}`}
                            >
                              <button
                                type="button"
                                className="track-category-button"
                                aria-label={`Filter genre ${formatCategory(category)}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectGenre(category);
                                }}
                              >
                                {formatCategory(category)}
                              </button>
                            </KaTeXTooltip>
                          ) : (
                            <strong>AI pending</strong>
                          )}
                        </div>
                        <div>
                          <span>ŹRÓDŁO</span>
                          <strong>{getSourceLabel(track)}</strong>
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
    previous.onPlayQueue === next.onPlayQueue
  );
});

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}

function formatCategory(category: TrackCategory): string {
  return category.replace(/_/g, " ");
}

function getSourceLabel(track: Track): string {
  if (track.source === "youtube") return "YouTube";
  if (track.source === "spotify") return "Spotify";
  if (track.source === "soundcloud") return "SoundCloud";
  if (track.source === "tiktok") return "TikTok";
  return `${track.extension.toUpperCase()} · local`;
}
