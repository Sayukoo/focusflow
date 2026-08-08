import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

interface HotkeysModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "Space", description: "Start / Pause session" },
  { key: "N", description: "Play next track" },
  { key: "L", description: "Toggle music library" },
  { key: "T", description: "Open timer settings" },
  { key: "P", description: "Pin / unpin window top-right" },
  { key: "?", description: "Show keyboard shortcuts" },
];

export function HotkeysModal({ open, onClose }: HotkeysModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="hotkeys-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            ref={modalRef}
            className="hotkeys-modal-card"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard Shortcuts"
          >
            <div className="hotkeys-modal-header">
              <div className="hotkeys-modal-title">
                <span className="hotkeys-modal-icon-wrap" aria-hidden="true">
                  <Icon name="sparkles" />
                </span>
                <h3>Keyboard Shortcuts</h3>
              </div>
              <button
                type="button"
                className="hotkeys-modal-close"
                onClick={onClose}
                aria-label="Close shortcuts dialog"
              >
                ✕
              </button>
            </div>

            <div className="hotkeys-modal-grid">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} className="hotkeys-item">
                  <span className="hotkeys-desc">{shortcut.description}</span>
                  <kbd className="kbd-badge">{shortcut.key}</kbd>
                </div>
              ))}
            </div>

            <div className="hotkeys-modal-footer">
              <p>Press <kbd className="kbd-badge inline-kbd">Esc</kbd> or <kbd className="kbd-badge inline-kbd">?</kbd> to close</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
