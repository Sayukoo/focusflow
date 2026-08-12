import { useEffect, useState } from "react";
import type { TimerSettings } from "../../../types";
import { listRunningApps, type RunningApp } from "../../../lib/appLock";
import { KaTeXTooltip } from "../../ui/KaTeXTooltip";
import { Icon } from "../../ui/Icon";

interface AppLockSectionProps {
  settings: TimerSettings;
  onChange: (next: TimerSettings) => void;
}

export function AppLockSection({ settings, onChange }: AppLockSectionProps) {
  const [apps, setApps] = useState<RunningApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setLoadError(false);
    const list = await listRunningApps();
    setApps(list);
    setLoading(false);
    if (list.length === 0) setLoadError(true);
  };

  useEffect(() => {
    if (settings.appLockEnabled && apps.length === 0 && !loading) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.appLockEnabled]);

  const toggleEnabled = (checked: boolean) => {
    onChange({ ...settings, appLockEnabled: checked });
  };

  const toggleApp = (processName: string, checked: boolean) => {
    const name = processName.toLowerCase();
    const next = checked
      ? Array.from(new Set([...settings.allowedApps, name]))
      : settings.allowedApps.filter((entry) => entry !== name);
    onChange({ ...settings, allowedApps: next });
  };

  return (
    <div className="app-lock-section">
      <KaTeXTooltip formula="\text{Minimize other apps while focusing}">
        <label className="timer-toggle-row app-lock-toggle-row">
          <span>🔒 Block other apps</span>
          <input
            type="checkbox"
            checked={settings.appLockEnabled}
            aria-label="Block apps outside the allowed list during the session"
            onChange={(event) => toggleEnabled(event.target.checked)}
          />
          <span className="switch-visual" aria-hidden="true">
            <span />
          </span>
        </label>
      </KaTeXTooltip>

      {settings.appLockEnabled ? (
        <div className="app-lock-picker">
          <div className="app-lock-picker-header">
            <span>Allowed apps</span>
            <button
              type="button"
              className="app-lock-refresh"
              aria-label="Refresh running apps"
              disabled={loading}
              onClick={() => void refresh()}
            >
              <Icon name="refresh" size={13} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {loadError && !loading ? (
            <p className="app-lock-empty" role="status">
              No apps detected, or app lock isn't supported on this platform.
            </p>
          ) : null}

          {apps.length > 0 ? (
            <ul className="app-lock-list">
              {apps.map((app) => (
                <li key={app.processName}>
                  <label className="app-lock-item">
                    <input
                      type="checkbox"
                      checked={settings.allowedApps.includes(
                        app.processName.toLowerCase(),
                      )}
                      onChange={(event) =>
                        toggleApp(app.processName, event.target.checked)
                      }
                    />
                    <span className="app-lock-item-title">
                      {app.windowTitle}
                    </span>
                    <span className="app-lock-item-process">
                      {app.processName}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
