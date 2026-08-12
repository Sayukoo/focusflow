import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import type { FocusAnalyticsStore } from "../../lib/analytics";
import { isRemoteTrack } from "../../lib/audio";
import {
  categorizeTrackWithStatus,
  getTrackCategory,
  type TrackCategory,
  type TrackCategoryStatus,
} from "../../lib/gemini";
import type { MusicProfile } from "../../lib/profiles";
import { DEFAULT_BREAK_MINI_GOALS } from "../../lib/timer";
import {
  type FocusMode,
  type MiniGoal,
  type PlaybackQueue,
  type TimerPhase,
  type TimerSettings,
  type Track,
} from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";
import { MobileMenu } from "../ui/MobileMenu";
import { KeyboardShortcutsModal } from "../ui/KeyboardShortcutsModal";
import { MiniGoalChecklist } from "../tasks/MiniGoalChecklist";
import { ProfilePicker, type FocusAnalyticsSummary } from "../settings/ProfilePicker";
import { RemotePlayer } from "../audio/RemotePlayer";
import { MusicLibrary } from "../library/MusicLibrary";
import { TimerSettings as TimerSettingsModal } from "../settings/TimerSettings";
import { PlaybackControls } from "./PlaybackControls";
import { HeaderControls } from "./HeaderControls";
import { ThumbnailBackground } from "./ThumbnailBackground";
import { ConfettiOverlay } from "./ConfettiOverlay";
import { TrackMetaDisplay } from "./TrackMetaDisplay";

interface FocusPlayerProps {
  tracks: Track[];
  musicDir: string;
  currentTrack: Track | null;
  profiles: MusicProfile[];
  activeProfileId: string;
  analyticsSummary?: FocusAnalyticsSummary;
  analyticsStore?: FocusAnalyticsStore;
  profilePickerOpen: boolean;
  favoriteTrackIds: string[];
  favoritesOnly: boolean;
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number;
  duckingMultiplier?: number;
  progress: number;
  duration: number;
  playbackRate?: number;
  timerLabel: string;
  currentPhase?: TimerPhase;
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
  onPlaybackRateChange?: (rate: number) => void;
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

const CONFETTI_TAP_COUNT = 15;

export function FocusPlayer({
  tracks,
  currentTrack,
  profiles,
  activeProfileId,
  analyticsSummary,
  analyticsStore,
  profilePickerOpen,
  favoriteTrackIds,
  favoritesOnly,
  isPlaying,
  volume,
  duckingMultiplier = 1.0,
  progress,
  duration,
  playbackRate = 1.0,
  timerLabel,
  currentPhase,
  mode,
  timerSettings,
  timerSettingsOpen,
  libraryOpen,
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
  onRefresh,
  onTogglePlay,
  onNext,
  onPrevious,
  onVolume,
  onPlaybackRateChange,
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
  onSetWindowPinned,
  musicDir,
  currentTrackId,
  busy = false,
  onImport,
  onAddLink,
  onDropFiles,
  onOpenFolder,
  onSelectTrack,
  onRemoveTrack,
  onPlayQueue,
}: FocusPlayerProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hotkeysModalOpen, setHotkeysModalOpen] = useState(false);

  useKeyboardShortcuts({
    onTogglePlay: () => void onTogglePlay(),
    onNext: () => void onNext(),
    onPrevious: () => void onPrevious(),
    onToggleLibrary: () => onToggleLibrary(!libraryOpen),
    onToggleTimer: () => (timerSettingsOpen ? onCloseTimerSettings() : onOpenTimerSettings()),
    onToggleProfile: () => onToggleProfilePicker(!profilePickerOpen),
    onToggleShortcuts: () => setHotkeysModalOpen((prev) => !prev),
    onSpeedUp: () => {
      if (onPlaybackRateChange) {
        const nextRate = Math.min(2.0, Math.round((playbackRate + 0.1) * 10) / 10);
        onPlaybackRateChange(nextRate);
      }
    },
    onSpeedDown: () => {
      if (onPlaybackRateChange) {
        const nextRate = Math.max(0.5, Math.round((playbackRate - 0.1) * 10) / 10);
        onPlaybackRateChange(nextRate);
      }
    },
    onEscape: () => {
      if (hotkeysModalOpen) {
        setHotkeysModalOpen(false);
        return;
      }
      if (libraryOpen) {
        onToggleLibrary(false);
        return;
      }
      if (timerSettingsOpen) {
        onCloseTimerSettings();
        return;
      }
      if (profilePickerOpen) {
        onToggleProfilePicker(false);
        return;
      }
      if (windowPinned) {
        void onSetWindowPinned(false);
      }
    },
  });

