import type { VoicePackId } from "../types";

export type CueKind = "work" | "break" | "complete";

export type { VoicePackId };

export const VOICE_PACK_OPTIONS: ReadonlyArray<{
  id: VoicePackId;
  label: string;
}> = [
  { id: "calm-female", label: "Calm female" },
];

export const VOICE_CUE_FILES = [
  "session-start.mp3",
  "break-start.mp3",
  "work-start.mp3",
  "session-complete.mp3",
] as const;

export type VoiceCueFile = (typeof VOICE_CUE_FILES)[number];

export function voiceCueFileForPhase(
  phase: CueKind,
  cycleIndex = 0,
): VoiceCueFile {
  if (phase === "break") return "break-start.mp3";
  if (phase === "complete") return "session-complete.mp3";
  return cycleIndex <= 0 ? "session-start.mp3" : "work-start.mp3";
}

export function voicePackAssetUrl(
  pack: VoicePackId,
  file: VoiceCueFile,
): string | null {
  if (pack === "system") return null;
  return `/audio/voices/${pack}/${file}`;
}
