import { Image } from 'react-native';

import { DocumentCorners } from './documentFrame';
import { detectPageCornersFromImage } from './opencvDocumentScan';
import { detectPaper } from './paperDetection';
import { readSmallPixels, warpToFile } from './skiaImage';

/** Long side of the copy used for page detection. Page outlines are big shapes. */
const DETECT_MAX_SIDE = 256;

export type DocumentDetectionResult = {
  corners: DocumentCorners;
  imageWidth: number;
  imageHeight: number;
};

/** Image dimensions, read natively (no JS decode of the whole file). */
export function getImageSizeFromUri(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Finds the page in a photo. Corners are in the pixels of the small detection copy,
 * whose size is returned as imageWidth / imageHeight (scale them to your image).
 */
export async function detectDocumentFromUri(uri: string): Promise<DocumentDetectionResult | null> {
  try {
    const image = await readSmallPixels(uri, DETECT_MAX_SIDE);
    // Colour-based paper detection first (robust on busy backgrounds), edges as fallback.
    const corners = detectPaper(image) ?? detectPageCornersFromImage(image);
    if (!corners) return null;

    return {
      corners,
      imageWidth: image.width,
      imageHeight: image.height,
    };
  } catch {
    return null;
  }
}

/** Crops and straightens the page inside `corners` (pixels of `uri`). Runs natively. */
export async function cropDocumentFromUri(uri: string, corners: DocumentCorners): Promise<string> {
  const saved = await warpToFile(uri, corners);
  return saved.uri;
}
