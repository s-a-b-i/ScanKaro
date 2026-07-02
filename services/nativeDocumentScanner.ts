import Constants from 'expo-constants';
import { Platform } from 'react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';

export type NativeScanOptions = {
  maxNumDocuments?: number;
  croppedImageQuality?: number;
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
