import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "../../types";
import { PlaylistTracksModal } from "./PlaylistTracksModal";

describe("PlaylistTracksModal", () => {
  const tracks: Track[] = [
    {
      id: "youtube:1",
      title: "Zdechły Osa - Patolove",
      filename: "patolove.mp3",
      path: "https://youtube.com/watch?v=1",
      extension: "youtube",
      source: "youtube",
      author: "Zdechły Osa",
    },
    {
      id: "youtube:2",
      title: "Limp Bizkit - Break Stuff",
      filename: "break.mp3",
      path: "https://youtube.com/watch?v=2",
      extension: "youtube",
      source: "youtube",
      author: "Limp Bizkit",
    },
  ];

  it("renders all tracks and allows selecting a track", () => {
    const onSelectTrack = vi.fn();
    const onClose = vi.fn();

    render(
      <PlaylistTracksModal
        open={true}
        onClose={onClose}
        playlistTitle="Energiczne kawałki"
        tracks={tracks}
        currentTrackId="youtube:1"
        onSelectTrack={onSelectTrack}
      />,
    );

    expect(screen.getByText("Energiczne kawałki")).toBeInTheDocument();
    expect(screen.getByText("2 utwory")).toBeInTheDocument();
    expect(screen.getByText("Zdechły Osa - Patolove")).toBeInTheDocument();
    expect(screen.getByText("Limp Bizkit - Break Stuff")).toBeInTheDocument();

    // Click on Limp Bizkit
    fireEvent.click(screen.getByRole("button", { name: "Odtwórz Limp Bizkit - Break Stuff" }));
    expect(onSelectTrack).toHaveBeenCalledWith("youtube:2", true);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape key press", () => {
    const onClose = vi.fn();

    render(
      <PlaylistTracksModal
        open={true}
        onClose={onClose}
        playlistTitle="Test"
        tracks={tracks}
        currentTrackId={null}
        onSelectTrack={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("identifies active track when matched by videoId", () => {
    const playlistWithVideos: Track[] = [
      {
        id: "local:1",
        videoId: "vid12345678",
        title: "Song One",
        filename: "song1.mp3",
        path: "song1.mp3",
        extension: "mp3",
        source: "managed",
      },
      {
        id: "youtube:vid99999999",
        videoId: "vid99999999",
        title: "Song Two",
        filename: "song2.mp3",
        path: "https://youtube.com/watch?v=vid99999999",
        extension: "youtube",
        source: "youtube",
      },
    ];

    render(
      <PlaylistTracksModal
        open={true}
        onClose={vi.fn()}
        playlistTitle="Playlist Test"
        tracks={playlistWithVideos}
        currentTrackId="youtube:vid99999999"
        onSelectTrack={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Odtwarzane")).toBeInTheDocument();
  });
});

