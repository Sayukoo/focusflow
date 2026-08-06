import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isRemoteTrack } from "../../lib/audio";
import {
  categorizeTrackWithStatus,
  getTrackCategory,
  type TrackCategory,
  type TrackCategoryStatus,
} from "../../lib/gemini";
import type { MusicProfile } from "../../lib/profiles";
import {
  type FocusMode,
  type MiniGoal,
  type PlaybackQueue,
  type TimerSettings,
  type Track,
} from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";
import { MobileMenu } from "../ui/MobileMenu";
import { MiniGoalChecklist } from "../tasks/MiniGoalChecklist";
import { MusicLibrary } from "../library/MusicLibrary";
import { ProfilePicker } from "../settings/ProfilePicker";
import { TimerSettings as TimerSettingsModal } from "../settings/TimerSettings";
import { RemotePlayer } from "../audio/RemotePlayer";
import { PlaybackControls } from "./PlaybackControls";
import { HeaderControls } from "./HeaderControls";
import { ThumbnailBackground } from "./ThumbnailBackground";

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
  browserMode: boolean;
  windowPinned: boolean;
  onToggleLibrary: (open: boolean) => void;
  onToggleProfilePicker: (open: boolean) => void;
  onSelectProfile: (profileId: string) => void | Promise<void>;
  onCreateProfile: (name: string) => void | Promise<void>;
  onDeleteProfile: (profileId: string) => void | Promise<void>;
  onUserAboutMeChange?: (userAboutMe: string) => void;
  onSetFavoritesOnly: (enabled: boolean) => void;
  onToggleFavorite: (trackId: string) => void;
  onOpenFolder: () => void;
  onImport: () => void;
  onAddLink: (url: string) => void;
  onDropFiles: (files: File[]) => void;
  onRefresh: () => void;
  onSelectTrack: (trackId: string) => void;
  onRemoveTrack: (track: Track) => void;
  onTogglePlay: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
  onPrevious: () => void | Promise<void>;
  onVolume: (value: number) => void;
  onSeek: (seconds: number) => void;
  onRemotePlaying: (playing: boolean) => void;
  onRemoteTime: (time: number) => void;
  onRemoteDuration: (duration: number) => void;
  onRemoteEnded: () => void;
  onRemoteError: (message: string) => void;
  remoteSeekRequest: { value: number; token: number } | null;
  onOpenTimerSettings: () => void;
  onCloseTimerSettings: () => void;
  onTimerSettingsChange?: (settings: TimerSettings) => void;
  onChangeTimerSettings?: (settings: TimerSettings) => void;
  onClearError?: () => void;
  onPlayQueue: (queue: PlaybackQueue, trackId: string | null) => void;
  onSetWindowPinned: (pinned: boolean) => void | Promise<void>;
}

