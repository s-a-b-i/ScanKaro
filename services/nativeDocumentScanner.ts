import Constants from 'expo-constants';
import { Platform } from 'react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';

export type NativeScanOptions = {
  maxNumDocuments?: number;
  croppedImageQuality?: number;
  /** Android only: show ML Kit's gallery button (needs patches/react-native-document-scanner-plugin). */
  galleryImportAllowed?: boolean;
  /**
   * Android only. "base" (our default): ML Kit only finds, crops and straightens the page;
   * all cleanup happens in our Enhance step, so camera scans and gallery imports get the
   * exact same processing. "full" would add ML Kit's own cleanup on top.
   */
  scannerMode?: 'base' | 'baseWithFilter' | 'full';
};

export function isNativeDocumentScannerAvailable(): boolean {
  // VisionKit / ML Kit scanner requires a dev or production build — not Expo Go.
  return Constants.appOwnership !== 'expo';
}

export async function scanDocumentsNative(
  options: NativeScanOptions = {},
): Promise<string[] | null> {
  if (!isNativeDocumentScannerAvailable()) {
    return null;
  }

  const result = await DocumentScanner.scanDocument({
    croppedImageQuality: options.croppedImageQuality ?? 92,
    maxNumDocuments: options.maxNumDocuments,
    galleryImportAllowed: options.galleryImportAllowed ?? Platform.OS === 'android',
    scannerMode: options.scannerMode ?? 'base',
  });

  if (result.status === ScanDocumentResponseStatus.Cancel || !result.scannedImages?.length) {
    return null;
  }

  return result.scannedImages.map((uri) => (uri.startsWith('file://') ? uri : `file://${uri}`));
}

export function getNativeScannerUnavailableMessage(): string {
  if (Platform.OS === 'web') {
    return 'Document scanning is not available on web.';
  }
  return 'Live edge detection requires a development build. Run: npx expo prebuild, then npx expo run:android or run:ios (Expo Go does not include the native scanner).';
}
