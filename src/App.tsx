import { FocusPlayer } from "./components/FocusPlayer";
import { useAudioLibrary } from "./hooks/useAudioLibrary";
import "./styles.css";

function App() {
  const player = useAudioLibrary();

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
      profilePickerOpen={player.profilePickerOpen}
      favoriteTrackIds={player.favoriteTrackIds}
      favoritesOnly={player.favoritesOnly}
      currentTrackId={player.currentTrackId}
      isPlaying={player.isPlaying}
      volume={player.volume}
      progress={player.progress}
      duration={player.duration}
      timerLabel={player.timerLabel}
      mode={player.mode}
      timerSettings={player.timerSettings}
      timerSettingsOpen={player.timerSettingsOpen}
      libraryOpen={player.libraryOpen}
      busy={player.busy}
      error={player.error}
      onToggleLibrary={player.setLibraryOpen}
      onToggleProfilePicker={player.setProfilePickerOpen}
      onSelectProfile={(profileId) => void player.switchProfile(profileId)}
      onCreateProfile={(name) => void player.createProfile(name)}
      onDeleteProfile={(profileId) => void player.deleteProfile(profileId)}
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
      onSelect={(trackId, autoplay) => void player.selectTrack(trackId, autoplay)}
      onRemove={(track) => void player.removeTrack(track)}
      onSetFavoritesOnly={player.setFavoritesOnly}
      onTogglePlay={() => void player.togglePlay()}
      onNext={() => void player.playNext()}
      onPrevious={() => void player.playPrevious()}
      onSeek={player.seek}
      onVolume={player.setVolume}
      onToggleFavorite={player.toggleFavorite}
      onOpenTimerSettings={() => player.setTimerSettingsOpen(true)}
      onCloseTimerSettings={() => player.setTimerSettingsOpen(false)}
      onTimerSettingsChange={player.updateTimerSettings}
      onClearError={() => player.setError(null)}
    />
  );
}

export default App;
