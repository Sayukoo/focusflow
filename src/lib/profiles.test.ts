import { beforeEach, describe, expect, it } from "vitest";
import {
  addCustomProfile,
  assignTracksToProfile,
  createDefaultProfileStore,
  deleteCustomProfile,
  getProfileFavoriteIds,
  getProfileTrackIds,
  isTrackSharedWithAnotherProfile,
  loadProfileStore,
  moveTrackToProfile,
  reconcileProfileTracks,
  reorderProfileTracks,
  saveProfileStore,
  setActiveProfile,
  toggleProfileFavorite,
} from "./profiles";
import type { Track } from "../types";

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

  it("detects tracks shared with another profile", () => {
    const custom = addCustomProfile(
      createDefaultProfileStore(),
      "Writing",
    ).store;
    const writing = custom.profiles.find((profile) => profile.name === "Writing");
    const withDeepWorkTrack = assignTracksToProfile(custom, "deep-work", [
      "track-1",
    ]);
    const shared = assignTracksToProfile(
      withDeepWorkTrack,
      writing!.id,
      ["track-1"],
    );

    expect(isTrackSharedWithAnotherProfile(shared, "deep-work", "track-1")).toBe(
      true,
    );
    expect(isTrackSharedWithAnotherProfile(shared, writing!.id, "track-1")).toBe(
      true,
    );
    expect(isTrackSharedWithAnotherProfile(shared, "deep-work", "track-2")).toBe(
      false,
    );
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

  it("strictly enforces phonk in energizing and purges it from deep-work", () => {
    // Simulate a store where phonk track was accidentally in deep-work
    const store = createDefaultProfileStore();
    store.migrationComplete = true;
    store.trackIdsByProfile["deep-work"] = ["lofi-1", "phonk-1"];
    store.trackIdsByProfile["energizing"] = [];

    const reconciled = reconcileProfileTracks(
      store,
      ["lofi-1", "phonk-1"],
      { "phonk-1": "energizing", "lofi-1": "deep-work" },
    );

    expect(getProfileTrackIds(reconciled, "deep-work")).toEqual(["lofi-1"]);
    expect(getProfileTrackIds(reconciled, "energizing")).toEqual(["phonk-1"]);
  });

  it("identifies phonk as energetic and never chill", async () => {
    const { isPhonkTrack, isEnergeticTrack, isChillTrack } = await import(
      "./defaultTracks"
    );

    const phonkTrack: Track = {
      id: "youtube:phonk-123",
      title: "KORDHELL - Murder In My Mind",
      filename: "murder.mp3",
      path: "https://youtube.com/watch?v=phonk-123",
      extension: "youtube",
      source: "youtube",
      category: "PHONK",
    };

    const lofiTrack: Track = {
      id: "youtube:lofi-123",
      title: "Kupla - Apogee",
      filename: "apogee.mp3",
      path: "https://youtube.com/watch?v=lofi-123",
      extension: "youtube",
      source: "youtube",
      category: "LOFI",
    };

    expect(isPhonkTrack(phonkTrack)).toBe(true);
    expect(isEnergeticTrack(phonkTrack)).toBe(true);
    expect(isChillTrack(phonkTrack)).toBe(false);

    expect(isPhonkTrack(lofiTrack)).toBe(false);
    expect(isEnergeticTrack(lofiTrack)).toBe(false);
    expect(isChillTrack(lofiTrack)).toBe(true);
  });

  it("classifies Zdechły Osa, Limp Bizkit and Miękki Biszkopt as energetic and never chill", async () => {
    const { isEnergeticTrack, isChillTrack } = await import("./defaultTracks");

    const zdechlyOsaTrack: Track = {
      id: "youtube:osa-1",
      title: "Zdechły Osa - Patolove",
      filename: "patolove.mp3",
      path: "https://youtube.com/watch?v=osa-1",
      extension: "youtube",
      source: "youtube",
    };

    const limpBizkitTrack: Track = {
      id: "youtube:lb-1",
      title: "Limp Bizkit - Break Stuff",
      filename: "break-stuff.mp3",
      path: "https://youtube.com/watch?v=lb-1",
      extension: "youtube",
      source: "youtube",
    };

    const miekkiBiszkoptTrack: Track = {
      id: "youtube:mb-1",
      title: "Miękki Biszkopt - Rollin",
      filename: "rollin.mp3",
      path: "https://youtube.com/watch?v=mb-1",
      extension: "youtube",
      source: "youtube",
    };

    const punkTrack: Track = {
      id: "youtube:punk-1",
      title: "Dezerter - Ku Przyszłości",
      filename: "dezerter.mp3",
      path: "https://youtube.com/watch?v=punk-1",
      extension: "youtube",
      source: "youtube",
      category: "PUNK",
    };

    const neutralTrack: Track = {
      id: "file:podcast-1",
      title: "Episode 42: History Talk",
      filename: "ep42.mp3",
      path: "C:\\podcast\\ep42.mp3",
      extension: "mp3",
    };

    // All energetic tracks must be identified as energetic
    expect(isEnergeticTrack(zdechlyOsaTrack)).toBe(true);
    expect(isChillTrack(zdechlyOsaTrack)).toBe(false);

    expect(isEnergeticTrack(limpBizkitTrack)).toBe(true);
    expect(isChillTrack(limpBizkitTrack)).toBe(false);

    expect(isEnergeticTrack(miekkiBiszkoptTrack)).toBe(true);
    expect(isChillTrack(miekkiBiszkoptTrack)).toBe(false);

    expect(isEnergeticTrack(punkTrack)).toBe(true);
    expect(isChillTrack(punkTrack)).toBe(false);

    // Neutral track should not blindly default to chill
    expect(isChillTrack(neutralTrack)).toBe(false);
    expect(isEnergeticTrack(neutralTrack)).toBe(false);
  });

  it("moves track to target profile, purges from other profiles, and persists override", () => {
    const store = createDefaultProfileStore();
    store.trackIdsByProfile["deep-work"] = ["track-1", "track-2"];
    store.trackIdsByProfile["energizing"] = ["track-3"];

    const moved = moveTrackToProfile(store, "track-1", "energizing");

    expect(getProfileTrackIds(moved, "deep-work")).toEqual(["track-2"]);
    expect(getProfileTrackIds(moved, "energizing")).toEqual(["track-3", "track-1"]);
    expect(moved.userProfileOverrides?.["track-1"]).toBe("energizing");

    // Reconcile must respect the user's manual override even if default heuristic says deep-work
    const reconciled = reconcileProfileTracks(
      moved,
      ["track-1", "track-2", "track-3"],
      { "track-1": "deep-work", "track-2": "deep-work", "track-3": "energizing" },
    );

    expect(getProfileTrackIds(reconciled, "deep-work")).toEqual(["track-2"]);
    expect(getProfileTrackIds(reconciled, "energizing")).toEqual(["track-3", "track-1"]);
  });

  it("reorders tracks within a profile", () => {
    const store = createDefaultProfileStore();
    store.trackIdsByProfile["deep-work"] = ["track-a", "track-b", "track-c"];

    // Move track-c to the top (index 2 to index 0)
    const reordered = reorderProfileTracks(store, "deep-work", 2, 0);
    expect(getProfileTrackIds(reordered, "deep-work")).toEqual([
      "track-c",
      "track-a",
      "track-b",
    ]);

    // Move track-c down (index 0 to index 1)
    const reordered2 = reorderProfileTracks(reordered, "deep-work", 0, 1);
    expect(getProfileTrackIds(reordered2, "deep-work")).toEqual([
      "track-a",
      "track-c",
      "track-b",
    ]);
  });
});

