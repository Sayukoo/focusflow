import { describe, expect, it } from "vitest";
import {
  findTrackIndex,
  formatClock,
  formatRemaining,
  formatTimerLabel,
  loadFavoriteTrackIds,
  nextTrackIndex,
  parseYouTubeVideoId,
  previousTrackIndex,
  sanitizeTitle,
  saveFavoriteTrackIds,
  uniqueFilename,
} from "./audio";
import type { Track } from "../types";

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3599)).toBe("59:59");
  });
});

describe("formatRemaining", () => {
  it("counts up for infinity", () => {
    expect(formatRemaining(125, "infinity")).toBe("2:05");
  });

  it("counts down for presets", () => {
    expect(formatRemaining(60, 25)).toBe("24:00");
    expect(formatRemaining(25 * 60, 25)).toBe("0:00");
  });
});

describe("formatTimerLabel", () => {
  it("shows elapsed time for infinite sessions", () => {
    expect(
      formatTimerLabel(125, {
        kind: "infinite",
        durationMinutes: null,
        pauseWhenMusicPaused: true,
      }),
    ).toBe("2:05");
  });

  it("shows remaining time for timer sessions", () => {
    expect(
      formatTimerLabel(60, {
        kind: "timer",
        durationMinutes: 60,
        pauseWhenMusicPaused: true,
      }),
    ).toBe("59:00");
  });
});

describe("uniqueFilename", () => {
  it("returns original when free", () => {
    expect(uniqueFilename(["a.mp3"], "b.mp3")).toBe("b.mp3");
  });

  it("adds numeric suffix on collision", () => {
    expect(uniqueFilename(["song.mp3"], "song.mp3")).toBe("song (1).mp3");
    expect(uniqueFilename(["song.mp3", "song (1).mp3"], "song.mp3")).toBe(
      "song (2).mp3",
    );
  });
});

describe("queue helpers", () => {
  const tracks: Track[] = [
    {
      id: "1",
      title: "One",
      filename: "one.mp3",
      path: "/one.mp3",
      extension: "mp3",
    },
    {
      id: "2",
      title: "Two",
      filename: "two.mp3",
      path: "/two.mp3",
      extension: "mp3",
    },
  ];

  it("wraps next and previous", () => {
    expect(nextTrackIndex(0, 2)).toBe(1);
    expect(nextTrackIndex(1, 2)).toBe(0);
    expect(previousTrackIndex(0, 2)).toBe(1);
    expect(previousTrackIndex(1, 2)).toBe(0);
  });

  it("finds track index", () => {
    expect(findTrackIndex(tracks, "2")).toBe(1);
    expect(findTrackIndex(tracks, null)).toBe(-1);
  });
});

describe("sanitizeTitle", () => {
  it("cleans separators", () => {
    expect(sanitizeTitle("deep_work-flow.mp3")).toBe("deep work flow");
  });
});

describe("parseYouTubeVideoId", () => {
  it("accepts common YouTube URL formats", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=vWjl07A3rZg")).toBe(
      "vWjl07A3rZg",
    );
    expect(parseYouTubeVideoId("https://youtu.be/vWjl07A3rZg?t=12")).toBe(
      "vWjl07A3rZg",
    );
    expect(parseYouTubeVideoId("youtube.com/shorts/vWjl07A3rZg")).toBe(
      "vWjl07A3rZg",
    );
  });

  it("rejects non-YouTube and incomplete links", () => {
    expect(parseYouTubeVideoId("https://example.com/watch?v=vWjl07A3rZg")).toBeNull();
    expect(parseYouTubeVideoId("not a link")).toBeNull();
  });
});

describe("favorite persistence", () => {
  it("round-trips unique track ids through local storage", () => {
    saveFavoriteTrackIds(["one", "two", "one"]);
    expect(loadFavoriteTrackIds()).toEqual(["one", "two"]);
  });

  it("ignores malformed stored values", () => {
    localStorage.setItem("focusflow.favorites", JSON.stringify(["one", 2, null]));
    expect(loadFavoriteTrackIds()).toEqual(["one"]);
    localStorage.setItem("focusflow.favorites", "{broken");
    expect(loadFavoriteTrackIds()).toEqual([]);
  });
});
