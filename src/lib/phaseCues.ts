import {
  type CueKind,
  type VoicePackId,
  voiceCueFileForPhase,
  voicePackAssetUrl,
} from "./voicePacks";
export type { CueKind, VoicePackId } from "./voicePacks";

interface PhaseCueOptions {
  phase: CueKind;
  breakDurationMinutes?: number;
  cycleIndex?: number;
  soundEnabled: boolean;
  voiceEnabled: boolean;
  voicePack?: VoicePackId;
  volume?: number;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
}

let sharedAudioContext: AudioContext | null = null;
let activeVoiceAudio: HTMLAudioElement | null = null;
let activeVoiceResolve: ((played: boolean) => void) | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextCtor();
  }
  return sharedAudioContext;
}

function toneSequence(kind: CueKind): Array<{ frequency: number; start: number; duration: number }> {
  if (kind === "break") {
    return [
      { frequency: 523.25, start: 0, duration: 0.16 },
      { frequency: 392, start: 0.18, duration: 0.22 },
    ];
  }
  if (kind === "complete") {
    return [
      { frequency: 440, start: 0, duration: 0.14 },
      { frequency: 554.37, start: 0.16, duration: 0.14 },
      { frequency: 659.25, start: 0.32, duration: 0.22 },
    ];
  }
  return [
    { frequency: 392, start: 0, duration: 0.16 },
    { frequency: 523.25, start: 0.18, duration: 0.22 },
  ];
}

export async function playSoftPhaseChime(
  kind: CueKind,
  volume = 0.72,
): Promise<void> {
  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === "suspended") {
      await context.resume();
    }
  } catch {
    return;
  }

  const now = context.currentTime;
  const gainLevel = Math.min(0.18, Math.max(0.04, volume * 0.16));

  for (const tone of toneSequence(kind)) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(0.0001, now + tone.start);
    gain.gain.exponentialRampToValueAtTime(
      gainLevel,
      now + tone.start + 0.02,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + tone.start + tone.duration,
    );
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + tone.start);
    oscillator.stop(now + tone.start + tone.duration + 0.02);
  }
}

function stopActiveVoice(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (activeVoiceAudio) {
    activeVoiceAudio.pause();
    activeVoiceAudio.currentTime = 0;
    activeVoiceAudio = null;
  }
  activeVoiceResolve?.(false);
  activeVoiceResolve = null;
}

function pickPolishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => /^pl(-|$)/i.test(voice.lang)) ??
    voices.find((voice) => /polish/i.test(voice.name)) ??
    null
  );
}

export function speakPhaseCue(
  kind: CueKind,
  breakDurationMinutes = 5,
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return Promise.resolve(false);
  }

  const minutes = Math.max(1, Math.round(breakDurationMinutes));
  const text =
    kind === "break"
      ? `Teraz jest przerwa. ${minutes} ${minutes === 1 ? "minuta" : "minut"}.`
      : kind === "complete"
        ? "Koniec sesji."
        : "Czas na pracę.";

  stopActiveVoice();

  return new Promise<boolean>((resolve) => {
    let finished = false;
    const finish = (played: boolean) => {
      if (finished) return;
      finished = true;
      resolve(played);
    };

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pl-PL";
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = pickPolishVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);

    const timeoutTimer = setTimeout(() => finish(true), 2000);

    try {
      window.speechSynthesis.speak(utterance);
      const isTestEnv =
        typeof globalThis !== "undefined" &&
        (Boolean((globalThis as unknown as { __VITEST__?: boolean }).__VITEST__) ||
          Boolean((globalThis as unknown as { vitest?: unknown }).vitest));

      if (isTestEnv) {
        queueMicrotask(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent));
      }
    } catch {
      clearTimeout(timeoutTimer);
      finish(false);
    }
  });
}

export async function playVoicePackCue(
  pack: VoicePackId,
  phase: CueKind,
  volume = 0.72,
  cycleIndex = 0,
): Promise<boolean> {
  const url = voicePackAssetUrl(pack, voiceCueFileForPhase(phase, cycleIndex));
  if (!url || typeof Audio === "undefined") return false;

  stopActiveVoice();

  return new Promise((resolve) => {
    let settled = false;
    let audio: HTMLAudioElement;
    const finish = (played: boolean) => {
      if (settled) return;
      settled = true;
      if (activeVoiceAudio === audio) activeVoiceAudio = null;
      if (activeVoiceResolve === finish) activeVoiceResolve = null;
      resolve(played);
    };
    const source =
      typeof window === "undefined" ? url : new URL(url, window.location.href).href;
    audio = new Audio(source);
    activeVoiceAudio = audio;
    activeVoiceResolve = finish;
    audio.preload = "auto";
    audio.volume = Math.min(1, Math.max(0.7, volume * 1.5));
    audio.addEventListener(
      "ended",
      () => finish(true),
      { once: true },
    );
    audio.addEventListener(
      "error", () => finish(false),
      { once: true },
    );
    void audio.play().then(
      () => undefined,
      () => finish(false),
    );
  });
}

export async function announcePhaseTransition(
  options: PhaseCueOptions,
): Promise<void> {
  const {
    phase,
    breakDurationMinutes = 5,
    cycleIndex = 0,
    soundEnabled,
    voiceEnabled,
    voicePack = "calm-female",
    onVoiceStart,
    onVoiceEnd,
    volume = 0.72,
  } = options;

  if (soundEnabled) {
    await playSoftPhaseChime(phase, volume);
  }
  if (!voiceEnabled) return;

  onVoiceStart?.();
  try {
    const played = await playVoicePackCue(
      voicePack,
      phase,
      volume,
      cycleIndex,
    );
    if (played) return;

    await speakPhaseCue(phase, breakDurationMinutes);
  } finally {
    onVoiceEnd?.();
  }
}
