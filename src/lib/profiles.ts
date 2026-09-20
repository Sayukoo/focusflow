export type ProfileTheme = "deep" | "energizing";
export type ProfileKind = "builtin" | "custom";

export interface MusicProfile {
  id: string;
  name: string;
  kind: ProfileKind;
  theme: ProfileTheme;
}

export interface ProfileStore {
  version: 1;
  profiles: MusicProfile[];
  activeProfileId: string;
  trackIdsByProfile: Record<string, string[]>;
  favoriteIdsByProfile: Record<string, string[]>;
  userProfileOverrides?: Record<string, string>;
  migrationComplete: boolean;
}

export const BUILT_IN_PROFILES: MusicProfile[] = [
  {
    id: "deep-work",
    name: "Deep Work",
    kind: "builtin",
    theme: "deep",
  },
  {
    id: "energizing",
    name: "Energizing",
    kind: "builtin",
    theme: "energizing",
  },
];

const PROFILE_STORAGE_KEY = "focusflow.profiles";
const LEGACY_FAVORITES_KEY = "focusflow.favorites";

export function createDefaultProfileStore(): ProfileStore {
  return {
    version: 1,
    profiles: BUILT_IN_PROFILES.map((profile) => ({ ...profile })),
    activeProfileId: "deep-work",
    trackIdsByProfile: {
      "deep-work": [],
      energizing: [],
    },
    favoriteIdsByProfile: {
      "deep-work": [],
      energizing: [],
    },
    userProfileOverrides: {},
    migrationComplete: false,
  };
}

export function loadProfileStore(): ProfileStore {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultProfileStore();
    return normalizeProfileStore(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultProfileStore();
  }
}

export function saveProfileStore(store: ProfileStore): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage can be unavailable in a restricted browser context.
  }
}

export function reconcileProfileTracks(
  store: ProfileStore,
  trackIds: string[],
  defaultProfileByTrackId: Record<string, string> = {},
): ProfileStore {
  const next = cloneProfileStore(store);
  const knownIds = unique(trackIds);

  const resolveTargetProfileId = (trackId: string): string | null => {
    // User manual override has absolute precedence!
    const override = next.userProfileOverrides?.[trackId];
    if (override && next.profiles.some((p) => p.id === override)) {
      return override;
    }
    const candidate = defaultProfileByTrackId[trackId];
    return candidate && next.profiles.some((profile) => profile.id === candidate)
      ? candidate
      : null;
  };

  // Combine default assignments with user overrides (overrides win!)
  const effectiveTargets: Record<string, string> = { ...defaultProfileByTrackId };
  if (next.userProfileOverrides) {
    for (const [trackId, profileId] of Object.entries(next.userProfileOverrides)) {
      effectiveTargets[trackId] = profileId;
    }
  }

  // Enforce explicit profile assignments and purge cross-contamination
  for (const [trackId, targetProfileId] of Object.entries(effectiveTargets)) {
    if (!next.profiles.some((p) => p.id === targetProfileId)) continue;
    if (!knownIds.includes(trackId)) continue;

    next.trackIdsByProfile[targetProfileId] = unique([
      ...(next.trackIdsByProfile[targetProfileId] ?? []),
      trackId,
    ]);

    // Ensure it is removed from the opposite profile so phonk/chill never leak
    const conflictingProfileId =
      targetProfileId === "deep-work" ? "energizing" : "deep-work";
    if (next.trackIdsByProfile[conflictingProfileId]) {
      next.trackIdsByProfile[conflictingProfileId] = (
        next.trackIdsByProfile[conflictingProfileId] ?? []
      ).filter((id) => id !== trackId);
    }
  }

  if (!next.migrationComplete) {
    const alreadyAssigned = new Set(
      Object.values(next.trackIdsByProfile).flatMap((ids) => ids),
    );
    for (const trackId of knownIds) {
      if (alreadyAssigned.has(trackId)) continue;
      const targetProfileId = resolveTargetProfileId(trackId) ?? "deep-work";
      next.trackIdsByProfile[targetProfileId] = unique([
        ...(next.trackIdsByProfile[targetProfileId] ?? []),
        trackId,
      ]);
    }
    next.favoriteIdsByProfile["deep-work"] = unique([
      ...(next.favoriteIdsByProfile["deep-work"] ?? []),
      ...loadLegacyFavoriteIds(),
    ]);
    next.migrationComplete = true;
    return next;
  }

  const assigned = new Set(
    Object.values(next.trackIdsByProfile).flatMap((ids) => ids),
  );
  const unassigned = knownIds.filter((id) => !assigned.has(id));
  for (const trackId of unassigned) {
    const targetProfileId = resolveTargetProfileId(trackId) ?? next.activeProfileId;
    next.trackIdsByProfile[targetProfileId] = unique([
      ...(next.trackIdsByProfile[targetProfileId] ?? []),
      trackId,
    ]);
  }

  return next;
}

