import { useEffect, useRef } from "react";
import type { Track } from "../types";

interface YouTubePlayerProps {
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

interface YouTubePlayerInstance {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (videoId: string) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      height: string;
      width: string;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange: (event: {
          data: number;
          target: YouTubePlayerInstance;
        }) => void;
        onError: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

export function YouTubePlayer({
  track,
  playing,
  volume,
  seekRequest,
  onTime,
  onDuration,
  onPlaying,
  onEnded,
  onError,
}: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
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
    if (!track?.videoId || !hostRef.current) {
      playerRef.current?.destroy();
      playerRef.current = null;
      return;
    }

    let disposed = false;
    const host = hostRef.current;
    host.replaceChildren();
    lastSeekTokenRef.current = null;

    void loadYouTubeApi()
      .then((api) => {
        if (disposed || !hostRef.current) return;

        playerRef.current = new api.Player(hostRef.current, {
          height: "1",
          width: "1",
          videoId: track.videoId!,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              event.target.setVolume(playbackRef.current.volume * 100);
              callbacksRef.current.onDuration(event.target.getDuration() || 0);
              if (playbackRef.current.playing) event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === 1) callbacksRef.current.onPlaying(true);
              if (event.data === 2) callbacksRef.current.onPlaying(false);
              if (event.data === 0) {
                callbacksRef.current.onPlaying(false);
                callbacksRef.current.onEnded();
              }
            },
            onError: (event) => {
              callbacksRef.current.onError(`YouTube player error (${event.data}).`);
            },
          },
        });
      })
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [track?.videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [playing]);

  useEffect(() => {
    playerRef.current?.setVolume(volume * 100);
  }, [volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !seekRequest || seekRequest.token === lastSeekTokenRef.current) return;
    lastSeekTokenRef.current = seekRequest.token;
    player.seekTo(seekRequest.value, true);
  }, [seekRequest]);

  useEffect(() => {
    if (!track?.videoId) return;

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      callbacksRef.current.onTime(player.getCurrentTime() || 0);
      callbacksRef.current.onDuration(player.getDuration() || 0);
    }, 350);

    return () => window.clearInterval(timer);
  }, [track?.videoId]);

  return <div ref={hostRef} className="youtube-player-host" aria-hidden="true" />;
}

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube API did not initialize."));
      }
    };

    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Could not load YouTube player."));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}
