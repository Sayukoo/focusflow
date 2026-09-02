import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { getTrackCategory, type TrackCategory } from "../../lib/gemini";
import type { PlaybackQueue, Track } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";
import { LibraryDropzone } from "./LibraryDropzone";
import { TrackCard } from "./TrackCard";

/**
 * Embeddable body of the music library. The unified hub panel
 * (`src/components/hub/HubPanel.tsx`) owns the drawer chrome — overlay,
 * backdrop, header actions and the Muzyka/Profil tabs.
 */
interface MusicLibraryProps {
  tracks: Track[];
  activeProfileName: string;
  currentTrackCategory: TrackCategory | null;
  currentTrackId: string | null;
  favoriteTrackIds: string[];
  favoritesOnly: boolean;
  busy: boolean;
  userAboutMe?: string;
  onUserAboutMeChange?: (userAboutMe: string) => void;
  onImport: () => void;
  onAddLink: (url: string) => void;
  onDropFiles: (files: File[]) => void;
  onSelect: (trackId: string) => void;
  onRemove: (track: Track) => void;
  onToggleFavorite: (trackId: string) => void;
  onPlayQueue: (queue: PlaybackQueue, trackId: string | null) => void;
}

type LibraryTab = "featured" | "genres" | "favorites" | "recent" | "about";
type GenreFilter = TrackCategory | "all" | "uncategorized";

export const MusicLibrary = memo(function MusicLibrary({
  tracks,
  activeProfileName,
  currentTrackCategory,
  currentTrackId,
  favoriteTrackIds,
  favoritesOnly,
  busy,
  userAboutMe,
  onUserAboutMeChange,
  onImport,
  onAddLink,
  onDropFiles,
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
  const [draftAboutMe, setDraftAboutMe] = useState(userAboutMe ?? "");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setDraftAboutMe(userAboutMe ?? "");
  }, [userAboutMe]);

  const handleSaveAboutMe = () => {
    onUserAboutMeChange?.(draftAboutMe);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const isAboutMeChanged = draftAboutMe !== (userAboutMe ?? "");

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

  // PERF: Set lookups instead of Array.includes inside the render loop.
  const favoriteSet = useMemo(
    () => new Set(favoriteTrackIds),
    [favoriteTrackIds],
  );

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

  const visibleTracks = useMemo(() => {
    const baseTracks =
      activeTab === "favorites"
        ? tracks.filter((track) => favoriteSet.has(track.id))
        : tracks;
    if (activeTab === "genres") {
      return baseTracks
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
        });
    }
    return activeTab === "recent" ? [...baseTracks].reverse() : baseTracks;
  }, [activeTab, categoryByTrack, favoriteSet, genreFilter, tracks]);

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

  const selectTab = useCallback((tab: LibraryTab) => {
    setActiveTab(tab);
    if (tab !== "genres") setGenreFilter("all");
  }, []);

  const selectGenre = useCallback((category: TrackCategory) => {
    setActiveTab("genres");
    setGenreFilter(category);
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedTrackId(id);
  }, []);

  return (
    <>
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
              ["about", "Informacja o mnie"],
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
              {tab === "about" ? <Icon name="user" size={13} /> : null}
              {label}
            </button>
          ))}
        </div>

        {activeTab === "about" ? (
          <div className="profile-about-me-section library-about-me-section">
            <div className="profile-about-me-header">
              <span className="profile-about-me-title">Informacje o mnie</span>
              <span className="profile-about-me-subtitle">Pamięć AI</span>
            </div>
            <div className="profile-about-me-wrap">
              <textarea
                rows={6}
                maxLength={4000}
                placeholder="Opisz swój kontekst, rolę, preferencje lub nuanse (np. 'Jestem programistą, miewam spadek energii po południu, lubię małe kroki...')"
                value={draftAboutMe}
                aria-label="Informacje o mnie"
                onChange={(event) => setDraftAboutMe(event.target.value)}
              />
              <div className="profile-about-me-footer">
                <span className="profile-about-me-counter">
                  {draftAboutMe.length} / 4000
                </span>
                <button
                  type="button"
                  className={
                    justSaved
                      ? "profile-about-me-save-btn is-saved"
                      : "profile-about-me-save-btn"
                  }
                  disabled={!isAboutMeChanged && !justSaved}
                  onClick={handleSaveAboutMe}
                >
                  {justSaved ? (
                    <>
                      <Icon name="check" size={14} /> Zapisano
                    </>
                  ) : (
                    "Zapisz"
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
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
                    favorite={favoriteSet.has(track.id)}
                    category={categoryByTrack.get(track.id) ?? null}
                    activeProfileName={activeProfileName}
                    busy={busy}
                    onSelect={onSelect}
                    onToggleExpanded={toggleExpanded}
                    onSelectGenre={selectGenre}
                    onToggleFavorite={onToggleFavorite}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            )}
          </>
        )}
    </>
  );
}, (previous, next) => {
  return (
    previous.tracks === next.tracks &&
    previous.activeProfileName === next.activeProfileName &&
    previous.currentTrackCategory === next.currentTrackCategory &&
    previous.currentTrackId === next.currentTrackId &&
    previous.favoriteTrackIds === next.favoriteTrackIds &&
    previous.favoritesOnly === next.favoritesOnly &&
    previous.busy === next.busy &&
    previous.userAboutMe === next.userAboutMe &&
    previous.onUserAboutMeChange === next.onUserAboutMeChange &&
    previous.onImport === next.onImport &&
    previous.onAddLink === next.onAddLink &&
    previous.onDropFiles === next.onDropFiles &&
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
