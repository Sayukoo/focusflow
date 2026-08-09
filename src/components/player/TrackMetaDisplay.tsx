import { useMemo } from "react";
import type { Track } from "../../types";
import type { TrackCategory, TrackCategoryStatus } from "../../lib/gemini";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}

interface TrackMetaDisplayProps {
  currentTrack: Track | null;
  favoriteTrackIds: string[];
  favoriteBursting: boolean;
  categoryStatus: TrackCategoryStatus;
  currentCategory: TrackCategory | null;
  onToggleLibrary: (open: boolean) => void;
  onToggleFavorite: (trackId: string) => void;
  onRequestCategory: (track: Track) => void;
  onSetFavoriteBursting: (bursting: boolean) => void;
}

export function TrackMetaDisplay({
  currentTrack,
  favoriteTrackIds,
  favoriteBursting,
  categoryStatus,
  currentCategory,
  onToggleLibrary,
  onToggleFavorite,
  onRequestCategory,
  onSetFavoriteBursting,
}: TrackMetaDisplayProps) {
  const coverStyle = useMemo(() => {
    if (!currentTrack?.thumbnail) return undefined;
    return {
      backgroundImage: `linear-gradient(135deg, rgba(20, 30, 48, 0.2), rgba(10, 15, 25, 0.6)), url("${currentTrack.thumbnail}")`,
    };
  }, [currentTrack?.thumbnail]);

  const sourceLabel = useMemo(() => {
    if (!currentTrack) return "No track selected";
    if (currentTrack.source === "youtube") return "YouTube";
    if (currentTrack.source === "spotify") return "Spotify";
    if (currentTrack.source === "soundcloud") return "SoundCloud";
    if (currentTrack.source === "tiktok") return "TikTok";
    return `${currentTrack.extension.toUpperCase()} file`;
  }, [currentTrack]);

  const categoryLabel = useMemo(() => {
    if (categoryStatus === "categorizing") return "Classifying…";
    if (currentCategory) return currentCategory.toUpperCase();
    if (categoryStatus === "invalid-api-key") return "Invalid Gemini key";
    if (
      categoryStatus === "missing-configuration" ||
      categoryStatus === "no-api-key"
    )
      return "AI setup";
    if (categoryStatus === "rate-limited") return "Retry AI";
    if (categoryStatus === "request-failed") return "Retry AI";
    return "AI category";
  }, [categoryStatus, currentCategory]);

  const categoryTooltip = useMemo(() => {
    if (categoryStatus === "categorizing") {
      return "\\text{AI categorization in progress}";
    }
    if (currentCategory) {
      return `\\text{AI Genre:}~\\text{${escapeTex(currentCategory.toUpperCase())}}`;
    }
    if (categoryStatus === "invalid-api-key") {
      return "\\text{VITE\\_GEMINI\\_API\\_KEY is invalid}";
    }
    if (
      categoryStatus === "missing-configuration" ||
      categoryStatus === "no-api-key"
    ) {
      return "\\text{Add VITE\\_GEMINI\\_API\\_KEY to .env}";
    }
    if (categoryStatus === "rate-limited") {
      return "\\text{Rate limited. Click to retry}";
    }
    return "\\text{Click to categorize with Gemini}";
  }, [categoryStatus, currentCategory]);

  const categoryNeedsAction = !currentCategory;
  const categoryLoading = categoryStatus === "categorizing";
  const categoryActionLabel =
    categoryStatus === "categorizing"
      ? "Classifying track"
      : categoryStatus === "missing-configuration" ||
          categoryStatus === "no-api-key"
        ? "Set up Gemini to categorize this track"
        : categoryStatus === "request-failed" ||
            categoryStatus === "rate-limited"
          ? "Retry AI category"
          : "Categorize track with Gemini AI";

  const isFavorite = currentTrack
    ? favoriteTrackIds.includes(currentTrack.id)
    : false;

  return (
    <div className="now-playing">
      <KaTeXTooltip
        formula={
          currentTrack
            ? `\\text{${escapeTex(currentTrack.title)}}`
            : "\\text{No track selected}"
        }
      >
        <button
          type="button"
          className="cover"
          aria-label={currentTrack?.title ?? "No track"}
          style={coverStyle}
          onClick={() => onToggleLibrary(true)}
        >
          <span className="cover-glow" aria-hidden="true">
            <Icon name="music" size={28} />
          </span>
        </button>
      </KaTeXTooltip>

      <div className="now-meta">
        <KaTeXTooltip
          formula={
            currentTrack
              ? `\\texttt{${escapeTex(currentTrack.filename)}}`
              : "\\text{Import your music}"
          }
        >
          <button
            type="button"
            className="now-title"
            onClick={() => onToggleLibrary(true)}
          >
            {currentTrack?.title ?? "—"}
          </button>
        </KaTeXTooltip>
        <KaTeXTooltip formula={`\\text{${sourceLabel}}`}>
          <span className="now-sub">{sourceLabel}</span>
        </KaTeXTooltip>
        <div className="now-chips">
          <KaTeXTooltip formula={categoryTooltip}>
            {categoryNeedsAction ? (
              <button
                type="button"
                className={[
                  "chip",
                  categoryLoading ? "is-loading" : "",
                  categoryStatus === "request-failed" ? "is-error" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={categoryActionLabel}
                aria-busy={categoryLoading}
                disabled={categoryLoading}
                onClick={() => {
                  if (currentTrack) onRequestCategory(currentTrack);
                }}
              >
                {categoryLabel}
              </button>
            ) : (
              <span className="chip">{categoryLabel}</span>
            )}
          </KaTeXTooltip>
        </div>
      </div>

      <div className="now-react">
        <KaTeXTooltip formula="\text{Favorite}">
          <button
            type="button"
            className={[
              "icon-btn",
              "ghost",
              "favorite-control",
              isFavorite ? "is-favorite" : "",
              favoriteBursting ? "is-bursting" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={
              isFavorite ? "Remove from favorites" : "Add to favorites"
            }
            aria-pressed={isFavorite}
            disabled={!currentTrack}
            onClick={() => {
              if (!currentTrack) return;
              const wasFavorite = isFavorite;
              onToggleFavorite(currentTrack.id);
              if (wasFavorite) return;
              onSetFavoriteBursting(true);
            }}
          >
            <Icon name="heart" size={19} />
          </button>
        </KaTeXTooltip>
      </div>
    </div>
  );
}
