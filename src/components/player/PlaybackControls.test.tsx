import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { PlaybackControls } from "./PlaybackControls";

function createProps(): ComponentProps<typeof PlaybackControls> {
  return {
    isPlaying: false,
    progress: 0,
    duration: 180,
    onTogglePlay: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onSeek: vi.fn(),
  };
}

describe("PlaybackControls shuffle toggle", () => {
  it("hides the shuffle button when no toggle handler is provided", () => {
    render(<PlaybackControls {...createProps()} />);
    expect(
      screen.queryByRole("button", { name: /shuffle/i }),
    ).not.toBeInTheDocument();
  });

  it("renders an inactive shuffle button and toggles on click", () => {
    const onToggleShuffle = vi.fn();
    render(
      <PlaybackControls
        {...createProps()}
        shuffleEnabled={false}
        onToggleShuffle={onToggleShuffle}
      />,
    );

    const button = screen.getByRole("button", { name: "Enable shuffle" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveClass("is-active");

    fireEvent.click(button);
    expect(onToggleShuffle).toHaveBeenCalledTimes(1);
  });

  it("renders an active shuffle button when enabled", () => {
    render(
      <PlaybackControls
        {...createProps()}
        shuffleEnabled
        onToggleShuffle={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Disable shuffle" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("is-active");
  });
});
