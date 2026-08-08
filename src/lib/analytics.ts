export interface DailyFocusRecord {
  date: string;
  focusTimeSeconds: number;
  sessionsCount: number;
}

export interface FocusAnalyticsStore {
  version: 1;
  history: Record<string, DailyFocusRecord>;
}

const ANALYTICS_STORAGE_KEY = "focusflow.analytics";

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createDefaultAnalyticsStore(): FocusAnalyticsStore {
  return {
    version: 1,
    history: {},
  };
}

export function loadAnalyticsStore(): FocusAnalyticsStore {
  try {
    const raw =
      localStorage.getItem(ANALYTICS_STORAGE_KEY) ??
      localStorage.getItem("brainfm.analytics");
    if (!raw) return createDefaultAnalyticsStore();
    return normalizeAnalyticsStore(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultAnalyticsStore();
  }
}

export function saveAnalyticsStore(store: FocusAnalyticsStore): void {
  try {
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage might be restricted in some environments.
  }
}

export function addFocusTime(
  store: FocusAnalyticsStore,
  seconds: number,
  dateStr = getLocalDateString(),
): FocusAnalyticsStore {
  if (seconds <= 0) return store;
  const next = cloneAnalyticsStore(store);
  const current = next.history[dateStr] ?? {
    date: dateStr,
    focusTimeSeconds: 0,
    sessionsCount: 0,
  };
  next.history[dateStr] = {
    ...current,
    focusTimeSeconds: current.focusTimeSeconds + seconds,
  };
  return next;
}

export function recordCompletedSession(
  store: FocusAnalyticsStore,
  dateStr = getLocalDateString(),
): FocusAnalyticsStore {
  const next = cloneAnalyticsStore(store);
  const current = next.history[dateStr] ?? {
    date: dateStr,
    focusTimeSeconds: 0,
    sessionsCount: 0,
  };
  next.history[dateStr] = {
    ...current,
    sessionsCount: current.sessionsCount + 1,
  };
  return next;
}

export function isDayActive(record?: DailyFocusRecord): boolean {
  if (!record) return false;
  return record.focusTimeSeconds > 0 || record.sessionsCount > 0;
}

export function calculateStreak(
  store: FocusAnalyticsStore,
  todayStr = getLocalDateString(),
): number {
  let streak = 0;
  const currentDate = parseLocalDate(todayStr);

  const todayRecord = store.history[todayStr];
  const todayIsActive = isDayActive(todayRecord);

  let checkDate = new Date(currentDate);

  if (!todayIsActive) {
    // Check if yesterday was active
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(checkDate);
    const yesterdayRecord = store.history[yesterdayStr];
    if (!isDayActive(yesterdayRecord)) {
      return 0;
    }
  }

  // Count backwards continuously
  while (true) {
    const dateStr = getLocalDateString(checkDate);
    const record = store.history[dateStr];
    if (isDayActive(record)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function formatFocusDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function getPolishSessionsLabel(count: number): string {
  if (count === 1) return "1 sesja";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${count} sesje`;
  }
  return `${count} sesji`;
}

export function formatDailyFocusSummary(
  todaySeconds: number,
  todaySessions: number,
): string {
  const durationText = formatFocusDuration(todaySeconds);
  const sessionsText = getPolishSessionsLabel(todaySessions);
  return `Dzisiaj: ${durationText} skupienia · ${sessionsText}`;
}

export function getTodayStats(
  store: FocusAnalyticsStore,
  todayStr = getLocalDateString(),
): { focusTimeSeconds: number; sessionsCount: number } {
  const record = store.history[todayStr];
  return {
    focusTimeSeconds: record?.focusTimeSeconds ?? 0,
    sessionsCount: record?.sessionsCount ?? 0,
  };
}

export interface DailyStatPoint {
  date: string;
  dayLabel: string;
  focusTimeSeconds: number;
  sessionsCount: number;
  isToday: boolean;
}

const POLISH_DAY_SHORT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];

export function getWeeklyFocusStats(
  store: FocusAnalyticsStore,
  todayStr = getLocalDateString(),
): {
  days: DailyStatPoint[];
  maxSeconds: number;
  totalWeeklySeconds: number;
  totalWeeklySessions: number;
} {
  const todayDate = parseLocalDate(todayStr);
  const days: DailyStatPoint[] = [];
  let totalWeeklySeconds = 0;
  let totalWeeklySessions = 0;
  let maxSeconds = 0;

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    const record = store.history[dateStr];
    const seconds = record?.focusTimeSeconds ?? 0;
    const sessions = record?.sessionsCount ?? 0;
    const dayLabel = POLISH_DAY_SHORT[d.getDay()] ?? "";

    totalWeeklySeconds += seconds;
    totalWeeklySessions += sessions;
    if (seconds > maxSeconds) {
      maxSeconds = seconds;
    }

    days.push({
      date: dateStr,
      dayLabel,
      focusTimeSeconds: seconds,
      sessionsCount: sessions,
      isToday: dateStr === todayStr,
    });
  }

  return {
    days,
    maxSeconds: Math.max(maxSeconds, 1800), // min scale of 30 mins for bar chart
    totalWeeklySeconds,
    totalWeeklySessions,
  };
}

function normalizeAnalyticsStore(value: unknown): FocusAnalyticsStore {
  const fallback = createDefaultAnalyticsStore();
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<FocusAnalyticsStore>;
  if (!candidate.history || typeof candidate.history !== "object") {
    return fallback;
  }

  const history: Record<string, DailyFocusRecord> = {};
  for (const [dateKey, recordVal] of Object.entries(candidate.history)) {
    if (recordVal && typeof recordVal === "object") {
      const rec = recordVal as Partial<DailyFocusRecord>;
      if (typeof rec.focusTimeSeconds === "number" && typeof rec.sessionsCount === "number") {
        history[dateKey] = {
          date: dateKey,
          focusTimeSeconds: Math.max(0, rec.focusTimeSeconds),
          sessionsCount: Math.max(0, rec.sessionsCount),
        };
      }
    }
  }

  return {
    version: 1,
    history,
  };
}

function cloneAnalyticsStore(store: FocusAnalyticsStore): FocusAnalyticsStore {
  return {
    version: 1,
    history: Object.fromEntries(
      Object.entries(store.history).map(([key, record]) => [
        key,
        { ...record },
      ]),
    ),
  };
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
}

const DAILY_GOAL_STORAGE_KEY = "brainfm.daily_goal_mins";
const LEGACY_DAILY_GOAL_STORAGE_KEY = "focusflow.daily_goal_mins";
export const DEFAULT_DAILY_GOAL_MINUTES = 240;

export function loadDailyGoalMinutes(): number {
  try {
    const raw =
      localStorage.getItem(DAILY_GOAL_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_DAILY_GOAL_STORAGE_KEY);
    if (!raw) return DEFAULT_DAILY_GOAL_MINUTES;
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return DEFAULT_DAILY_GOAL_MINUTES;
  } catch {
    return DEFAULT_DAILY_GOAL_MINUTES;
  }
}

export function saveDailyGoalMinutes(minutes: number): void {
  try {
    const valid = Math.max(15, Math.min(24 * 60, minutes));
    localStorage.setItem(DAILY_GOAL_STORAGE_KEY, String(valid));
  } catch {
    // Storage restricted
  }
}
