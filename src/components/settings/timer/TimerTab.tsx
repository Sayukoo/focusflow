import { motion } from "framer-motion";
import { Icon } from "../../ui/Icon";

interface TimerTabProps {
  active: boolean;
  icon: "infinity" | "stopwatch" | "intervals";
  label: string;
  reducedMotion: boolean;
  onClick: () => void;
}

export function TimerTab({
  active,
  icon,
  label,
  reducedMotion,
  onClick,
}: TimerTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      className={active ? "timer-tab is-active" : "timer-tab"}
      onClick={onClick}
    >
      {active ? (
        <motion.span
          className="timer-tab-indicator"
          layoutId="timer-tab-indicator"
          transition={reducedMotion ? { duration: 0 } : undefined}
          aria-hidden="true"
        />
      ) : null}
      <span className="timer-tab-content">
        <Icon name={icon} size={22} />
        <span>{label}</span>
      </span>
    </button>
  );
}
