import { afterEach, describe, expect, it, vi } from "vitest";
import {
  breakdownSubGoalDetailed,
  categorizeTrack,
  categorizeTrackWithStatus,
  generateMiniGoals,
  generateMiniGoalsDetailed,
} from "./gemini";
import type { Track } from "../types";

const track: Track = {
  id: "youtube:video-123",
  title: "Night Drive",
  filename: "night-drive.mp3",
  path: "C:\\music\\night-drive.mp3",
  extension: "mp3",
  source: "youtube",
  url: "https://youtu.be/video-123",
  videoId: "video-123",
  providerId: "video-123",
  providerKind: "video",
  author: "Focus Artist",
  metadata: {
    album: "After Hours",
    year: 2024,
    token: "must not be sent",
  },
};

describe("Gemini mini-goals", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails closed when no API key is configured", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(generateMiniGoals("Outline the report")).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses and bounds concise mini-goals", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    vi.stubEnv("VITE_GEMINI_MODEL", "");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      miniGoals: [
                        "  Open the document  ",
                        "Write the first heading",
                        "Add three supporting points",
                        "Review the outline",
                        "Save the draft",
                        "Ignore this sixth item",
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      generateMiniGoals(
        "Outline the report",
        {
          kind: "intervals",
          workDurationMinutes: 40,
          breakDurationMinutes: 10,
        },
      ),
    ).resolves.toEqual([
        "Open the document",
        "Write the first heading",
        "Add three supporting points",
        "Review the outline",
        "Save the draft",
      ]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("gemini-3.1-flash-lite"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-goog-api-key": "test-key" }),
        body: expect.stringContaining(
          "Selected work duration: 40 minutes",
        ),
      }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining("Selected break interval: 10 minutes"),
      }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining("Exact goal text: Outline the report"),
      }),
    );
  });

  it("preserves the complete text of a generated mini-goal", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const longMiniGoal =
      "Wybierz jeden temat, który autentycznie Cię ciekawi (nie musi być idealnie naukowy, wystarczy, że jest dla Ciebie fascynujący i zachęca do dalszego researchu).";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({ miniGoals: [longMiniGoal] }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(generateMiniGoals("Prepare a research plan")).resolves.toEqual([
      longMiniGoal,
    ]);
  });

  it("includes userAboutMe background prompt in Gemini request body", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      miniGoals: ["Create project folder", "Setup React app"],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await generateMiniGoalsDetailed(
      "Build app",
      {
        kind: "timer",
        workDurationMinutes: 30,
        breakDurationMinutes: null,
        userAboutMe: "Senior React developer specializing in TypeScript",
      },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining(
          "User background / About me (psychological context & memory): Senior React developer specializing in TypeScript",
        ),
      }),
    );
  });

  it("supports one-step clarification before generating mini-goals", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      miniGoals: [],
                      clarifyingQuestion: "Which section should come first?",
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      generateMiniGoalsDetailed(
        "Improve the project",
        {
          kind: "timer",
          workDurationMinutes: 45,
          breakDurationMinutes: null,
        },
        undefined,
        "Start with the onboarding flow",
      ),
    ).resolves.toEqual({
      miniGoals: [],
      clarifyingQuestion: "Which section should come first?",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining(
          "Clarification answer: Start with the onboarding flow",
        ),
      }),
    );
  });

  it("breaks down a large subtask into sub-subtasks with full session context", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      subGoals: ["Krok 1: Otwórz plik", "Krok 2: Napisz wstęp"],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await breakdownSubGoalDetailed(
      { id: "sub-1", text: "Napisz całą dokumentację", completed: false },
      "Stwórz nową aplikację FocusFlow",
      [
        { id: "sub-1", text: "Napisz całą dokumentację", completed: false },
        { id: "sub-2", text: "Zrobić testy", completed: true },
      ],
      {
        kind: "timer",
        workDurationMinutes: 25,
        breakDurationMinutes: null,
        userAboutMe: "Programista z tendencją do prokrastynacji",
      },
    );

    expect(result.subGoals).toEqual(["Krok 1: Otwórz plik", "Krok 2: Napisz wstęp"]);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining("Main Work Goal:"),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining("Target Subtask to break down:"),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining("Programista z tendencją do prokrastynacji"),
      }),
    );
  });
});

describe("Gemini track categories", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends the full safe track metadata to the configured model", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    vi.stubEnv("VITE_GEMINI_MODEL", "custom-model");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ category: "electronic" }) }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(categorizeTrack(track)).resolves.toBe("ELECTRONIC");

    const request = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    const prompt = body.contents[0]?.parts[0]?.text ?? "";
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/models/custom-model:generateContent"),
      expect.anything(),
    );
    expect(prompt).toContain("Title: Night Drive");
    expect(prompt).toContain("Filename: night-drive.mp3");
    expect(prompt).toContain("Author: Focus Artist");
    expect(prompt).toContain("Source: youtube");
    expect(prompt).toContain("Provider: youtube");
    expect(prompt).toContain("URL: https://youtu.be/video-123");
    expect(prompt).toContain("Video ID: video-123");
    expect(prompt).toContain("Provider ID: video-123");
    expect(prompt).toContain("Extension: mp3");
    expect(prompt).toContain("File type: mp3");
    expect(prompt).toContain("Metadata album: After Hours");
    expect(prompt).toContain("Metadata year: 2024");
    expect(prompt).not.toContain("must not be sent");
  });

  it("distinguishes missing configuration from request failure", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(categorizeTrackWithStatus(track)).resolves.toEqual({
      category: null,
      status: "missing-configuration",
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 503 }));

    await expect(categorizeTrackWithStatus(track)).resolves.toEqual({
      category: null,
      status: "request-failed",
    });
  });

  it("retries after failure and uses the local cache after success", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("temporary failure", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ category: "lofi" }) }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    await expect(categorizeTrackWithStatus(track)).resolves.toEqual({
      category: null,
      status: "request-failed",
    });
    await expect(categorizeTrackWithStatus(track)).resolves.toEqual({
      category: "LOFI",
      status: "available",
    });
    await expect(categorizeTrack(track)).resolves.toBe("LOFI");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("focusflow.track-categories")).toContain(
      '"youtube:video-123":"LOFI"',
    );
  });

  it("keeps a valid manual category ahead of the remote cache", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      categorizeTrack({ ...track, category: "jazz" }),
    ).resolves.toBe("JAZZ");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("categorizes phonk tracks as PHONK", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ category: "phonk" }) }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      categorizeTrack({
        ...track,
        title: "KORDHELL - Murder In My Mind",
      }),
    ).resolves.toBe("PHONK");
  });
});
