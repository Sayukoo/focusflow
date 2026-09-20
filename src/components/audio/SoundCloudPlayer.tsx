import { useEffect, useRef } from "react";
import type { RemoteTrackInfo, Track } from "../../types";

interface SoundCloudPlayerProps {
  track: Track | null;
  playing: boolean;
  volume: number;
  seekRequest: { value: number; token: number } | null;
  onTime: (value: number) => void;
  onDuration: (value: number) => void;
  onPlaying: (playing: boolean) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onTrackChange?: (info: RemoteTrackInfo) => void;
}

interface SoundCloudProgressEvent {
  currentPosition?: number;
}

interface SoundCloudWidget {
  bind: (
    event: string,
    callback: (event?: SoundCloudProgressEvent) => void,
  ) => void;
  getDuration: (callback: (duration: number) => void) => void;
  pause: () => void;
  play: () => void;
  seekTo: (milliseconds: number) => void;
  setVolume: (volume: number) => void;
}

interface SoundCloudWidgetFactory {
  (iframe: HTMLIFrameElement): SoundCloudWidget;
  Events: Record<string, string>;
}

interface SoundCloudApi {
  Widget: SoundCloudWidgetFactory;
}

declare global {
  interface Window {
    SC?: SoundCloudApi;
  }
}

let soundCloudApiPromise: Promise<SoundCloudApi> | null = null;

export function SoundCloudPlayer({
  track,
  playing,
  volume,
  seekRequest,
  onTime,
  onDuration,
  onPlaying,
  onEnded,
  onError,
}: SoundCloudPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<SoundCloudWidget | null>(null);
  const lastSeekTokenRef = useRef<number | null>(null);
  const playbackRef = useRef({ playing, volume });
  const callbacksRef = useRef({
    onDuration,
    onEnded,
    onError,
    onPlaying,
    onTime,
  });

  playbackRef.current = { playing, volume };
  callbacksRef.current = {
    onDuration,
    onEnded,
    onError,
    onPlaying,
    onTime,
  };

  useEffect(() => {
    if (!track?.url || !hostRef.current) {
      widgetRef.current = null;
      return;
    }

    let disposed = false;
    const host = hostRef.current;
    host.replaceChildren();
    widgetRef.current = null;
    lastSeekTokenRef.current = null;

    void loadSoundCloudApi()
      .then((api) => {
        if (disposed || !hostRef.current) return;

        const iframe = document.createElement("iframe");
        iframe.title = "SoundCloud player";
        iframe.allow = "autoplay";
        iframe.width = "100%";
        iframe.height = "166";
        iframe.scrolling = "no";
        iframe.frameBorder = "no";
        iframe.src = [
          "https://w.soundcloud.com/player/",
          `?url=${encodeURIComponent(track.url!)}`,
          "&color=%2395c7ff",
          "&auto_play=false",
          "&hide_related=true",
          "&show_comments=false",
          "&show_user=true",
          "&show_reposts=false",
          "&visual=false",
        ].join("");
        host.appendChild(iframe);

        const widget = api.Widget(iframe);
        widgetRef.current = widget;
        const events = api.Widget.Events;
        widget.bind(events.READY, () => {
          widget.getDuration((duration) => {
            callbacksRef.current.onDuration(duration / 1000);
          });
          widget.setVolume(playbackRef.current.volume * 100);
          if (playbackRef.current.playing) widget.play();
        });
        widget.bind(events.PLAY, () => callbacksRef.current.onPlaying(true));
        widget.bind(events.PAUSE, () => callbacksRef.current.onPlaying(false));
        widget.bind(events.PLAY_PROGRESS, (event) => {
          callbacksRef.current.onTime((event?.currentPosition ?? 0) / 1000);
        });
        widget.bind(events.FINISH, () => {
          callbacksRef.current.onPlaying(false);
          callbacksRef.current.onEnded();
        });
      })
      .catch((error: unknown) => {
        callbacksRef.current.onError(
          error instanceof Error ? error.message : String(error),
        );
      });

    return () => {
      disposed = true;
      widgetRef.current = null;
      host.replaceChildren();
    };
  }, [track?.id]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    if (playing) widget.play();
    else widget.pause();
  }, [playing]);

  useEffect(() => {
    widgetRef.current?.setVolume(volume * 100);
  }, [volume]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || !seekRequest || seekRequest.token === lastSeekTokenRef.current) {
      return;
    }
    lastSeekTokenRef.current = seekRequest.token;
    widget.seekTo(seekRequest.value * 1000);
  }, [seekRequest]);

  return (
    <div
      ref={hostRef}
      className="remote-player-host remote-player-host--soundcloud"
    />
  );
}

function loadSoundCloudApi(): Promise<SoundCloudApi> {
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  if (soundCloudApiPromise) return soundCloudApiPromise;

  soundCloudApiPromise = new Promise<SoundCloudApi>((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[src="https://w.soundcloud.com/player/api.js"]',
    );
    let attempts = 0;
    const checkReady = () => {
      if (window.SC?.Widget) {
        resolve(window.SC);
        return;
      }
      attempts += 1;
      if (attempts >= 40) {
        reject(new Error("SoundCloud player did not initialize."));
        return;
      }
      window.setTimeout(checkReady, 250);
    };

    if (window.SC?.Widget) {
      checkReady();
      return;
    }

    if (existingScript) {
      checkReady();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://w.soundcloud.com/player/api.js";
    script.async = true;
    script.onload = checkReady;
    script.onerror = () =>
      reject(new Error("Could not load the SoundCloud player."));
    document.head.appendChild(script);
  });

  return soundCloudApiPromise;
}
