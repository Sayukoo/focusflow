import { useCallback, useRef, useState } from "react";
import { announcePhaseTransition } from "../lib/phaseCues";
import {
  createTimerClock,
  getIntervalPhase,
  type TimerClock,
} from "../lib/timer";
import {
  DEFAULT_TIMER_SETTINGS,
  type TimerPhase,
  type TimerSettings,
} from "../types";

interface UseTimerEngineProps {
  getAudioElement: () => HTMLAudioElement | null;
  getVolume: () => number;
}

export function useTimerEngine({
  getAudioElement,
  getVolume,
}: UseTimerEngineProps) {
  const timerSettingsRef = useRef<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const timerClockRef = useRef<TimerClock>(createTimerClock());
  const sessionStartedRef = useRef(false);
  const voiceCueSequenceRef = useRef(0);
  const lastAnnouncedPhaseRef = useRef<{
    kind: TimerSettings["kind"];
    phase: TimerPhase | "complete" | null;
    cycleIndex: number | null;
  }>({ kind: DEFAULT_TIMER_SETTINGS.kind, phase: null, cycleIndex: null });

  const duckingMultiplierRef = useRef(1.0);
  const [duckingMultiplier, setDuckingMultiplier] = useState(1.0);
  const [timerSettings, setTimerSettings] =
    useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const setSessionActive = useCallback((active: boolean) => {
    sessionStartedRef.current = active;
    setSessionStarted(active);
  }, []);

  const resetPhaseCueBaseline = useCallback(
    (settings: TimerSettings, elapsedMs = 0) => {
      if (settings.kind !== "intervals") {
        lastAnnouncedPhaseRef.current = {
          kind: settings.kind,
          phase: null,
          cycleIndex: null,
        };
        return;
      }
      const phaseState = getIntervalPhase(elapsedMs, settings);
      lastAnnouncedPhaseRef.current = {
        kind: "intervals",
        phase: phaseState.phase,
        cycleIndex: phaseState.cycleIndex,
      };
    },
    [],
  );

  const announceTimerCue = useCallback(
    (
      phase: TimerPhase | "complete",
      settings: TimerSettings,
      cycleIndex = 0,
    ) => {
      if (!settings.phaseSoundEnabled && !settings.phaseVoiceEnabled) return;
      const voiceCueId = ++voiceCueSequenceRef.current;
      const musicAudio = getAudioElement();
      const currentVolume = getVolume();

      const duckMusic = () => {
        if (
          !settings.phaseVoiceEnabled ||
          voiceCueId !== voiceCueSequenceRef.current
        ) {
          return;
        }
        duckingMultiplierRef.current = 0.2;
        setDuckingMultiplier(0.2);
        if (musicAudio && !musicAudio.paused) {
          musicAudio.volume = Math.max(0, currentVolume * 0.2);
        }
      };
      const restoreMusic = () => {
        if (voiceCueId !== voiceCueSequenceRef.current) {
          return;
        }
        duckingMultiplierRef.current = 1.0;
        setDuckingMultiplier(1.0);
        if (musicAudio && getAudioElement() === musicAudio) {
          musicAudio.volume = currentVolume;
        }
      };
      void announcePhaseTransition({
        phase,
        breakDurationMinutes: settings.breakDurationMinutes,
        cycleIndex,
        soundEnabled: settings.phaseSoundEnabled,
        voiceEnabled: settings.phaseVoiceEnabled,
        voicePack: settings.voicePack,
        volume: currentVolume,
        onVoiceStart: duckMusic,
        onVoiceEnd: restoreMusic,
      });
    },
    [getAudioElement, getVolume],
  );

  const startSession = useCallback(() => {
    const wasActive = sessionStartedRef.current;
    setSessionActive(true);
    if (!wasActive) {
      announceTimerCue("work", timerSettingsRef.current, 0);
    }
  }, [announceTimerCue, setSessionActive]);

  return {
    timerSettings,
    setTimerSettings,
    timerSettingsRef,
    timerClockRef,
    sessionStarted,
    setSessionStarted,
    sessionStartedRef,
    setSessionActive,
    elapsed,
    setElapsed,
    lastAnnouncedPhaseRef,
    duckingMultiplier,
    duckingMultiplierRef,
    setDuckingMultiplier,
    resetPhaseCueBaseline,
    announceTimerCue,
    startSession,
  };
}
