import type { ReactElement } from "react";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface PlaybackControlsProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlay: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
  onPrevious: () => void | Promise<void>;
  onSeek: (seconds: number) => void;
}

export function PlaybackControls({
  isPlaying,
  progress,
  duration,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
}: PlaybackControlsProps): ReactElement {
  const seekPercent =
    duration > 0 ? (Math.min(progress, duration) / duration) * 100 : 0;

  return (
    <div className="transport">
      <div className="transport-strip" role="group" aria-label="Playback controls">
        <div className="transport-row">
          <KaTeXTooltip formula="\text{Previous}">
            <button
              type="button"
              className="transport-btn transport-btn--previous"
              aria-label="Previous"
              onClick={onPrevious}
            >
              <Icon name="previous" size={18} />
            </button>
          </KaTeXTooltip>
          <KaTeXTooltip formula={isPlaying ? "\\text{Pause}" : "\\text{Play}"}>
            <button
              type="button"
              className="play-btn"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={onTogglePlay}
            >
              <Icon name={isPlaying ? "pause" : "play"} size={20} />
            </button>
          </KaTeXTooltip>
          <KaTeXTooltip formula="\text{Next}">
            <button
              type="button"
              className="transport-btn transport-btn--next"
              aria-label="Next"
              onClick={onNext}
            >
              <Icon name="next" size={18} />
            </button>
          </KaTeXTooltip>
        </div>
      </div>

      <div className="seek-row">
        <KaTeXTooltip formula={`\\text{${formatClock(progress)}}`}>
          <span className="seek-time">{formatClock(progress)}</span>
        </KaTeXTooltip>
        <input
          className="seek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(progress, duration || 0)}
          style={{ "--seek-pct": `${seekPercent}%` } as React.CSSProperties}
          aria-label="Seek"
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <KaTeXTooltip formula={`\\text{${formatClock(duration)}}`}>
          <span className="seek-time">{formatClock(duration)}</span>
        </KaTeXTooltip>
      </div>
    </div>
  );
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
