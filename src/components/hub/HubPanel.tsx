import { memo, type ReactElement } from "react";
import type { FocusAnalyticsStore } from "../../lib/analytics";
import type { TrackCategory } from "../../lib/gemini";
import type { MusicProfile } from "../../lib/profiles";
import type { PlaybackQueue, Track } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";
import { MusicLibrary } from "../library/MusicLibrary";
import { WeeklyFocusChart } from "./WeeklyFocusChart";

interface HubPanelProps {
  open: boolean;
  onClose: () => void;
  // Music library
  tracks: Track[];
  activeProfileName: string;
  currentTrackCategory: TrackCategory | null;
  currentTrackId: string | null;
  favoriteTrackIds: string[];
  favoritesOnly: boolean;
  musicDir: string;
  busy: boolean;
  onImport: () => void;
  onAddLink: (url: string) => void;
  onDropFiles: (files: File[]) => void;
  onOpenFolder: () => void;
  onSelectTrack: (trackId: string) => void;
  onRemoveTrack: (track: Track) => void;
  onToggleFavorite: (trackId: string) => void;
  onPlayQueue: (queue: PlaybackQueue, trackId: string | null) => void;
  // Weekly focus statistics
  analyticsStore?: FocusAnalyticsStore;
  // Account & profiles
  profiles: MusicProfile[];
  activeProfileId: string;
  userAboutMe?: string;
  onSelectProfile: (profileId: string) => void | Promise<void>;
  onCreateProfile?: (name: string) => void | Promise<void>;
  onDeleteProfile?: (profileId: string) => void | Promise<void>;
  onUserAboutMeChange?: (userAboutMe: string) => void;
}

/**
 * Unified hub drawer: music library and account & profiles in one continuous,
 * scrollable panel with Focus / Energizing mode switcher in the header.
 */
