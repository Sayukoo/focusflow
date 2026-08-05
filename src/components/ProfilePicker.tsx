import { memo, useState, type FormEvent } from "react";
import type { MusicProfile } from "../lib/profiles";
import { Icon } from "./Icon";
import { KaTeXTooltip } from "./KaTeXTooltip";

interface ProfilePickerProps {
  open: boolean;
  profiles: MusicProfile[];
  activeProfileId: string;
  onClose: () => void;
  onSelect: (profileId: string) => void | Promise<void>;
  onCreate: (name: string) => void | Promise<void>;
  onDelete: (profileId: string) => void | Promise<void>;
}

export const ProfilePicker = memo(function ProfilePicker({
  open,
  profiles,
  activeProfileId,
  onClose,
  onSelect,
  onCreate,
  onDelete,
}: ProfilePickerProps) {
  const [name, setName] = useState("");
  if (!open) return null;

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    void onCreate(name.trim());
    setName("");
  };

  return (
    <div
      className="profile-popover"
      role="dialog"
      aria-label="Profiles"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="profile-popover-header">
        <div>
          <strong>Profiles</strong>
          <span>Private on this device</span>
        </div>
        <KaTeXTooltip formula="\text{Close profiles}">
          <button
            type="button"
            className="icon-btn ghost"
            aria-label="Close profiles"
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
    </div>
  );
}, (previous, next) => {
  if (previous.open !== next.open) return false;
  if (!previous.open) return true;
  return (
    previous.profiles === next.profiles &&
    previous.activeProfileId === next.activeProfileId &&
    previous.onClose === next.onClose &&
    previous.onSelect === next.onSelect &&
    previous.onCreate === next.onCreate &&
    previous.onDelete === next.onDelete
  );
});

function escapeTex(value: string): string {
  return value.replace(/([\\{}$&#^_~%])/g, "\\$1");
}
