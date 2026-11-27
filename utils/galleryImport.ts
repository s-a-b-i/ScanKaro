import { Alert, Platform } from 'react-native';

import { isNativeDocumentScannerAvailable, scanDocumentsNative } from '../services/nativeDocumentScanner';
import { DocumentCorners } from './documentFrame';
import { detectDocumentFromUri } from './documentScan';
import { toJpeg } from './imageFiles';
import { pickScanCamera, pickScanImage } from './scanPicker';

/**
 * Longest side of the photo we keep and crop. Larger than the final page (2000px) so the
 * straightened page comes out the same size as a camera scan.
 */
const WORKING_MAX_SIDE = 3000;

export type PreparedImport = {
  /** JPEG copy of the photo, orientation fixed, at most WORKING_MAX_SIDE px. */
  uri: string;
  /** Detected page edges in `uri`'s pixels, or null when no page was found. */
  corners: DocumentCorners | null;
};

/**
 * Prepares a gallery photo like a scan: converts it to JPEG (HEIC/PNG safe, EXIF
 * orientation applied) and finds the page edges, so the crop frame can start on them.
 */
export async function prepareGalleryImage(sourceUri: string): Promise<PreparedImport> {
  const working = await toJpeg(sourceUri, WORKING_MAX_SIDE, 0.92);
  const detection = await detectDocumentFromUri(working.uri);
  if (!detection) {
    return { uri: working.uri, corners: null };
  }

  // Corners were found on a small copy; scale them up to the working image.
  const sx = working.width / detection.imageWidth;
  const sy = working.height / detection.imageHeight;
  const scale = (p: { x: number; y: number }) => ({ x: p.x * sx, y: p.y * sy });
  const { topLeft, topRight, bottomLeft, bottomRight } = detection.corners;

  return {
    uri: working.uri,
    corners: {
      topLeft: scale(topLeft),
      topRight: scale(topRight),
      bottomLeft: scale(bottomLeft),
      bottomRight: scale(bottomRight),
    },
  };
}

/**
 * Opens the photo gallery, then prepares the chosen photo. Null if the user cancels.
 * `onPicked` runs once a photo is chosen: show progress UI there, not before. On Android
 * a modal that is already open blocks the gallery from launching.
 */
export async function importFromGallery(onPicked?: () => void): Promise<PreparedImport | null> {
  const uri = await pickScanImage();
  if (!uri) return null;
  onPicked?.();
  return prepareGalleryImage(uri);
}

/** Captures one page with the scanner (or the plain camera when it is unavailable). */
async function captureOnePage(): Promise<PreparedImport | null> {
  if (isNativeDocumentScannerAvailable()) {
    const images = await scanDocumentsNative({ croppedImageQuality: 92, maxNumDocuments: 1 });
    // The native scanner already crops and straightens.
    return images?.[0] ? { uri: images[0], corners: null } : null;
  }
  const uri = await pickScanCamera();
  return uri ? prepareGalleryImage(uri) : null;
}

/** "Add Page" source prompt: Camera (scanner) or Gallery (with edge detection). */
export function addPageWithPrompt(): Promise<PreparedImport | null> {
  if (Platform.OS === 'web') return importFromGallery();

  const run = async (task: () => Promise<PreparedImport | null>) => {
    try {
      return await task();
    } catch (error) {
      Alert.alert('Could not add page', error instanceof Error ? error.message : 'Please try again.');
      return null;
    }
  };

  return new Promise((resolve) => {
    Alert.alert('Add Page', 'Choose a source for your scan', [
      { text: 'Camera', onPress: () => void run(captureOnePage).then(resolve) },
      { text: 'Gallery', onPress: () => void run(importFromGallery).then(resolve) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
