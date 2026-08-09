import { useCallback, useEffect, useRef, useState } from "react";
import {
  addFocusTime,
  loadAnalyticsStore,
  recordCompletedSession,
  saveAnalyticsStore,
  type FocusAnalyticsStore,
} from "../lib/analytics";

export function useAnalyticsTracker() {
  const [analyticsStore, setAnalyticsStore] = useState<FocusAnalyticsStore>(() =>
    loadAnalyticsStore(),
  );
  const analyticsStoreRef = useRef<FocusAnalyticsStore>(analyticsStore);
  const lastAnalyticsTickRef = useRef<number | null>(null);

  useEffect(() => {
    analyticsStoreRef.current = analyticsStore;
  }, [analyticsStore]);

  const commitAnalyticsStore = useCallback((next: FocusAnalyticsStore) => {
    analyticsStoreRef.current = next;
    setAnalyticsStore(next);
    saveAnalyticsStore(next);
  }, []);

  const trackFocusTick = useCallback(
    (nowMs: number, isWorkPhase: boolean) => {
      if (isWorkPhase) {
        if (lastAnalyticsTickRef.current !== null) {
          const diffSec = Math.floor(
            (nowMs - lastAnalyticsTickRef.current) / 1000,
          );
          if (diffSec >= 1) {
            lastAnalyticsTickRef.current =
              nowMs - ((nowMs - lastAnalyticsTickRef.current) % 1000);
            commitAnalyticsStore(
              addFocusTime(analyticsStoreRef.current, diffSec),
            );
          }
        } else {
          lastAnalyticsTickRef.current = nowMs;
        }
      } else {
        lastAnalyticsTickRef.current = null;
      }
    },
    [commitAnalyticsStore],
  );

  const resetAnalyticsTick = useCallback(() => {
    lastAnalyticsTickRef.current = null;
  }, []);

  const recordSessionCompletion = useCallback(() => {
    commitAnalyticsStore(recordCompletedSession(analyticsStoreRef.current));
  }, [commitAnalyticsStore]);

  return {
    analyticsStore,
    analyticsStoreRef,
    commitAnalyticsStore,
    trackFocusTick,
    resetAnalyticsTick,
    recordSessionCompletion,
  };
}