export const HubPanel = memo(function HubPanel({
  open,
  onClose,
  tracks,
  activeProfileName,
  currentTrackCategory,
  currentTrackId,
  favoriteTrackIds,
  favoritesOnly,
  musicDir,
  busy,
  onImport,
  onAddLink,
  onDropFiles,
  onOpenFolder,
  onSelectTrack,
  onRemoveTrack,
  onToggleFavorite,
  onPlayQueue,
  analyticsStore,
  profiles,
  activeProfileId,
  userAboutMe,
  onSelectProfile,
  onUserAboutMeChange,
}: HubPanelProps): ReactElement | null {
  if (!open) return null;

  const escapedDir = musicDir.replace(/\\/g, "\\\\");

  const activeProfile = profiles.find(
    (profile) => profile.id === activeProfileId,
  );
  const isEnergizing =
    activeProfile?.theme === "energizing" || activeProfileId === "energizing";

  const handleSelectFocus = () => {
    const target =
      profiles.find((p) => p.theme === "deep" && p.kind === "builtin") ??
      profiles.find((p) => p.theme === "deep") ?? { id: "deep-work" };
    void onSelectProfile(target.id);
  };

  const handleSelectEnergizing = () => {
    const target =
      profiles.find((p) => p.theme === "energizing" && p.kind === "builtin") ??
      profiles.find((p) => p.theme === "energizing") ?? { id: "energizing" };
    void onSelectProfile(target.id);
  };

  return (
    <div
      className="library-overlay hub-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Focus hub"
    >
      <button
        className="library-backdrop"
        aria-label="Close hub"
        onClick={onClose}
      />
      <aside className="library-panel library-manager hub-panel">
        <header className="hub-header">
          <div className="hub-brand">
            <span className="hub-glyph" aria-hidden="true">
              <Icon name="music-library" size={22} />
            </span>
            <div className="hub-brand-copy">
              <strong className="hub-title">Centrum</strong>
              <span className="hub-subtitle">
                FocusFlow · {isEnergizing ? "Energetyczne" : "Chillowe"}
              </span>
            </div>
          </div>

          <div className="hub-actions">
            <div
              className="hub-mode-switch"
              role="radiogroup"
              aria-label="Kategoria muzyki"
            >
              <KaTeXTooltip formula="\text{Kategoria: Chillowe (Lo-Fi, Ambient, Spokojna)}">
                <button
                  type="button"
                  className={`hub-mode-btn hub-mode-btn--focus ${!isEnergizing ? "is-active" : ""}`}
                  role="radio"
                  aria-checked={!isEnergizing}
                  aria-label="Kategoria Chillowe"
                  onClick={handleSelectFocus}
                >
                  <Icon name="target" size={15} />
                  <span>Chillowe</span>
                </button>
              </KaTeXTooltip>
              <KaTeXTooltip formula="\text{Kategoria: Energetyczne (Phonk, Rave, Elektronika)}">
                <button
                  type="button"
                  className={`hub-mode-btn hub-mode-btn--energizing ${isEnergizing ? "is-active" : ""}`}
                  role="radio"
                  aria-checked={isEnergizing}
                  aria-label="Kategoria Energetyczne"
                  onClick={handleSelectEnergizing}
                >
                  <Icon name="flame" size={15} />
                  <span>Energetyczne</span>
                </button>
              </KaTeXTooltip>
            </div>
            <KaTeXTooltip
              formula={`\\text{Open in Explorer:}~\\texttt{${escapedDir}}`}
            >
              <button
                type="button"
                className="icon-btn hub-folder-btn"
                aria-label="Open folder in Explorer"
                disabled={busy}
                onClick={onOpenFolder}
              >
                <Icon name="folder-open" size={18} />
              </button>
            </KaTeXTooltip>
            <KaTeXTooltip formula="\text{Close}">
              <button
                type="button"
                className="icon-btn hub-close-btn"
                aria-label="Close hub"
                onClick={onClose}
              >
                <Icon name="close" size={18} />
              </button>
            </KaTeXTooltip>
          </div>
        </header>

        {/* One continuous scrollable body: the music library first, account
            & profiles right below — no tab switching, nothing gets squeezed. */}
        <div className="hub-body">
          <section className="hub-section" aria-label="Muzyka">
            <MusicLibrary
              tracks={tracks}
              activeProfileName={activeProfileName}
              currentTrackCategory={currentTrackCategory}
              currentTrackId={currentTrackId}
              favoriteTrackIds={favoriteTrackIds}
              favoritesOnly={favoritesOnly}
              busy={busy}
              userAboutMe={userAboutMe}
              onUserAboutMeChange={onUserAboutMeChange}
              onImport={onImport}
              onAddLink={onAddLink}
              onDropFiles={onDropFiles}
              onSelect={onSelectTrack}
              onRemove={onRemoveTrack}
              onToggleFavorite={onToggleFavorite}
              onPlayQueue={onPlayQueue}
            />
          </section>

          <div className="hub-section-heading" aria-hidden="true">
            Statystyki tygodnia
          </div>

          {analyticsStore ? <WeeklyFocusChart store={analyticsStore} /> : null}
        </div>
      </aside>
    </div>
  );
}, (previous, next) => {
  if (previous.open !== next.open) return false;
  if (!previous.open) return true;
  return (
    previous.tracks === next.tracks &&
    previous.activeProfileName === next.activeProfileName &&
    previous.currentTrackCategory === next.currentTrackCategory &&
    previous.currentTrackId === next.currentTrackId &&
    previous.favoriteTrackIds === next.favoriteTrackIds &&
    previous.favoritesOnly === next.favoritesOnly &&
    previous.musicDir === next.musicDir &&
    previous.busy === next.busy &&
    previous.profiles === next.profiles &&
    previous.activeProfileId === next.activeProfileId &&
    previous.userAboutMe === next.userAboutMe &&
    previous.onClose === next.onClose &&
    previous.onImport === next.onImport &&
    previous.onAddLink === next.onAddLink &&
    previous.onDropFiles === next.onDropFiles &&
    previous.onOpenFolder === next.onOpenFolder &&
    previous.onSelectTrack === next.onSelectTrack &&
    previous.onRemoveTrack === next.onRemoveTrack &&
    previous.onToggleFavorite === next.onToggleFavorite &&
    previous.onPlayQueue === next.onPlayQueue &&
    previous.analyticsStore === next.analyticsStore &&
    previous.onSelectProfile === next.onSelectProfile &&
    previous.onCreateProfile === next.onCreateProfile &&
    previous.onDeleteProfile === next.onDeleteProfile &&
    previous.onUserAboutMeChange === next.onUserAboutMeChange
  );
});
