import { useEffect, useRef, useState } from "react";

interface ThumbnailBackgroundProps {
  /** URL of the current track's thumbnail. May be undefined for local files. */
  thumbnail: string | undefined;
  /** Whether audio is currently playing; drives breathing animation. */
  isPlaying: boolean;
}

/**
 * Full-bleed, behind-everything background panel.
 *
 * How it works:
 *  - Two absolutely-positioned layers are cross-faded when the thumbnail changes
 *    to avoid a hard cut.
 *  - Each layer renders the thumbnail three times at large scale with independent
 *    blur, saturation, and slow drift/rotate animations, creating a chromatic
 *    depth effect.
 *  - When `isPlaying` is true the breathing animation intensifies slightly.
 *  - When there is no thumbnail the panel falls back to the solid shell background
 *    and the CSS atmosphere gradient shows through.
 */
export function ThumbnailBackground({
  thumbnail,
  isPlaying,
}: ThumbnailBackgroundProps) {
  const [displayedUrl, setDisplayedUrl] = useState<string | undefined>(
    thumbnail,
  );
  const [previousUrl, setPreviousUrl] = useState<string | undefined>(undefined);
  const [crossfading, setCrossfading] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (thumbnail === displayedUrl) return;

    // Start crossfade: outgoing = previous displayed, incoming = new thumbnail
    setPreviousUrl(displayedUrl);
    setDisplayedUrl(thumbnail);
    setCrossfading(true);

    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setPreviousUrl(undefined);
      setCrossfading(false);
    }, 900);

    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
    // Only track thumbnail; displayedUrl is derived state intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbnail]);

  const playing = isPlaying ? "is-playing" : "";

  return (
    <div
      className={`thumbnail-bg ${playing}`}
      aria-hidden="true"
    >
      {/* Outgoing layer fades out during crossfade */}
      {crossfading && previousUrl ? (
        <div
          className="thumbnail-bg__layer thumbnail-bg__layer--out"
          key={`out-${previousUrl}`}
        >
          <ThumbnailLayers url={previousUrl} />
        </div>
      ) : null}

      {/* Current layer fades in */}
      {displayedUrl ? (
        <div
          className="thumbnail-bg__layer thumbnail-bg__layer--in"
          key={`in-${displayedUrl}`}
        >
          <ThumbnailLayers url={displayedUrl} />
        </div>
      ) : null}

      {/* Static dark overlay always present to keep text readable */}
      <div className="thumbnail-bg__overlay" />
    </div>
  );
}

/** Renders 3 separate blurred copies of the thumbnail for chromatic depth. */
function ThumbnailLayers({ url }: { url: string }) {
  const style = { backgroundImage: `url("${url}")` };
  return (
    <>
      {/* Far background: heaviest blur, slight purple tint */}
      <div className="thumbnail-bg__img thumbnail-bg__img--far" style={style} />
      {/* Mid: medium blur, warm saturated */}
      <div className="thumbnail-bg__img thumbnail-bg__img--mid" style={style} />
      {/* Near: light blur, vivid; handles breathing anim */}
      <div
        className="thumbnail-bg__img thumbnail-bg__img--near"
        style={style}
      />
    </>
  );
}
