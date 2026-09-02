import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleDetection } from "./useIdleDetection";

describe("useIdleDetection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("becomes idle after the delay without input", () => {
    const { result } = renderHook(() => useIdleDetection(10_000));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(true);
  });

  it("resets to active on user input", () => {
    const { result } = renderHook(() => useIdleDetection(10_000));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("pointermove"));
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(true);
  });

  it("resets on keyboard and wheel input too", () => {
    const { result } = renderHook(() => useIdleDetection(5_000));

    for (const event of ["keydown", "wheel", "pointerdown"]) {
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(result.current).toBe(true);

      act(() => {
        window.dispatchEvent(new Event(event));
      });
      expect(result.current).toBe(false);
    }
  });
});
