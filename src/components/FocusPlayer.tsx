import { useEffect, useRef, useState } from "react";
import { formatClock, isRemoteTrack } from "../lib/audio";
import { categorizeTrack } from "../lib/gemini";
import type { MusicProfile } from "../lib/profiles";
import type { FocusMode, TimerSettings, Track } from "../types";
import { Icon } from "./Icon";
import { KaTeXTooltip } from "./KaTeXTooltip";
import { MusicLibrary } from "./MusicLibrary";
import { ProfilePicker } from "./ProfilePicker";
import { TimerSettings as TimerSettingsModal } from "./TimerSettings";
import { RemotePlayer } from "./RemotePlayer";

interface FocusPlayerProps {
  tracks: Track[];
  musicDir: string;
  currentTrack: Track | null;
  profiles: MusicProfile[];
  activeProfileId: string;
  profilePickerOpen: boolean;
  favoriteTrackIds: string[];
  favoritesOnly: boolean;
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
  onToggleProfilePicker: (open: boolean) => void;
  onSelectProfile: (profileId: string) => void | Promise<void>;
  onCreateProfile: (name: string) => void | Promise<void>;
  onDeleteProfile: (profileId: string) => void | Promise<void>;
  onImport: () => void;
  onAddLink: (url: string) => void;
  onDropFiles: (files: File[]) => void;
  remoteSeekRequest: { value: number; token: number } | null;
  onRemoteTime: (value: number) => void;
  onRemoteDuration: (value: number) => void;
  onRemotePlaying: (playing: boolean) => void;
  onRemoteEnded: () => void;
  onRemoteError: (message: string) => void;
  onRefresh: () => void;
  onOpenFolder: () => void;
  onSelect: (trackId: string, autoplay?: boolean) => void;
  onRemove: (track: Track) => void;
  onSetFavoritesOnly: (enabled: boolean) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (value: number) => void;
  onVolume: (value: number) => void;
  onToggleFavorite: (trackId: string) => void;
  onOpenTimerSettings: () => void;
  onCloseTimerSettings: () => void;
  onTimerSettingsChange: (settings: TimerSettings) => void;
  onClearError: () => void;
}

