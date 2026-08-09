import { describe, expect, it } from "vitest";
import {
  fetchRemotePlaylistTracks,
  findTrackIndex,
  formatClock,
  formatRemaining,
  formatTimerLabel,
  loadPlayerSnapshot,
  loadFavoriteTrackIds,
  nextTrackIndex,
  parseRemoteLink,
  parseYouTubeVideoId,
  previousTrackIndex,
  sanitizeTitle,
  savePlayerSnapshot,
  saveFavoriteTrackIds,
  uniqueFilename,
} from "./audio";
import { DEFAULT_TIMER_SETTINGS, type Track } from "../types";

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
        ...DEFAULT_TIMER_SETTINGS,
        kind: "infinite",
        durationMinutes: null,
        goal: "",
        miniGoals: [],
      }),
    ).toBe("2:05");
  });

  it("shows remaining time for timer sessions", () => {
    expect(
      formatTimerLabel(60, {
        ...DEFAULT_TIMER_SETTINGS,
        kind: "timer",
        durationMinutes: 60,
        goal: "",
        miniGoals: [],
      }),
    ).toBe("59:00");
  });

  it("shows the active interval phase countdown", () => {
    const settings = {
      ...DEFAULT_TIMER_SETTINGS,
      kind: "intervals" as const,
      durationMinutes: 25,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      goal: "",
      miniGoals: [],
    };

    expect(formatTimerLabel(60, settings)).toBe("24:00");
    expect(formatTimerLabel(25 * 60, settings)).toBe("5:00");
    expect(formatTimerLabel(30 * 60, settings)).toBe("25:00");
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

describe("parseRemoteLink", () => {
  it("recognizes Spotify, YouTube playlist, and SoundCloud links", () => {
    expect(parseRemoteLink("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toMatchObject({
      provider: "spotify",
      providerId: "4uLU6hMCjMI75M1A2tKUQC",
      providerKind: "track",
    });
    expect(parseRemoteLink("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toMatchObject({
      provider: "spotify",
      providerId: "37i9dQZF1DXcBWIGoYBM5M",
      providerKind: "playlist",
    });
    expect(parseRemoteLink("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy")).toMatchObject({
      provider: "spotify",
      providerId: "4aawyAB9vmqN3uQ7FjRGTy",
      providerKind: "album",
    });
    expect(parseRemoteLink("https://www.youtube.com/playlist?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj")).toMatchObject({
      provider: "youtube",
      providerId: "PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj",
      providerKind: "playlist",
    });
    expect(parseRemoteLink("https://open.spotify.com/intl-pl/track/4uLU6hMCjMI75M1A2tKUQC")).toMatchObject({
      provider: "spotify",
      providerKind: "track",
    });
    expect(parseRemoteLink("https://soundcloud.com/artist/late-night-focus")).toMatchObject({
      provider: "soundcloud",
    });
    expect(
      parseRemoteLink(
        "https://www.tiktok.com/@lofi.1hour/video/7649770990515326216",
      ),
    ).toMatchObject({
      provider: "tiktok",
      providerId: "7649770990515326216",
      providerKind: "video",
    });
  });

  it("rejects unsupported streaming links", () => {
    expect(parseRemoteLink("https://example.com/audio.mp3")).toBeNull();
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

describe("timer snapshot persistence", () => {
  it("round-trips editable mini-goal progress", () => {
    const timerSettings = {
      ...DEFAULT_TIMER_SETTINGS,
      kind: "timer" as const,
      durationMinutes: 25,
      pauseWhenMusicPaused: true,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      goal: "Finish the outline",
      miniGoals: [
        {
          id: "mini-goal-1",
          text: "Review the document",
          completed: true,
        },
      ],
    };

    savePlayerSnapshot({
      currentTrackId: null,
      volume: 0.72,
      mode: "energizing",
      durationPreset: 25,
      timerSettings,
      playbackRate: 1.3,
    });

    const snapshot = loadPlayerSnapshot();
    expect(snapshot.timerSettings).toEqual(timerSettings);
    expect(snapshot.playbackRate).toBe(1.3);
  });
});

describe("fetchRemotePlaylistTracks", () => {
  it("returns empty array for non-playlist links", async () => {
    const parsed = parseRemoteLink("https://soundcloud.com/artist/track");
    if (!parsed) throw new Error("Expected parsed link");
    const tracks = await fetchRemotePlaylistTracks("https://soundcloud.com/artist/track", parsed);
    expect(tracks).toEqual([]);
  });
});
