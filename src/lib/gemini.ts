import type { Track } from "../types";

export const TRACK_CATEGORIES = [
  "AMBIENT",
  "CLASSICAL",
  "ELECTRONIC",
  "FOCUS",
  "JAZZ",
  "LOFI",
  "NATURE",
  "SOUNDTRACK",
  "SLEEP",
  "OTHER",
] as const;

export type TrackCategory = (typeof TRACK_CATEGORIES)[number];

const CATEGORY_CACHE_KEY = "focusflow.track-categories";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export function hasGeminiConfiguration(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY?.trim());
}

export function loadTrackCategoryCache(): Record<string, TrackCategory> {
  try {
    const raw = localStorage.getItem(CATEGORY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === "string" && isTrackCategory(value),
      ),
    ) as Record<string, TrackCategory>;
  } catch {
    return {};
  }
}

export function saveTrackCategory(
  trackId: string,
  category: TrackCategory,
): void {
  const cache = loadTrackCategoryCache();
  cache[trackId] = category;
  localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(cache));
}

export async function categorizeTrack(
  track: Track,
): Promise<TrackCategory | null> {
  const cached = loadTrackCategoryCache()[track.id];
  if (cached) return cached;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const model =
    import.meta.env.VITE_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const prompt = [
    "Classify the music track into exactly one category.",
    `Allowed categories: ${TRACK_CATEGORIES.join(", ")}.`,
    "Return JSON only in the form {\"category\":\"CATEGORY\"}.",
    "",
    "Track metadata:",
    `Title: ${track.title}`,
    `Author: ${track.author ?? "unknown"}`,
    `Source: ${track.source ?? "local"}`,
    `Provider type: ${track.providerKind ?? "local audio file"}`,
    `File type: ${track.extension || "unknown"}`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 32,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                category: {
                  type: "STRING",
                  enum: [...TRACK_CATEGORIES],
                },
              },
              required: ["category"],
            },
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) return null;
    const payload = (await response.json()) as GeminiGenerateResponse;
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) return null;

    const parsed = JSON.parse(stripMarkdownFence(text)) as {
      category?: unknown;
    };
    if (typeof parsed.category !== "string") return null;
    const category = normalizeCategory(parsed.category);
    if (!category) return null;

    saveTrackCategory(track.id, category);
    return category;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function isTrackCategory(value: string): value is TrackCategory {
  return TRACK_CATEGORIES.includes(value as TrackCategory);
}

function normalizeCategory(value: string): TrackCategory | null {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return isTrackCategory(normalized) ? normalized : null;
}

function stripMarkdownFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