export function moveTrackToProfile(
  store: ProfileStore,
  trackId: string,
  targetProfileId: string,
): ProfileStore {
  if (!store.profiles.some((p) => p.id === targetProfileId)) return store;
  const next = cloneProfileStore(store);

  // Remove from all other profiles
  for (const profileId of Object.keys(next.trackIdsByProfile)) {
    if (profileId !== targetProfileId) {
      next.trackIdsByProfile[profileId] = (
        next.trackIdsByProfile[profileId] ?? []
      ).filter((id) => id !== trackId);
    }
  }

  // Add to target profile if not already there
  if (!(next.trackIdsByProfile[targetProfileId] ?? []).includes(trackId)) {
    next.trackIdsByProfile[targetProfileId] = [
      ...(next.trackIdsByProfile[targetProfileId] ?? []),
      trackId,
    ];
  }

  // Record user override so future reconcileProfileTracks does not overwrite it
  next.userProfileOverrides = {
    ...(next.userProfileOverrides ?? {}),
    [trackId]: targetProfileId,
  };

  return next;
}

export function reorderProfileTracks(
  store: ProfileStore,
  profileId: string,
  sourceIndex: number,
  destinationIndex: number,
): ProfileStore {
  const current = [...(store.trackIdsByProfile[profileId] ?? [])];
  if (
    sourceIndex < 0 ||
    sourceIndex >= current.length ||
    destinationIndex < 0 ||
    destinationIndex >= current.length ||
    sourceIndex === destinationIndex
  ) {
    return store;
  }

  const next = cloneProfileStore(store);
  const [item] = current.splice(sourceIndex, 1);
  current.splice(destinationIndex, 0, item);
  next.trackIdsByProfile[profileId] = current;
  return next;
}


export function assignTracksToProfile(
  store: ProfileStore,
  profileId: string,
  trackIds: string[],
): ProfileStore {
  if (!store.profiles.some((profile) => profile.id === profileId)) return store;
  const next = cloneProfileStore(store);
  next.trackIdsByProfile[profileId] = unique([
    ...(next.trackIdsByProfile[profileId] ?? []),
    ...trackIds,
  ]);
  return next;
}

export function removeTracksFromProfiles(
  store: ProfileStore,
  trackIds: string[],
): ProfileStore {
  const ids = new Set(trackIds);
  const next = cloneProfileStore(store);
  for (const profileId of Object.keys(next.trackIdsByProfile)) {
    next.trackIdsByProfile[profileId] = (
      next.trackIdsByProfile[profileId] ?? []
    ).filter((trackId) => !ids.has(trackId));
    next.favoriteIdsByProfile[profileId] = (
      next.favoriteIdsByProfile[profileId] ?? []
    ).filter((trackId) => !ids.has(trackId));
  }
  return next;
}

export function removeTracksFromProfile(
  store: ProfileStore,
  profileId: string,
  trackIds: string[],
): ProfileStore {
  const ids = new Set(trackIds);
  const next = cloneProfileStore(store);
  next.trackIdsByProfile[profileId] = (
    next.trackIdsByProfile[profileId] ?? []
  ).filter((trackId) => !ids.has(trackId));
  next.favoriteIdsByProfile[profileId] = (
    next.favoriteIdsByProfile[profileId] ?? []
  ).filter((trackId) => !ids.has(trackId));
  return next;
}

export function isTrackSharedWithAnotherProfile(
  store: ProfileStore,
  profileId: string,
  trackId: string,
): boolean {
  return Object.entries(store.trackIdsByProfile).some(
    ([candidateProfileId, trackIds]) =>
      candidateProfileId !== profileId && trackIds.includes(trackId),
  );
}

export function setActiveProfile(
  store: ProfileStore,
  profileId: string,
): ProfileStore {
  if (!store.profiles.some((profile) => profile.id === profileId)) return store;
  const next = cloneProfileStore(store);
  next.activeProfileId = profileId;
  return next;
}

export function addCustomProfile(
  store: ProfileStore,
  name: string,
): { store: ProfileStore; profile: MusicProfile | null } {
  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!cleanName) return { store, profile: null };

  const id = `profile-${slugify(cleanName)}-${Date.now().toString(36)}`;
  const profile: MusicProfile = {
    id,
    name: cleanName,
    kind: "custom",
    theme: "deep",
  };
  const next = cloneProfileStore(store);
  next.profiles.push(profile);
  next.trackIdsByProfile[id] = [];
  next.favoriteIdsByProfile[id] = [];
  return { store: next, profile };
}

