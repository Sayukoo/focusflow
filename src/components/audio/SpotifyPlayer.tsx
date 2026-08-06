import { useEffect, useRef } from "react";
import type { Track } from "../../types";

interface SpotifyPlayerProps {
  track: Track | null;
  playing: boolean;
  volume: number;
  seekRequest: { value: number; token: number } | null;
  onTime: (value: number) => void;
  onDuration: (value: number) => void;
  onPlaying: (playing: boolean) => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

interface SpotifyPlaybackEvent {
  data?: {
    duration?: number;
    isPaused?: boolean;
    position?: number;
  };
}

interface SpotifyEmbedController {
  addListener: (
    event: string,
    callback: (event: SpotifyPlaybackEvent) => void,
  ) => void;
  pause: () => void | Promise<void>;
  play: () => void | Promise<void>;
  seek: (seconds: number) => void | Promise<void>;
}

interface SpotifyIframeApi {
  createController: (
    element: HTMLElement,
    options: {
      height: number | string;
      url: string;
      width: number | string;
    },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  }
}

let spotifyApiPromise: Promise<SpotifyIframeApi> | null = null;
let spotifyApi: SpotifyIframeApi | null = null;

export function SpotifyPlayer({
  track,
  playing,
  volume: _volume,
  seekRequest,
  onTime,
  onDuration,
  onPlaying,
  onEnded,
  onError,
}: SpotifyPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const lastSeekTokenRef = useRef<number | null>(null);
  const playbackRef = useRef(playing);
  const callbacksRef = useRef({
    onDuration,
    onEnded,
    onError,
    onPlaying,
    onTime,
  });

  playbackRef.current = playing;
  callbacksRef.current = {
    onDuration,
    onEnded,
    onError,
    onPlaying,
    onTime,
  };

  useEffect(() => {
    if (!track?.url || !hostRef.current) {
      controllerRef.current = null;
      return;
    }

    let disposed = false;
    const host = hostRef.current;
    host.replaceChildren();
    controllerRef.current = null;
    lastSeekTokenRef.current = null;
    const embedHeight =
      track.providerKind === "playlist" || track.providerKind === "album"
        ? 352
        : 80;
    appendSpotifyFallback(host, track, embedHeight);

    void loadSpotifyApi()
      .then((api) => {
        if (disposed || !hostRef.current) return;

        api.createController(
          hostRef.current,
          {
            height: embedHeight,
            url: track.url!,
            width: "100%",
          },
          (controller) => {
            if (disposed) return;
            controllerRef.current = controller;
            controller.addListener("playback_update", (event) => {
              const data = event.data ?? {};
              const duration = millisecondsToSeconds(data.duration ?? 0);
              const position = millisecondsToSeconds(data.position ?? 0);
              if (duration > 0) {
                callbacksRef.current.onDuration(duration);
                callbacksRef.current.onTime(Math.min(position, duration));
              }

              if (typeof data.isPaused === "boolean") {
                callbacksRef.current.onPlaying(!data.isPaused);
              }
            });

            if (playbackRef.current) {
              void Promise.resolve(controller.play()).catch((error: unknown) => {
                callbacksRef.current.onError(
                  error instanceof Error ? error.message : String(error),
                );
              });
            }
          },
        );
      })
      .catch((error: unknown) => {
        if (!host.querySelector("iframe")) {
          callbacksRef.current.onError(
            error instanceof Error ? error.message : String(error),
          );
        }
      });

    return () => {
      disposed = true;
      controllerRef.current = null;
      host.replaceChildren();
    };
  }, [track?.id]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const action = playing ? controller.play() : controller.pause();
    void Promise.resolve(action).catch((error: unknown) => {
      callbacksRef.current.onError(
        error instanceof Error ? error.message : String(error),
      );
    });
  }, [playing]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !seekRequest || seekRequest.token === lastSeekTokenRef.current) {
      return;
    }
    lastSeekTokenRef.current = seekRequest.token;
    void Promise.resolve(controller.seek(seekRequest.value)).catch((error: unknown) => {
      callbacksRef.current.onError(
        error instanceof Error ? error.message : String(error),
      );
    });
  }, [seekRequest]);

  return (
    <div
      ref={hostRef}
      className={
        track?.providerKind === "playlist" || track?.providerKind === "album"
          ? "remote-player-host remote-player-host--spotify remote-player-host--spotify-playlist"
          : "remote-player-host remote-player-host--spotify"
      }
    />
  );
}

function millisecondsToSeconds(value: number): number {
  return Math.max(0, value) / 1000;
}

function appendSpotifyFallback(
  host: HTMLElement,
  track: Track,
  height: number,
): void {
  if (!track.providerKind || !track.providerId) return;
  const iframe = document.createElement("iframe");
  iframe.title = "Spotify player";
  iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
  iframe.loading = "lazy";
  iframe.height = String(height);
  iframe.width = "100%";
  iframe.frameBorder = "0";
  iframe.src = `https://open.spotify.com/embed/${track.providerKind}/${encodeURIComponent(track.providerId)}?utm_source=generator`;
  host.appendChild(iframe);
}

function loadSpotifyApi(): Promise<SpotifyIframeApi> {
  if (spotifyApi) return Promise.resolve(spotifyApi);
  if (spotifyApiPromise) return spotifyApiPromise;

  spotifyApiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[src="https://open.spotify.com/embed/iframe-api/v1"]',
    );
    const previousReady = window.onSpotifyIframeApiReady;

    window.onSpotifyIframeApiReady = (api) => {
      previousReady?.(api);
      spotifyApi = api;
      resolve(api);
    };

    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onerror = () =>
      reject(new Error("Could not load the Spotify player."));
    document.head.appendChild(script);
  });

  return spotifyApiPromise;
}
