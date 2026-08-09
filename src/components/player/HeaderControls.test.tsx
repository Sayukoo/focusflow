import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderControls } from "./HeaderControls";

describe("HeaderControls", () => {
  it("hides volume control in main view when window is not pinned", () => {
    render(
      <HeaderControls
        windowPinned={false}
        volume={0.7}
        onSetWindowPinned={vi.fn()}
        onToggleLibrary={vi.fn()}
        onToggleProfilePicker={vi.fn()}
      />
    );

    const volumeBtn = screen.queryByRole("button", { name: /volume 70%/i });
    expect(volumeBtn).not.toBeInTheDocument();
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
