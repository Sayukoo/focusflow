import { memo, useEffect, useState } from "react";
import type { RemoteTrackInfo, Track } from "../../types";
import { Icon } from "../ui/Icon";
import { SoundCloudPlayer } from "./SoundCloudPlayer";
import { SpotifyPlayer } from "./SpotifyPlayer";
import { TikTokPlayer } from "./TikTokPlayer";
import { YouTubePlayer } from "./YouTubePlayer";

export interface RemotePlayerProps {
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

/** Tracks browser/WebView connectivity so remote embeds can warn offline. */
function useIsOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

export const RemotePlayer = memo(function RemotePlayer({
  track,
  ...props
}: RemotePlayerProps) {
  const online = useIsOnline();

  let player = null;
  if (track?.source === "youtube") {
    player = <YouTubePlayer track={track} {...props} />;
  } else if (track?.source === "spotify") {
    player = <SpotifyPlayer track={track} {...props} />;
  } else if (track?.source === "soundcloud") {
    player = <SoundCloudPlayer track={track} {...props} />;
  } else if (track?.source === "tiktok") {
    player = <TikTokPlayer track={track} {...props} />;
  }

  return (
    <>
      {player}
      {track && !online ? (
        <div className="remote-offline-badge" role="status">
          <Icon name="link" size={13} />
          <span>
            Tryb offline — metadane z pamięci, strumień zdalny niedostępny.
          </span>
        </div>
      ) : null}
    </>
  );
});
