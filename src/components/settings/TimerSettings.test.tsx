import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TIMER_SETTINGS, type TimerSettings as TimerSettingsState } from "../../types";
import { TimerSettings } from "./TimerSettings";

function intervalSettings(): TimerSettingsState {
  return {
    ...DEFAULT_TIMER_SETTINGS,
    kind: "intervals",
    durationMinutes: 25,
    workDurationMinutes: 25,
    breakDurationMinutes: 5,
    goal: "Outline the report",
  };
}

describe("TimerSettings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("offers only the primary 25, 45, and 90 minute timer presets", () => {
    render(
      <TimerSettings
        open
        settings={{
          ...DEFAULT_TIMER_SETTINGS,
          kind: "timer",
          durationMinutes: 45,
          goal: "Write the outline",
        }}
        onClose={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Timer duration 25 minutes" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Timer duration 45 minutes" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Timer duration 90 minutes" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Timer duration 30 minutes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Timer duration 60 minutes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Timer duration 120 minutes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate mini goals" }),
    ).toHaveClass("mini-goals-icon-button");
  });

  it("keeps generated checklist edits transactional until Apply", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      miniGoals: ["Open the document", "Draft the heading"],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const onChange = vi.fn();

    render(
      <TimerSettings
        open
        settings={{
          ...DEFAULT_TIMER_SETTINGS,
          kind: "timer",
          durationMinutes: 45,
          goal: "Write the outline",
        }}
        onClose={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate mini goals" }));
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Mark subtask 1 complete" }),
      ).toBeVisible(),
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Mark subtask 1 complete" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Subtask 1" }), {
      target: { value: "Review the document" },
    });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply timer settings" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        miniGoals: [
          {
            id: "mini-goal-1",
            text: "Review the document",
            completed: true,
          },
          {
            id: "mini-goal-2",
            text: "Draft the heading",
            completed: false,
          },
        ],
      }),
    );
  });

  it("exposes selected interval presets and updates the work goal", () => {
    const onChange = vi.fn();
    const settings = intervalSettings();

    render(
      <TimerSettings
        open
        settings={settings}
        onClose={vi.fn()}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Intervals" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Work time 25 minutes" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Break time 5 minutes" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Work time 40 minutes" }),
    );
    expect(onChange).not.toHaveBeenCalled();

    const goalInput = screen.getByRole("textbox", { name: "Work goal" });
    fireEvent.change(goalInput, {
      target: { value: "Finish the outline" },
    });
    fireEvent.blur(goalInput);
    fireEvent.click(screen.getByRole("button", { name: "Apply timer settings" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...settings,
      durationMinutes: 40,
      workDurationMinutes: 40,
      goal: "Finish the outline",
    });
  });

  it("blocks finite changes until a non-empty goal is entered", () => {
    const onChange = vi.fn();
    const settings = {
      ...intervalSettings(),
      goal: "",
    };

    render(
      <TimerSettings
        open
        settings={settings}
        onClose={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Work time 40 minutes" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply timer settings" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a goal before choosing a finite timer.",
    );
    expect(screen.getByRole("textbox", { name: "Work goal" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("uses Infinite copy for infinite mode", () => {
    render(
      <TimerSettings
        open
        settings={{
          ...DEFAULT_TIMER_SETTINGS,
          kind: "infinite",
          durationMinutes: null,
        }}
        onClose={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Infinite" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Timer" })).not.toBeInTheDocument();
  });

  it("requires a draft goal before leaving infinite mode", () => {
    const onChange = vi.fn();
    const settings = {
      ...DEFAULT_TIMER_SETTINGS,
      kind: "infinite" as const,
      durationMinutes: null,
      goal: "",
    };
    render(
      <TimerSettings
        open
        settings={settings}
        onClose={vi.fn()}
        onChange={onChange}
      />,
    );

    const goalInput = screen.getByRole("textbox", { name: "Finite goal" });
    fireEvent.change(goalInput, { target: { value: "Plan the first chapter" } });
    fireEvent.blur(goalInput);
    fireEvent.click(screen.getByRole("tab", { name: "Timer" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply timer settings" }));

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      kind: "timer",
      durationMinutes: 45,
      goal: "Plan the first chapter",
    });
  });

  it("discards draft goals when the modal is cancelled", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <TimerSettings
        open
        settings={intervalSettings()}
        onClose={onClose}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Work goal" }), {
      target: { value: "Uncommitted change" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel timer settings" }),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps mini-goals when switching between timer and intervals", () => {
    const onChange = vi.fn();
    const settings = {
      ...DEFAULT_TIMER_SETTINGS,
      kind: "timer" as const,
      durationMinutes: 45,
      goal: "Outline the report",
      miniGoals: [
        {
          id: "mini-goal-1",
          text: "Open the document",
          completed: true,
        },
        {
          id: "mini-goal-2",
          text: "Draft the heading",
          completed: false,
        },
      ],
    };

    render(
      <TimerSettings
        open
        settings={settings}
        onClose={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Intervals" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply timer settings" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "intervals",
        goal: "Outline the report",
        miniGoals: settings.miniGoals,
        workDurationMinutes: 45,
        breakDurationMinutes: 5,
      }),
    );
  });

  it("keeps mini-goals when changing an interval preset", () => {
    const onChange = vi.fn();
    const settings = {
      ...intervalSettings(),
      miniGoals: [
        {
          id: "mini-goal-1",
          text: "Open the document",
          completed: false,
        },
      ],
    };

    render(
      <TimerSettings
        open
        settings={settings}
        onClose={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Work time 40 minutes" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply timer settings" }));

    expect(onChange).toHaveBeenLastCalledWith({
      ...settings,
      durationMinutes: 40,
      workDurationMinutes: 40,
      miniGoals: settings.miniGoals,
    });
  });
});
