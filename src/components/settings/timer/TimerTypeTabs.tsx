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
        label="Interwały"
        ariaLabel="Intervals"
        reducedMotion={shouldReduceMotion}
        onClick={() => onChooseKind("intervals")}
      />
      <TimerTab
        active={kind === "timer"}
        icon="stopwatch"
        label="Minutnik"
        ariaLabel="Timer"
        reducedMotion={shouldReduceMotion}
        onClick={() => onChooseKind("timer")}
      />
      <TimerTab
        active={kind === "infinite"}
        icon="infinity"
        label="Ciągły"
        ariaLabel="Infinite"
        reducedMotion={shouldReduceMotion}
        onClick={() => onChooseKind("infinite")}
      />
    </div>
  );
}
