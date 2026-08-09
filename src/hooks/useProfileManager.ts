import { useCallback, useRef, useState } from "react";
import {
  addCustomProfile,
  deleteCustomProfile,
  getProfileFavoriteIds,
  loadProfileStore,
  saveProfileStore,
  setActiveProfile,
  toggleProfileFavorite,
  type ProfileStore,
} from "../lib/profiles";

function profileMapsEqual(
  left: Record<string, string[]>,
  right: Record<string, string[]>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    if (!(key in right)) return false;
    const leftValues = left[key] ?? [];
    const rightValues = right[key] ?? [];
    return (
      leftValues.length === rightValues.length &&
      leftValues.every((value, index) => value === rightValues[index])
    );
  });
}

function profileStoresEqual(left: ProfileStore, right: ProfileStore): boolean {
  if (
    left.activeProfileId !== right.activeProfileId ||
    left.migrationComplete !== right.migrationComplete ||
    left.profiles.length !== right.profiles.length
  ) {
    return false;
  }

  for (let index = 0; index < left.profiles.length; index += 1) {
    const a = left.profiles[index];
    const b = right.profiles[index];
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.kind !== b.kind ||
      a.theme !== b.theme
    ) {
      return false;
    }
  }

  return (
    profileMapsEqual(left.trackIdsByProfile, right.trackIdsByProfile) &&
    profileMapsEqual(left.favoriteIdsByProfile, right.favoriteIdsByProfile)
  );
}

export function useProfileManager() {
  const [profileStore, setProfileStore] = useState<ProfileStore>(() =>
    loadProfileStore(),
  );
  const profileStoreRef = useRef<ProfileStore>(profileStore);
  const activeProfileIdRef = useRef(profileStore.activeProfileId);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState<string[]>(() =>
    getProfileFavoriteIds(profileStore),
  );
  const favoriteTrackIdsRef = useRef<string[]>(favoriteTrackIds);

  const commitProfileStore = useCallback((next: ProfileStore) => {
    if (profileStoresEqual(profileStoreRef.current, next)) return;
    profileStoreRef.current = next;
    activeProfileIdRef.current = next.activeProfileId;
    setProfileStore(next);
    const favorites = getProfileFavoriteIds(next);
    setFavoriteTrackIds(favorites);
    favoriteTrackIdsRef.current = favorites;
    saveProfileStore(next);
  }, []);

  const selectProfile = useCallback(
    (profileId: string) => {
      const next = setActiveProfile(profileStoreRef.current, profileId);
      commitProfileStore(next);
    },
    [commitProfileStore],
  );

  const createProfile = useCallback(
    (name: string) => {
      const result = addCustomProfile(profileStoreRef.current, name);
      commitProfileStore(result.store);
    },
    [commitProfileStore],
  );

  const deleteProfile = useCallback(
    (profileId: string) => {
      const next = deleteCustomProfile(profileStoreRef.current, profileId);
      commitProfileStore(next);
    },
    [commitProfileStore],
  );

  const toggleFavorite = useCallback(
    (trackId: string) => {
      const next = toggleProfileFavorite(
        profileStoreRef.current,
        activeProfileIdRef.current,
        trackId,
      );
      commitProfileStore(next);
    },
    [commitProfileStore],
  );

  return {
    profileStore,
    profileStoreRef,
    activeProfileIdRef,
    favoriteTrackIds,
    favoriteTrackIdsRef,
    commitProfileStore,
    selectProfile,
    createProfile,
    deleteProfile,
    toggleFavorite,
  };
}
