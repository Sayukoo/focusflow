import { formatClock } from "../lib/audio";
import type { FocusMode, TimerSettings, Track } from "../types";
import { Icon } from "./Icon";
import { KaTeXTooltip } from "./KaTeXTooltip";
import { MusicLibrary } from "./MusicLibrary";
import { TimerSettings as TimerSettingsModal } from "./TimerSettings";
import { YouTubePlayer } from "./YouTubePlayer";

interface FocusPlayerProps {
  tracks: Track[];
  musicDir: string;
  currentTrack: Track | null;
  favoriteTrackIds: string[];
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  timerLabel: string;
  mode: FocusMode;
  timerSettings: TimerSettings;
  timerSettingsOpen: boolean;
  libraryOpen: boolean;
  busy: boolean;
  error: string | null;
  onToggleLibrary: (open: boolean) => void;
  onImport: () => void;
  onAddLink: (url: string) => void;
  onDropFiles: (files: File[]) => void;
  youtubeSeekRequest: { value: number; token: number } | null;
  onYoutubeTime: (value: number) => void;
  onYoutubeDuration: (value: number) => void;
  onYoutubePlaying: (playing: boolean) => void;
  onYoutubeEnded: () => void;
  onYoutubeError: (message: string) => void;
  onRefresh: () => void;
  onOpenFolder: () => void;
  onSelect: (trackId: string, autoplay?: boolean) => void;
  onRemove: (track: Track) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (value: number) => void;
  onVolume: (value: number) => void;
  onToggleFavorite: (trackId: string) => void;
  onCycleMode: () => void;
  onOpenTimerSettings: () => void;
  onCloseTimerSettings: () => void;
  onTimerSettingsChange: (settings: TimerSettings) => void;
  onResetSession: () => void;
  onClearError: () => void;
}

const MODE_LABEL: Record<FocusMode, string> = {
  deep: "Deep Work",
  flow: "Flow",
  calm: "Calm",
};

const MODE_TEX: Record<FocusMode, string> = {
  deep: "\\text{Deep Work}",
  flow: "\\text{Flow State}",
  calm: "\\text{Calm Focus}",
};

