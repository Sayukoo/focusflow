import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  it("triggers onSpeedUp and onSpeedDown on bracket key presses", () => {
    const onSpeedUp = vi.fn();
    const onSpeedDown = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        onSpeedUp,
        onSpeedDown,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "]" }));
    expect(onSpeedUp).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "[" }));
    expect(onSpeedDown).toHaveBeenCalledTimes(1);
  });

  it("ignores hotkeys when typing in an input element", () => {
    const onSpeedUp = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSpeedUp }));

    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = new KeyboardEvent("keydown", { key: "]", bubbles: true });
    input.dispatchEvent(event);

    expect(onSpeedUp).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
