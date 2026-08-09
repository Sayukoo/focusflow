import { useEffect, useRef, useState, type ReactElement } from "react";
import { PLAYBACK_RATES, type FocusMode } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface PlaybackControlsProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  mode?: FocusMode;
  playbackRate?: number;
  onTogglePlay: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
  onPrevious: () => void | Promise<void>;
  onSeek: (seconds: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
}

export function PlaybackControls({
  isPlaying,
  progress,
  duration,
  mode,
  playbackRate = 1.0,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onPlaybackRateChange,
}: PlaybackControlsProps): ReactElement {
  const [speedPopoverOpen, setSpeedPopoverOpen] = useState(false);
  const speedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!speedPopoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setSpeedPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [speedPopoverOpen]);

  const seekPercent =
    duration > 0 ? (Math.min(progress, duration) / duration) * 100 : 0;

  const isEnergizing = mode === "energizing";
  const speedLabel =
    playbackRate === 1.0 ? "1.0x" : `${playbackRate.toFixed(1)}x`;

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

          {(isEnergizing || onPlaybackRateChange) && (
            <div className="speed-control-container" ref={speedRef}>
              <KaTeXTooltip formula={`\\text{Prędkość: ${speedLabel}}`}>
                <button
                  type="button"
                  className={`speed-btn ${playbackRate > 1.0 ? "is-active" : ""}`}
                  aria-label="Speed controls"
                  aria-expanded={speedPopoverOpen}
                  onClick={() => setSpeedPopoverOpen((prev) => !prev)}
                >
                  <Icon name="gauge" size={13} className="speed-icon" />
                  <span className="speed-label">{speedLabel}</span>
                </button>
              </KaTeXTooltip>

              {speedPopoverOpen && (
                <div className="speed-popover" role="menu" aria-label="Playback speed">
                  <div className="speed-popover-title">Prędkość odtwarzania</div>
                  <div className="speed-options">
                    {PLAYBACK_RATES.map((rate) => {
                      const pct = Math.round((rate - 1) * 100);
                      const isSelected = Math.abs(rate - playbackRate) < 0.05;
                      return (
                        <button
                          key={rate}
                          type="button"
                          className={`speed-option ${isSelected ? "is-selected" : ""}`}
                          role="menuitemradio"
                          aria-checked={isSelected}
                          onClick={() => {
                            onPlaybackRateChange?.(rate);
                            setSpeedPopoverOpen(false);
                          }}
                        >
                          <span className="speed-option-rate">{rate.toFixed(1)}x</span>
                          <span className="speed-option-pct">
                            {pct > 0 ? `+${pct}%` : pct === 0 ? "Normal" : `${pct}%`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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
