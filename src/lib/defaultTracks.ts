import type { Track } from "../types";

interface DefaultTrackSeed {
  videoId: string;
  title: string;
}

// Public YouTube lofi/chillhop tracks used as the starter library so a fresh
// install has something to press play on. These are standalone songs (not
// 24/7 livestreams) — live "radio" streams were removed because they break
// playback (no audio / stuck buffering) once the underlying live session
// rotates or ends. Verified via web search rather than guessed video IDs.
const DEFAULT_LOFI_SEEDS: DefaultTrackSeed[] = [
  { videoId: "kSxcTCxK91s", title: "Felty - Movement" },
  { videoId: "QEWV6fiYaDU", title: "dryhope - White Oak" },
  { videoId: "cZpHvdK4MWQ", title: "idealism - and then i woke up" },
  { videoId: "u8siIjPQzqU", title: "SwuM x idealism - forever in my mind" },
  { videoId: "8nFch8whXsA", title: "idealism - Watch Over" },
  { videoId: "CW4_apuEX9s", title: "Kupla - Apogee" },
  { videoId: "sM55hg006oI", title: "Jinsang - Never Know" },
  { videoId: "W1dDwh35APU", title: "Antimidas - Parkbench Epiphany" },
  { videoId: "O7cWSVzCEJo", title: "Swørn - Reflection" },
  { videoId: "ERkFW5-HALo", title: "psalm trees - Whales" },
  { videoId: "VSBW9ayq2aQ", title: "psalm trees - Forever Tired" },
  { videoId: "-X3SzCtyhU8", title: "No Spirit - Reminiscing" },
  { videoId: "gVOEJbwGJbE", title: "Ward Wills - When to Say Goodbye" },
  { videoId: "MXO8ftmr0PY", title: "L'indécis - Passage" },
  { videoId: "4tp9EBChzjI", title: "L'indécis - Underwater" },
  { videoId: "_B4tsd2eNHE", title: "L'indécis - Windmills In My Head" },
  { videoId: "Z8FJiPvHdx0", title: "Purrple Cat - Peace" },
  { videoId: "yDdcpsAuGRk", title: "Purrple Cat - Please Hold Me" },
  { videoId: "g4_FixM5oa0", title: "WYS - Satellite" },
  { videoId: "gS62leDULLY", title: "Aso - Dreamer" },
  { videoId: "Np14crvDDE8", title: "Aso - Summer Nights" },
  { videoId: "XgJJ1L2fti8", title: "Aso - Caught In The Rain" },
  { videoId: "xLrJnLA8CVA", title: "Aso - Packing My Bags" },
  { videoId: "kaqhBdUcpsQ", title: "Aviino - Utopia" },
  { videoId: "AfzLwM8iPPM", title: "Aviino - Fly High Newborn" },
  { videoId: "FQA5smIFFok", title: "Aviino - Lily" },
  { videoId: "yYZy0jrQomQ", title: "Aso x Aviino x Middle School - Canary Forest" },
  { videoId: "xxmT7hfpK9o", title: "Devin Kroes - There Is Growth Here" },
  { videoId: "AwXMsS3W6js", title: "Devin Kroes - Misty Peaks" },
  { videoId: "9BvlPg8vakQ", title: "potsu too - another.winn" },
  { videoId: "65j21FRDec4", title: "potsu too - i'm not ok" },
  { videoId: "7eMZMyr0GjE", title: "Mondo Loops - restful haze" },
  { videoId: "YOQAztMEFcA", title: "Mondo Loops - intricate" },
  { videoId: "oN8hAqNDf8I", title: "Hanz - On The Other Side" },
  { videoId: "X5awXYdrkuM", title: "Mama Aiuto - Today Feels Like Everyday" },
  { videoId: "cV6CmAq50lw", title: "Evil Needle - Sound Escapes" },
  { videoId: "Kq0i9wAnxFg", title: "lloom - In My Room" },
  { videoId: "psmel3hsKmE", title: "fantompower - On a Walk" },
];

