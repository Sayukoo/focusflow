import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Track } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

export interface PlaylistTracksModalProps {
  open: boolean;
  onClose: () => void;
  playlistTitle?: string;
  tracks: Track[];
  currentTrackId: string | null;
  onSelectTrack: (trackId: string, autoplay?: boolean) => void;
  favoriteTrackIds?: string[];
  onToggleFavorite?: (trackId: string) => void;
}

export function PlaylistTracksModal({
  open,
  onClose,
  playlistTitle,
  tracks,
  currentTrackId,
  onSelectTrack,
  favoriteTrackIds = [],
  onToggleFavorite,
}: PlaylistTracksModalProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  const favoriteSet = useMemo(
    () => new Set(favoriteTrackIds),
    [favoriteTrackIds],
  );

  useEffect(() => {
    if (!open) return;
    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
      activeItemRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }, 50);
    return () => clearTimeout(focusTimer);
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const backdropTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: "easeOut" as const };

  const modalTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 400, damping: 32 };

  const title = playlistTitle || "Playlista";

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="playlist-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="playlist-modal-title"
          onKeyDown={handleKeyDown}
        >
          <motion.button
            type="button"
            className="playlist-modal-backdrop"
            aria-label="Zamknij listę utworów playlisty"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
          />

          <motion.div
            className="playlist-modal-panel"
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 0, scale: 0.95, y: 14 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 8 }
            }
            transition={modalTransition}
          >
            <header className="playlist-modal-header">
              <div className="playlist-modal-heading">
                <span className="playlist-modal-badge" aria-hidden="true">
                  <Icon name="music-queue" size={20} />
                </span>
                <div className="playlist-modal-meta">
                  <h2 id="playlist-modal-title" className="playlist-modal-title">
                    {title}
                  </h2>
                  <span className="playlist-modal-count">
                    {tracks.length} {tracks.length === 1 ? "utwór" : tracks.length < 5 ? "utwory" : "utworów"}
                  </span>
                </div>
              </div>
              <KaTeXTooltip formula="\text{Zamknij (Esc)}">
                <button
                  type="button"
                  ref={closeButtonRef}
                  className="playlist-modal-close-btn"
                  aria-label="Zamknij okno playlisty"
                  onClick={onClose}
                >
                  <Icon name="close" size={16} />
                </button>
              </KaTeXTooltip>
            </header>

            <div className="playlist-modal-body" role="list">
              {tracks.length === 0 ? (
                <div className="playlist-modal-empty">
                  <Icon name="music" size={24} />
                  <span>Brak wczytanych utworów dla tej playlisty</span>
                </div>
              ) : (
                tracks.map((item, index) => {
                  const activeItem = tracks.find((t) => t.id === currentTrackId);
                  const isCurrent =
                    item.id === currentTrackId ||
                    Boolean(
                      item.videoId &&
                        activeItem?.videoId &&
                        item.videoId === activeItem.videoId,
                    );
                  const isFavorite = favoriteSet.has(item.id);
                  const thumbnail = item.thumbnailDataUrl ?? item.thumbnail;

                  return (
                    <div
                      key={item.id}
                      ref={isCurrent ? activeItemRef : undefined}
                      className={`playlist-track-row ${isCurrent ? "is-current" : ""}`}
                      role="listitem"
                    >
                      <span className="playlist-track-index">
                        {isCurrent ? (
                          <span className="playlist-track-playing-indicator" title="Odtwarzane">
                            <Icon name="play" size={12} />
                          </span>
                        ) : (
                          index + 1
                        )}
                      </span>

                      <button
                        type="button"
                        className="playlist-track-main"
                        onClick={() => {
                          onSelectTrack(item.id, true);
                          onClose();
                        }}
                      >
                        <span
                          className="playlist-track-thumb"
                          aria-hidden="true"
                          style={
                            thumbnail
                              ? {
                                  backgroundImage: `linear-gradient(135deg, rgba(14, 25, 45, 0.18), rgba(17, 9, 28, 0.5)), url("${thumbnail}")`,
                                }
                              : undefined
                          }
                        >
                          {!thumbnail && <Icon name="music" size={14} />}
                        </span>
                        <span className="playlist-track-info">
                          <strong className="playlist-track-title">{item.title}</strong>
                          <span className="playlist-track-author">
                            {item.author || (item.source ? item.source.toUpperCase() : "Audio")}
                          </span>
                        </span>
                      </button>

                      <div className="playlist-track-actions">
                        {onToggleFavorite && (
                          <button
                            type="button"
                            className={`playlist-track-favorite ${isFavorite ? "is-favorite" : ""}`}
                            aria-label={isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                            onClick={() => onToggleFavorite(item.id)}
                          >
                            <Icon name="heart" size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="playlist-track-play-btn"
                          aria-label={`Odtwórz ${item.title}`}
                          onClick={() => {
                            onSelectTrack(item.id, true);
                            onClose();
                          }}
                        >
                          <Icon name="play" size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
