import { useEffect, useRef } from "react";
import type { Track } from "../types";

interface TikTokPlayerProps {
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

interface TikTokPlayerMessage {
  type?: string;
  value?: unknown;
  "x-tiktok-player"?: boolean;
}

export function TikTokPlayer({
  track,
  playing,
  volume,
  seekRequest,
  onTime,
  onDuration,
  onPlaying,
  onEnded,
  onError,
}: TikTokPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
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
    if (
      !track?.providerId ||
      !/^\d+$/.test(track.providerId) ||
      !hostRef.current
    ) {
      iframeRef.current = null;
      return;
    }

    const host = hostRef.current;
    const iframe = document.createElement("iframe");
    iframe.title = "TikTok player";
    iframe.allow = "autoplay";
    iframe.loading = "lazy";
    iframe.frameBorder = "0";
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.src = [
      `https://www.tiktok.com/player/v1/${encodeURIComponent(track.providerId)}`,
      "?autoplay=0&controls=0&description=0&music_info=0&timestamp=0&volume_control=0",
    ].join("");
    host.replaceChildren(iframe);
    iframeRef.current = iframe;
    lastSeekTokenRef.current = null;

    const onMessage = (event: MessageEvent<TikTokPlayerMessage>) => {
      if (event.source !== iframe.contentWindow) return;
      const message = event.data;
      if (!message || message["x-tiktok-player"] !== true) return;

      if (message.type === "onPlayerReady") {
        if (playbackRef.current.playing) sendTikTokMessage(iframe, "play");
        sendTikTokMessage(iframe, "changeVolume", playbackRef.current.volume * 100);
      }

      if (message.type === "onStateChange") {
        const state = Number(message.value);
        if (state === 1) callbacksRef.current.onPlaying(true);
        if (state === 2) callbacksRef.current.onPlaying(false);
        if (state === 0) {
          callbacksRef.current.onPlaying(false);
          callbacksRef.current.onEnded();
        }
      }

      if (message.type === "onCurrentTime") {
        const value =
          message.value && typeof message.value === "object"
            ? (message.value as { currentTime?: number; duration?: number })
            : undefined;
        if (typeof value?.currentTime === "number") {
          callbacksRef.current.onTime(value.currentTime);
        }
        if (typeof value?.duration === "number") {
          callbacksRef.current.onDuration(value.duration);
        }
      }

      if (message.type === "onPlayerError") {
        callbacksRef.current.onError("TikTok player could not load this video.");
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      iframeRef.current = null;
      host.replaceChildren();
    };
  }, [track?.id]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    sendTikTokMessage(iframe, playing ? "play" : "pause");
  }, [playing]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    sendTikTokMessage(iframe, "changeVolume", volume * 100);
  }, [volume]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !seekRequest || seekRequest.token === lastSeekTokenRef.current) {
      return;
    }
    lastSeekTokenRef.current = seekRequest.token;
    sendTikTokMessage(iframe, "seekTo", seekRequest.value);
  }, [seekRequest]);

  return (
    <div
      ref={hostRef}
      className="remote-player-host remote-player-host--tiktok"
      aria-hidden="true"
    />
  );
}

function sendTikTokMessage(
  iframe: HTMLIFrameElement,
  type: string,
  value?: number,
): void {
  iframe.contentWindow?.postMessage(
    {
      type,
      ...(typeof value === "number" ? { value } : {}),
      "x-tiktok-player": true,
    },
    "*",
  );
}
