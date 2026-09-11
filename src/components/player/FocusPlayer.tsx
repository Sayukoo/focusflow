import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIdleDetection } from "../../hooks/useIdleDetection";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import type { FocusAnalyticsStore } from "../../lib/analytics";
import { isRemoteTrack, isTauriRuntime } from "../../lib/audio";
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
import type { FocusAnalyticsSummary } from "../settings/ProfilePicker";
import { RemotePlayer } from "../audio/RemotePlayer";
import { HubPanel } from "../hub/HubPanel";
import { TimerSettings as TimerSettingsModal } from "../settings/TimerSettings";
import { PlaybackControls } from "./PlaybackControls";
import { FocusStatsBadge } from "./FocusStatsBadge";
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
  hubOpen: boolean;
  busy: boolean;
  error: string | null;
  browserMode: boolean;
  windowPinned: boolean;
  onOpenHub: () => void;
  onCloseHub: () => void;
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
  onSelectTrack: (trackId: string, autoplay?: boolean) => void;
  onRemoveTrack: (track: Track) => void;
  onTogglePlay: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
  onPrevious: () => void | Promise<void>;
  onVolume: (value: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
  /** Loudness normalization master switch (persisted in the snapshot). */
  volumeNormalization?: boolean;
  onToggleVolumeNormalization?: () => void;
  onSeek: (seconds: number) => void;
  onRemotePlaying: (playing: boolean) => void;
  onRemoteTime: (time: number) => void;
  onRemoteDuration: (duration: number) => void;
  onRemoteEnded: () => void;
  onRemoteError: (message: string) => void;
  remoteSeekRequest: { value: number; token: number } | null;
  onOpenTimerSettings: (focus?: "goal" | "subtask") => void;
  onCloseTimerSettings: () => void;
  onTimerSettingsChange?: (settings: TimerSettings) => void;
  onChangeTimerSettings?: (settings: TimerSettings) => void;
  onClearError?: () => void;
  onPlayQueue: (queue: PlaybackQueue, trackId: string | null) => void;
  onSetWindowPinned: (pinned: boolean) => void | Promise<void>;
}

const CONFETTI_TAP_COUNT = 15;

const UI_IDLE_DELAY_MS = 10_000;

