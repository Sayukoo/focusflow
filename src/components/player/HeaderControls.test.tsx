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
        onOpenHub={vi.fn()}
      />
    );

    const slider = screen.queryByRole("slider", { name: /volume slider/i });
    expect(slider).not.toBeInTheDocument();
  });

  it("renders menu button and inline volume slider when window is pinned", () => {
    const onOpenMobileMenu = vi.fn();
    const onVolume = vi.fn();

    render(
      <HeaderControls
        windowPinned={true}
        volume={0.8}
        onVolume={onVolume}
        onSetWindowPinned={vi.fn()}
        onOpenHub={vi.fn()}
        onOpenMobileMenu={onOpenMobileMenu}
      />
    );

    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    expect(menuBtn).toBeInTheDocument();
    fireEvent.click(menuBtn);
    expect(onOpenMobileMenu).toHaveBeenCalledTimes(1);

    const slider = screen.getByRole("slider", { name: /volume slider/i });
    expect(slider).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: "0.2" } });
    expect(onVolume).toHaveBeenCalledWith(0.2);
  });

  it("opens the unified hub from a single header button", () => {
    const onOpenHub = vi.fn();

    render(
      <HeaderControls
        windowPinned={false}
        volume={0.7}
        onSetWindowPinned={vi.fn()}
        onOpenHub={onOpenHub}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /open hub — music, profiles and library/i,
      }),
    );
    expect(onOpenHub).toHaveBeenCalledTimes(1);
  });

  it("opens timer settings from the header timer button", () => {
    const onOpenTimerSettings = vi.fn();

    render(
      <HeaderControls
        windowPinned={false}
        volume={0.7}
        onSetWindowPinned={vi.fn()}
        onOpenHub={vi.fn()}
        onOpenTimerSettings={onOpenTimerSettings}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /open timer settings/i }));
    expect(onOpenTimerSettings).toHaveBeenCalledTimes(1);
  });
});

