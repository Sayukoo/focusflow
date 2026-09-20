import { useEffect, useRef } from "react";
import type { RemoteTrackInfo, Track } from "../../types";

interface YouTubePlayerProps {
  track: Track | null;
  playing: boolean;
  volume: number;
  playbackRate?: number;
  seekRequest: { value: number; token: number } | null;
  onTime: (value: number) => void;
  onDuration: (value: number) => void;
  onPlaying: (playing: boolean) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onTrackChange?: (info: RemoteTrackInfo) => void;
}

interface YouTubePlayerInstance {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (videoId: string | { videoId: string }) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate?: (suggestedRate: number) => void;
  setPlaybackQuality?: (suggestedQuality: string) => void;
  getPlaybackQuality?: () => string;
  nextVideo?: () => void;
  previousVideo?: () => void;
  getPlaylistIndex?: () => number;
  getPlaylist?: () => string[];
  playVideoAt?: (index: number) => void;
  getVideoData?: () => { video_id?: string; title?: string; author?: string };
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      height: string;
      width: string;
      videoId?: string;
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

const YOUTUBE_STATE_UNSTARTED = -1;
const YOUTUBE_STATE_ENDED = 0;
const YOUTUBE_STATE_PLAYING = 1;
const YOUTUBE_STATE_PAUSED = 2;
const YOUTUBE_STATE_BUFFERING = 3;
const YOUTUBE_STATE_CUED = 5;
const RESUME_RETRY_LIMIT = 6;
const RESUME_RETRY_DELAY_MS = 350;

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
  playbackRate = 1.0,
  seekRequest,
  onTime,
  onDuration,
  onPlaying,
  onEnded,
  onError,
  onTrackChange,
}: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const lastSeekTokenRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const onTrackEndedTimerRef = useRef<number | null>(null);
  const currentPlayingVideoIdRef = useRef<string | null>(null);
  const currentPlaylistIdRef = useRef<string | null>(null);
  const playbackRef = useRef({ playing, volume, playbackRate });
  const callbacksRef = useRef({
    onDuration,
    onEnded,
    onError,
    onPlaying,
    onTime,
    onTrackChange,
  });
  playbackRef.current = { playing, volume, playbackRate };
  callbacksRef.current = {
    onDuration,
    onEnded,
    onError,
    onPlaying,
    onTime,
    onTrackChange,
  };

  const rawVideoId = track?.videoId;
  const isVideoIdValid = Boolean(rawVideoId && /^[\w-]{11}$/.test(rawVideoId));
  const videoId = isVideoIdValid ? rawVideoId : undefined;
  const rawPlaylistId =
    track?.playlistId ??
    (track?.providerKind === "playlist" && track.providerId
      ? track.providerId
      : !isVideoIdValid && rawVideoId
        ? rawVideoId
        : undefined);

  // YouTube Music / YouTube dynamic algorithmic mixes (RD, UL, LM) fail when
  // passed as playerVars.list in embedded iframes. If a videoId is present,
  // we play the video directly instead of trying to load the mix as a playlist.
  const isAlgorithmicMix = Boolean(
    rawPlaylistId && /^(RD|UL|LM)/i.test(rawPlaylistId) && videoId,
  );
  const playlistId = isAlgorithmicMix ? undefined : rawPlaylistId;
  const hasSource = Boolean(videoId || playlistId);

  const clearResumeTimer = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const clearTrackEndedTimer = () => {
    if (onTrackEndedTimerRef.current !== null) {
      window.clearTimeout(onTrackEndedTimerRef.current);
      onTrackEndedTimerRef.current = null;
    }
  };

  const checkActiveVideo = (player: YouTubePlayerInstance) => {
    if (typeof player.getVideoData !== "function") return;
    try {
      const data = player.getVideoData();
      const activeVid = data?.video_id;
      if (
        activeVid &&
        activeVid.length === 11 &&
        activeVid !== currentPlayingVideoIdRef.current
      ) {
        currentPlayingVideoIdRef.current = activeVid;
        const playlistIndex =
          typeof player.getPlaylistIndex === "function"
            ? player.getPlaylistIndex()
            : undefined;
        callbacksRef.current.onTrackChange?.({
          videoId: activeVid,
          title: data.title,
          author: data.author,
          index:
            typeof playlistIndex === "number" && playlistIndex >= 0
              ? playlistIndex
              : undefined,
        });
      }
    } catch {
      // Third-party iframe may not have initialized video data yet.
    }
  };

  // Player lifecycle: manages the YouTube iframe instance.
  // Re-creates the player only when playlistId changes or when mounting/unmounting.
  useEffect(() => {
    if (!hasSource || !hostRef.current) {
      clearResumeTimer();
      clearTrackEndedTimer();
      try {
        playerRef.current?.destroy();
      } catch {
        // A third-party player can already have torn down its iframe.
      }
      playerRef.current = null;
      currentPlaylistIdRef.current = null;
      currentPlayingVideoIdRef.current = null;
      return;
    }

    let disposed = false;
    const host = hostRef.current;
    const playerMount = document.createElement("div");
    playerMount.className = "youtube-player-target";
    let resumeAttempts = 0;

    const resumeIfIntended = (player: YouTubePlayerInstance) => {
      clearResumeTimer();
      if (disposed || playerRef.current !== player || !playbackRef.current.playing) {
        return;
      }

      const attempt = () => {
        resumeTimerRef.current = null;
        if (
          disposed ||
          playerRef.current !== player ||
          !playbackRef.current.playing ||
          resumeAttempts >= RESUME_RETRY_LIMIT
        ) {
          return;
        }

        resumeAttempts += 1;
        player.playVideo();
        if (resumeAttempts < RESUME_RETRY_LIMIT) {
          resumeTimerRef.current = window.setTimeout(attempt, RESUME_RETRY_DELAY_MS);
        }
      };

      attempt();
    };

    host.replaceChildren(playerMount);
    lastSeekTokenRef.current = null;
    clearResumeTimer();
    clearTrackEndedTimer();
    currentPlaylistIdRef.current = playlistId ?? null;
    currentPlayingVideoIdRef.current = videoId ?? null;

    void loadYouTubeApi()
      .then((api) => {
        if (disposed || !hostRef.current || !playerMount.isConnected) return;

        const playerVars: Record<string, string | number> = {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
          vq: "hd1080",
        };

        if (playlistId) {
          playerVars.listType = "playlist";
          playerVars.list = playlistId;
        }

        // Standard 640x360 rendered offscreen via CSS ensures studio-grade 160kbps Opus audio.
        playerRef.current = new api.Player(playerMount, {
          height: "360",
          width: "640",
          ...(videoId ? { videoId } : {}),
          playerVars,
          events: {
            onReady: (event) => {
              resumeAttempts = 0;
              if (typeof event.target.setVolume === "function") {
                event.target.setVolume(playbackRef.current.volume * 100);
              }
              if (
                typeof event.target.setPlaybackRate === "function" &&
                playbackRef.current.playbackRate
              ) {
                event.target.setPlaybackRate(playbackRef.current.playbackRate);
              }
              if (typeof event.target.setPlaybackQuality === "function") {
                event.target.setPlaybackQuality("hd1080");
              }
              const duration =
                typeof event.target.getDuration === "function"
                  ? event.target.getDuration()
                  : 0;
              callbacksRef.current.onDuration(duration || 0);
              checkActiveVideo(event.target);
              if (playbackRef.current.playing) resumeIfIntended(event.target);
            },
            onStateChange: (event) => {
              clearTrackEndedTimer();
              checkActiveVideo(event.target);

              if (event.data === YOUTUBE_STATE_PLAYING) {
                resumeAttempts = 0;
                clearResumeTimer();
                if (typeof event.target.setPlaybackQuality === "function") {
                  event.target.setPlaybackQuality("hd1080");
                }
                callbacksRef.current.onPlaying(true);
              }
              if (
                event.data === YOUTUBE_STATE_UNSTARTED ||
                event.data === YOUTUBE_STATE_PAUSED ||
                event.data === YOUTUBE_STATE_BUFFERING ||
                event.data === YOUTUBE_STATE_CUED
              ) {
                if (playbackRef.current.playing) {
                  resumeIfIntended(event.target);
                } else if (event.data === YOUTUBE_STATE_PAUSED) {
                  callbacksRef.current.onPlaying(false);
                }
              }
              if (event.data === YOUTUBE_STATE_ENDED) {
                clearResumeTimer();
                if (playlistId) {
                  const playlist =
                    typeof event.target.getPlaylist === "function"
                      ? event.target.getPlaylist()
                      : null;
                  const playlistIndex =
                    typeof event.target.getPlaylistIndex === "function"
                      ? event.target.getPlaylistIndex()
                      : -1;
                  const isExplicitlyLast =
                    Array.isArray(playlist) &&
                    playlist.length > 0 &&
                    playlistIndex >= playlist.length - 1;

                  if (isExplicitlyLast) {
                    callbacksRef.current.onPlaying(false);
                    callbacksRef.current.onEnded();
                  } else {
                    // Intermediate track in a playlist: YouTube will advance to the next track.
                    // Fallback timer in case the playlist stopped.
                    onTrackEndedTimerRef.current = window.setTimeout(() => {
                      onTrackEndedTimerRef.current = null;
                      callbacksRef.current.onPlaying(false);
                      callbacksRef.current.onEnded();
                    }, 800);
                  }
                } else {
                  callbacksRef.current.onPlaying(false);
                  callbacksRef.current.onEnded();
                }
              }
            },
            onError: (event) => {
              const code = event.data;
              let msg = `YouTube player error (${code}).`;
              if (code === 2) msg = "Invalid YouTube video or playlist parameter.";
              else if (code === 5) msg = "HTML5 player error on YouTube.";
              else if (code === 100) msg = "YouTube video or playlist not found.";
              else if (code === 101 || code === 150)
                msg = "Playback not allowed outside YouTube by owner.";
              callbacksRef.current.onError(msg);
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (!disposed) {
          callbacksRef.current.onError(
            error instanceof Error ? error.message : String(error),
          );
        }
      });

    return () => {
      disposed = true;
      clearResumeTimer();
      clearTrackEndedTimer();
      try {
        playerRef.current?.destroy();
      } catch {
        // A third-party player can already have torn down its iframe.
      }
      playerRef.current = null;
      currentPlaylistIdRef.current = null;
      currentPlayingVideoIdRef.current = null;
      host.replaceChildren();
    };
  }, [playlistId, hasSource]);

  // Seamless video switching: if the player already exists and a different video
  // was selected (e.g. from the playlist list), switch video without destroying the iframe.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoId) return;

    // Already playing this exact video (e.g. YouTube auto-advanced and notified us)
    if (currentPlayingVideoIdRef.current === videoId) return;

    currentPlayingVideoIdRef.current = videoId;
    if (typeof player.loadVideoById === "function") {
      player.loadVideoById(videoId);
      if (playbackRef.current.playing) {
        player.playVideo();
      }
    }
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || typeof player.playVideo !== "function") return;
    if (playing) {
      player.playVideo();
    } else if (typeof player.pauseVideo === "function") {
      player.pauseVideo();
    }
  }, [playing]);

  useEffect(() => {
    if (typeof playerRef.current?.setVolume === "function") {
      playerRef.current.setVolume(volume * 100);
    }
  }, [volume]);

  useEffect(() => {
    if (typeof playerRef.current?.setPlaybackRate === "function" && playbackRate) {
      playerRef.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  useEffect(() => {
    const player = playerRef.current;
    if (
      !player ||
      typeof player.seekTo !== "function" ||
      !seekRequest ||
      seekRequest.token === lastSeekTokenRef.current
    ) {
      return;
    }
    lastSeekTokenRef.current = seekRequest.token;
    player.seekTo(seekRequest.value, true);
  }, [seekRequest]);

  useEffect(() => {
    if (!hasSource) return;

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (
        !player ||
        typeof player.getCurrentTime !== "function" ||
        typeof player.getDuration !== "function"
      ) {
        return;
      }
      callbacksRef.current.onTime(player.getCurrentTime() || 0);
      callbacksRef.current.onDuration(player.getDuration() || 0);
      checkActiveVideo(player);
    }, 350);

    return () => window.clearInterval(timer);
  }, [hasSource]);

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
