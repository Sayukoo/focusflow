import { useEffect, useRef } from "react";

interface KeyboardShortcutsOptions {
  onTogglePlay?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleLibrary?: () => void;
  onToggleTimer?: () => void;
  onToggleProfile?: () => void;
  onToggleShortcuts?: () => void;
  onSpeedUp?: () => void;
  onSpeedDown?: () => void;
  onEscape?: () => void;
  disabled?: boolean;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onNext,
  onPrevious,
  onToggleLibrary,
  onToggleTimer,
  onToggleProfile,
  onToggleShortcuts,
  onSpeedUp,
  onSpeedDown,
  onEscape,
  disabled = false,
}: KeyboardShortcutsOptions): void {
  // PERF: handlers get fresh identities on every parent render (the timer
  // re-renders once per second). Keeping them in a ref lets the keydown
  // listener subscribe exactly once instead of churning every tick.
  const handlersRef = useRef({
    onTogglePlay,
    onNext,
    onPrevious,
    onToggleLibrary,
    onToggleTimer,
    onToggleProfile,
    onToggleShortcuts,
    onSpeedUp,
    onSpeedDown,
    onEscape,
  });
  handlersRef.current = {
    onTogglePlay,
    onNext,
    onPrevious,
    onToggleLibrary,
    onToggleTimer,
    onToggleProfile,
    onToggleShortcuts,
    onSpeedUp,
    onSpeedDown,
    onEscape,
  };

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const {
        onTogglePlay,
        onNext,
        onPrevious,
        onToggleLibrary,
        onToggleTimer,
        onToggleProfile,
        onToggleShortcuts,
        onSpeedUp,
        onSpeedDown,
        onEscape,
      } = handlersRef.current;
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Handle Escape anywhere
      if (event.key === "Escape") {
        if (onEscape) {
          event.preventDefault();
          onEscape();
          return;
        }
      }

      // Handle Ctrl/Cmd + M anywhere for AI breakdown shortcut
      if ((event.ctrlKey || event.metaKey) && (event.key === "m" || event.key === "M")) {
        // Can be handled by specific components or registered
        return;
      }

      // Ignore standard hotkeys if user is actively typing in an input
      if (isInput) return;

      if (event.key === " " || event.code === "Space") {
        if (onTogglePlay) {
          event.preventDefault();
          onTogglePlay();
        }
      } else if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        if (onToggleShortcuts) {
          event.preventDefault();
          onToggleShortcuts();
        }
      } else if (event.key === "l" || event.key === "L") {
        if (onToggleLibrary) {
          event.preventDefault();
          onToggleLibrary();
        }
      } else if (event.key === "t" || event.key === "T") {
        if (onToggleTimer) {
          event.preventDefault();
          onToggleTimer();
        }
      } else if (event.key === "s" || event.key === "S") {
        if (onToggleProfile) {
          event.preventDefault();
          onToggleProfile();
        }
      } else if (event.key === "n" || event.key === "N" || event.key === "ArrowRight") {
        if (onNext && !event.shiftKey && !event.ctrlKey) {
          event.preventDefault();
          onNext();
        }
      } else if (event.key === "p" || event.key === "P" || event.key === "ArrowLeft") {
        if (onPrevious && !event.shiftKey && !event.ctrlKey) {
          event.preventDefault();
          onPrevious();
        }
      } else if (event.key === "]") {
        if (onSpeedUp) {
          event.preventDefault();
          onSpeedUp();
        }
      } else if (event.key === "[") {
        if (onSpeedDown) {
          event.preventDefault();
          onSpeedDown();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled]);
}
