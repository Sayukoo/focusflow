import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { normalizeMiniGoalText } from "../../lib/timer";
import type { MiniGoal } from "../../types";

interface MiniGoalChecklistProps {
  items: MiniGoal[];
  label?: string;
  className?: string;
  onChange: (items: MiniGoal[]) => void;
}

export function MiniGoalChecklist({
  items,
  label = "Mini goals",
  className,
  onChange,
}: MiniGoalChecklistProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.text])),
  );
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
    previousItemsRef.current = items;
  }, [items]);

  const updateItem = (index: number, patch: Partial<MiniGoal>) => {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const commitText = (index: number, item: MiniGoal) => {
    const draft = drafts[item.id] ?? item.text;
    const text = normalizeMiniGoalText(draft);
    if (!text) {
      setDrafts((current) => ({ ...current, [item.id]: item.text }));
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

  return (
    <ul
      className={["mini-goals-list", className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          className={item.completed ? "is-complete" : undefined}
        >
          <input
            className="mini-goal-check"
            type="checkbox"
            checked={item.completed}
            aria-label={`Mark mini goal ${index + 1} complete`}
            onChange={(event) =>
              updateItem(index, { completed: event.target.checked })
            }
          />
          <input
            className="mini-goal-input"
            type="text"
            maxLength={120}
            value={drafts[item.id] ?? item.text}
            aria-label={`Mini goal ${index + 1}`}
            onChange={(event) => handleTextChange(index, item, event)}
            onBlur={() => commitText(index, item)}
            onKeyDown={(event) => handleTextKeyDown(index, item, event)}
          />
        </li>
      ))}
    </ul>
  );
}
