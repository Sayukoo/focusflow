import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { DEFAULT_TIMER_SETTINGS, type Track } from "../types";
import { FocusPlayer } from "./FocusPlayer";

vi.mock("./MusicLibrary", () => ({
  MusicLibrary: () => null,
}));

vi.mock("./ProfilePicker", () => ({
  ProfilePicker: () => null,
}));

vi.mock("./RemotePlayer", () => ({
  RemotePlayer: () => null,
}));

vi.mock("./TimerSettings", () => ({
  TimerSettings: () => null,
}));

const track: Track = {
  id: "track-1",
  title: "Focus track",
  filename: "focus-track.mp3",
  path: "C:\\music\\focus-track.mp3",
  extension: "mp3",
  source: "managed",
};

function createProps(): ComponentProps<typeof FocusPlayer> {
  return {
    tracks: [track],
    musicDir: "C:\\music",
    currentTrack: track,
    profiles: [
      {
        id: "deep-work",
        name: "Deep Work",
        kind: "builtin",
        theme: "deep",
      },
    ],
    activeProfileId: "deep-work",
    profilePickerOpen: false,
    favoriteTrackIds: [],
    favoritesOnly: false,
    currentTrackId: track.id,
    isPlaying: false,
    volume: 0.72,
    progress: 0,
    duration: 0,
    timerLabel: "0:00",
    timerPhase: null,
    mode: "deep",
    timerSettings: DEFAULT_TIMER_SETTINGS,
    timerSettingsOpen: false,
    libraryOpen: false,
    busy: false,
    error: null,
    browserMode: true,
    onToggleLibrary: vi.fn(),
    onToggleProfilePicker: vi.fn(),
    onSelectProfile: vi.fn(),
    onCreateProfile: vi.fn(),
    onDeleteProfile: vi.fn(),
    onImport: vi.fn(),
    onAddLink: vi.fn(),
    onDropFiles: vi.fn(),
    remoteSeekRequest: null,
    onRemoteTime: vi.fn(),
    onRemoteDuration: vi.fn(),
    onRemotePlaying: vi.fn(),
    onRemoteEnded: vi.fn(),
    onRemoteError: vi.fn(),
    onRefresh: vi.fn(),
    onOpenFolder: vi.fn(),
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    onSetFavoritesOnly: vi.fn(),
    onTogglePlay: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onSeek: vi.fn(),
    onVolume: vi.fn(),
    onToggleFavorite: vi.fn(),
    onOpenTimerSettings: vi.fn(),
    onCloseTimerSettings: vi.fn(),
    onTimerSettingsChange: vi.fn(),
    onClearError: vi.fn(),
  };
}

describe("FocusPlayer AI category chip", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("shows a setup action when the Gemini key is missing", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<FocusPlayer {...createProps()} />);

    const button = await screen.findByRole("button", {
      name: "Set up Gemini to categorize this track",
    });
    expect(button).toHaveTextContent("AI setup");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows retry and loading states after a request failure", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("failure", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ category: "ambient" }) }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    render(<FocusPlayer {...createProps()} />);

    const retryButton = await screen.findByRole("button", {
      name: "Retry AI category",
    });
    expect(retryButton).toHaveTextContent("Retry AI");

    fireEvent.click(retryButton);
    expect(
      await screen.findByRole("button", { name: "Classifying track" }),
    ).toHaveTextContent("Classifying…");

    await waitFor(() => {
      expect(screen.getByText("AMBIENT")).toBeVisible();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole("button", { name: "Retry AI category" }),
    ).not.toBeInTheDocument();
  });

  it("places an editable checklist below the timer and persists changes", () => {
    const onTimerSettingsChange = vi.fn();
    const timerSettings = {
      ...DEFAULT_TIMER_SETTINGS,
      kind: "timer" as const,
      durationMinutes: 25,
      goal: "Finish the outline",
      miniGoals: [
        {
          id: "mini-goal-1",
          text: "Open the document",
          completed: false,
        },
        {
          id: "mini-goal-2",
          text: "Write the first heading",
          completed: true,
        },
      ],
    };

    render(
      <FocusPlayer
        {...createProps()}
        timerSettings={timerSettings}
        onTimerSettingsChange={onTimerSettingsChange}
      />,
    );

    const timer = screen.getByRole("button", { name: "Timer 0:00" });
    const checkbox = screen.getByRole("checkbox", {
      name: "Mark mini goal 1 complete",
    });
    expect(
      timer.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(checkbox);
    expect(onTimerSettingsChange).toHaveBeenLastCalledWith({
      ...timerSettings,
      miniGoals: [
        { ...timerSettings.miniGoals[0], completed: true },
        timerSettings.miniGoals[1],
      ],
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Mini goal 1" }), {
      target: { value: "Review the document" },
    });
    expect(onTimerSettingsChange).toHaveBeenLastCalledWith({
      ...timerSettings,
      miniGoals: [
        { ...timerSettings.miniGoals[0], text: "Review the document" },
        timerSettings.miniGoals[1],
      ],
    });
  });
});
