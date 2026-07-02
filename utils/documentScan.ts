import { Buffer } from 'buffer';
import { File, Paths } from 'expo-file-system';

import { DocumentCorners } from './documentFrame';
import {
  decodeJpegBase64,
  detectPageCornersFromImage,
  encodeJpeg,
  warpDocumentPerspective,
} from './opencvDocumentScan';

export type DocumentDetectionResult = {
  corners: DocumentCorners;
  imageWidth: number;
  imageHeight: number;
};

async function readUriAsBase64(uri: string) {
  const file = new File(uri);
  return file.base64();
}

export async function getImageSizeFromUri(uri: string): Promise<{ width: number; height: number }> {
  const base64 = await readUriAsBase64(uri);
  const image = decodeJpegBase64(base64);
  return { width: image.width, height: image.height };
}

export async function detectDocumentFromUri(uri: string): Promise<DocumentDetectionResult | null> {
  try {
    const base64 = await readUriAsBase64(uri);
    const image = decodeJpegBase64(base64);
    const corners = detectPageCornersFromImage(image);
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

export async function cropDocumentFromUri(uri: string, corners: DocumentCorners): Promise<string> {
  const base64 = await readUriAsBase64(uri);
  const image = decodeJpegBase64(base64);
  const warped = warpDocumentPerspective(image, corners);
  const jpegBytes = encodeJpeg(warped, 90);
  const outFile = new File(Paths.cache, `scan-crop-${Date.now()}.jpg`);
  outFile.create();
  outFile.write(jpegBytes);
  return outFile.uri;
}

export async function autoScanDocumentFromUri(uri: string): Promise<string> {
  const detection = await detectDocumentFromUri(uri);
  if (!detection) return uri;
  return cropDocumentFromUri(uri, detection.corners);
}
