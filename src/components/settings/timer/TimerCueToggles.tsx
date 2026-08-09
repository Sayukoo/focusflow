import type { TimerSettings } from "../../../types";
import { KaTeXTooltip } from "../../ui/KaTeXTooltip";

interface TimerCueTogglesProps {
  settings: TimerSettings;
  onChange: (next: TimerSettings) => void;
}

export function TimerCueToggles({ settings, onChange }: TimerCueTogglesProps) {
  return (
    <div
      className="timer-settings-toggle-strip"
      role="group"
      aria-label="Timer cue settings"
    >
      <KaTeXTooltip formula="\text{Pause when music pauses}">
        <label className="timer-toggle-row">
          <span>Pause</span>
          <input
            type="checkbox"
            checked={settings.pauseWhenMusicPaused}
            aria-label="Pause timer when music is paused"
            onChange={(event) =>
              onChange({
                ...settings,
                pauseWhenMusicPaused: event.target.checked,
              })
            }
          />
          <span className="switch-visual" aria-hidden="true">
            <span />
          </span>
        </label>
      </KaTeXTooltip>

      <KaTeXTooltip formula="\text{Play a soft sound on phase changes}">
        <label className="timer-toggle-row">
          <span>Sound</span>
          <input
            type="checkbox"
            checked={settings.phaseSoundEnabled}
            aria-label="Play a soft sound on work and break transitions"
            onChange={(event) =>
              onChange({
                ...settings,
                phaseSoundEnabled: event.target.checked,
              })
            }
          />
          <span className="switch-visual" aria-hidden="true">
            <span />
          </span>
        </label>
      </KaTeXTooltip>

      <KaTeXTooltip formula="\text{Play the calm female voice pack}">
        <label className="timer-toggle-row">
          <span>Voice</span>
          <input
            type="checkbox"
            checked={settings.phaseVoiceEnabled}
            aria-label="Speak Polish work and break announcements"
            onChange={(event) =>
              onChange({
                ...settings,
                phaseVoiceEnabled: event.target.checked,
              })
            }
          />
          <span className="switch-visual" aria-hidden="true">
            <span />
          </span>
        </label>
      </KaTeXTooltip>
    </div>
  );
}
