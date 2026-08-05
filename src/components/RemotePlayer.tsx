import { memo } from "react";
import type { Track } from "../types";
import { SoundCloudPlayer } from "./SoundCloudPlayer";
import { SpotifyPlayer } from "./SpotifyPlayer";
import { TikTokPlayer } from "./TikTokPlayer";
import { YouTubePlayer } from "./YouTubePlayer";

export interface RemotePlayerProps {
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

export const RemotePlayer = memo(function RemotePlayer({
  track,
  ...props
}: RemotePlayerProps) {
  if (!track || !track.source) return null;

  if (track.source === "youtube") {
    return <YouTubePlayer track={track} {...props} />;
  }

  if (track.source === "spotify") {
    return <SpotifyPlayer track={track} {...props} />;
  }

  if (track.source === "soundcloud") {
    return <SoundCloudPlayer track={track} {...props} />;
  }

  if (track.source === "tiktok") {
    return <TikTokPlayer track={track} {...props} />;
  }

  return null;
});
