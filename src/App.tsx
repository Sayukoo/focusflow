import { useEffect, useState } from "react";
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

  const handleSetWindowPinned = async (pinned: boolean) => {
    try {
      await setNativeWindowPinned(pinned);
      setWindowPinnedState(pinned);
    } catch (error) {
      player.setError(error instanceof Error ? error.message : String(error));
    }
  };

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
      profilePickerOpen={player.profilePickerOpen}
      favoriteTrackIds={player.favoriteTrackIds}
      favoritesOnly={player.favoritesOnly}
      currentTrackId={player.currentTrackId}
      isPlaying={player.isPlaying}
      volume={player.volume}
      progress={player.progress}
      duration={player.duration}
      timerLabel={player.timerLabel}
      currentPhase={player.currentPhase}
      mode={player.mode}
      timerSettings={player.timerSettings}
      timerSettingsOpen={player.timerSettingsOpen}
      libraryOpen={player.libraryOpen}
      busy={player.busy}
      error={player.error}
      browserMode={player.browserMode}
      windowPinned={windowPinned}
      onToggleLibrary={player.setLibraryOpen}
      onToggleProfilePicker={player.setProfilePickerOpen}
      onSelectProfile={(profileId) => void player.switchProfile(profileId)}
      onCreateProfile={(name) => void player.createProfile(name)}
      onDeleteProfile={(profileId) => void player.deleteProfile(profileId)}
      onUserAboutMeChange={(userAboutMe) =>
        player.updateTimerSettings({
          ...player.timerSettings,
          userAboutMe,
        })
      }
      onImport={() => void player.importTracks()}
      onAddLink={(url) => void player.addRemoteLink(url)}
      onDropFiles={(files) => void player.importDroppedFiles(files)}
      remoteSeekRequest={player.remoteSeekRequest}
      onRemoteTime={player.onRemoteTime}
      onRemoteDuration={player.onRemoteDuration}
      onRemotePlaying={player.onRemotePlaying}
      onRemoteEnded={player.onRemoteEnded}
      onRemoteError={player.onRemoteError}
      onRefresh={() =>
        void player.refresh().catch((error: unknown) => {
          player.setError(error instanceof Error ? error.message : String(error));
        })
      }
      onOpenFolder={() => void player.openMusicFolder()}
      onSelectTrack={(trackId) => void player.selectTrack(trackId)}
      onRemoveTrack={(track) => void player.removeTrack(track)}
      onSetFavoritesOnly={player.setFavoritesOnly}
      onTogglePlay={() => void player.togglePlay()}
      onNext={() => void player.playNext()}
      onPrevious={() => void player.playPrevious()}
      onSeek={player.seek}
      onVolume={player.setVolume}
      playbackRate={player.playbackRate}
      onPlaybackRateChange={player.setPlaybackRate}
      onToggleFavorite={player.toggleFavorite}
      onPlayQueue={player.playQueue}
      onOpenTimerSettings={() => player.setTimerSettingsOpen(true)}
      onCloseTimerSettings={() => player.setTimerSettingsOpen(false)}
      onTimerSettingsChange={player.updateTimerSettings}
      onClearError={() => player.setError(null)}
      onSetWindowPinned={handleSetWindowPinned}
    />
  );
}

export default App;
