import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon } from "./Icon";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Odtwarzanie i Audio",
    items: [
      { keys: ["Spacja"], description: "Start / Pauza sesji i audio" },
      { keys: ["→", "N"], description: "Następny utwór" },
      { keys: ["←", "P"], description: "Poprzedni utwór" },
      { keys: ["[", "]"], description: "Zwolnij / Przyspiesz muzykę (±10%)" },
    ],
  },
  {
    title: "Nawigacja i Widoki",
    items: [
      { keys: ["L"], description: "Otwórz / Zamknij Bibliotekę Muzyki" },
      { keys: ["T"], description: "Otwórz / Zamknij Ustawienia Timera" },
      { keys: ["S"], description: "Otwórz / Zamknij Statystyki i Profil" },
      { keys: ["Esc"], description: "Zamknij aktywne okno / Odpnij" },
    ],
  },
  {
    title: "Sztuczna Inteligencja & Zadania",
    items: [
      { keys: ["Ctrl", "M"], description: "Szybkie rozbicie subtaska przez AI Gemini" },
      { keys: ["?"], description: "Otwórz / Zamknij tę ściągę skrótów" },
    ],
  },
];

export function KeyboardShortcutsModal({
  open,
  onClose,
}: KeyboardShortcutsModalProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(focusTimer);
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const backdropTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: "easeOut" as const };

  const modalTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 400, damping: 32 };

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="shortcuts-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
          onKeyDown={handleKeyDown}
        >
          <motion.button
            type="button"
            className="shortcuts-modal-backdrop"
            aria-label="Close shortcuts cheatsheet"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
          />

          <motion.div
            className="shortcuts-modal-panel"
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 0, scale: 0.95, y: 12 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 8 }
            }
            transition={modalTransition}
          >
            <header className="shortcuts-modal-header">
              <div className="shortcuts-modal-heading">
                <span className="shortcuts-modal-badge" aria-hidden="true">
                  <Icon name="keyboard" size={18} />
                </span>
                <div>
                  <strong id="shortcuts-title">Skróty Klawiszowe</strong>
                  <span className="shortcuts-modal-subtitle">Szybka nawigacja i kontrola</span>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="icon-btn ghost"
                aria-label="Close shortcuts cheatsheet"
                onClick={onClose}
              >
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="shortcuts-modal-body">
              {SHORTCUT_CATEGORIES.map((category) => (
                <section className="shortcuts-category" key={category.title}>
                  <h3 className="shortcuts-category-title">{category.title}</h3>
                  <div className="shortcuts-list">
                    {category.items.map((item) => (
                      <div className="shortcut-row" key={item.description}>
                        <span className="shortcut-desc">{item.description}</span>
                        <div className="shortcut-keys">
                          {item.keys.map((k) => (
                            <kbd className="shortcut-key" key={k}>
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