// Standalone phonk tracks (not mixes/livestreams) used as the starter pack
// for the Energizing profile. Verified via web search rather than guessed
// video IDs.
const DEFAULT_PHONK_SEEDS: DefaultTrackSeed[] = [
  { videoId: "Fvh9yLWrpTY", title: "WAZ (DVRST) - Flight into space" },
  { videoId: "HE7ViC-n25g", title: "KORDHELL - MURDER IN MY MIND (Asphalt Remix)" },
  { videoId: "Kii1mdfiX3Y", title: "INTERWORLD - METAMORPHOSIS (Slowed + Reverb)" },
  { videoId: "EO3u4_cS470", title: "Panther Phonk - Summer Love" },
  { videoId: "Gxm1z0PYzCY", title: "CONTAGIVM - NOVA PHONK" },
  { videoId: "PTZgxW_3LIQ", title: "Dxrk ダーク - RAVE" },
  { videoId: "5LACYrvV6uU", title: "Dxrk ダーク - BONES" },
  { videoId: "MSOicpJrkoU", title: "Dxrk ダーク - SUCCUMB" },
  { videoId: "fFxprX9oEkU", title: "Dxrk ダーク x Kordhell - UNHOLY" },
  { videoId: "-3Tw6OZpZIo", title: "Dxrk ダーク x Moondeity - CURSED" },
  { videoId: "ikS1yi9MxFs", title: "Kaito Shoma - No Russian" },
  { videoId: "6cayt_NMH-Y", title: "Kaito Shoma - Revenge" },
  { videoId: "lG_arDqssXI", title: "Kaito Shoma - Junkie Scum" },
  { videoId: "ksf7x4h_3bQ", title: "Kaito Shoma - Force of Nature" },
  { videoId: "1zhk5pY-7PU", title: "PlayaPhonk - ABOMINATION OF VALHALLA" },
  { videoId: "GAUbYSFigI0", title: "PlayaPhonk - Army Tank" },
  { videoId: "3CjrrPsdOa0", title: "PlayaPhonk - REALM TO PARADISE" },
  { videoId: "ArTroJOtZM4", title: "PlayaPhonk - GODS OF EGYPT" },
];

function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

function buildTrack(seed: DefaultTrackSeed, category: string): Track {
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
    category,
  };
}

export const DEFAULT_LOFI_TRACKS: Track[] = DEFAULT_LOFI_SEEDS.map((seed) =>
  buildTrack(seed, "LOFI"),
);

export const DEFAULT_LOFI_TRACK_IDS: string[] = DEFAULT_LOFI_TRACKS.map(
  (track) => track.id,
);

export const DEFAULT_PHONK_TRACKS: Track[] = DEFAULT_PHONK_SEEDS.map((seed) =>
  buildTrack(seed, "PHONK"),
);

export const DEFAULT_PHONK_TRACK_IDS: string[] = DEFAULT_PHONK_TRACKS.map(
  (track) => track.id,
);

const PHONK_IDS_SET = new Set(DEFAULT_PHONK_TRACK_IDS);
const LOFI_IDS_SET = new Set(DEFAULT_LOFI_TRACK_IDS);

export function normalizeMusicSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ENERGETIC_CATEGORIES = new Set([
  "PHONK",
  "ROCK",
  "METAL",
  "PUNK",
  "HIPHOP",
  "RAP",
  "ENERGETIC",
]);

const ENERGETIC_ARTISTS_REGEX =
  /\b(zdechly\s*osa|zdechlyosa|limp\s*bizkit|limpbizkit|miekki\s*biszkopt|fred\s*durst|slipknot|rammstein|linkin\s*park|korn|system\s*of\s*a\s*down|soad|deftones|papa\s*roach|rage\s*against\s*the\s*machine|ratm|disturbed|marilyn\s*manson|avenged\s*sevenfold|a7x|bring\s*me\s*the\s*horizon|bmth|architects|nirvana|metallica|iron\s*maiden|ac\s*\/?\s*dc|green\s*day|blink\s*182|the\s*offspring|sum\s*41|prodigy|the\s*prodigy|pendulum|chase\s*(and|&)\s*status|skrillex|kordhell|dxrk|dvrst|interworld|playaphonk|kaito\s*shoma|memphis\s*cult|ghostemane|scarlxrd|suicideboys|pouya|bones|slon|wsrh|szpaku|oki|otsochodzi|young\s*multi|malik\s*montana|zabson|bedoes|white\s*2115|mata|kizo|pro8l3m|peja|slums\s*attack|hemp\s*gru|wwo|sokol|paluch|kali|keke|reto|guzior|kukon|gibbs|ronnie\s*ferrari|nocny\s*kochanek|hunter|behemoth|vader|decapitated|tsa|kat|illusion|sweet\s*noise|acid\s*drinkers|luxtorpeda|pidzama\s*porno|dezerter|ksu|farben\s*lehre|proletaryat|armia|siekiera|sedes|defekt\s*muzgo)\b/i;