export function FocusPlayer({
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
  browserMode,
  windowPinned,
  onToggleLibrary,
  onToggleProfilePicker,
  onSelectProfile,
  onCreateProfile,
  onDeleteProfile,
  onUserAboutMeChange,
  onSetFavoritesOnly,
  onToggleFavorite,
  onOpenFolder,
  onImport,
  onAddLink,
  onDropFiles,
  onRefresh,
  onSelectTrack,
  onRemoveTrack,
  onTogglePlay,
  onNext,
  onPrevious,
  onVolume,
  onSeek,
  onRemotePlaying,
  onRemoteTime,
  onRemoteDuration,
  onRemoteEnded,
  onRemoteError,
  remoteSeekRequest,
  onOpenTimerSettings,
  onCloseTimerSettings,
  onTimerSettingsChange,
  onChangeTimerSettings,
  onClearError,
  onPlayQueue,
  onSetWindowPinned,
}: FocusPlayerProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryStatus, setCategoryStatus] =
    useState<TrackCategoryStatus>("idle");
  const [currentCategory, setCurrentCategory] = useState<TrackCategory | null>(
    null,
  );
  const [favoriteBursting, setFavoriteBursting] = useState(false);
  const favoriteBurstTimerRef = useRef<number | null>(null);
  const categoryRequestRef = useRef<{
    abortController: AbortController;
    trackId: string;
  } | null>(null);
  const categoryMountedRef = useRef(true);

  useEffect(() => {
    categoryMountedRef.current = true;
    return () => {
      categoryMountedRef.current = false;
      if (categoryRequestRef.current) {
        categoryRequestRef.current.abortController.abort();
      }
    };
  }, []);

  const requestCategory = useCallback(
    async (track: Track, forceRequery = false) => {
      const existingCategory = getTrackCategory(track);
      if (existingCategory && !forceRequery) {
        setCategoryStatus("idle");
        setCurrentCategory(existingCategory);
        return;
      }

      if (categoryRequestRef.current) {
        categoryRequestRef.current.abortController.abort();
        categoryRequestRef.current = null;
      }

      const abortController = new AbortController();
      categoryRequestRef.current = {
        abortController,
        trackId: track.id,
      };

      setCategoryStatus("categorizing");
      setCurrentCategory(existingCategory);

      try {
        const result = await categorizeTrackWithStatus(
          track,
          abortController.signal,
          forceRequery,
        );

        if (
          !categoryMountedRef.current ||
          categoryRequestRef.current?.trackId !== track.id
        ) {
          return;
        }

        setCategoryStatus(result.status);
        setCurrentCategory(result.category);
      } catch {
        if (
          !categoryMountedRef.current ||
          categoryRequestRef.current?.trackId !== track.id
        ) {
          return;
        }
        setCategoryStatus("request-failed");
      } finally {
        if (categoryRequestRef.current?.trackId === track.id) {
          categoryRequestRef.current = null;
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!currentTrack) {
      if (categoryRequestRef.current) {
        categoryRequestRef.current.abortController.abort();
        categoryRequestRef.current = null;
      }
      setCategoryStatus("idle");
      setCurrentCategory(null);
      return;
    }

    void requestCategory(currentTrack);
  }, [currentTrack, requestCategory]);

  useEffect(
    () => () => {
      if (favoriteBurstTimerRef.current !== null) {
        window.clearTimeout(favoriteBurstTimerRef.current);
      }
    },
    [],
  );

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [activeProfileId, profiles],
  );
  const profileLabel = activeProfile?.name ?? "Default profile";

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
    if (categoryStatus === "missing-configuration" || categoryStatus === "no-api-key") return "AI setup";
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
    if (categoryStatus === "missing-configuration" || categoryStatus === "no-api-key") {
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
      : categoryStatus === "missing-configuration" || categoryStatus === "no-api-key"
        ? "Set up Gemini to categorize this track"
        : categoryStatus === "request-failed" || categoryStatus === "rate-limited"
          ? "Retry AI category"
          : "Categorize track with Gemini AI";

  const isRemote = isRemoteTrack(currentTrack);

  const durationSummary = useMemo(() => {
    if (timerSettings.kind === "infinite") return "Infinite focus";
    if (timerSettings.kind === "intervals") {
      const phaseLabel = (mode as string) === "break" ? "Break" : "Work";
      return `${phaseLabel} · ${timerSettings.workDurationMinutes}m / ${timerSettings.breakDurationMinutes}m`;
    }
    return `${timerSettings.durationMinutes ?? 60}m session`;
  }, [
    mode,
    timerSettings.breakDurationMinutes,
    timerSettings.durationMinutes,
    timerSettings.kind,
    timerSettings.workDurationMinutes,
  ]);

  const windowPinAvailable = true;

  const handleMiniGoalsChange = (next: MiniGoal[]) => {
    const updateFn = onTimerSettingsChange ?? onChangeTimerSettings;
    updateFn?.({
      ...timerSettings,
      miniGoals: next,
    });
  };

  const openMobileTimer = () => {
    setMobileMenuOpen(false);
    onOpenTimerSettings();
  };

  const openMobileLibrary = () => {
    setMobileMenuOpen(false);
    onToggleLibrary(true);
  };

  const openMobileProfiles = () => {
    setMobileMenuOpen(false);
    onToggleProfilePicker(true);
  };

  const shellClasses = [
    "focus-shell",
    `mode-${mode}`,
    browserMode ? "is-browser" : "",
    windowPinned ? "is-window-pinned" : "",
    favoritesOnly ? "is-favorites-only" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClasses}>
      <ThumbnailBackground
        thumbnail={currentTrack?.thumbnail}
        isPlaying={isPlaying}
      />
      <div className="focus-atmosphere" aria-hidden="true" />
      <div className="focus-vignette" aria-hidden="true" />

      <header className="focus-top">
        <div className="focus-top-left">
          <button
            type="button"
            className="mobile-menu-trigger"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-controls="mobile-menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Icon name="menu" size={20} />
          </button>
        </div>

        <HeaderControls
          windowPinned={windowPinned}
          windowPinAvailable={windowPinAvailable}
          onSetWindowPinned={onSetWindowPinned}
          onToggleLibrary={onToggleLibrary}
          onToggleProfilePicker={onToggleProfilePicker}
        />
      </header>

      <ProfilePicker
        open={profilePickerOpen}
        profiles={profiles}
        activeProfileId={activeProfileId}
        userAboutMe={timerSettings.userAboutMe}
        onClose={() => onToggleProfilePicker(false)}
        onSelect={onSelectProfile}
        onCreate={onCreateProfile}
        onDelete={onDeleteProfile}
        onUserAboutMeChange={onUserAboutMeChange}
      />

      <MobileMenu
        open={mobileMenuOpen}
        profileLabel={profileLabel}
        durationLabel={durationSummary}
        trackCount={tracks.length}
        favoritesOnly={favoritesOnly}
        volume={volume}
        isPlaying={isPlaying}
        windowPinned={windowPinned}
        windowPinAvailable={windowPinAvailable}
        onClose={() => setMobileMenuOpen(false)}
        onOpenTimer={openMobileTimer}
        onOpenLibrary={openMobileLibrary}
        onOpenProfiles={openMobileProfiles}
        onSetFavoritesOnly={onSetFavoritesOnly}
        onVolume={onVolume}
        onTogglePlay={onTogglePlay}
        onSetWindowPinned={onSetWindowPinned}
      />

      <main className="focus-center">
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

        {timerSettings.goal ? (
          <button
            type="button"
            className="timer-goal-text-btn"
            aria-label="Main task - Edit in timer settings"
            onClick={onOpenTimerSettings}
          >
            {timerSettings.goal}
          </button>
        ) : null}

        {timerSettings.miniGoals.length > 0 ? (
          <section
            className={
              windowPinned
                ? "focus-mini-goals focus-mini-goals--flat focus-mini-goals--pinned"
                : "focus-mini-goals focus-mini-goals--flat focus-mini-goals--desktop"
            }
            aria-label="Subtasks"
          >
            <MiniGoalChecklist
              items={timerSettings.miniGoals}
              label="Subtasks"
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

        <PlaybackControls
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrevious={onPrevious}
          onSeek={onSeek}
        />

        <div className="focus-controls focus-stats">
          <KaTeXTooltip formula={`\\text{Volume: ${Math.round(volume * 100)}\\%}`}>
            <div className="volume" aria-label="Volume strip">
              <Icon name="volume" size={18} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                style={{ "--vol": `${Math.round(volume * 100)}%` } as React.CSSProperties}
                aria-label="Volume"
                onChange={(event) => onVolume(Number(event.target.value))}
              />
            </div>
          </KaTeXTooltip>
        </div>
      </footer>

      {isRemote ? (
        <RemotePlayer
          track={currentTrack}
          playing={isPlaying}
          volume={volume}
          seekRequest={remoteSeekRequest}
          onTime={onRemoteTime}
          onDuration={onRemoteDuration}
          onPlaying={onRemotePlaying}
          onEnded={onRemoteEnded}
          onError={onRemoteError}
        />
      ) : null}

      <MusicLibrary
        open={libraryOpen}
        tracks={tracks}
        activeProfileName={profileLabel}
        currentTrackCategory={currentCategory}
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
        onSelect={onSelectTrack}
        onRemove={onRemoveTrack}
        onToggleFavorite={onToggleFavorite}
        onPlayQueue={onPlayQueue}
      />

      <TimerSettingsModal
        open={timerSettingsOpen}
        settings={timerSettings}
        onClose={onCloseTimerSettings}
        onChange={(settings) =>
          (onTimerSettingsChange ?? onChangeTimerSettings)?.(settings)
        }
      />

      {error ? (
        <div className="error-toast" role="alert" aria-live="assertive">
          <span className="error-toast-text">{error}</span>
          <KaTeXTooltip formula="\text{Dismiss error}">
            <button
              type="button"
              className="error-toast-close"
              aria-label="Dismiss error"
              onClick={onClearError ?? onRefresh}
            >
              <Icon name="close" size={14} />
            </button>
          </KaTeXTooltip>
        </div>
      ) : null}
    </div>
  );
}

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}
