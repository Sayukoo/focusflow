import { memo, useEffect, useState, type KeyboardEvent } from "react";
import { isTauriRuntime } from "../../lib/audio";
import {
  GEMINI_KEY_CHANGED_EVENT,
  getStoredGeminiApiKey,
  hasGeminiConfiguration,
  saveStoredGeminiApiKey,
} from "../../lib/gemini";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface GeminiApiKeySectionProps {
  compact?: boolean;
  className?: string;
  onKeyChange?: (newKey: string) => void;
}

export const GeminiApiKeySection = memo(function GeminiApiKeySection({
  compact = false,
  className = "",
  onKeyChange,
}: GeminiApiKeySectionProps) {
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getStoredGeminiApiKey());
  const [isConfigured, setIsConfigured] = useState(() => hasGeminiConfiguration());
  const [showKey, setShowKey] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justDeleted, setJustDeleted] = useState(false);

  useEffect(() => {
    const handleKeyChanged = () => {
      const stored = getStoredGeminiApiKey();
      setApiKeyDraft(stored);
      setIsConfigured(hasGeminiConfiguration());
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
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDelete = () => {
    saveStoredGeminiApiKey("");
    setApiKeyDraft("");
    setIsConfigured(hasGeminiConfiguration());
    onKeyChange?.("");
    setJustDeleted(true);
    setTimeout(() => setJustDeleted(false), 2000);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    }
  };

  const handleOpenAiStudio = () => {
    const url = "https://aistudio.google.com/app/apikey";
    if (isTauriRuntime()) {
      import("@tauri-apps/plugin-opener")
        .then(({ openUrl }) => openUrl(url))
        .catch(() => window.open(url, "_blank"));
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div
      className={`gemini-api-key-section ${compact ? "is-compact" : ""} ${className}`.trim()}
    >
      <div className="gemini-api-key-header">
        <div className="gemini-api-key-title-wrap">
          <span className="gemini-api-key-title">
            <Icon name="sparkles" size={14} /> Klucz Gemini API
          </span>
          <span
            className={`gemini-status-badge ${isConfigured ? "is-active" : "is-missing"}`}
          >
            <span className="gemini-status-dot" aria-hidden="true" />
            {isConfigured ? "Aktywny" : "Brak klucza"}
          </span>
        </div>
        <button
          type="button"
          className="gemini-ai-studio-link"
          onClick={handleOpenAiStudio}
          aria-label="Pobierz bezpłatny klucz w Google AI Studio (otwiera stronę zewnętrzną)"
        >
          Pobierz klucz w AI Studio
          <Icon name="link" size={11} />
        </button>
      </div>

      <p className="gemini-api-key-desc">
        Wymagany do inteligentnego podziału celów (mini-goals) oraz kategoryzacji muzyki.
      </p>

      <div className="gemini-api-key-input-row">
        <div className="gemini-api-key-input-wrap">
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
          <KaTeXTooltip formula={showKey ? "\\text{Ukryj klucz}" : "\\text{Pokaż klucz}"}>
            <button
              type="button"
              className="gemini-toggle-visibility-btn"
              aria-label={showKey ? "Ukryj klucz API" : "Pokaż klucz API"}
              onClick={() => setShowKey((prev) => !prev)}
            >
              <Icon name={showKey ? "eye-off" : "eye"} size={14} />
            </button>
          </KaTeXTooltip>
        </div>

        <div className="gemini-api-key-actions">
          {storedKey ? (
            <KaTeXTooltip formula="\text{Usuń zapisany klucz}">
              <button
                type="button"
                className="gemini-api-key-delete-btn"
                aria-label="Usuń zapisany klucz API"
                onClick={handleDelete}
              >
                {justDeleted ? "Usunięto" : <Icon name="trash" size={14} />}
              </button>
            </KaTeXTooltip>
          ) : null}

          <button
            type="button"
            className={`gemini-api-key-save-btn ${justSaved ? "is-saved" : ""}`}
            disabled={!isChanged && !justSaved}
            onClick={handleSave}
            aria-label="Zapisz klucz API"
          >
            {justSaved ? (
              <>
                <Icon name="check" size={13} /> Zapisano
              </>
            ) : (
              "Zapisz"
            )}
          </button>
        </div>
      </div>

      <div className="gemini-api-key-footer">
        <span className="gemini-api-key-privacy">
          Prywatne na tym urządzeniu · zapisywane wyłącznie w pamięci lokalnej
        </span>
      </div>
    </div>
  );
});
