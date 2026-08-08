import { memo, useState, type FormEvent } from "react";
import type { MusicProfile } from "../../lib/profiles";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

export interface FocusAnalyticsSummary {
  todaySummary: string;
  streakDays: number;
  todaySeconds: number;
  todaySessions: number;
}

interface ProfilePickerProps {
  open: boolean;
  profiles: MusicProfile[];
  activeProfileId: string;
  userAboutMe?: string;
  onClose: () => void;
  onSelect: (profileId: string) => void | Promise<void>;
  onCreate: (name: string) => void | Promise<void>;
  onDelete: (profileId: string) => void | Promise<void>;
  onUserAboutMeChange?: (userAboutMe: string) => void;
}

export const ProfilePicker = memo(function ProfilePicker({
  open,
  profiles,
  activeProfileId,
  userAboutMe,
  onClose,
  onSelect,
  onCreate,
  onDelete,
  onUserAboutMeChange,
}: ProfilePickerProps) {
  const [name, setName] = useState("");
  const [draftAboutMe, setDraftAboutMe] = useState(userAboutMe ?? "");
  const [justSaved, setJustSaved] = useState(false);
  if (!open) return null;

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    void onCreate(name.trim());
    setName("");
  };

  const handleSaveAboutMe = () => {
    onUserAboutMeChange?.(draftAboutMe);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const isChanged = draftAboutMe !== (userAboutMe ?? "");

  return (
    <div
      className="profile-popover"
      role="dialog"
      aria-label="Account and Profile Settings"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="profile-popover-header">
        <div>
          <strong>Account & Profiles</strong>
          <span>Private on this device</span>
        </div>
        <KaTeXTooltip formula="\text{Close settings}">
          <button
            type="button"
            className="icon-btn ghost"
            aria-label="Close settings"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </KaTeXTooltip>
      </div>

      <div className="profile-options" role="listbox" aria-label="Profiles">
        {profiles.map((profile) => {
          const active = profile.id === activeProfileId;
          return (
            <div
              className={active ? "profile-option is-active" : "profile-option"}
              key={profile.id}
            >
              <button
                type="button"
                className="profile-option-select"
                role="option"
                aria-selected={active}
                onClick={() => void onSelect(profile.id)}
              >
                <span
                  className={`profile-option-dot profile-option-dot--${profile.theme}`}
                  aria-hidden="true"
                />
                <span className="profile-option-copy">
                  <strong>{profile.name}</strong>
                  <small>{profile.kind === "builtin" ? "Built-in" : "Custom"}</small>
                </span>
                {active ? <Icon name="check" size={16} /> : null}
              </button>
              {profile.kind === "custom" ? (
                <KaTeXTooltip formula={`\\text{Delete ${escapeTex(profile.name)}}`}>
                  <button
                    type="button"
                    className="profile-option-delete"
                    aria-label={`Delete ${profile.name}`}
                    onClick={() => void onDelete(profile.id)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </KaTeXTooltip>
              ) : null}
            </div>
          );
        })}
      </div>

      <form className="profile-create-form" onSubmit={handleCreate}>
        <input
          type="text"
          value={name}
          maxLength={40}
          placeholder="New profile"
          aria-label="New profile name"
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" aria-label="Create profile" disabled={!name.trim()}>
          <Icon name="plus" size={16} />
        </button>
      </form>

      <div className="profile-about-me-section">
        <div className="profile-about-me-header">
          <span>Informacje o mnie</span>
        </div>
        <div className="profile-about-me-wrap">
          <textarea
            rows={5}
            maxLength={4000}
            placeholder="Opisz swój kontekst, rolę, preferencje lub nuanse (np. 'Jestem psychologiem, miewam lęk przed oceną, lubię małe kroki...')"
            value={draftAboutMe}
            aria-label="Informacje o mnie"
            onChange={(event) => setDraftAboutMe(event.target.value)}
          />
          <div className="profile-about-me-actions">
            <button
              type="button"
              className="profile-about-me-save-btn"
              disabled={!isChanged && !justSaved}
              onClick={handleSaveAboutMe}
            >
              {justSaved ? (
                <>
                  <Icon name="check" size={14} /> Zapisano
                </>
              ) : (
                "Zapisz"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}, (previous, next) => {
  if (previous.open !== next.open) return false;
  if (!previous.open) return true;
  return (
    previous.profiles === next.profiles &&
    previous.activeProfileId === next.activeProfileId &&
    previous.userAboutMe === next.userAboutMe &&
    previous.onClose === next.onClose &&
    previous.onSelect === next.onSelect &&
    previous.onCreate === next.onCreate &&
    previous.onDelete === next.onDelete &&
    previous.onUserAboutMeChange === next.onUserAboutMeChange
  );
});

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}
