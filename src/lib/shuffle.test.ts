import { beforeEach, describe, expect, it } from "vitest";
import {
  loadShuffleEnabled,
  pickRandomTrackIndex,
  saveShuffleEnabled,
} from "./shuffle";

describe("pickRandomTrackIndex", () => {
  it("returns -1 for an empty queue", () => {
    expect(pickRandomTrackIndex(-1, 0)).toBe(-1);
  });

  it("returns 0 for a single-track queue", () => {
    expect(pickRandomTrackIndex(0, 1)).toBe(0);
    expect(pickRandomTrackIndex(-1, 1)).toBe(0);
  });

  it("returns the drawn index when it differs from the current one", () => {
    expect(pickRandomTrackIndex(0, 5, () => 0.5)).toBe(2);
  });

  it("never repeats the current track when the draw lands on it", () => {
    expect(pickRandomTrackIndex(2, 5, () => 0.4)).toBe(3);
    // Wraps around at the end of the queue.
    expect(pickRandomTrackIndex(4, 5, () => 0.99)).toBe(0);
  });

  it("stays in range when the random source misbehaves", () => {
    expect(pickRandomTrackIndex(0, 3, () => NaN)).toBe(1);
    expect(pickRandomTrackIndex(1, 3, () => 7)).toBe(0);
  });
});

describe("shuffle persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to off and round-trips the preference", () => {
    expect(loadShuffleEnabled()).toBe(false);
    saveShuffleEnabled(true);
    expect(loadShuffleEnabled()).toBe(true);
    saveShuffleEnabled(false);
    expect(loadShuffleEnabled()).toBe(false);
  });
});