const ENERGETIC_KEYWORDS_REGEX =
  /\b(phonk|rave|drift|hardstyle|gym|workout|bass|trap|metal|rock|hyperpop|nightcore|dnb|drum\s*and\s*bass|drum\s*bass|dubstep|electro|electronic\s*rock|energetic|energy|intense|pump|punk|nu\s*metal|numetal|rapcore|hardcore|post\s*hardcore|deathcore|metalcore|heavy\s*metal|thrash|grunge|screamo|drill|bassboost|bass\s*boost|speedup|speed\s*up|techno|gabber|breakcore|jumpstyle|edm|industrial|aggressive|rage|hype|banger|party|club|power|fast|dynamic|upbeat|moshpit|pogo|rap|hip\s*hop|hiphop|distort)\b/i;

const CHILL_CATEGORIES = new Set([
  "LOFI",
  "AMBIENT",
  "CLASSICAL",
  "JAZZ",
  "NATURE",
  "SLEEP",
  "FOCUS",
]);

const CHILL_KEYWORDS_REGEX =
  /\b(lofi|lo\s*fi|chill|chillhop|chillout|ambient|relax|calm|peaceful|meditation|sleep|sleeping|nature|soft|acoustic|piano|slowed|reverb|rain|waves|breeze|coffee|cozy|study|studying|focus|calm\s*piano|meditative|soothing|zen|mellow|downtempo)\b/i;

const CHILL_ARTISTS_REGEX =
  /\b(purrple\s*cat|idealism|jinsang|kupla|l\s*indecis|lindecis|aso|aviino|devin\s*kroes|potsu|mondo\s*loops|swum|sworn|psalm\s*trees|no\s*spirit|ward\s*wills|fantompower|mama\s*aiuto|evil\s*needle|lloom|dryhope|felty|hanz)\b/i;

export function isPhonkTrack(track: Track): boolean {
  if (PHONK_IDS_SET.has(track.id)) return true;
  const category = (track.category ?? "").toUpperCase();
  if (category === "PHONK") return true;
  const normalized = normalizeMusicSearchText(
    `${track.title} ${track.filename} ${track.author ?? ""}`,
  );
  return (
    normalized.includes("phonk") ||
    /\b(kordhell|dxrk|dvrst|interworld|playaphonk|kaito\s*shoma|memphis\s*cult)\b/i.test(
      normalized,
    )
  );
}

export function isEnergeticTrack(track: Track): boolean {
  if (isPhonkTrack(track)) return true;
  const category = (track.category ?? "").toUpperCase();
  if (ENERGETIC_CATEGORIES.has(category)) return true;
  const normalized = normalizeMusicSearchText(
    `${track.title} ${track.filename} ${track.author ?? ""}`,
  );
  if (ENERGETIC_ARTISTS_REGEX.test(normalized)) return true;
  if (ENERGETIC_KEYWORDS_REGEX.test(normalized)) return true;
  return false;
}

export function isChillTrack(track: Track): boolean {
  if (LOFI_IDS_SET.has(track.id)) return true;
  // If it's energetic or phonk, it can NEVER be chill!
  if (isEnergeticTrack(track)) return false;

  const category = (track.category ?? "").toUpperCase();
  if (CHILL_CATEGORIES.has(category)) return true;

  const normalized = normalizeMusicSearchText(
    `${track.title} ${track.filename} ${track.author ?? ""}`,
  );
  if (CHILL_ARTISTS_REGEX.test(normalized)) return true;
  if (CHILL_KEYWORDS_REGEX.test(normalized)) return true;

  // Unknown or unclassified tracks MUST NOT default to chill!
  return false;
}
