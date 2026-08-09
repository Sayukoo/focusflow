import type { TimerKind } from "../../../types";
import { TimerTab } from "./TimerTab";

interface TimerTypeTabsProps {
  kind: TimerKind;
  shouldReduceMotion: boolean;
  onChooseKind: (kind: TimerKind) => void;
}

export function TimerTypeTabs({
  kind,
  shouldReduceMotion,
  onChooseKind,
}: TimerTypeTabsProps) {
  return (
    <div
      className="timer-tabs timer-tabs--primary"
      role="tablist"
      aria-label="Timer type"
    >
      <TimerTab
        active={kind === "intervals"}
        icon="intervals"
        label="Intervals"
        reducedMotion={shouldReduceMotion}
        onClick={() => onChooseKind("intervals")}
      />
      <TimerTab
        active={kind === "timer"}
        icon="stopwatch"
        label="Timer"
        reducedMotion={shouldReduceMotion}
        onClick={() => onChooseKind("timer")}
      />
      <TimerTab
        active={kind === "infinite"}
        icon="infinity"
        label="Infinite"
        reducedMotion={shouldReduceMotion}
        onClick={() => onChooseKind("infinite")}
      />
    </div>
  );
}
