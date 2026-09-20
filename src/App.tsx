import { useCallback, useEffect, useState } from "react";
import { FocusPlayer } from "./components";
import { useAudioLibrary } from "./hooks/useAudioLibrary";
import { ensureWindowsAutostart } from "./lib/autostart";
import {
  restoreWindowPin,
  setWindowPinned as setNativeWindowPinned,
} from "./lib/window";
import "./styles.css";

function App() {
  const player = useAudioLibrary();
  const [windowPinned, setWindowPinnedState] = useState(false);

  useEffect(() => {
    void ensureWindowsAutostart().catch(() => {
      // Autostart is optional; a policy-restricted Windows profile must not
      // prevent the player from opening.
    });
  }, []);

  useEffect(() => {
    let active = true;
    void restoreWindowPin().then((pinned) => {
      if (active) setWindowPinnedState(pinned);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSetWindowPinned = useCallback(
    async (pinned: boolean) => {
      try {
        await setNativeWindowPinned(pinned);
        setWindowPinnedState(pinned);
      } catch (error) {
        player.setError(error instanceof Error ? error.message : String(error));
      }
    },
    [player.setError],
  );

  // PERF: stable identities so memoized children of FocusPlayer can actually
  // skip re-renders while progress/timer ticks stream through the app.
  const handleCloseHub = useCallback(
    () => player.setHubOpen(false),
    [player.setHubOpen],
  );
  const handleSelectProfile = useCallback(
    (profileId: string) => void player.switchProfile(profileId),
    [player.switchProfile],
  );
  const handleCreateProfile = useCallback(
    (name: string) => void player.createProfile(name),
    [player.createProfile],
  );
  const handleDeleteProfile = useCallback(
    (profileId: string) => void player.deleteProfile(profileId),
    [player.deleteProfile],
  );
  const handleUserAboutMeChange = useCallback(
    (userAboutMe: string) =>
      player.updateTimerSettings({
        ...player.timerSettings,
        userAboutMe,
      }),
    [player.timerSettings, player.updateTimerSettings],
  );
  const handleImport = useCallback(
    () => void player.importTracks(),
    [player.importTracks],
  );
  const handleAddLink = useCallback(
    (url: string) => void player.addRemoteLink(url),
    [player.addRemoteLink],
  );
  const handleDropFiles = useCallback(
    (files: File[]) => void player.importDroppedFiles(files),
    [player.importDroppedFiles],
  );
  const handleRemoteTime = useCallback(
    (time: number) => player.onRemoteTime(time),
    [player.onRemoteTime],
  );
  const handleRemoteDuration = useCallback(
    (duration: number) => player.onRemoteDuration(duration),
    [player.onRemoteDuration],
  );
  const handleRemotePlaying = useCallback(
    (playing: boolean) => player.onRemotePlaying(playing),
    [player.onRemotePlaying],
  );
  const handleRemoteEnded = useCallback(
    () => player.onRemoteEnded(),
    [player.onRemoteEnded],
  );
  const handleRemoteError = useCallback(
    (message: string) => player.onRemoteError(message),
    [player.onRemoteError],
  );
  const handleRemoteTrackChange = useCallback(
    (info: Parameters<typeof player.onRemoteTrackChange>[0]) =>
      player.onRemoteTrackChange(info),
    [player.onRemoteTrackChange],
  );
  const handleRefresh = useCallback(() => {
    void player.refresh().catch((error: unknown) => {
      player.setError(error instanceof Error ? error.message : String(error));
    });
  }, [player.refresh, player.setError]);
  const handleOpenFolder = useCallback(
    () => void player.openMusicFolder(),
    [player.openMusicFolder],
  );
  const handleSelectTrack = useCallback(
    (trackId: string, autoplay?: boolean) =>
      void player.selectTrack(trackId, autoplay),
    [player.selectTrack],
  );
  const handleRemoveTrack = useCallback(
    (track: Parameters<typeof player.removeTrack>[0]) =>
      void player.removeTrack(track),
    [player.removeTrack],
  );
  const handleSetFavoritesOnly = useCallback(
    (enabled: boolean) => player.setFavoritesOnly(enabled),
    [player.setFavoritesOnly],
  );
  const handleTogglePlay = useCallback(
    () => void player.togglePlay(),
    [player.togglePlay],
  );
  const handleNext = useCallback(
    () => void player.playNext(),
    [player.playNext],
  );
  const handlePrevious = useCallback(
    () => void player.playPrevious(),
    [player.playPrevious],
  );
  const handleSeek = useCallback(
    (seconds: number) => player.seek(seconds),
    [player.seek],
  );
  const handleVolume = useCallback(
    (value: number) => player.setVolume(value),
    [player.setVolume],
  );
  const handlePlaybackRateChange = useCallback(
    (rate: number) => player.setPlaybackRate(rate),
    [player.setPlaybackRate],
  );
  const handleToggleFavorite = useCallback(
    (trackId: string) => player.toggleFavorite(trackId),
    [player.toggleFavorite],
  );
  const handlePlayQueue = useCallback(
    (queue: Parameters<typeof player.playQueue>[0], trackId: string | null) =>
      player.playQueue(queue, trackId),
    [player.playQueue],
  );
  const handleOpenTimerSettings = useCallback(
    (_focus?: "goal" | "subtask") => player.setTimerSettingsOpen(true),
    [player.setTimerSettingsOpen],
  );
  const handleCloseTimerSettings = useCallback(
    () => player.setTimerSettingsOpen(false),
    [player.setTimerSettingsOpen],
  );
  const handleTimerSettingsChange = useCallback(
    (settings: Parameters<typeof player.updateTimerSettings>[0]) =>
      player.updateTimerSettings(settings),
    [player.updateTimerSettings],
  );
  const handleClearError = useCallback(
    () => player.setError(null),
    [player.setError],
  );
  const handleToggleVolumeNormalization = useCallback(
    () => player.toggleVolumeNormalization(),
    [player.toggleVolumeNormalization],
  );
  const handleReorderTracks = useCallback(
    (sourceIndex: number, destinationIndex: number) =>
      player.reorderTracks(sourceIndex, destinationIndex),
    [player.reorderTracks],
  );
  const handleMoveTrackToProfile = useCallback(
    (trackId: string, targetProfileId: string) =>
      void player.moveTrackToProfile(trackId, targetProfileId),
    [player.moveTrackToProfile],
  );

  if (!player.ready) {
    return (
      <div className="boot">
        <div className="boot-orb" aria-hidden="true" />
      </div>
    );
  }

  return (
    <FocusPlayer
      tracks={player.tracks}
      musicDir={player.musicDir}
      currentTrack={player.currentTrack}
      profiles={player.profiles}
      activeProfileId={player.activeProfileId}
      analyticsSummary={player.analyticsSummary}
      analyticsStore={player.analyticsStore}
      favoriteTrackIds={player.favoriteTrackIds}
      favoritesOnly={player.favoritesOnly}
      currentTrackId={player.currentTrackId}
      isPlaying={player.isPlaying}
      volume={player.volume}
      duckingMultiplier={player.duckingMultiplier}
      progress={player.progress}
      duration={player.duration}
      timerLabel={player.timerLabel}
      currentPhase={player.currentPhase}
      mode={player.mode}
      timerSettings={player.timerSettings}
      timerSettingsOpen={player.timerSettingsOpen}
      hubOpen={player.hubOpen}
      busy={player.busy}
      error={player.error}
      browserMode={player.browserMode}
      windowPinned={windowPinned}
      onOpenHub={player.openHub}
      onCloseHub={handleCloseHub}
      onSelectProfile={handleSelectProfile}
      onCreateProfile={handleCreateProfile}
      onDeleteProfile={handleDeleteProfile}
      onUserAboutMeChange={handleUserAboutMeChange}
      onImport={handleImport}
      onAddLink={handleAddLink}
      onDropFiles={handleDropFiles}
      remoteSeekRequest={player.remoteSeekRequest}
      onRemoteTime={handleRemoteTime}
      onRemoteDuration={handleRemoteDuration}
      onRemotePlaying={handleRemotePlaying}
      onRemoteEnded={handleRemoteEnded}
      onRemoteError={handleRemoteError}
      onRemoteTrackChange={handleRemoteTrackChange}
      onRefresh={handleRefresh}
      onOpenFolder={handleOpenFolder}
      onSelectTrack={handleSelectTrack}
      onRemoveTrack={handleRemoveTrack}
      onSetFavoritesOnly={handleSetFavoritesOnly}
      onTogglePlay={handleTogglePlay}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onSeek={handleSeek}
      onVolume={handleVolume}
      playbackRate={player.playbackRate}
      onPlaybackRateChange={handlePlaybackRateChange}
      volumeNormalization={player.volumeNormalization}
      onToggleVolumeNormalization={handleToggleVolumeNormalization}
      onToggleFavorite={handleToggleFavorite}
      onPlayQueue={handlePlayQueue}
      onOpenTimerSettings={handleOpenTimerSettings}
      onCloseTimerSettings={handleCloseTimerSettings}
      onTimerSettingsChange={handleTimerSettingsChange}
      onClearError={handleClearError}
      onSetWindowPinned={handleSetWindowPinned}
      onReorderTracks={handleReorderTracks}
      onMoveTrackToProfile={handleMoveTrackToProfile}
    />
  );
}

export default App;
