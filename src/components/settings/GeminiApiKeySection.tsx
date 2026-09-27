import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isTauriRuntime } from "../../lib/audio";
import {
  GEMINI_KEY_CHANGED_EVENT,
  getStoredGeminiApiKey,
  hasGeminiConfiguration,
  saveStoredGeminiApiKey,
} from "../../lib/gemini";
import { Icon } from "../ui/Icon";

interface GeminiApiKeySectionProps {
  compact?: boolean;
  className?: string;
  onKeyChange?: (newKey: string) => void;
}

/**
 * Ultra-minimalny klucz Gemini API — domyślnie zwinięty do jednej linijki
 * piktogramów (✨ + kropka statusu). Work goal i mini-goals są najważniejsze,
 * więc ta sekcja ma znikać w tle: bez opisów, bez stopki, same ikonki.
 */
export const GeminiApiKeySection = memo(function GeminiApiKeySection({
  compact = false,
  className = "",
  onKeyChange,
}: GeminiApiKeySectionProps) {
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getStoredGeminiApiKey());
  const [isConfigured, setIsConfigured] = useState(() => hasGeminiConfiguration());
  const [showKey, setShowKey] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // Brak klucza → od razu rozwiń (trzeba wkleić). Klucz zapisany → minimalistycznie zwinięte.
  const [expanded, setExpanded] = useState(() => !hasGeminiConfiguration());
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyChanged = () => {
      const stored = getStoredGeminiApiKey();
      setApiKeyDraft(stored);
      const configured = hasGeminiConfiguration();
      setIsConfigured(configured);
      // Zewnętrzna zmiana (np. inny panel) — dopasuj rozwinięcie tylko gdy klucza brakuje.
      if (!configured) setExpanded(true);
    };

    window.addEventListener(GEMINI_KEY_CHANGED_EVENT, handleKeyChanged);
    window.addEventListener("storage", handleKeyChanged);
    return () => {
      window.removeEventListener(GEMINI_KEY_CHANGED_EVENT, handleKeyChanged);
      window.removeEventListener("storage", handleKeyChanged);
    };
  }, []);

  const storedKey = getStoredGeminiApiKey();
  const isChanged = apiKeyDraft.trim() !== storedKey;

  const handleSave = () => {
    const trimmed = apiKeyDraft.trim();
    saveStoredGeminiApiKey(trimmed);
    setIsConfigured(Boolean(trimmed));
    onKeyChange?.(trimmed);
    setJustSaved(true);
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setJustSaved(false), 2000);
    // Po zapisie wróć do formy ikonki.
    if (trimmed) setExpanded(false);
  };

  const handleDelete = () => {
    saveStoredGeminiApiKey("");
    setApiKeyDraft("");
    setIsConfigured(hasGeminiConfiguration());
    onKeyChange?.("");
    setExpanded(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape" && isConfigured) {
      setExpanded(false);
    }
  };

  const handleOpenAiStudio = () => {
    const url = "https://aistudio.google.com/app/apikey";
    if (isTauriRuntime()) {
      import("@tauri-apps/plugin-opener")
        .then(({ openUrl }) => openUrl(url))
        .catch(() => window.open(url, "_blank", "noopener,noreferrer"));
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={
        `gemini-api-key-section is-minimal ${isConfigured ? "is-active" : "is-missing"} ${expanded ? "is-expanded" : "is-collapsed"} ${compact ? "is-compact" : ""} ${className}`.trim()
      }
      title="Klucz przechowywany tylko lokalnie, na tym urządzeniu"
    >
      <div className="gemini-mini-bar">
        <button
          type="button"
          className="gemini-mini-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? "Zwiń klucz Gemini API" : "Rozwiń klucz Gemini API"}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span className="gemini-mini-icon" aria-hidden="true">
            <Icon name="sparkles" size={13} />
            <span className="gemini-mini-dot" />
          </span>
          <span className="gemini-mini-status">
            {isConfigured ? "Aktywny" : "Brak klucza"}
          </span>
          <Icon
            name="chevron-down"
            size={12}
            className={expanded ? "gemini-mini-chevron is-open" : "gemini-mini-chevron"}
          />
        </button>

        <span className="gemini-mini-spacer" aria-hidden="true" />

        {!expanded && !isConfigured ? (
          <button
            type="button"
            className="gemini-mini-icon-btn"
            aria-label="Pobierz bezpłatny klucz w Google AI Studio (otwiera stronę zewnętrzną)"
            title="Pobierz bezpłatny klucz w AI Studio"
            onClick={handleOpenAiStudio}
          >
            <Icon name="link" size={12} />
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="gemini-mini-editor">
          <div className="gemini-mini-input-wrap">
            <input
              type={showKey ? "text" : "password"}
              className="gemini-api-key-input"
              value={apiKeyDraft}
              placeholder="Wklej klucz API (np. AIzaSy...)"
              aria-label="Klucz API Gemini"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="gemini-toggle-visibility-btn"
              aria-label={showKey ? "Ukryj klucz API" : "Pokaż klucz API"}
              title={showKey ? "Ukryj" : "Pokaż"}
              onClick={() => setShowKey((prev) => !prev)}
            >
              <Icon name={showKey ? "eye-off" : "eye"} size={13} />
            </button>
          </div>

          <button
            type="button"
            className={`gemini-mini-icon-btn is-save ${justSaved ? "is-saved" : ""}`}
            disabled={!isChanged && !justSaved}
            onClick={handleSave}
            aria-label="Zapisz klucz API"
            title="Zapisz"
          >
            <Icon name="check" size={13} />
          </button>

          {storedKey ? (
            <button
              type="button"
              className="gemini-mini-icon-btn is-delete"
              aria-label="Usuń zapisany klucz API"
              title="Usuń klucz"
              onClick={handleDelete}
            >
              <Icon name="trash" size={13} />
            </button>
          ) : null}

          <button
            type="button"
            className="gemini-mini-icon-btn"
            onClick={handleOpenAiStudio}
            aria-label="Pobierz bezpłatny klucz w Google AI Studio (otwiera stronę zewnętrzną)"
            title="AI Studio — bezpłatny klucz"
          >
            <Icon name="link" size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
});
