/**
 * Web build of services/nativeDocumentScanner.ts (Metro picks this file for web).
 * The ML Kit / VisionKit scanner is a native module that does not exist in a browser,
 * and importing react-native-document-scanner-plugin there crashes the whole app.
 */
import type { NativeScanOptions } from './nativeDocumentScanner';

export type { NativeScanOptions };

export function isNativeDocumentScannerAvailable(): boolean {
  return false;
}

export async function scanDocumentsNative(_options: NativeScanOptions = {}): Promise<string[] | null> {
  return null;
}

export function getNativeScannerUnavailableMessage(): string {
  return 'Document scanning is not available on web.';
}
