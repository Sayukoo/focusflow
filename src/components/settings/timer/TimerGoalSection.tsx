import { motion } from "framer-motion";
import type { RefObject } from "react";
import type { MiniGoal, TimerSettings } from "../../../types";
import { Icon } from "../../ui/Icon";
import { KaTeXTooltip } from "../../ui/KaTeXTooltip";
import { MiniGoalChecklist } from "../../tasks/MiniGoalChecklist";

interface TimerGoalSectionProps {
  settings: TimerSettings;
  goalDraft: string;
  goalError: string;
  miniGoals: MiniGoal[];
  miniGoalsLoading: boolean;
  miniGoalsError: string;
  clarificationQuestion: string;
  clarificationAnswer: string;
  shouldReduceMotion: boolean;
  goalInputRef: RefObject<HTMLTextAreaElement | null>;
  onGoalChange: (nextGoal: string) => void;
  onGoalCommit: () => void;
  onRequestMiniGoals: (answer?: string) => void;
  onClarificationAnswerChange: (answer: string) => void;
  onMiniGoalsChange: (next: MiniGoal[]) => void;
}

export function TimerGoalSection({
  settings,
  goalDraft,
  goalError,
  miniGoals,
  miniGoalsLoading,
  miniGoalsError,
  clarificationQuestion,
  clarificationAnswer,
  shouldReduceMotion,
  goalInputRef,
  onGoalChange,
  onGoalCommit,
  onRequestMiniGoals,
  onClarificationAnswerChange,
  onMiniGoalsChange,
}: TimerGoalSectionProps) {
  return (
    <motion.div
      className="timer-goal-field"
      layout={!shouldReduceMotion ? "position" : false}
    >
      <div className="timer-goal-label-row">
        <label htmlFor="timer-work-goal">
          {settings.kind === "infinite" ? "Finite goal" : "Work goal"}
        </label>
        {settings.kind !== "infinite" ? (
          <KaTeXTooltip
            formula={
              miniGoalsLoading
                ? "\\text{Generating mini-goals}"
                : "\\text{Generate mini-goals}"
            }
          >
            <button
              type="button"
              className={
                miniGoalsLoading
                  ? "mini-goals-icon-button is-loading"
                  : "mini-goals-icon-button"
              }
              aria-label={
                miniGoalsLoading
                  ? "Generating mini goals"
                  : "Generate mini goals"
              }
              aria-busy={miniGoalsLoading}
              disabled={miniGoalsLoading}
              onClick={() => void onRequestMiniGoals()}
            >
              <Icon name="sparkles" size={15} />
            </button>
          </KaTeXTooltip>
        ) : null}
      </div>

      <div className="timer-goal-input-wrap">
        <textarea
          ref={goalInputRef}
          id="timer-work-goal"
          rows={3}
          maxLength={300}
          placeholder="Required for finite mode"
          value={goalDraft}
          aria-label={
            settings.kind === "infinite" ? "Finite goal" : "Work goal"
          }
          aria-invalid={Boolean(goalError)}
          aria-describedby={goalError ? "timer-goal-error" : undefined}
          required={settings.kind !== "infinite"}
          onChange={(event) => onGoalChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onGoalCommit();
            }
          }}
          onBlur={onGoalCommit}
        />
        <span aria-hidden="true">{goalDraft.length}/300</span>
      </div>

      {goalError ? (
        <p id="timer-goal-error" className="timer-goal-error" role="alert">
          {goalError}
        </p>
      ) : null}
      {miniGoalsLoading ? (
        <p className="mini-goals-status" role="status" aria-live="polite">
          Generating…
        </p>
      ) : null}
      {miniGoalsError ? (
        <p className="mini-goals-status is-error" role="alert">
          {miniGoalsError}
        </p>
      ) : null}
      {clarificationQuestion ? (
        <div className="mini-goals-clarification" role="group">
          <p className="mini-goals-clarification-question">
            {clarificationQuestion}
          </p>
          <div className="mini-goals-clarification-controls">
            <input
              type="text"
              value={clarificationAnswer}
              maxLength={240}
              aria-label="Clarification answer"
              placeholder="What should come first?"
              onChange={(event) =>
                onClarificationAnswerChange(event.target.value)
              }
            />
            <button
              type="button"
              aria-label="Generate mini goals from clarification"
              disabled={miniGoalsLoading || !clarificationAnswer.trim()}
              onClick={() => void onRequestMiniGoals(clarificationAnswer)}
            >
              Use answer
            </button>
          </div>
        </div>
      ) : null}
      {miniGoals.length > 0 ? (
        <div className="mini-goals-card" aria-label="Mini goals">
          <div className="mini-goals-card-heading">
            <Icon name="sparkles" size={14} />
            <span>Mini goals</span>
          </div>
          <MiniGoalChecklist
            items={miniGoals}
            mainGoal={goalDraft}
            userAboutMe={settings.userAboutMe}
            workDurationMinutes={settings.workDurationMinutes}
            label="Mini goals"
            onChange={onMiniGoalsChange}
          />
        </div>
      ) : null}
    </motion.div>
  );
}
