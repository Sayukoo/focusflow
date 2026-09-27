const SHUFFLE_STORAGE_KEY = "focusflow.shuffle";

/** Reads the persisted shuffle preference (defaults to off). */
export function loadShuffleEnabled(): boolean {
  try {
    return localStorage.getItem(SHUFFLE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Persists the shuffle preference. Never throws. */
export function saveShuffleEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SHUFFLE_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Storage can be unavailable in a restricted browser context.
  }
}

/**
 * Picks a random track index from a queue of `length` items.
 *
 * Guarantees no immediate repeat when there is more than one track by
 * stepping one slot forward when the draw lands on the current index.
 * Returns -1 for an empty queue and 0 for a single-track queue.
 *
 * The `random` parameter is injectable so the behavior stays testable.
 */
export function pickRandomTrackIndex(
  currentIndex: number,
  length: number,
  random: () => number = Math.random,
): number {
  if (length <= 0) return -1;
  if (length === 1) return 0;
  const drawn = Math.floor(random() * length);
  const safeDrawn =
    Number.isFinite(drawn) && drawn >= 0 && drawn < length ? drawn : 0;
  if (safeDrawn === currentIndex) return (safeDrawn + 1) % length;
  return safeDrawn;
}