export function deleteCustomProfile(
  store: ProfileStore,
  profileId: string,
): ProfileStore {
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile || profile.kind !== "custom") return store;

  const next = cloneProfileStore(store);
  next.profiles = next.profiles.filter((item) => item.id !== profileId);
  delete next.trackIdsByProfile[profileId];
  delete next.favoriteIdsByProfile[profileId];
  if (next.activeProfileId === profileId) {
    next.activeProfileId = "deep-work";
  }
  return next;
}

export function toggleProfileFavorite(
  store: ProfileStore,
  profileId: string,
  trackId: string,
): ProfileStore {
  const next = cloneProfileStore(store);
  const current = next.favoriteIdsByProfile[profileId] ?? [];
  next.favoriteIdsByProfile[profileId] = current.includes(trackId)
    ? current.filter((id) => id !== trackId)
    : [...current, trackId];
  return next;
}

export function getProfileTrackIds(
  store: ProfileStore,
  profileId = store.activeProfileId,
): string[] {
  return store.trackIdsByProfile[profileId] ?? [];
}

export function getProfileFavoriteIds(
  store: ProfileStore,
  profileId = store.activeProfileId,
): string[] {
  return store.favoriteIdsByProfile[profileId] ?? [];
}

function normalizeProfileStore(value: unknown): ProfileStore {
  const fallback = createDefaultProfileStore();
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<ProfileStore>;
  const customProfiles = Array.isArray(candidate.profiles)
    ? candidate.profiles.filter(isValidProfile)
    : [];
  const profiles = uniqueProfiles([
    ...BUILT_IN_PROFILES,
    ...customProfiles.filter(
      (profile) => !BUILT_IN_PROFILES.some((item) => item.id === profile.id),
    ),
  ]);

  const trackIdsByProfile = normalizeMap(candidate.trackIdsByProfile, profiles);
  const favoriteIdsByProfile = normalizeMap(
    candidate.favoriteIdsByProfile,
    profiles,
  );
  const activeProfileId =
    typeof candidate.activeProfileId === "string" &&
    profiles.some((profile) => profile.id === candidate.activeProfileId)
      ? candidate.activeProfileId
      : fallback.activeProfileId;

  const userProfileOverrides =
    candidate.userProfileOverrides &&
    typeof candidate.userProfileOverrides === "object"
      ? Object.fromEntries(
          Object.entries(candidate.userProfileOverrides).filter(
            ([trackId, profileId]) =>
              typeof trackId === "string" &&
              typeof profileId === "string" &&
              profiles.some((p) => p.id === profileId),
          ),
        )
      : {};

  return {
    version: 1,
    profiles,
    activeProfileId,
    trackIdsByProfile,
    favoriteIdsByProfile,
    userProfileOverrides,
    migrationComplete: candidate.migrationComplete === true,
  };
}

function normalizeMap(
  value: unknown,
  profiles: MusicProfile[],
): Record<string, string[]> {
  const candidate =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    profiles.map((profile) => {
      const rawIds = candidate[profile.id];
      return [
        profile.id,
        Array.isArray(rawIds)
          ? unique(
              rawIds.filter(
                (trackId): trackId is string => typeof trackId === "string",
              ),
            )
          : [],
      ];
    }),
  );
}

function isValidProfile(value: unknown): value is MusicProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<MusicProfile>;
  return (
    typeof profile.id === "string" &&
    typeof profile.name === "string" &&
    profile.kind === "custom" &&
    (profile.theme === "deep" || profile.theme === "energizing")
  );
}

function uniqueProfiles(profiles: MusicProfile[]): MusicProfile[] {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
}

function cloneProfileStore(store: ProfileStore): ProfileStore {
  return {
    version: 1,
    profiles: store.profiles.map((profile) => ({ ...profile })),
    activeProfileId: store.activeProfileId,
    trackIdsByProfile: Object.fromEntries(
      Object.entries(store.trackIdsByProfile).map(([id, ids]) => [id, [...ids]]),
    ),
    favoriteIdsByProfile: Object.fromEntries(
      Object.entries(store.favoriteIdsByProfile).map(([id, ids]) => [
        id,
        [...ids],
      ]),
    ),
    userProfileOverrides: { ...(store.userProfileOverrides ?? {}) },
    migrationComplete: store.migrationComplete,
  };
}

function loadLegacyFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(LEGACY_FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? unique(parsed.filter((id): id is string => typeof id === "string"))
      : [];
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "custom"
  );
}
