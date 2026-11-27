import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { DocumentCorners, Point } from './documentFrame';

export type SavedImage = { uri: string; width: number; height: number };

/** Natively re-encodes an image as JPEG, scaled so its longest side is at most `maxSide`. */
export async function toJpeg(uri: string, maxSide: number, compress = 0.9): Promise<SavedImage> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { width, height } = original;
  const scale = Math.min(1, maxSide / Math.max(width, height));

  const context = ImageManipulator.manipulate(uri);
  if (scale < 1) {
    context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Rotates an image by a multiple of 90 degrees (positive = clockwise). */
export async function rotateJpeg(uri: string, degrees: 90 | -90): Promise<SavedImage> {
  const image = await ImageManipulator.manipulate(uri).rotate(degrees).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Puts four points into top-left / top-right / bottom-right / bottom-left roles. */
export function sortCorners(points: Point[]): DocumentCorners {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));
  return {
    topLeft: bySum[0],
    bottomRight: bySum[3],
    topRight: byDiff[0],
    bottomLeft: byDiff[3],
  };
}

/** Maps page corners through a 90° rotation of a `width` x `height` image. */
export function rotateCorners(
  corners: DocumentCorners,
  width: number,
  height: number,
  degrees: 90 | -90,
): DocumentCorners {
  const turn = (p: Point): Point => (degrees === 90 ? { x: height - p.y, y: p.x } : { x: p.y, y: width - p.x });
  return sortCorners([corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft].map(turn));
}

/**
 * Splits a scanned two-page book spread down the middle into two pages (left, then right).
 * A spread captured sideways (taller than wide) is split top/bottom instead.
 * `gutter` trims a little from each side of the fold, where pages curve into shadow.
 */
export async function splitSpread(uri: string, gutter = 0.015): Promise<[SavedImage, SavedImage]> {
  const { width, height } = await ImageManipulator.manipulate(uri).renderAsync();
  const sideways = height > width;
  const long = sideways ? height : width;
  const half = Math.floor(long / 2);
  const trim = Math.round(long * gutter);

  const cut = async (start: number, size: number) => {
    const rect = sideways
      ? { originX: 0, originY: start, width, height: size }
      : { originX: start, originY: 0, width: size, height };
    const image = await ImageManipulator.manipulate(uri).crop(rect).renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  };

  return [await cut(0, half - trim), await cut(half + trim, long - half - trim)];
}
