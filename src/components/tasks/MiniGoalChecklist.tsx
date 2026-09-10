import { memo, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import {
  breakdownSubGoalDetailed,
  hasGeminiConfiguration,
} from "../../lib/gemini";
import { playMiniGoalCompletionChime } from "../../lib/phaseCues";
import { createMiniGoals, normalizeMiniGoalText } from "../../lib/timer";
import type { MiniGoal } from "../../types";
import { Icon } from "../ui/Icon";
import { KaTeXTooltip } from "../ui/KaTeXTooltip";

interface MiniGoalChecklistProps {
  items: MiniGoal[];
  mainGoal?: string;
  userAboutMe?: string;
  workDurationMinutes?: number;
  label?: string;
  className?: string;
  isBreakPhase?: boolean;
  onAddClick?: () => void;
  onChange: (items: MiniGoal[]) => void;
}

// PERF: memo — the parent re-renders once per second (timer tick); the
// checklist only depends on its own items/callbacks, so skip the reconciliation.
export const MiniGoalChecklist = memo(function MiniGoalChecklist({
  items,
  mainGoal,
  userAboutMe,
  workDurationMinutes,
  label = "Mini goals",
  className,
  isBreakPhase,
  onAddClick,
  onChange,
}: MiniGoalChecklistProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.text])),
  );
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const [newSubSubText, setNewSubSubText] = useState<Record<string, string>>({});
  const previousItemsRef = useRef(items);

  useEffect(() => {
    const previousItems = previousItemsRef.current;
    setDrafts((current) => {
      const next: Record<string, string> = {};
      for (const item of items) {
        const previous = previousItems.find(
          (previousItem) => previousItem.id === item.id,
        );
        const currentDraft = current[item.id];
        next[item.id] =
          currentDraft === undefined || currentDraft === previous?.text
            ? item.text
            : currentDraft;
      }
      return next;
    });

    setSubDrafts((current) => {
      const next: Record<string, string> = {};
      for (const item of items) {
        if (!item.subGoals) continue;
        const previousItem = previousItems.find((p) => p.id === item.id);
        for (const subItem of item.subGoals) {
          const previousSub = previousItem?.subGoals?.find(
            (ps) => ps.id === subItem.id,
          );
          const currentDraft = current[subItem.id];
          next[subItem.id] =
            currentDraft === undefined || currentDraft === previousSub?.text
              ? subItem.text
              : currentDraft;
        }
      }
      return next;
    });

    previousItemsRef.current = items;
  }, [items]);

  const updateItem = (index: number, patch: Partial<MiniGoal>) => {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleParentToggle = (index: number, completed: boolean) => {
    const item = items[index];
    if (!item) return;
    if (completed) {
      void playMiniGoalCompletionChime();
    }
    const updatedSubGoals = item.subGoals?.map((sg) => ({
      ...sg,
      completed,
    }));
    updateItem(index, {
      completed,
      ...(updatedSubGoals ? { subGoals: updatedSubGoals } : {}),
    });
  };

  const handleSubGoalToggle = (
    parentIndex: number,
    subIndex: number,
    completed: boolean,
  ) => {
    const parent = items[parentIndex];
    if (!parent || !parent.subGoals) return;

    if (completed) {
      void playMiniGoalCompletionChime();
    }

    const nextSubGoals = parent.subGoals.map((sg, i) =>
      i === subIndex ? { ...sg, completed } : sg,
    );

    const allCompleted =
      nextSubGoals.length > 0 && nextSubGoals.every((sg) => sg.completed);

    updateItem(parentIndex, {
      subGoals: nextSubGoals,
      completed: allCompleted ? true : completed ? parent.completed : false,
    });
  };

  const handleDeleteMiniGoal = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const commitText = (index: number, item: MiniGoal) => {
    const draft = drafts[item.id] ?? item.text;
    const text = normalizeMiniGoalText(draft);
    if (!text) {
      handleDeleteMiniGoal(index);
      return;
    }

    setDrafts((current) => ({ ...current, [item.id]: text }));
    if (text !== item.text) {
      updateItem(index, { text });
    }
  };

  const handleTextChange = (
    index: number,
    item: MiniGoal,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const text = event.target.value;
    setDrafts((current) => ({ ...current, [item.id]: text }));
    if (normalizeMiniGoalText(text)) {
      updateItem(index, { text });
    }
  };

  const handleTextKeyDown = (
    index: number,
    item: MiniGoal,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitText(index, item);
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDrafts((current) => ({ ...current, [item.id]: item.text }));
      event.currentTarget.blur();
    }
  };

  const handleSubGoalTextChange = (
    parentIndex: number,
    subIndex: number,
    subItem: MiniGoal,
    text: string,
  ) => {
    setSubDrafts((current) => ({ ...current, [subItem.id]: text }));
    const parent = items[parentIndex];
    if (!parent || !parent.subGoals) return;

    if (normalizeMiniGoalText(text)) {
      const nextSubGoals = parent.subGoals.map((sg, i) =>
        i === subIndex ? { ...sg, text } : sg,
      );
      updateItem(parentIndex, { subGoals: nextSubGoals });
    }
  };

  const commitSubGoalText = (
    parentIndex: number,
    subIndex: number,
    subItem: MiniGoal,
  ) => {
    const draft = subDrafts[subItem.id] ?? subItem.text;
    const text = normalizeMiniGoalText(draft);
    const parent = items[parentIndex];
    if (!parent || !parent.subGoals) return;

    if (!text) {
      handleDeleteSubGoal(parentIndex, subIndex);
      return;
    }

    setSubDrafts((current) => ({ ...current, [subItem.id]: text }));
    if (text !== subItem.text) {
      const nextSubGoals = parent.subGoals.map((sg, i) =>
        i === subIndex ? { ...sg, text } : sg,
      );
      updateItem(parentIndex, { subGoals: nextSubGoals });
    }
  };

  const handleDeleteSubGoal = (parentIndex: number, subIndex: number) => {
    const parent = items[parentIndex];
    if (!parent || !parent.subGoals) return;
    const nextSubGoals = parent.subGoals.filter((_, i) => i !== subIndex);
    updateItem(parentIndex, { subGoals: nextSubGoals });
  };

  const handleAddSubSubGoal = (parentIndex: number) => {
    const parent = items[parentIndex];
    if (!parent) return;
    const inputVal = newSubSubText[parent.id] ?? "";
    const text = normalizeMiniGoalText(inputVal);
    if (!text) {
      setNewSubSubText((current) => ({ ...current, [parent.id]: "" }));
      return;
    }

    const newSubItem: MiniGoal = {
      id: `sub-goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      completed: false,
    };

    const nextSubGoals = [...(parent.subGoals ?? []), newSubItem];
    updateItem(parentIndex, { subGoals: nextSubGoals });
    setNewSubSubText((current) => ({ ...current, [parent.id]: "" }));
  };

  const handleBreakdown = async (parentIndex: number, item: MiniGoal) => {
    if (decomposingId !== null) return;
    setDecomposingId(item.id);

    try {
      const result = await breakdownSubGoalDetailed(
        item,
        mainGoal ?? "",
        items,
        {
          kind: "timer",
          workDurationMinutes: workDurationMinutes ?? 25,
          breakDurationMinutes: null,
          userAboutMe,
        },
      );

      if (result.subGoals.length > 0) {
        const newSubGoals = createMiniGoals(result.subGoals);
        updateItem(parentIndex, { subGoals: newSubGoals });
      }
    } catch {
      // Gemini breakdown error handled gracefully
    } finally {
      setDecomposingId(null);
    }
  };

  const [newSubtaskText, setNewSubtaskText] = useState("");

  const handleAddSubtask = () => {
    const text = normalizeMiniGoalText(newSubtaskText);
    if (!text) {
      setNewSubtaskText("");
      return;
    }
    const newGoal: MiniGoal = {
      id: `mini-goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      completed: false,
    };
    onChange([...items, newGoal]);
    setNewSubtaskText("");
  };

  const handleNewSubtaskKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddSubtask();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setNewSubtaskText("");
      event.currentTarget.blur();
    }
  };

  const canUseAiBreakdown = hasGeminiConfiguration();

  return (
    <div
      className={[
        "mini-goals-wrapper",
        isBreakPhase ? "is-break-phase" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ul
        className={["mini-goals-list", className].filter(Boolean).join(" ")}
        aria-label={label}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            className={[
              item.completed ? "is-complete" : "",
              item.subGoals && item.subGoals.length > 0 ? "has-subgoals-wrap" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="mini-goal-main-row">
              <input
                className="mini-goal-check"
                type="checkbox"
                checked={item.completed}
                aria-label={`Mark subtask ${index + 1} complete`}
                onChange={(event) =>
                  handleParentToggle(index, event.target.checked)
                }
              />
              <input
                className="mini-goal-input"
                type="text"
                value={drafts[item.id] ?? item.text}
                aria-label={`Subtask ${index + 1}`}
                onChange={(event) => handleTextChange(index, item, event)}
                onBlur={() => commitText(index, item)}
                onKeyDown={(event) => handleTextKeyDown(index, item, event)}
              />
              {canUseAiBreakdown ? (
                <KaTeXTooltip formula="\text{Break down subtask with Gemini AI}">
                  <button
                    type="button"
                    className={[
                      "mini-goal-ai-btn",
                      decomposingId === item.id ? "is-loading" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={`Break down subtask ${index + 1} with AI`}
                    disabled={decomposingId !== null}
                    onClick={() => void handleBreakdown(index, item)}
                  >
                    <Icon name="sparkles" size={13} />
                  </button>
                </KaTeXTooltip>
              ) : null}
            </div>

            {item.subGoals && item.subGoals.length > 0 ? (
              <ul className="mini-subgoals-list">
                {item.subGoals.map((subItem, subIndex) => (
                  <li
                    key={subItem.id}
                    className={subItem.completed ? "is-complete" : undefined}
                  >
                    <input
                      className="mini-goal-check mini-subgoal-check"
                      type="checkbox"
                      checked={subItem.completed}
                      aria-label={`Mark sub-task ${subIndex + 1} complete`}
                      onChange={(e) =>
                        handleSubGoalToggle(index, subIndex, e.target.checked)
                      }
                    />
                    <input
                      className="mini-goal-input mini-subgoal-input"
                      type="text"
                      value={subDrafts[subItem.id] ?? subItem.text}
                      aria-label={`Sub-task ${subIndex + 1}`}
                      onChange={(e) =>
                        handleSubGoalTextChange(
                          index,
                          subIndex,
                          subItem,
                          e.target.value,
                        )
                      }
                      onBlur={() => commitSubGoalText(index, subIndex, subItem)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitSubGoalText(index, subIndex, subItem);
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setSubDrafts((curr) => ({
                            ...curr,
                            [subItem.id]: subItem.text,
                          }));
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="mini-subgoal-delete-btn"
                      aria-label="Delete sub-task"
                      onClick={() => handleDeleteSubGoal(index, subIndex)}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </li>
                ))}
                <li className="mini-subgoal-add-item">
                  <span className="mini-subgoal-add-plus" aria-hidden="true">+</span>
                  <input
                    className="mini-goal-input mini-subgoal-input mini-subgoal-add-input"
                    type="text"
                    value={newSubSubText[item.id] ?? ""}
                    placeholder="Add sub-subtask…"
                    aria-label={`Add sub-subtask under subtask ${index + 1}`}
                    onChange={(e) =>
                      setNewSubSubText((curr) => ({
                        ...curr,
                        [item.id]: e.target.value,
                      }))
                    }
                    onBlur={() => handleAddSubSubGoal(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubSubGoal(index);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setNewSubSubText((curr) => ({
                          ...curr,
                          [item.id]: "",
                        }));
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </li>
              </ul>
            ) : null}
          </li>
        ))}
        <li className="mini-goal-add-item">
          {onAddClick ? (
            <button
              type="button"
              className="mini-goal-add-trigger-btn"
              onClick={onAddClick}
              aria-label="Add subtask"
            >
              <span className="mini-goal-add-plus" aria-hidden="true">+</span>
              <span className="mini-goal-add-placeholder">Add subtask…</span>
            </button>
          ) : (
            <>
              <span className="mini-goal-add-plus" aria-hidden="true">+</span>
              <input
                className="mini-goal-input mini-goal-add-input"
                type="text"
                value={newSubtaskText}
                placeholder="Add subtask…"
                aria-label="Add new subtask"
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onBlur={handleAddSubtask}
                onKeyDown={handleNewSubtaskKeyDown}
              />
            </>
          )}
        </li>
      </ul>
    </div>
  );
});

