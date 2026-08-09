import { memo, useEffect, useMemo, useState } from "react";
import { getTrackCategory, type TrackCategory } from "../../lib/gemini";
import type { PlaybackQueue, Track } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";
import { LibraryDropzone } from "./LibraryDropzone";
import { LibraryHeader } from "./LibraryHeader";
import { TrackCard } from "./TrackCard";

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

  return (
    <div className="library-overlay" role="dialog" aria-modal="true" aria-label="Library">
      <button className="library-backdrop" aria-label="Close library" onClick={onClose} />
      <aside className="library-panel library-manager">
        <LibraryHeader
          activeProfileName={activeProfileName}
          musicDir={musicDir}
          busy={busy}
          onOpenFolder={onOpenFolder}
          onClose={onClose}
        />

        <LibraryDropzone
          busy={busy}
          onImport={onImport}
          onAddLink={onAddLink}
          onDropFiles={onDropFiles}
        />

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
            {visibleTracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                active={track.id === currentTrackId}
                expanded={track.id === expandedTrackId}
                favorite={favoriteTrackIds.includes(track.id)}
                category={categoryByTrack.get(track.id) ?? null}
                activeProfileName={activeProfileName}
                busy={busy}
                onSelect={onSelect}
                onToggleExpanded={(id) => setExpandedTrackId(id)}
                onSelectGenre={selectGenre}
                onToggleFavorite={onToggleFavorite}
                onRemove={onRemove}
              />
            ))}
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
