import { memo } from "react";
import type { TrackCategory } from "../../lib/gemini";
import type { Track } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface TrackCardProps {
  track: Track;
  active: boolean;
  expanded: boolean;
  favorite: boolean;
  category: TrackCategory | null;
  activeProfileName: string;
  busy: boolean;
  onSelect: (trackId: string) => void;
  onToggleExpanded: (trackId: string) => void;
  onSelectGenre: (category: TrackCategory) => void;
  onToggleFavorite: (trackId: string) => void;
  onRemove: (track: Track) => void;
}

export const TrackCard = memo(function TrackCard({
  track,
  active,
  expanded,
  favorite,
  category,
  activeProfileName,
  busy,
  onSelect,
  onToggleExpanded,
  onSelectGenre,
  onToggleFavorite,
  onRemove,
}: TrackCardProps) {
  return (
    <article
      className={[
        "track-card",
        active ? "is-active" : "",
        expanded ? "is-expanded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <KaTeXTooltip placement="top" formula="\text{Play}">
        <button
          type="button"
          className="track-card-main"
          aria-label={`Play ${track.title}`}
          aria-current={active ? "true" : undefined}
          onClick={() => {
            onToggleExpanded(track.id);
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
                      onSelectGenre(category);
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
