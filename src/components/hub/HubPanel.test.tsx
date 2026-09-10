import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Track } from "../../types";
import { HubPanel } from "./HubPanel";

const track: Track = {
  id: "track-1",
  title: "Focus track",
  filename: "focus-track.mp3",
  path: "C:\\music\\focus-track.mp3",
  extension: "mp3",
  source: "managed",
};

function createProps(): ComponentProps<typeof HubPanel> {
  return {
    open: true,
    onClose: vi.fn(),
    tracks: [track],
    activeProfileName: "Deep Work",
    currentTrackCategory: null,
    currentTrackId: null,
    favoriteTrackIds: [],
    favoritesOnly: false,
    musicDir: "C:\\music",
    busy: false,
    onImport: vi.fn(),
    onAddLink: vi.fn(),
    onDropFiles: vi.fn(),
    onOpenFolder: vi.fn(),
    onSelectTrack: vi.fn(),
    onRemoveTrack: vi.fn(),
    onToggleFavorite: vi.fn(),
    onPlayQueue: vi.fn(),
    profiles: [
      {
        id: "deep-work",
        name: "Deep Work",
        kind: "builtin",
        theme: "deep",
      },
      {
        id: "energizing",
        name: "Energizing",
        kind: "builtin",
        theme: "energizing",
      },
    ],
    activeProfileId: "deep-work",
    userAboutMe: "",
    onSelectProfile: vi.fn(),
    onCreateProfile: vi.fn(),
    onDeleteProfile: vi.fn(),
    onUserAboutMeChange: vi.fn(),
  };
}

describe("HubPanel", () => {
  it("renders nothing when closed", () => {
    render(<HubPanel {...createProps()} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the music library without the redundant bottom profile section", () => {
    render(<HubPanel {...createProps()} />);

    expect(
      screen.queryByRole("tab", { name: /^muzyka$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /konto i profile/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Focus track from Deep Work" }),
    ).toBeVisible();
    expect(screen.queryByText("Konto i profile")).not.toBeInTheDocument();

    // Verify Informacja o mnie tab in library
    const aboutTab = screen.getByRole("tab", { name: "Informacja o mnie" });
    expect(aboutTab).toBeVisible();
    fireEvent.click(aboutTab);
    expect(
      screen.getByRole("textbox", { name: "Informacje o mnie" }),
    ).toBeVisible();
  });

  it("renders Chillowe and Energetyczne category switch in header and allows switching", () => {
    const onSelectProfile = vi.fn();
    render(<HubPanel {...createProps()} onSelectProfile={onSelectProfile} />);

    const chillBtn = screen.getByRole("radio", { name: "Kategoria Chillowe" });
    const energeticBtn = screen.getByRole("radio", {
      name: "Kategoria Energetyczne",
    });

    expect(chillBtn).toBeVisible();
    expect(energeticBtn).toBeVisible();
    expect(chillBtn).toHaveAttribute("aria-checked", "true");
    expect(energeticBtn).toHaveAttribute("aria-checked", "false");

    fireEvent.click(energeticBtn);
    expect(onSelectProfile).toHaveBeenCalledWith("energizing");
  });
});
