import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { resolvePlaylistTracks } from "../../lib/audio";
import { getTrackCategory, type TrackCategory } from "../../lib/gemini";
import type { PlaybackQueue, Track } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";
import { LibraryDropzone } from "./LibraryDropzone";
import { TrackCard } from "./TrackCard";
import { GeminiApiKeySection } from "../settings/GeminiApiKeySection";

export interface PlaylistGroup {
  id: string;
  title: string;
  author?: string;
  thumbnail?: string;
  tracks: Track[];
}

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
  onReorderTracks?: (sourceIndex: number, destinationIndex: number) => void;
  onMoveTrackToProfile?: (trackId: string, targetProfileId: string) => void;
}

type LibraryTab =
  | "featured"
  | "playlists"
  | "genres"
  | "favorites"
  | "recent"
  | "about";
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
  onReorderTracks,
  onMoveTrackToProfile,
}: MusicLibraryProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    favoritesOnly ? "favorites" : "featured",
  );
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(
    currentTrackId,
  );
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(
    null,
  );
  const [genreFilter, setGenreFilter] = useState<GenreFilter>("all");
  const [draftAboutMe, setDraftAboutMe] = useState(userAboutMe ?? "");
  const [justSaved, setJustSaved] = useState(false);

  // Drag & drop reordering state
  const [draggedTrackIndex, setDraggedTrackIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPlacement, setDropPlacement] = useState<"before" | "after" | null>(null);

  const handleDragStart = useCallback(
    (_event: React.DragEvent<HTMLElement>, _trackId: string, index: number) => {
      setDraggedTrackIndex(index);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTrackIndex(null);
    setDropTargetIndex(null);
    setDropPlacement(null);
  }, []);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, index: number) => {
      if (draggedTrackIndex === null || activeTab !== "featured") return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      if (draggedTrackIndex === index) {
        if (dropTargetIndex !== null) setDropTargetIndex(null);
        if (dropPlacement !== null) setDropPlacement(null);
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const relY = event.clientY - rect.top;
      const placement = relY < rect.height / 2 ? "before" : "after";

      if (dropTargetIndex !== index || dropPlacement !== placement) {
        setDropTargetIndex(index);
        setDropPlacement(placement);
      }
    },
    [activeTab, draggedTrackIndex, dropPlacement, dropTargetIndex],
  );

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    setDropTargetIndex(null);
    setDropPlacement(null);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, index: number) => {
      event.preventDefault();
      if (
        draggedTrackIndex !== null &&
        onReorderTracks &&
        activeTab === "featured" &&
        draggedTrackIndex !== index
      ) {
        const rect = event.currentTarget.getBoundingClientRect();
        const relY = event.clientY - rect.top;
        let targetIndex = relY < rect.height / 2 ? index : index + 1;
        if (draggedTrackIndex < targetIndex) {
          targetIndex -= 1;
        }
        if (draggedTrackIndex !== targetIndex) {
          onReorderTracks(draggedTrackIndex, targetIndex);
        }
      }
      setDraggedTrackIndex(null);
      setDropTargetIndex(null);
      setDropPlacement(null);
    },
    [activeTab, draggedTrackIndex, onReorderTracks],
  );

  useEffect(() => {
    setDraggedTrackIndex(null);
    setDropTargetIndex(null);
    setDropPlacement(null);
  }, [activeTab, activeProfileName]);

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
    setExpandedPlaylistId(null);
  }, [activeProfileName]);

  const playlistGroups = useMemo((): PlaylistGroup[] => {
    const groupsMap = new Map<string, PlaylistGroup>();

    for (const track of tracks) {
      const playlistId =
        track.playlistId ||
        (track.providerKind === "playlist" || track.providerKind === "album"
          ? track.providerId
          : undefined);

      if (playlistId) {
        let group = groupsMap.get(playlistId);
        if (!group) {
          const groupTitle =
            track.playlistTitle ||
            (track.providerKind === "playlist" || track.providerKind === "album"
              ? track.title
              : `Playlista (${playlistId})`);
          group = {
            id: playlistId,
            title: groupTitle,
            author: track.author,
            thumbnail: track.thumbnailDataUrl ?? track.thumbnail,
            tracks: [],
          };
          groupsMap.set(playlistId, group);
        }

        if (track.providerKind === "playlist" || track.providerKind === "album") {
          const resolved = resolvePlaylistTracks(track, tracks);
          for (const sub of resolved) {
            if (!group.tracks.some((t) => t.id === sub.id)) {
              group.tracks.push(sub);
            }
          }
        } else if (!group.tracks.some((t) => t.id === track.id)) {
          group.tracks.push(track);
        }
      }
    }

    return Array.from(groupsMap.values());
  }, [tracks]);

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

  const handleViewPlaylist = useCallback((playlistId: string) => {
    setActiveTab("playlists");
    setExpandedPlaylistId(playlistId);
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
              ["playlists", "Playlisty"],
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
              {tab === "playlists" ? <Icon name="music-queue" size={13} /> : null}
              {tab === "favorites" ? <Icon name="heart" size={13} /> : null}
              {tab === "about" ? <Icon name="user" size={13} /> : null}
              {label}
            </button>
          ))}
        </div>

        {activeTab === "playlists" ? (
          <div className="library-playlists-section">
            <div className="library-toolbar">
              <h2 className="library-section-title">Playlisty</h2>
              <div className="library-toolbar-actions">
                <span className="library-toolbar-count">
                  {playlistGroups.length}{" "}
                  {playlistGroups.length === 1
                    ? "playlista"
                    : playlistGroups.length < 5
                      ? "playlisty"
                      : "playlist"}
                </span>
              </div>
            </div>

            {playlistGroups.length === 0 ? (
              <div className="library-empty library-empty--manager">
                <Icon name="music-queue" size={28} />
                <span>Brak playlist</span>
                <span style={{ fontSize: "0.82rem", opacity: 0.65, marginTop: "0.25rem", textAlign: "center", maxWidth: "22rem" }}>
                  Wklej powyżej link do playlisty z YouTube lub Spotify, aby zobaczyć wszystkie jej utwory.
                </span>
              </div>
            ) : (
              <div className="library-playlists-list">
                {playlistGroups.map((group) => {
                  const isExpanded = expandedPlaylistId === group.id;
                  const firstTrack = group.tracks[0];

                  return (
                    <article
                      key={group.id}
                      className={`library-playlist-card ${isExpanded ? "is-expanded" : ""}`}
                    >
                      <div className="library-playlist-card-header">
                        <span
                          className="library-playlist-card-art"
                          aria-hidden="true"
                          style={
                            group.thumbnail
                              ? {
                                  backgroundImage: `linear-gradient(135deg, rgba(14, 25, 45, 0.18), rgba(17, 9, 28, 0.5)), url("${group.thumbnail}")`,
                                }
                              : undefined
                          }
                        >
                          <Icon name="music-queue" size={22} />
                        </span>

                        <div className="library-playlist-card-meta">
                          <h3 className="library-playlist-card-title">{group.title}</h3>
                          <span className="library-playlist-card-subtitle">
                            {group.tracks.length}{" "}
                            {group.tracks.length === 1
                              ? "utwór"
                              : group.tracks.length < 5
                                ? "utwory"
                                : "utworów"}
                            {group.author ? ` · ${group.author}` : ""}
                          </span>
                        </div>

                        <div className="library-playlist-card-actions">
                          {firstTrack && (
                            <KaTeXTooltip formula="\\text{Odtwórz playlistę}">
                              <button
                                type="button"
                                className="library-queue-play"
                                aria-label={`Odtwórz playlistę ${group.title}`}
                                onClick={() =>
                                  onPlayQueue(
                                    { kind: "playlist", playlistId: group.id },
                                    firstTrack.id,
                                  )
                                }
                              >
                                <Icon name="play" size={13} />
                              </button>
                            </KaTeXTooltip>
                          )}
                          <button
                            type="button"
                            className="library-playlist-toggle-btn"
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpandedPlaylistId((prev) =>
                                prev === group.id ? null : group.id,
                              )
                            }
                          >
                            <span>{isExpanded ? "Zwiń" : "Pokaż utwory"}</span>
                            <Icon
                              name="chevron-down"
                              size={14}
                              style={{
                                transform: isExpanded ? "rotate(180deg)" : "none",
                                transition: "transform 180ms ease",
                              }}
                            />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="library-playlist-tracks-list" role="list">
                          {group.tracks.map((t, idx) => {
                            const activePlayingTrack = tracks.find(
                              (item) => item.id === currentTrackId,
                            );
                            const isCurrent =
                              t.id === currentTrackId ||
                              Boolean(
                                t.videoId &&
                                  activePlayingTrack?.videoId &&
                                  t.videoId === activePlayingTrack.videoId,
                              );
                            const isFav = favoriteSet.has(t.id);
                            const tArt = t.thumbnailDataUrl ?? t.thumbnail;

                            return (
                              <div
                                key={t.id}
                                className={`library-playlist-track-row ${isCurrent ? "is-current" : ""}`}
                                role="listitem"
                              >
                                <span className="playlist-track-index">
                                  {isCurrent ? (
                                    <Icon name="play" size={12} />
                                  ) : (
                                    idx + 1
                                  )}
                                </span>

                                <button
                                  type="button"
                                  className="library-playlist-track-info-btn"
                                  onClick={() =>
                                    onPlayQueue(
                                      { kind: "playlist", playlistId: group.id },
                                      t.id,
                                    )
                                  }
                                >
                                  <span
                                    className="playlist-track-thumb"
                                    aria-hidden="true"
                                    style={
                                      tArt
                                        ? {
                                            backgroundImage: `url("${tArt}")`,
                                          }
                                        : undefined
                                    }
                                  >
                                    {!tArt && <Icon name="music" size={12} />}
                                  </span>
                                  <span className="playlist-track-texts">
                                    <strong className="playlist-track-title">
                                      {t.title}
                                    </strong>
                                    <span className="playlist-track-author">
                                      {t.author ?? "Audio"}
                                    </span>
                                  </span>
                                </button>

                                <div className="playlist-track-row-actions">
                                  <button
                                    type="button"
                                    className={`playlist-track-fav-btn ${isFav ? "is-favorite" : ""}`}
                                    aria-label={isFav ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                                    onClick={() => onToggleFavorite(t.id)}
                                  >
                                    <Icon name="heart" size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="playlist-track-play-btn"
                                    aria-label={`Odtwórz ${t.title}`}
                                    onClick={() => onSelect(t.id)}
                                  >
                                    <Icon name="play" size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "about" ? (
          <div className="profile-about-me-section library-about-me-section">
            <GeminiApiKeySection />
            <div className="profile-about-me-header" style={{ marginTop: "1rem" }}>
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
                {visibleTracks.map((track, index) => {
                  const isBeingDragged = draggedTrackIndex === index;
                  const isDropTarget = dropTargetIndex === index;
                  const currentDropPos = isDropTarget ? dropPlacement : null;

                  return (
                    <TrackCard
                      key={track.id}
                      track={track}
                      index={index}
                      draggable={true}
                      isDragging={isBeingDragged}
                      dropPosition={currentDropPos}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onMoveToProfile={onMoveTrackToProfile}
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
                      onViewPlaylist={handleViewPlaylist}
                    />
                  );
                })}
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
    previous.onPlayQueue === next.onPlayQueue &&
    previous.onReorderTracks === next.onReorderTracks &&
    previous.onMoveTrackToProfile === next.onMoveTrackToProfile
  );
});

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}

function formatCategory(category: TrackCategory): string {
  return category.replace(/_/g, " ");
}
