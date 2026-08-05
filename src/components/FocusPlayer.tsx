import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { formatClock, isRemoteTrack } from "../lib/audio";
import {
  categorizeTrackWithStatus,
  getTrackCategory,
  type TrackCategory,
  type TrackCategoryStatus,
} from "../lib/gemini";
import type { MusicProfile } from "../lib/profiles";
import type {
  FocusMode,
  MiniGoal,
  TimerPhase,
  TimerSettings,
  Track,
} from "../types";
import { Icon } from "./Icon";
import { KaTeXTooltip } from "./KaTeXTooltip";
import { MiniGoalChecklist } from "./MiniGoalChecklist";
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
  timerPhase: TimerPhase | null;
  mode: FocusMode;
  timerSettings: TimerSettings;
  timerSettingsOpen: boolean;
  libraryOpen: boolean;
  busy: boolean;
  error: string | null;
  browserMode: boolean;
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
    timerPhase,
    mode,
    timerSettings,
    timerSettingsOpen,
    libraryOpen,
    busy,
    error,
    browserMode,
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

  const durationSummary =
    timerSettings.kind === "infinite"
      ? "Infinite"
      : timerSettings.kind === "intervals"
        ? `${timerSettings.workDurationMinutes} / ${timerSettings.breakDurationMinutes} min`
        : `${timerSettings.durationMinutes ?? 60} min`;
  const [trackCategory, setTrackCategory] = useState<TrackCategory | null>(() =>
    currentTrack ? getTrackCategory(currentTrack) : null,
  );
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryStatus, setCategoryStatus] =
    useState<TrackCategoryStatus>("available");
  const categoryRequestIdRef = useRef(0);
  const categoryRequestTrackIdRef = useRef<string | null>(null);
  const categoryAbortRef = useRef<AbortController | null>(null);
  const visibleTrackIdRef = useRef<string | null>(currentTrack?.id ?? null);
  visibleTrackIdRef.current = currentTrack?.id ?? null;
  const [favoriteBursting, setFavoriteBursting] = useState(false);
  const favoriteBurstTimerRef = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const thumbnailUrl = currentTrack?.thumbnail ?? null;
  const thumbnailUrlRef = useRef(thumbnailUrl);
  const thumbnailTransitionTimerRef = useRef<number | null>(null);
  const [thumbnailLayers, setThumbnailLayers] = useState<{
    current: string | null;
    previous: string | null;
  }>({ current: thumbnailUrl, previous: null });
  const [thumbnailTransitioning, setThumbnailTransitioning] = useState(false);

  useEffect(() => {
    if (thumbnailUrlRef.current === thumbnailUrl) return;
    const previous = thumbnailUrlRef.current;
    thumbnailUrlRef.current = thumbnailUrl;
    if (thumbnailTransitionTimerRef.current !== null) {
      window.clearTimeout(thumbnailTransitionTimerRef.current);
    }

    if (shouldReduceMotion) {
      setThumbnailLayers({ current: thumbnailUrl, previous: null });
      setThumbnailTransitioning(false);
      return;
    }

    setThumbnailLayers({ current: thumbnailUrl, previous });
    setThumbnailTransitioning(true);
    thumbnailTransitionTimerRef.current = window.setTimeout(() => {
      thumbnailTransitionTimerRef.current = null;
      setThumbnailTransitioning(false);
      setThumbnailLayers((layers) => ({ current: layers.current, previous: null }));
    }, 460);

    return () => {
      if (thumbnailTransitionTimerRef.current !== null) {
        window.clearTimeout(thumbnailTransitionTimerRef.current);
        thumbnailTransitionTimerRef.current = null;
      }
    };
  }, [shouldReduceMotion, thumbnailUrl]);

  useEffect(
    () => () => {
      if (thumbnailTransitionTimerRef.current !== null) {
        window.clearTimeout(thumbnailTransitionTimerRef.current);
      }
    },
    [],
  );

  const previousThumbnailStyle = useMemo(
    () =>
      thumbnailLayers.previous
        ? { backgroundImage: `url("${thumbnailLayers.previous}")` }
        : undefined,
    [thumbnailLayers.previous],
  );
  const currentThumbnailStyle = useMemo(
    () =>
      thumbnailLayers.current
        ? { backgroundImage: `url("${thumbnailLayers.current}")` }
        : undefined,
    [thumbnailLayers.current],
  );
  const coverStyle = useMemo(
    () =>
      thumbnailUrl
        ? {
            backgroundImage: `linear-gradient(135deg, rgba(13, 22, 42, 0.2), rgba(20, 8, 30, 0.52)), url("${thumbnailUrl}")`,
          }
        : undefined,
    [thumbnailUrl],
  );

  const requestCategory = useCallback(async (track: Track) => {
    if (
      categoryAbortRef.current &&
      categoryRequestTrackIdRef.current === track.id
    ) {
      return;
    }

    categoryRequestIdRef.current += 1;
    const requestId = categoryRequestIdRef.current;
    categoryAbortRef.current?.abort();
    const controller = new AbortController();
    categoryAbortRef.current = controller;
    categoryRequestTrackIdRef.current = track.id;
    setCategoryLoading(true);
    setCategoryStatus("available");

    try {
      const result = await categorizeTrackWithStatus(track, controller.signal);
      if (
        requestId !== categoryRequestIdRef.current ||
        visibleTrackIdRef.current !== track.id
      ) {
        return;
      }
      setTrackCategory(result.category);
      setCategoryStatus(result.status);
    } catch {
      if (
        requestId === categoryRequestIdRef.current &&
        visibleTrackIdRef.current === track.id
      ) {
        setTrackCategory(null);
        setCategoryStatus("request-failed");
      }
    } finally {
      if (requestId === categoryRequestIdRef.current) {
        categoryAbortRef.current = null;
        categoryRequestTrackIdRef.current = null;
        setCategoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    categoryRequestIdRef.current += 1;
    categoryAbortRef.current?.abort();
    categoryAbortRef.current = null;
    categoryRequestTrackIdRef.current = null;

    const knownCategory = currentTrack ? getTrackCategory(currentTrack) : null;
    setTrackCategory(knownCategory);
    if (!currentTrack || knownCategory) {
      setCategoryLoading(false);
      setCategoryStatus(knownCategory ? "available" : "available");
      return;
    }

    setCategoryLoading(true);
    void requestCategory(currentTrack);
  }, [currentTrack?.id, requestCategory]);

  useEffect(
    () => () => {
      categoryRequestIdRef.current += 1;
      categoryAbortRef.current?.abort();
    },
    [],
  );

  useEffect(
    () => () => {
      if (favoriteBurstTimerRef.current !== null) {
        window.clearTimeout(favoriteBurstTimerRef.current);
      }
    },
    [],
  );

  const categoryLabel = categoryLoading
    ? "Classifying…"
    : trackCategory ??
      (categoryStatus === "missing-configuration"
        ? "AI setup"
        : categoryStatus === "request-failed"
          ? "Retry AI"
          : currentTrack
            ? "Categorize"
            : "No track");
  const categoryNeedsAction = Boolean(currentTrack && !trackCategory);
  const categoryActionLabel =
    categoryStatus === "missing-configuration"
      ? "Set up Gemini to categorize this track"
      : categoryStatus === "request-failed"
        ? "Retry AI category"
        : categoryLoading
          ? "Classifying track"
          : "Categorize track with Gemini";
  const categoryTooltip = trackCategory
    ? `\\text{AI music category:}~\\text{${escapeTex(categoryLabel)}}`
    : categoryStatus === "missing-configuration"
      ? "\\text{Gemini setup required: configure the local API key}"
      : categoryStatus === "request-failed"
        ? "\\text{Gemini request failed: click to retry}"
        : categoryLoading
          ? "\\text{Classifying this track with Gemini}"
          : "\\text{Classify this track with Gemini}";
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

  const handleMiniGoalsChange = useCallback(
    (miniGoals: MiniGoal[]) => {
      onTimerSettingsChange({
        ...timerSettings,
        miniGoals,
      });
    },
    [onTimerSettingsChange, timerSettings],
  );

  return (
    <div className={`focus-shell mode-${mode}${browserMode ? " is-browser" : ""}`}>
      <div className="focus-atmosphere" aria-hidden="true" />
      {thumbnailLayers.previous ? (
        <div
          className={
            thumbnailTransitioning
              ? "focus-thumbnail-atmosphere focus-thumbnail-atmosphere--previous is-fading"
              : "focus-thumbnail-atmosphere focus-thumbnail-atmosphere--previous"
          }
          aria-hidden="true"
          style={previousThumbnailStyle}
        />
      ) : null}
      {thumbnailLayers.current ? (
        <div
          className={
            thumbnailTransitioning
              ? "focus-thumbnail-atmosphere focus-thumbnail-atmosphere--current is-entering"
              : "focus-thumbnail-atmosphere focus-thumbnail-atmosphere--current"
          }
          aria-hidden="true"
          style={currentThumbnailStyle}
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
              aria-haspopup="dialog"
              aria-controls="timer-settings-dialog"
              aria-expanded={timerSettingsOpen}
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
        <p className="focus-kicker">IN FOCUS</p>

        {timerSettings.goal ? (
          <p className="timer-goal">{timerSettings.goal}</p>
        ) : null}

        {timerPhase ? (
          <span className="timer-phase-pill" aria-live="polite">
            {timerPhase === "work" ? "Work" : "Break"}
          </span>
        ) : null}

        <button
          type="button"
          className="timer-display"
          aria-label={`Timer ${timerLabel}`}
          aria-haspopup="dialog"
          aria-controls="timer-settings-dialog"
          aria-expanded={timerSettingsOpen}
          onClick={onOpenTimerSettings}
        >
          {timerLabel}
        </button>

        <button
          type="button"
          className="duration-pill"
          aria-label={`Change timer settings (${durationSummary})`}
          aria-haspopup="dialog"
          aria-controls="timer-settings-dialog"
          aria-expanded={timerSettingsOpen}
          onClick={onOpenTimerSettings}
        >
          {durationSummary}
          <Icon name="chevron-down" size={15} />
        </button>

        {timerSettings.miniGoals.length > 0 ? (
          <section className="focus-mini-goals" aria-label="Mini goals">
            <div className="focus-mini-goals-heading">
              <Icon name="sparkles" size={14} />
              <span>Mini goals</span>
            </div>
            <MiniGoalChecklist
              items={timerSettings.miniGoals}
              label="Mini goals"
              onChange={handleMiniGoalsChange}
            />
          </section>
        ) : null}
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
                      if (currentTrack) void requestCategory(currentTrack);
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
          <div className="transport-strip" role="group" aria-label="Playback controls">
            <span className="transport-side-icon" aria-hidden="true">
              <Icon name="shuffle" size={15} />
            </span>
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
            <KaTeXTooltip
              formula={
                favoritesOnly
                  ? "\\text{Repeat favorites queue}"
                  : "\\text{Repeat queue}"
              }
            >
              <button
                type="button"
                className={
                  favoritesOnly
                    ? "transport-side-btn repeat-btn is-active"
                    : "transport-side-btn repeat-btn"
                }
                aria-label={
                  favoritesOnly ? "Repeat favorites queue" : "Repeat queue"
                }
                aria-pressed={favoritesOnly}
                onClick={() => onSetFavoritesOnly(!favoritesOnly)}
              >
                <Icon name="repeat" size={15} />
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
