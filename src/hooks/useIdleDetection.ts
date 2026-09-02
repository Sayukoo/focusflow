import { useEffect, useState } from "react";

const IDLE_EVENTS = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
] as const;

/**
 * Returns true once the user has not interacted for `idleDelayMs`.
 * Any pointer/keyboard/wheel/touch activity instantly resets to false.
 * Used by Zen mode to fade the UI down to the timer only.
 */
export function useIdleDetection(idleDelayMs = 10_000): boolean {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    let timer: number | undefined;

    const arm = () => {
      setIsIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsIdle(true), idleDelayMs);
    };

    arm();
    for (const event of IDLE_EVENTS) {
      window.addEventListener(event, arm, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const event of IDLE_EVENTS) {
        window.removeEventListener(event, arm);
      }
    };
  }, [idleDelayMs]);

  return isIdle;
}