  const [categoryStatus, setCategoryStatus] =
    useState<TrackCategoryStatus>("idle");
  const [currentCategory, setCurrentCategory] = useState<TrackCategory | null>(
    null,
  );
  const [favoriteBursting, setFavoriteBursting] = useState(false);
  const [confettiBursting, setConfettiBursting] = useState(false);
  const [confettiBurstId, setConfettiBurstId] = useState(0);
  const favoriteBurstTimerRef = useRef<number | null>(null);
  const timerTapCountRef = useRef(0);
  const confettiTimerRef = useRef<number | null>(null);
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
      if (confettiTimerRef.current !== null) {
        window.clearTimeout(confettiTimerRef.current);
      }
    },
    [],
  );

  const [draftGoal, setDraftGoal] = useState(timerSettings.goal);
  const goalInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraftGoal(timerSettings.goal);
  }, [timerSettings.goal]);

  const handleQuickPomodoro = () => {
    const updateFn = onTimerSettingsChange ?? onChangeTimerSettings;
    updateFn?.({
      ...timerSettings,
      kind: "intervals",
      durationMinutes: 25,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
    });
    window.setTimeout(() => goalInputRef.current?.focus(), 0);
  };

  const handleGoalChange = (nextGoal: string) => {
    setDraftGoal(nextGoal);
    const updateFn = onTimerSettingsChange ?? onChangeTimerSettings;
    updateFn?.({
      ...timerSettings,
      goal: nextGoal,
    });
  };

  const handleGoalBlur = () => {
    const trimmed = draftGoal.trim();
    setDraftGoal(trimmed);
    if (trimmed !== timerSettings.goal) {
      const updateFn = onTimerSettingsChange ?? onChangeTimerSettings;
      updateFn?.({
        ...timerSettings,
        goal: trimmed,
      });
    }
  };

  const isBreakPhase = currentPhase === "break";

  const handleBreakMiniGoalsChange = useCallback(
    (nextBreakMiniGoals: MiniGoal[]) => {
      const nextSettings = {
        ...timerSettings,
        breakMiniGoals: nextBreakMiniGoals,
      };
      (onTimerSettingsChange ?? onChangeTimerSettings)?.(nextSettings);
    },
    [onChangeTimerSettings, onTimerSettingsChange, timerSettings],
  );

  const handleGoalKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleGoalBlur();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraftGoal(timerSettings.goal);
      event.currentTarget.blur();
    }
  };

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [activeProfileId, profiles],
  );
  const profileLabel = activeProfile?.name ?? "Default profile";

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

  const handleTimerTap = () => {
    timerTapCountRef.current += 1;
    if (timerTapCountRef.current < CONFETTI_TAP_COUNT) return;

    timerTapCountRef.current = 0;
    setConfettiBurstId((current) => current + 1);
    setConfettiBursting(true);
    if (confettiTimerRef.current !== null) {
      window.clearTimeout(confettiTimerRef.current);
    }
    confettiTimerRef.current = window.setTimeout(() => {
      confettiTimerRef.current = null;
      setConfettiBursting(false);
    }, 2_000);
  };

  const handleSetFavoriteBursting = (bursting: boolean) => {
    if (favoriteBurstTimerRef.current !== null) {
      window.clearTimeout(favoriteBurstTimerRef.current);
    }
    setFavoriteBursting(bursting);
    if (bursting) {
      favoriteBurstTimerRef.current = window.setTimeout(() => {
        favoriteBurstTimerRef.current = null;
        setFavoriteBursting(false);
      }, 760);
    }
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
      {confettiBursting ? <ConfettiOverlay burstId={confettiBurstId} /> : null}

      <header className="focus-top">
        <div className="focus-top-left" />

        <HeaderControls
          windowPinned={windowPinned}
          windowPinAvailable={windowPinAvailable}
          volume={volume}
          onVolume={onVolume}
          onSetWindowPinned={onSetWindowPinned}
          onToggleLibrary={(open) => {
            if (open) onToggleProfilePicker(false);
            onToggleLibrary(open);
          }}
          onToggleProfilePicker={(open) => {
            if (open) onToggleLibrary(false);
            onToggleProfilePicker(open);
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          mobileMenuOpen={mobileMenuOpen}
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
        analyticsSummary={analyticsSummary}
        analyticsStore={analyticsStore}
        onClose={() => setMobileMenuOpen(false)}
        onOpenTimer={openMobileTimer}
        onOpenLibrary={openMobileLibrary}
        onOpenProfiles={openMobileProfiles}
        onOpenShortcuts={() => setHotkeysModalOpen(true)}
        onSetFavoritesOnly={onSetFavoritesOnly}
        onVolume={onVolume}
        onTogglePlay={onTogglePlay}
        onSetWindowPinned={onSetWindowPinned}
      />

      <main className="focus-center">
        {!isBreakPhase ? (
          <KaTeXTooltip formula="\text{25 min pracy / 5 min przerwy}">
            <button
              type="button"
              className="quick-pomodoro-btn"
              aria-label="Ustaw Pomodoro 25 minut pracy, 5 minut przerwy"
              onClick={handleQuickPomodoro}
            >
              25 / 5
            </button>
          </KaTeXTooltip>
        ) : null}

        <div
          className="timer-display"
          aria-label={`Timer ${timerLabel}`}
          onClick={handleTimerTap}
        >
          {timerLabel}
        </div>

        {!isBreakPhase ? (
          <textarea
            ref={goalInputRef}
            rows={3}
            className="timer-goal-input"
            value={draftGoal}
            placeholder="Set main task…"
            aria-label="Main task"
            maxLength={300}
            onChange={(event) => handleGoalChange(event.target.value)}
            onBlur={handleGoalBlur}
            onKeyDown={handleGoalKeyDown}
          />
        ) : (
          <div className="timer-goal-break-banner">
            ☕ Korzystaj z przerwy!
          </div>
        )}

        <section
          className={
            windowPinned
              ? "focus-mini-goals focus-mini-goals--flat focus-mini-goals--pinned"
              : "focus-mini-goals focus-mini-goals--flat focus-mini-goals--desktop"
          }
          aria-label={isBreakPhase ? "Break subtasks" : "Subtasks"}
        >
          <MiniGoalChecklist
            items={
              isBreakPhase
                ? timerSettings.breakMiniGoals &&
                  timerSettings.breakMiniGoals.length > 0
                  ? timerSettings.breakMiniGoals
                  : DEFAULT_BREAK_MINI_GOALS
                : timerSettings.miniGoals
            }
            mainGoal={isBreakPhase ? "Czas na Przerwę" : timerSettings.goal}
            userAboutMe={timerSettings.userAboutMe}
            workDurationMinutes={timerSettings.workDurationMinutes}
            label={isBreakPhase ? "Przerwowe micro-cele" : "Subtasks"}
            isBreakPhase={isBreakPhase}
            onChange={
              isBreakPhase ? handleBreakMiniGoalsChange : handleMiniGoalsChange
            }
          />
        </section>
      </main>

      <footer className="focus-bottom">
        <TrackMetaDisplay
          currentTrack={currentTrack}
          favoriteTrackIds={favoriteTrackIds}
          favoriteBursting={favoriteBursting}
          categoryStatus={categoryStatus}
          currentCategory={currentCategory}
          onToggleLibrary={onToggleLibrary}
          onToggleFavorite={onToggleFavorite}
          onRequestCategory={(track) => void requestCategory(track)}
          onSetFavoriteBursting={handleSetFavoriteBursting}
        />

        <PlaybackControls
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          mode={mode}
          playbackRate={playbackRate}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrevious={onPrevious}
          onSeek={onSeek}
          onPlaybackRateChange={onPlaybackRateChange}
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
          volume={volume * duckingMultiplier}
          playbackRate={playbackRate}
          seekRequest={remoteSeekRequest}
          onPlaying={onRemotePlaying}
          onTime={onRemoteTime}
          onDuration={onRemoteDuration}
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

      <KeyboardShortcutsModal
        open={hotkeysModalOpen}
        onClose={() => setHotkeysModalOpen(false)}
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