export function FocusPlayer({
  tracks,
  currentTrack,
  profiles,
  activeProfileId,
  analyticsSummary,
  analyticsStore,
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
  hubOpen,
  error,
  browserMode,
  windowPinned,
  onOpenHub,
  onCloseHub,
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
  volumeNormalization,
  onToggleVolumeNormalization,
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
  const uiIdle = useIdleDetection(UI_IDLE_DELAY_MS);

  useKeyboardShortcuts({
    onTogglePlay: () => void onTogglePlay(),
    onNext: () => void onNext(),
    onPrevious: () => void onPrevious(),
    onToggleLibrary: () => (hubOpen ? onCloseHub() : onOpenHub()),
    onToggleTimer: () =>
      timerSettingsOpen ? onCloseTimerSettings() : openFullTimerSettings(),
    onToggleProfile: () => (hubOpen ? onCloseHub() : onOpenHub()),
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
      if (timerSettingsOpen) {
        onCloseTimerSettings();
        return;
      }
      if (hubOpen) {
        onCloseHub();
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

  const [timerSettingsCompact, setTimerSettingsCompact] = useState(false);
  const [timerSettingsFocus, setTimerSettingsFocus] = useState<
    "goal" | "subtask"
  >("goal");

  const handleQuickPomodoro = useCallback(() => {
    const updateFn = onTimerSettingsChange ?? onChangeTimerSettings;
    updateFn?.({
      ...timerSettings,
      kind: "intervals",
      durationMinutes: 25,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
    });
    setTimerSettingsCompact(true);
    setTimerSettingsFocus("goal");
    onOpenTimerSettings("goal");
  }, [
    onChangeTimerSettings,
    onOpenTimerSettings,
    onTimerSettingsChange,
    timerSettings,
  ]);

  const openFullTimerSettings = useCallback(
    (focus: "goal" | "subtask" = "goal") => {
      setTimerSettingsCompact(false);
      setTimerSettingsFocus(focus);
      onOpenTimerSettings(focus);
    },
    [onOpenTimerSettings],
  );

  const handleTrayQuickPomodoro = useCallback(() => {
    const updateFn = onTimerSettingsChange ?? onChangeTimerSettings;
    updateFn?.({
      ...timerSettings,
      kind: "intervals",
      durationMinutes: 25,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
    });

    const focusTrack =
      tracks.find(
        (track) => track.source === "youtube" && track.category === "LOFI",
      ) ?? tracks[0];
    if (focusTrack) {
      onSelectTrack(focusTrack.id, true);
    }

    void onSetWindowPinned(true);
    openFullTimerSettings("goal");
  }, [
    onChangeTimerSettings,
    onSelectTrack,
    onSetWindowPinned,
    onTimerSettingsChange,
    openFullTimerSettings,
    timerSettings,
    tracks,
  ]);

  const handleTrayQuickPomodoroRef = useRef(handleTrayQuickPomodoro);
  useEffect(() => {
    handleTrayQuickPomodoroRef.current = handleTrayQuickPomodoro;
  }, [handleTrayQuickPomodoro]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const stop = await listen("tray-quick-pomodoro", () => {
        if (!cancelled) {
          handleTrayQuickPomodoroRef.current();
        }
      });
      if (cancelled) {
        stop();
      } else {
        unlisten = stop;
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

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

  const handleMiniGoalsChange = useCallback(
    (next: MiniGoal[]) => {
      const updateFn = onTimerSettingsChange ?? onChangeTimerSettings;
      updateFn?.({
        ...timerSettings,
        miniGoals: next,
      });
    },
    [onChangeTimerSettings, onTimerSettingsChange, timerSettings],
  );

  // PERF: stable identities so the memoized HubPanel does not re-render on
  // every playback progress tick.
  const handleHubSelectTrack = useCallback(
    (trackId: string) => {
      void onSelectTrack(trackId, false);
    },
    [onSelectTrack],
  );
  const handleHeaderOpenHub = useCallback(() => {
    setMobileMenuOpen(false);
    onOpenHub();
  }, [onOpenHub]);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [activeProfileId, profiles],
  );
  const profileLabel = activeProfile?.name ?? "Default profile";

  const isRemote = isRemoteTrack(currentTrack);

  const durationSummary = useMemo(() => {
    if (timerSettings.kind === "infinite") return "Infinite focus";
    if (timerSettings.kind === "intervals") {
      const phaseLabel = isBreakPhase ? "Break" : "Work";
      return `${phaseLabel} · ${timerSettings.workDurationMinutes}m / ${timerSettings.breakDurationMinutes}m`;
    }
    return `${timerSettings.durationMinutes ?? 60}m session`;
  }, [
    isBreakPhase,
    timerSettings.breakDurationMinutes,
    timerSettings.durationMinutes,
    timerSettings.kind,
    timerSettings.workDurationMinutes,
  ]);

  const windowPinAvailable = true;

  const handleSetFavoriteBursting = useCallback((bursting: boolean) => {
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
  }, []);

  // PERF: stable identities so the memoized header/meta/menu children skip
  // re-renders on every one-second timer tick.
  const openMobileMenu = useCallback(() => setMobileMenuOpen(true), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const openMobileTimer = useCallback(() => {
    setMobileMenuOpen(false);
    openFullTimerSettings();
  }, [openFullTimerSettings]);
  const openMobileLibrary = useCallback(() => {
    setMobileMenuOpen(false);
    onOpenHub();
  }, [onOpenHub]);
  const openMobileProfiles = openMobileLibrary;
  const handleRequestCategory = useCallback(
    (track: Track) => {
      void requestCategory(track);
    },
    [requestCategory],
  );

  const quickPomodoroControl = useMemo(
    () =>
      !isBreakPhase ? (
        <KaTeXTooltip
          wrapperClassName="quick-pomodoro-control"
          formula="\text{25 min pracy / 5 min przerwy}"
        >
          <button
            type="button"
            className="quick-pomodoro-btn"
            aria-label="Ustaw Pomodoro 25 minut pracy, 5 minut przerwy"
            onClick={handleQuickPomodoro}
          >
            25 / 5
          </button>
        </KaTeXTooltip>
      ) : undefined,
    [handleQuickPomodoro, isBreakPhase],
  );

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

  const shellClasses = [
    "focus-shell",
    `mode-${mode}`,
    browserMode ? "is-browser" : "",
    windowPinned ? "is-window-pinned" : "",
    favoritesOnly ? "is-favorites-only" : "",
    uiIdle ? "is-ui-idle" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClasses}>
      <ThumbnailBackground
        thumbnail={currentTrack?.thumbnailDataUrl ?? currentTrack?.thumbnail}
        isPlaying={isPlaying}
      />
      <div className="focus-atmosphere" aria-hidden="true" />
      <div className="focus-vignette" aria-hidden="true" />
      {confettiBursting ? <ConfettiOverlay burstId={confettiBurstId} /> : null}

      <header className="focus-top">
        <div className="focus-top-left">
          <FocusStatsBadge
            streakDays={analyticsSummary?.streakDays ?? 0}
            todaySeconds={analyticsSummary?.todaySeconds ?? 0}
          />
        </div>

        <HeaderControls
          windowPinned={windowPinned}
          windowPinAvailable={windowPinAvailable}
          volume={volume}
          onVolume={onVolume}
          onSetWindowPinned={onSetWindowPinned}
          onOpenHub={handleHeaderOpenHub}
          onOpenTimerSettings={openFullTimerSettings}
          onOpenMobileMenu={openMobileMenu}
          mobileMenuOpen={mobileMenuOpen}
          leading={quickPomodoroControl}
        />
      </header>

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
        onClose={closeMobileMenu}
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
        <div
          className="timer-display"
          aria-label={`Timer ${timerLabel}`}
          onClick={handleTimerTap}
        >
          {timerLabel}
        </div>

        {!isBreakPhase ? (
          <button
            type="button"
            className={`timer-goal-text-btn ${!timerSettings.goal ? "is-placeholder" : ""}`}
            onClick={() => openFullTimerSettings("goal")}
            aria-label={
              timerSettings.goal
                ? `Main task: ${timerSettings.goal}. Click to edit`
                : "Set main task"
            }
          >
            {timerSettings.goal || "Set main task…"}
          </button>
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
            onAddClick={() => openFullTimerSettings("subtask")}
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
          onOpenHub={onOpenHub}
          onToggleFavorite={onToggleFavorite}
          onRequestCategory={handleRequestCategory}
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
          {onToggleVolumeNormalization ? (
            <button
              type="button"
              className={
                volumeNormalization ? "norm-toggle is-active" : "norm-toggle"
              }
              aria-pressed={Boolean(volumeNormalization)}
              aria-label="Normalizacja głośności"
              title="Normalizacja głośności"
              onClick={onToggleVolumeNormalization}
            >
              <Icon name="gauge" size={17} />
            </button>
          ) : null}
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

      <HubPanel
        open={hubOpen}
        onClose={onCloseHub}
        tracks={tracks}
        activeProfileName={profileLabel}
        currentTrackCategory={currentCategory}
        currentTrackId={currentTrackId}
        favoriteTrackIds={favoriteTrackIds}
        favoritesOnly={favoritesOnly}
        musicDir={musicDir}
        busy={busy}
        onImport={onImport}
        onAddLink={onAddLink}
        onDropFiles={onDropFiles}
        onOpenFolder={onOpenFolder}
        onSelectTrack={handleHubSelectTrack}
        onRemoveTrack={onRemoveTrack}
        onToggleFavorite={onToggleFavorite}
        onPlayQueue={onPlayQueue}
        profiles={profiles}
        activeProfileId={activeProfileId}
        analyticsStore={analyticsStore}
        userAboutMe={timerSettings.userAboutMe}
        onSelectProfile={onSelectProfile}
        onCreateProfile={onCreateProfile}
        onDeleteProfile={onDeleteProfile}
        onUserAboutMeChange={onUserAboutMeChange}
      />

      <TimerSettingsModal
        open={timerSettingsOpen}
        settings={timerSettings}
        compact={timerSettingsCompact}
        initialFocus={timerSettingsFocus}
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
