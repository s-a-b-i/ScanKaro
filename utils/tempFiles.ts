/**
 * Temporary file cleanup. Scanning, filters and PDF tools write working files to the
 * cache folder; saved documents live elsewhere (services/local/library.ts), so these
 * can be removed whenever no scan is in progress.
 */
import { Directory, File, Paths } from 'expo-file-system';

/** Files the app writes to the cache root, including rendered PDF pages (react-native-pdf-thumbnail). */
const OWN_FILE = /^(page|preview|thumb|scan|scan-crop)-.*\.jpg$|-pdf-thumbnail-\d+-\d+\.jpg$/;

/** Cache sub-folders filled by the scanner, pickers, image tools and PDF tools. */
const TEMP_DIRS = ['ImageManipulator', 'ImagePicker', 'DocumentPicker', 'mlkit_docscan_ui_client', 'pdf'];

function entries() {
  try {
    return new Directory(Paths.cache).list();
  } catch {
    return [];
  }
}

function isTemp(entry: File | Directory) {
  return entry instanceof File ? OWN_FILE.test(entry.name) : TEMP_DIRS.includes(entry.name);
}

/** Bytes used by temporary files. */
export function tempBytes(): number {
  return entries()
    .filter(isTemp)
    .reduce((sum, e) => sum + ((e instanceof File ? e.size : e.size) ?? 0), 0);
}

/**
 * Deletes temporary files. Call only when no scan or PDF job is in progress
 * (app start, after saving, or from Settings). Returns bytes freed.
 */
export function clearTempFiles(): number {
  let freed = 0;
  for (const entry of entries()) {
    if (!isTemp(entry)) continue;
    try {
      freed += (entry.size ?? 0) as number;
      entry.delete();
    } catch {
      // A file in use or already gone: skip it.
    }
  }
  return freed;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
