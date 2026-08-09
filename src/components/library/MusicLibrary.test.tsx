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
      open
      tracks={[track]}
      activeProfileName="Deep Work"
      currentTrackCategory={null}
      currentTrackId={null}
      favoriteTrackIds={[]}
      favoritesOnly={false}
      musicDir="C:\\music"
      busy={false}
      onClose={vi.fn()}
      onImport={vi.fn()}
      onAddLink={vi.fn()}
      onDropFiles={vi.fn()}
      onRefresh={vi.fn()}
      onOpenFolder={vi.fn()}
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
});
