import { beforeEach, describe, expect, it } from "vitest";
import {
  addCustomProfile,
  assignTracksToProfile,
  createDefaultProfileStore,
  deleteCustomProfile,
  getProfileFavoriteIds,
  getProfileTrackIds,
  loadProfileStore,
  reconcileProfileTracks,
  saveProfileStore,
  setActiveProfile,
  toggleProfileFavorite,
} from "./profiles";

describe("profile storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with Deep Work active and Energizing available", () => {
    const store = createDefaultProfileStore();

    expect(store.activeProfileId).toBe("deep-work");
    expect(store.profiles.map((profile) => profile.name)).toEqual([
      "Deep Work",
      "Energizing",
    ]);
  });

  it("migrates legacy tracks and favorites into Deep Work once", () => {
    localStorage.setItem(
      "focusflow.favorites",
      JSON.stringify(["track-1", "track-1", "missing"]),
    );

    const migrated = reconcileProfileTracks(
      createDefaultProfileStore(),
      ["track-1", "track-2"],
    );

    expect(migrated.migrationComplete).toBe(true);
    expect(getProfileTrackIds(migrated, "deep-work")).toEqual([
      "track-1",
      "track-2",
    ]);
    expect(getProfileFavoriteIds(migrated, "deep-work")).toEqual([
      "track-1",
      "missing",
    ]);
  });

  it("persists normalized profile state", () => {
    const first = addCustomProfile(createDefaultProfileStore(), "Exam sprint");
    expect(first.profile).not.toBeNull();
    saveProfileStore(first.store);

    const restored = loadProfileStore();
    expect(restored.profiles[restored.profiles.length - 1]?.name).toBe(
      "Exam sprint",
    );
    expect(restored.activeProfileId).toBe("deep-work");
  });

  it("keeps membership and favorites scoped to a profile", () => {
    const custom = addCustomProfile(
      createDefaultProfileStore(),
      "Writing",
    ).store;
    const writing = custom.profiles.find((profile) => profile.name === "Writing");
    expect(writing).toBeDefined();

    const withTracks = assignTracksToProfile(custom, writing!.id, ["track-1"]);
    const withFavorite = toggleProfileFavorite(withTracks, writing!.id, "track-1");
    const deepWork = setActiveProfile(withFavorite, "deep-work");

    expect(getProfileTrackIds(withFavorite, writing!.id)).toEqual(["track-1"]);
    expect(getProfileFavoriteIds(withFavorite, writing!.id)).toEqual(["track-1"]);
    expect(getProfileTrackIds(deepWork)).toEqual([]);
    expect(getProfileFavoriteIds(deepWork)).toEqual([]);
  });

  it("returns to Deep Work when an active custom profile is deleted", () => {
    const custom = addCustomProfile(createDefaultProfileStore(), "Planning");
    const active = setActiveProfile(custom.store, custom.profile!.id);
    const deleted = deleteCustomProfile(active, custom.profile!.id);

    expect(deleted.activeProfileId).toBe("deep-work");
    expect(deleted.profiles.some((profile) => profile.name === "Planning")).toBe(
      false,
    );
  });
});
