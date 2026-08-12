import type { Track } from "../types";

interface DefaultLofiSeed {
  videoId: string;
  title: string;
}

// Public YouTube lofi/chillhop mixes used as the starter library so a fresh
// install has something to press play on. Curated from well-known lofi
// channels (Lofi Girl, Chillhop Music) plus "matcha cafe" aesthetic study
// mixes; verified via web search rather than guessed video IDs.
const DEFAULT_LOFI_SEEDS: DefaultLofiSeed[] = [
  { videoId: "5qap5aO4i9A", title: "lofi hip hop radio – beats to relax/study to" },
  { videoId: "jfKfPfyJRdk", title: "lofi hip hop radio – beats to study/relax to" },
  { videoId: "7NOSDKb0HlU", title: "lofi hip hop radio – beats to study/relax to 🐾" },
  { videoId: "CFGLoQIhmow", title: "lofi hip hop mix – beats to relax/study to (Part 1)" },
  { videoId: "8b3fqIBrNW0", title: "lofi hip hop mix – beats to relax/study to (Part 2)" },
  { videoId: "7ccH8u8fj8Y", title: "Best of lofi hip hop 2025 – beats to relax/study to" },
  { videoId: "i43tkaTXtwI", title: "Best of lofi hip hop 2022 – beats to relax/study to" },
  { videoId: "n61ULEU7CO0", title: "Best of lofi hip hop 2021 – beats to relax/study to" },
  { videoId: "-FlxM_0S2lA", title: "Best of lofi 2018 – beats to chill/study to" },
  { videoId: "5yx6BWlEVcY", title: "Chillhop Radio – jazzy & lofi hip hop beats" },
  { videoId: "Liv0MXUPiqo", title: "Chillhop at the Diner – lofi jazz beats" },
  { videoId: "B1ggnlaiHkQ", title: "when school starts. – lofi / chillhop / jazzhop mix" },
  { videoId: "amTJUg8-AhI", title: "Summer Waves – Chillhop & Jazzhop" },
  { videoId: "LoUrZk9hI-o", title: "Aesthetic Lofi Beats – chill beats to study/relax to" },
  { videoId: "fg_R967cUBI", title: "Lofi chill – early morning study music" },
  { videoId: "sF80I-TQiW0", title: "90's Chill Lofi – study music with rain" },
  { videoId: "7TgS-e0mJaY", title: "Matcha Latte Lo-fi – chillhop for study & focus" },
  { videoId: "WeBYtv2Bv7c", title: "Matcha Morning Ritual – calm cafe lofi" },
  { videoId: "vL4AypJbhkE", title: "Chill Matcha Cat Lofi – study with me" },
  { videoId: "kJMRpId0H50", title: "Study with me (matcha) – lofi focus music" },
];

function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

export const DEFAULT_LOFI_TRACKS: Track[] = DEFAULT_LOFI_SEEDS.map((seed) => {
  const url = `https://www.youtube.com/watch?v=${seed.videoId}`;
  return {
    id: `youtube:${seed.videoId}`,
    title: seed.title,
    filename: seed.title,
    path: url,
    extension: "youtube",
    source: "youtube",
    url,
    videoId: seed.videoId,
    providerId: seed.videoId,
    providerKind: "video",
    thumbnail: youtubeThumbnailUrl(seed.videoId),
    category: "LOFI",
  };
});
