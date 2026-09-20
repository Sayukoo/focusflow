import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "../../types";
import { MusicLibrary } from "./MusicLibrary";

const track: Track = {
  id: "track-1",
  title: "Focus track",
  filename: "focus-track.mp3",
  path: "C:\\music\\focus-track.mp3",
  extension: "mp3",
  source: "managed",
};

function renderLibrary(
  onRemove = vi.fn(),
  onPlayQueue = vi.fn(),
) {
  render(
    <MusicLibrary
      tracks={[track]}
      activeProfileName="Deep Work"
      currentTrackCategory={null}
      currentTrackId={null}
      favoriteTrackIds={[]}
      favoritesOnly={false}
      busy={false}
      onImport={vi.fn()}
      onAddLink={vi.fn()}
      onDropFiles={vi.fn()}
      onSelect={vi.fn()}
      onRemove={onRemove}
      onToggleFavorite={vi.fn()}
      onPlayQueue={onPlayQueue}
    />,
  );
  return { onRemove, onPlayQueue };
}

describe("MusicLibrary delete action", () => {
  it("exposes and invokes the accessible delete control", () => {
    const { onRemove } = renderLibrary();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete Focus track from Deep Work",
      }),
    );

    expect(onRemove).toHaveBeenCalledWith(track);
  });

  it("does not change playback when browsing, until the queue play button is pressed", () => {
    const { onPlayQueue } = renderLibrary();

    fireEvent.click(screen.getByRole("tab", { name: "Ostatni" }));
    expect(onPlayQueue).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Play recent tracks" }),
    );
    expect(onPlayQueue).toHaveBeenCalledWith({ kind: "recent" }, track.id);
  });

  it("switches to Informacja o mnie tab and allows saving userAboutMe", () => {
    const onUserAboutMeChange = vi.fn();
    render(
      <MusicLibrary
        tracks={[track]}
        activeProfileName="Deep Work"
        currentTrackCategory={null}
        currentTrackId={null}
        favoriteTrackIds={[]}
        favoritesOnly={false}
        busy={false}
        userAboutMe="Old context"
        onUserAboutMeChange={onUserAboutMeChange}
        onImport={vi.fn()}
        onAddLink={vi.fn()}
        onDropFiles={vi.fn()}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onToggleFavorite={vi.fn()}
        onPlayQueue={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Informacja o mnie" }));
    const textarea = screen.getByRole("textbox", { name: "Informacje o mnie" });
    expect(textarea).toHaveValue("Old context");

    fireEvent.change(textarea, { target: { value: "New context text" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(onUserAboutMeChange).toHaveBeenCalledWith("New context text");
  });

  it("switches to Playlisty tab and shows all tracks in the playlist", () => {
    const onSelect = vi.fn();
    const playlistTrack1: Track = {
      id: "youtube:pl-1",
      title: "Zdechły Osa - Patolove",
      filename: "patolove.mp3",
      path: "https://youtube.com/watch?v=pl-1",
      extension: "youtube",
      source: "youtube",
      playlistId: "PL_TEST_123",
      playlistTitle: "Polski Punk i Trap",
    };
    const playlistTrack2: Track = {
      id: "youtube:pl-2",
      title: "Limp Bizkit - Rollin",
      filename: "rollin.mp3",
      path: "https://youtube.com/watch?v=pl-2",
      extension: "youtube",
      source: "youtube",
      playlistId: "PL_TEST_123",
      playlistTitle: "Polski Punk i Trap",
    };

    render(
      <MusicLibrary
        tracks={[playlistTrack1, playlistTrack2]}
        activeProfileName="Energizing"
        currentTrackCategory={null}
        currentTrackId={null}
        favoriteTrackIds={[]}
        favoritesOnly={false}
        busy={false}
        onImport={vi.fn()}
        onAddLink={vi.fn()}
        onDropFiles={vi.fn()}
        onSelect={onSelect}
        onRemove={vi.fn()}
        onToggleFavorite={vi.fn()}
        onPlayQueue={vi.fn()}
      />,
    );

    // Click Playlisty tab
    fireEvent.click(screen.getByRole("tab", { name: "Playlisty" }));

    // Playlist header should appear
    expect(screen.getByText("Polski Punk i Trap")).toBeInTheDocument();
    expect(screen.getByText("2 utwory")).toBeInTheDocument();

    // Click "Pokaż utwory"
    fireEvent.click(screen.getByRole("button", { name: "Pokaż utwory" }));

    // Both tracks must be visible
    expect(screen.getByText("Zdechły Osa - Patolove")).toBeInTheDocument();
    expect(screen.getByText("Limp Bizkit - Rollin")).toBeInTheDocument();

    // Clicking a track triggers playback
    fireEvent.click(screen.getByRole("button", { name: "Odtwórz Limp Bizkit - Rollin" }));
    expect(onSelect).toHaveBeenCalledWith("youtube:pl-2");
  });

  it("exposes the move to opposite category button and invokes callback", () => {
    const onMoveTrackToProfile = vi.fn();
    render(
      <MusicLibrary
        tracks={[track]}
        activeProfileName="Deep Work"
        currentTrackCategory={null}
        currentTrackId={null}
        favoriteTrackIds={[]}
        favoritesOnly={false}
        busy={false}
        onImport={vi.fn()}
        onAddLink={vi.fn()}
        onDropFiles={vi.fn()}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onToggleFavorite={vi.fn()}
        onPlayQueue={vi.fn()}
        onMoveTrackToProfile={onMoveTrackToProfile}
      />,
    );

    const moveBtn = screen.getByRole("button", {
      name: "Przenieś Focus track do Energetyczne",
    });
    expect(moveBtn).toBeInTheDocument();

    fireEvent.click(moveBtn);
    expect(onMoveTrackToProfile).toHaveBeenCalledWith(track.id, "energizing");
  });

  it("triggers onReorderTracks when dragging and dropping a track", () => {
    const onReorderTracks = vi.fn();
    const track2: Track = {
      id: "track-2",
      title: "Second track",
      filename: "second.mp3",
      path: "C:\\music\\second.mp3",
      extension: "mp3",
      source: "managed",
    };

    render(
      <MusicLibrary
        tracks={[track, track2]}
        activeProfileName="Deep Work"
        currentTrackCategory={null}
        currentTrackId={null}
        favoriteTrackIds={[]}
        favoritesOnly={false}
        busy={false}
        onImport={vi.fn()}
        onAddLink={vi.fn()}
        onDropFiles={vi.fn()}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onToggleFavorite={vi.fn()}
        onPlayQueue={vi.fn()}
        onReorderTracks={onReorderTracks}
      />,
    );

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);

    // Simulate drag start on track 1 (index 0)
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "move",
      types: ["application/x-focusflow-track-id"],
    };
    fireEvent.dragStart(cards[0]!, { dataTransfer });

    // Simulate drag over track 2 (index 1)
    // mock getBoundingClientRect
    cards[1]!.getBoundingClientRect = () => ({
      top: 100,
      bottom: 200,
      left: 0,
      right: 300,
      width: 300,
      height: 100,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    fireEvent.dragOver(cards[1]!, { clientY: 180, dataTransfer });
    fireEvent.drop(cards[1]!, { clientY: 180, dataTransfer });

    // Dropping at bottom of item 1 moves item 0 to index 1
    expect(onReorderTracks).toHaveBeenCalledWith(0, 1);
  });
});
