import { describe, expect, it } from "vitest";
import {
  DEFAULT_THUMBNAIL_PALETTE,
  paletteFromPixels,
} from "./ThumbnailBackground";

function pixel(red: number, green: number, blue: number, alpha = 255): number[] {
  return [red, green, blue, alpha];
}

describe("thumbnail palette extraction", () => {
  it("returns separated dominant colors and derives a readable veil", () => {
    const pixels = new Uint8ClampedArray([
      ...pixel(232, 179, 47),
      ...pixel(232, 179, 47),
      ...pixel(232, 179, 47),
      ...pixel(232, 179, 47),
      ...pixel(40, 75, 215),
      ...pixel(40, 75, 215),
      ...pixel(40, 75, 215),
      ...pixel(215, 75, 145),
      ...pixel(215, 75, 145),
      ...pixel(4, 4, 4),
    ]);

    const palette = paletteFromPixels(pixels);

    expect(palette.primary).toBe("#e8b32f");
    expect(palette.secondary).toBe("#284bd7");
    expect(palette.tertiary).toBe("#d74b91");
    expect(palette.luminance).toBeGreaterThan(0.4);
    expect(palette.centerVeil).toBeGreaterThan(
      DEFAULT_THUMBNAIL_PALETTE.centerVeil,
    );
  });

  it("falls back safely when pixels are transparent or almost black", () => {
    const palette = paletteFromPixels(
      new Uint8ClampedArray([
        ...pixel(0, 0, 0, 0),
        ...pixel(4, 4, 4),
        ...pixel(8, 8, 8),
      ]),
    );

    expect(palette).toEqual(DEFAULT_THUMBNAIL_PALETTE);
  });
});
