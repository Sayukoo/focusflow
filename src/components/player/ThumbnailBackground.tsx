import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export interface ThumbnailPalette {
  primary: string;
  secondary: string;
  tertiary: string;
  centerVeil: number;
  edgeVeil: number;
  topVeil: number;
  bottomVeil: number;
  luminance: number;
}

export const DEFAULT_THUMBNAIL_PALETTE: ThumbnailPalette = {
  primary: "#5d6f9d",
  secondary: "#c88c68",
  tertiary: "#171a2e",
  centerVeil: 0.18,
  edgeVeil: 0.34,
  topVeil: 0.2,
  bottomVeil: 0.5,
  luminance: 0.36,
};

interface ColorBucket {
  red: number;
  green: number;
  blue: number;
  count: number;
}

interface RGBColor {
  red: number;
  green: number;
  blue: number;
}

const PALETTE_SAMPLE_SIZE = 32;
const MAX_PALETTE_CACHE_SIZE = 24;
const paletteCache = new Map<string, ThumbnailPalette>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function colorToHex(color: RGBColor): string {
  return `#${[color.red, color.green, color.blue]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function colorDistance(first: RGBColor, second: RGBColor): number {
  return Math.sqrt(
    (first.red - second.red) ** 2 +
      (first.green - second.green) ** 2 +
      (first.blue - second.blue) ** 2,
  );
}

function createPalette(
  colors: RGBColor[],
  luminance: number,
): ThumbnailPalette {
  const primary = colors[0] ?? hexToColor(DEFAULT_THUMBNAIL_PALETTE.primary);
  const secondary =
    colors[1] ??
    colors[0] ??
    hexToColor(DEFAULT_THUMBNAIL_PALETTE.secondary);
  const tertiary =
    colors[2] ??
    colors[1] ??
    colors[0] ??
    hexToColor(DEFAULT_THUMBNAIL_PALETTE.tertiary);
  const normalizedLuminance = clamp(luminance, 0, 1);

  return {
    primary: colorToHex(primary),
    secondary: colorToHex(secondary),
    tertiary: colorToHex(tertiary),
    centerVeil: clamp(0.14 + normalizedLuminance * 0.28, 0.14, 0.42),
    edgeVeil: clamp(0.28 + normalizedLuminance * 0.28, 0.28, 0.58),
    topVeil: clamp(0.16 + normalizedLuminance * 0.2, 0.16, 0.38),
    bottomVeil: clamp(0.4 + normalizedLuminance * 0.26, 0.4, 0.7),
    luminance: normalizedLuminance,
  };
}

function hexToColor(hex: string): RGBColor {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  };
}

/**
 * Reduces a small RGBA image to three separated representative colors.
 * Kept independent from the DOM so the color logic can be tested cheaply.
 */
export function paletteFromPixels(
  pixels: Uint8ClampedArray,
): ThumbnailPalette {
  const buckets = new Map<number, ColorBucket>();
  let luminanceTotal = 0;
  let sampledPixels = 0;

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 96) continue;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const brightness = (red + green + blue) / 3;
    if (brightness < 12) continue;

    const quantizedRed = Math.min(255, Math.round(red / 24) * 24);
    const quantizedGreen = Math.min(255, Math.round(green / 24) * 24);
    const quantizedBlue = Math.min(255, Math.round(blue / 24) * 24);
    const key =
      (quantizedRed << 16) | (quantizedGreen << 8) | quantizedBlue;
    const bucket = buckets.get(key) ?? {
      red: 0,
      green: 0,
      blue: 0,
      count: 0,
    };

    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    bucket.count += 1;
    buckets.set(key, bucket);

    luminanceTotal +=
      (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    sampledPixels += 1;
  }

  const candidates = [...buckets.values()]
    .sort((first, second) => second.count - first.count)
    .map((bucket) => ({
      red: bucket.red / bucket.count,
      green: bucket.green / bucket.count,
      blue: bucket.blue / bucket.count,
    }));
  const colors: RGBColor[] = [];

  for (const candidate of candidates) {
    if (
      colors.length === 0 ||
      colors.every((selected) => colorDistance(selected, candidate) > 42)
    ) {
      colors.push(candidate);
    }
    if (colors.length === 3) break;
  }

  if (sampledPixels === 0) return DEFAULT_THUMBNAIL_PALETTE;

  return createPalette(colors, luminanceTotal / sampledPixels);
}

function cachePalette(url: string, palette: ThumbnailPalette): void {
  if (paletteCache.has(url)) paletteCache.delete(url);
  paletteCache.set(url, palette);
  if (paletteCache.size <= MAX_PALETTE_CACHE_SIZE) return;
  const oldestUrl = paletteCache.keys().next().value;
  if (oldestUrl) paletteCache.delete(oldestUrl);
}

export function extractThumbnailPalette(
  url: string,
): Promise<ThumbnailPalette> {
  const cached = paletteCache.get(url);
  if (cached) return Promise.resolve(cached);
  if (typeof Image === "undefined" || typeof document === "undefined") {
    return Promise.resolve(DEFAULT_THUMBNAIL_PALETTE);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";

    const finish = (palette: ThumbnailPalette) => {
      image.onload = null;
      image.onerror = null;
      cachePalette(url, palette);
      resolve(palette);
    };

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PALETTE_SAMPLE_SIZE;
      canvas.height = PALETTE_SAMPLE_SIZE;
      const context = canvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!context) {
        finish(DEFAULT_THUMBNAIL_PALETTE);
        return;
      }

      try {
        context.drawImage(
          image,
          0,
          0,
          PALETTE_SAMPLE_SIZE,
          PALETTE_SAMPLE_SIZE,
        );
        finish(
          paletteFromPixels(
            context.getImageData(
              0,
              0,
              PALETTE_SAMPLE_SIZE,
              PALETTE_SAMPLE_SIZE,
            ).data,
          ),
        );
      } catch {
        // Cross-origin images without CORS headers cannot be sampled.
        finish(DEFAULT_THUMBNAIL_PALETTE);
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
    image.onerror = () => finish(DEFAULT_THUMBNAIL_PALETTE);
    image.src = url;
  });
}

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
// PERF: memo — parent re-renders every timer tick; the backdrop only changes
// when the thumbnail or play state changes.
export const ThumbnailBackground = memo(function ThumbnailBackground({
  thumbnail,
  isPlaying,
}: ThumbnailBackgroundProps) {
  const [displayedUrl, setDisplayedUrl] = useState<string | undefined>(
    thumbnail,
  );
  const [previousUrl, setPreviousUrl] = useState<string | undefined>(undefined);
  const [crossfading, setCrossfading] = useState(false);
  const [palette, setPalette] = useState<ThumbnailPalette>(
    DEFAULT_THUMBNAIL_PALETTE,
  );
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

  useEffect(() => {
    let active = true;

    if (!thumbnail) {
      setPalette(DEFAULT_THUMBNAIL_PALETTE);
      return () => {
        active = false;
      };
    }

    void extractThumbnailPalette(thumbnail).then((nextPalette) => {
      if (active) setPalette(nextPalette);
    });

    return () => {
      active = false;
    };
  }, [thumbnail]);

  const playing = isPlaying ? "is-playing" : "";
  const paletteStyle = useMemo(
    () =>
      ({
        "--thumbnail-primary": palette.primary,
        "--thumbnail-secondary": palette.secondary,
        "--thumbnail-tertiary": palette.tertiary,
        "--thumbnail-center-veil": palette.centerVeil,
        "--thumbnail-edge-veil": palette.edgeVeil,
        "--thumbnail-top-veil": palette.topVeil,
        "--thumbnail-bottom-veil": palette.bottomVeil,
      }) as CSSProperties,
    [palette],
  );

  return (
    <div
      className={`thumbnail-bg ${playing}`}
      style={paletteStyle}
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

      <div className="thumbnail-bg__palette" />

      {/* Static dark overlay always present to keep text readable */}
      <div className="thumbnail-bg__overlay" />
    </div>
  );
});

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