export function FocusPlayer(props: FocusPlayerProps) {
  const {
    tracks,
    musicDir,
    currentTrack,
    favoriteTrackIds,
    currentTrackId,
    isPlaying,
    volume,
    progress,
    duration,
    timerLabel,
    mode,
    timerSettings,
    timerSettingsOpen,
    libraryOpen,
    busy,
    error,
    onToggleLibrary,
    onImport,
    onAddLink,
    onDropFiles,
    youtubeSeekRequest,
    onYoutubeTime,
    onYoutubeDuration,
    onYoutubePlaying,
    onYoutubeEnded,
    onYoutubeError,
    onRefresh,
    onOpenFolder,
    onSelect,
    onRemove,
    onTogglePlay,
    onNext,
    onPrevious,
    onSeek,
    onVolume,
    onToggleFavorite,
    onCycleMode,
    onOpenTimerSettings,
    onCloseTimerSettings,
    onTimerSettingsChange,
    onResetSession,
    onClearError,
  } = props;

  const durationText =
    timerSettings.kind === "infinite"
      ? "\\infty"
      : `${timerSettings.durationMinutes ?? 60}\\text{m}`;

  return (
    <div className={`focus-shell mode-${mode}`}>
      <div className="focus-atmosphere" aria-hidden="true" />
      {currentTrack?.thumbnail ? (
        <div
          className="focus-thumbnail-atmosphere"
          aria-hidden="true"
          style={{ backgroundImage: `url("${currentTrack.thumbnail}")` }}
        />
      ) : null}
      <div className="focus-vignette" aria-hidden="true" />
      <YouTubePlayer
        track={currentTrack?.source === "youtube" ? currentTrack : null}
        playing={currentTrack?.source === "youtube" && isPlaying}
        volume={volume}
        seekRequest={youtubeSeekRequest}
        onTime={onYoutubeTime}
        onDuration={onYoutubeDuration}
        onPlaying={onYoutubePlaying}
        onEnded={onYoutubeEnded}
        onError={onYoutubeError}
      />

      <header className="focus-top">
        <div className="focus-top-left">
          <KaTeXTooltip formula="\text{Session home}">
            <button type="button" className="icon-btn ghost" aria-label="Back">
              <Icon name="arrow-left" />
            </button>
          </KaTeXTooltip>
          <KaTeXTooltip formula={MODE_TEX[mode]}>
            <button
              type="button"
              className="mode-pill"
              aria-label={MODE_LABEL[mode]}
              onClick={onCycleMode}
            >
              <span className="mode-dot" aria-hidden="true" />
              <span className="mode-text">{MODE_LABEL[mode]}</span>
              <Icon name="chevron-down" size={15} />
            </button>
          </KaTeXTooltip>
        </div>

        <div className="focus-top-right">
          <KaTeXTooltip formula="\text{Timer settings}">
            <button
              type="button"
              className="icon-btn ghost"
              aria-label="Timer settings"
              onClick={onOpenTimerSettings}
            >
              <Icon name="stopwatch" />
            </button>
          </KaTeXTooltip>
          <KaTeXTooltip formula="\text{Music library}">
            <button
              type="button"
              className="icon-btn ghost"
              aria-label="Library"
              onClick={() => onToggleLibrary(true)}
            >
              <Icon name="library" />
            </button>
          </KaTeXTooltip>
          <KaTeXTooltip formula={`\\text{Open music folder}`}>
            <button
              type="button"
              className="icon-btn ghost has-badge"
              aria-label="Open music folder"
              onClick={() => onToggleLibrary(true)}
            >
              <Icon name="folder-open" />
              <span className="badge-dot" aria-hidden="true" />
            </button>
          </KaTeXTooltip>
        </div>
      </header>

      <main className="focus-center">
        <KaTeXTooltip formula="\text{IN FOCUS}">
          <p className="focus-kicker">IN FOCUS</p>
        </KaTeXTooltip>

        <KaTeXTooltip
          formula={
            timerSettings.kind === "infinite"
              ? `\\text{Elapsed }${timerLabel}`
              : `\\text{Remaining }${timerLabel}`
          }
        >
          <button
            type="button"
            className="timer-display"
            aria-label={`Timer ${timerLabel}`}
            onClick={onResetSession}
          >
            {timerLabel}
          </button>
        </KaTeXTooltip>

          <KaTeXTooltip formula={`\\text{Duration:}~${durationText}`}>
          <button
            type="button"
            className="duration-pill"
            aria-label="Change duration"
            onClick={onOpenTimerSettings}
          >
            {timerSettings.kind === "infinite"
              ? "∞ Infinity"
              : `${timerSettings.durationMinutes ?? 60} min`}
            <Icon name="chevron-down" size={15} />
          </button>
        </KaTeXTooltip>
      </main>

      <footer className="focus-bottom">
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
              style={
                currentTrack?.thumbnail
                  ? {
                      backgroundImage: `linear-gradient(135deg, rgba(13, 22, 42, 0.2), rgba(20, 8, 30, 0.52)), url("${currentTrack.thumbnail}")`,
                    }
                  : undefined
              }
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
            <KaTeXTooltip formula="\text{Local Neural Effect}">
              <span className="now-sub">Local Neural Effect</span>
            </KaTeXTooltip>
            <div className="now-chips">
              <KaTeXTooltip formula="\text{Groove}">
                <span className="chip">GROOVE</span>
              </KaTeXTooltip>
              <KaTeXTooltip formula="\text{Track details}">
                <button
                  type="button"
                  className="chip"
                  onClick={() => onToggleLibrary(true)}
                >
                  + DETAILS
                </button>
              </KaTeXTooltip>
            </div>
          </div>

          <div className="now-react">
            <KaTeXTooltip formula="\text{Skip vibe}">
              <button type="button" className="icon-btn ghost" aria-label="Dislike">
                <Icon name="thumbs-down" size={18} />
              </button>
            </KaTeXTooltip>
            <KaTeXTooltip formula="\text{Favorite}">
              <button
                type="button"
                className={`icon-btn ghost ${currentTrack && favoriteTrackIds.includes(currentTrack.id) ? "is-favorite" : ""}`}
                aria-label={
                  currentTrack && favoriteTrackIds.includes(currentTrack.id)
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                aria-pressed={currentTrack ? favoriteTrackIds.includes(currentTrack.id) : false}
                disabled={!currentTrack}
                onClick={() => {
                  if (currentTrack) onToggleFavorite(currentTrack.id);
                }}
              >
                <Icon name="heart" size={19} />
              </button>
            </KaTeXTooltip>
            <KaTeXTooltip formula="\text{Share session}">
              <button type="button" className="icon-btn ghost" aria-label="Share">
                <Icon name="share" size={18} />
              </button>
            </KaTeXTooltip>
          </div>
        </div>

        <div className="transport">
          <KaTeXTooltip formula="\text{Repeat queue}">
            <button type="button" className="icon-btn ghost tiny" aria-label="Repeat">
              <Icon name="repeat" size={17} />
            </button>
          </KaTeXTooltip>
          <div className="transport-row">
            <KaTeXTooltip formula="\text{Previous}">
              <button
                type="button"
                className="icon-btn ghost"
                aria-label="Previous"
                onClick={onPrevious}
              >
                <Icon name="previous" size={21} />
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
                className="icon-btn ghost"
                aria-label="Next"
                onClick={onNext}
              >
                <Icon name="next" size={21} />
              </button>
            </KaTeXTooltip>
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
              aria-label="Seek"
              onChange={(event) => onSeek(Number(event.target.value))}
            />
            <KaTeXTooltip formula={`\\text{${formatClock(duration)}}`}>
              <span className="seek-time">{formatClock(duration)}</span>
            </KaTeXTooltip>
          </div>
        </div>

        <div className="focus-stats">
          <KaTeXTooltip formula={`\\text{${tracks.length}~tracks in library}`}>
            <button
              type="button"
              className="streak"
              onClick={() => onToggleLibrary(true)}
            >
              <Icon name="sparkles" size={17} />
              <span>{tracks.length} tracks</span>
            </button>
          </KaTeXTooltip>
          <KaTeXTooltip formula={`\\text{Volume }${Math.round(volume * 100)}\\%`}>
            <label
              className="volume"
              style={{ ["--vol" as string]: `${Math.round(volume * 100)}%` }}
            >
              <Icon name="volume" size={17} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volume"
                onChange={(event) => onVolume(Number(event.target.value))}
              />
            </label>
          </KaTeXTooltip>
        </div>
      </footer>

      {error ? (
        <KaTeXTooltip formula={`\\text{${escapeTex(error)}}`}>
          <button type="button" className="toast" onClick={onClearError}>
            !
          </button>
        </KaTeXTooltip>
      ) : null}

      <TimerSettingsModal
        open={timerSettingsOpen}
        settings={timerSettings}
        onClose={onCloseTimerSettings}
        onChange={onTimerSettingsChange}
      />

      <MusicLibrary
        open={libraryOpen}
        tracks={tracks}
        currentTrackId={currentTrackId}
        musicDir={musicDir}
        busy={busy}
        onClose={() => onToggleLibrary(false)}
        onImport={onImport}
        onAddLink={onAddLink}
        onDropFiles={onDropFiles}
        onRefresh={onRefresh}
        onOpenFolder={onOpenFolder}
        onSelect={(trackId) => {
          void onSelect(trackId, true);
          onToggleLibrary(false);
        }}
        onRemove={onRemove}
      />
    </div>
  );
}

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}