export function FocusPlayer(props: FocusPlayerProps) {
  const {
    tracks,
    musicDir,
    currentTrack,
    profiles,
    activeProfileId,
    profilePickerOpen,
    favoriteTrackIds,
    favoritesOnly,
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
    onToggleProfilePicker,
    onSelectProfile,
    onCreateProfile,
    onDeleteProfile,
    onImport,
    onAddLink,
    onDropFiles,
    remoteSeekRequest,
    onRemoteTime,
    onRemoteDuration,
    onRemotePlaying,
    onRemoteEnded,
    onRemoteError,
    onRefresh,
    onOpenFolder,
    onSelect,
    onRemove,
    onSetFavoritesOnly,
    onTogglePlay,
    onNext,
    onPrevious,
    onSeek,
    onVolume,
    onToggleFavorite,
    onOpenTimerSettings,
    onCloseTimerSettings,
    onTimerSettingsChange,
    onClearError,
  } = props;

  const durationText =
    timerSettings.kind === "infinite"
      ? "\\infty"
      : `${timerSettings.durationMinutes ?? 60}\\text{m}`;
  const [trackCategory, setTrackCategory] = useState<string | null>(
    currentTrack?.category ?? null,
  );
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [favoriteBursting, setFavoriteBursting] = useState(false);
  const favoriteBurstTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setTrackCategory(currentTrack?.category ?? null);
    setCategoryLoading(Boolean(currentTrack));
    if (!currentTrack) return () => undefined;

    void categorizeTrack(currentTrack).then((category) => {
      if (!active) return;
      setTrackCategory(category);
      setCategoryLoading(false);
    });

    return () => {
      active = false;
    };
  }, [currentTrack?.id]);

  useEffect(
    () => () => {
      if (favoriteBurstTimerRef.current !== null) {
        window.clearTimeout(favoriteBurstTimerRef.current);
      }
    },
    [],
  );

  const categoryLabel = categoryLoading
    ? "AI..."
    : trackCategory ?? "GROOVE";
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const profileLabel = activeProfile?.name ?? "Deep Work";
  const sourceLabel =
    currentTrack?.source === "youtube"
      ? "YouTube stream"
      : currentTrack?.source === "spotify"
        ? "Spotify stream"
        : currentTrack?.source === "soundcloud"
          ? "SoundCloud stream"
          : currentTrack?.source === "tiktok"
            ? "TikTok stream"
            : "Local Neural Effect";

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
      <RemotePlayer
        track={currentTrack}
        playing={Boolean(isRemoteTrack(currentTrack) && isPlaying)}
        volume={volume}
        seekRequest={remoteSeekRequest}
        onTime={onRemoteTime}
        onDuration={onRemoteDuration}
        onPlaying={onRemotePlaying}
        onEnded={onRemoteEnded}
        onError={onRemoteError}
      />

      <header className="focus-top">
        <div className="focus-top-left">
          <KaTeXTooltip formula="\text{Session home}">
            <button type="button" className="icon-btn ghost" aria-label="Back">
              <Icon name="arrow-left" />
            </button>
          </KaTeXTooltip>
          <KaTeXTooltip formula={`\\text{${escapeTex(profileLabel)}}`}>
            <button
              type="button"
              className={`mode-pill profile-pill profile-pill--${activeProfile?.theme ?? mode}`}
              aria-label={`Profile: ${profileLabel}`}
              aria-expanded={profilePickerOpen}
              onClick={() => onToggleProfilePicker(!profilePickerOpen)}
            >
              <span className="mode-dot" aria-hidden="true" />
              <span className="mode-text">{profileLabel}</span>
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

      <ProfilePicker
        open={profilePickerOpen}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onClose={() => onToggleProfilePicker(false)}
        onSelect={onSelectProfile}
        onCreate={onCreateProfile}
        onDelete={onDeleteProfile}
      />

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
            onClick={onOpenTimerSettings}
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
            <KaTeXTooltip formula={`\\text{${sourceLabel}}`}>
              <span className="now-sub">{sourceLabel}</span>
            </KaTeXTooltip>
            <div className="now-chips">
              <KaTeXTooltip
                formula={`\\text{AI music category:}~\\text{${escapeTex(categoryLabel)}}`}
              >
                <span className={categoryLoading ? "chip is-loading" : "chip"}>
                  {categoryLabel}
                </span>
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
                  currentTrack && favoriteTrackIds.includes(currentTrack.id)
                    ? "is-favorite"
                    : "",
                  favoriteBursting ? "is-bursting" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={
                  currentTrack && favoriteTrackIds.includes(currentTrack.id)
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                aria-pressed={currentTrack ? favoriteTrackIds.includes(currentTrack.id) : false}
                disabled={!currentTrack}
                onClick={() => {
                  if (!currentTrack) return;
                  const wasFavorite = favoriteTrackIds.includes(currentTrack.id);
                  onToggleFavorite(currentTrack.id);
                  if (wasFavorite) return;
                  if (favoriteBurstTimerRef.current !== null) {
                    window.clearTimeout(favoriteBurstTimerRef.current);
                  }
                  setFavoriteBursting(true);
                  favoriteBurstTimerRef.current = window.setTimeout(() => {
                    favoriteBurstTimerRef.current = null;
                    setFavoriteBursting(false);
                  }, 760);
                }}
              >
                <Icon name="heart" size={19} />
              </button>
            </KaTeXTooltip>
          </div>
        </div>

        <div className="transport">
          <KaTeXTooltip formula="\text{Repeat queue}">
            <button type="button" className="repeat-btn" aria-label="Repeat queue">
              <Icon name="repeat" size={19} />
            </button>
          </KaTeXTooltip>
          <div className="transport-row">
            <KaTeXTooltip formula="\text{Previous}">
              <button
                type="button"
                className="transport-btn transport-btn--previous"
                aria-label="Previous"
                onClick={onPrevious}
              >
                <Icon name="previous" size={24} />
              </button>
            </KaTeXTooltip>
            <KaTeXTooltip formula={isPlaying ? "\\text{Pause}" : "\\text{Play}"}>
              <button
                type="button"
                className="play-btn"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={onTogglePlay}
              >
                <Icon name={isPlaying ? "pause" : "play"} size={27} />
              </button>
            </KaTeXTooltip>
            <KaTeXTooltip formula="\text{Next}">
              <button
                type="button"
                className="transport-btn transport-btn--next"
                aria-label="Next"
                onClick={onNext}
              >
                <Icon name="next" size={24} />
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
        activeProfileName={profileLabel}
        currentTrackCategory={trackCategory}
        currentTrackId={currentTrackId}
        favoriteTrackIds={favoriteTrackIds}
        favoritesOnly={favoritesOnly}
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
        }}
        onRemove={onRemove}
        onToggleFavorite={onToggleFavorite}
        onSetFavoritesOnly={onSetFavoritesOnly}
      />
    </div>
  );
}

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}
