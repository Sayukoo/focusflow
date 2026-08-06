import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MiniGoalChecklist } from "./tasks/MiniGoalChecklist";
import type { MiniGoal } from "../types";

const items: MiniGoal[] = [
  {
    id: "mini-goal-1",
    text: "Open the document",
    completed: false,
  },
  {
    id: "mini-goal-2",
    text: "Write the first heading",
    completed: true,
  },
];

describe("MiniGoalChecklist", () => {
  it("provides accessible checkbox and inline text controls", () => {
    const onChange = vi.fn();

    render(
      <MiniGoalChecklist
        items={items}
        label="Session mini goals"
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Session mini goals" }),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "Mark mini goal 1 complete" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Mark mini goal 2 complete" }),
    ).toBeChecked();

    const firstInput = screen.getByRole("textbox", { name: "Mini goal 1" });
    expect(firstInput).toHaveValue("Open the document");

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Mark mini goal 1 complete" }),
    );
    expect(onChange).toHaveBeenLastCalledWith([
      { ...items[0], completed: true },
      items[1],
    ]);

    fireEvent.change(firstInput, {
      target: { value: "Review the document" },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      { ...items[0], text: "Review the document" },
      items[1],
    ]);
  });
});
