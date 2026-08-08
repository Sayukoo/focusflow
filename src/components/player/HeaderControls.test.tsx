import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderControls } from "./HeaderControls";

describe("HeaderControls", () => {
  it("renders volume control and allows changing volume via popover", () => {
    const onVolume = vi.fn();
    const onSetWindowPinned = vi.fn();
    const onToggleLibrary = vi.fn();
    const onToggleProfilePicker = vi.fn();

    render(
      <HeaderControls
        windowPinned={false}
        volume={0.7}
        onVolume={onVolume}
        onSetWindowPinned={onSetWindowPinned}
        onToggleLibrary={onToggleLibrary}
        onToggleProfilePicker={onToggleProfilePicker}
      />
    );

    // Open volume popover by clicking volume button
    const volumeBtn = screen.getByRole("button", { name: /volume 70%/i });
    expect(volumeBtn).toBeInTheDocument();
    fireEvent.click(volumeBtn);

    // Slider should now be present
    const slider = screen.getByRole("slider", { name: /volume slider/i });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue("0.7");

    // Change slider value
    fireEvent.change(slider, { target: { value: "0.45" } });
    expect(onVolume).toHaveBeenCalledWith(0.45);
  });

  it("renders menu button and volume control when window is pinned", () => {
    const onOpenMobileMenu = vi.fn();
    const onVolume = vi.fn();

    render(
      <HeaderControls
        windowPinned={true}
        volume={0.8}
        onVolume={onVolume}
        onSetWindowPinned={vi.fn()}
        onToggleLibrary={vi.fn()}
        onToggleProfilePicker={vi.fn()}
        onOpenMobileMenu={onOpenMobileMenu}
      />
    );

    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    expect(menuBtn).toBeInTheDocument();
    fireEvent.click(menuBtn);
    expect(onOpenMobileMenu).toHaveBeenCalledTimes(1);

    const volumeBtn = screen.getByRole("button", { name: /volume 80%/i });
    expect(volumeBtn).toBeInTheDocument();
    fireEvent.click(volumeBtn);

    const slider = screen.getByRole("slider", { name: /volume slider/i });
    expect(slider).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: "0.2" } });
    expect(onVolume).toHaveBeenCalledWith(0.2);
  });
});
