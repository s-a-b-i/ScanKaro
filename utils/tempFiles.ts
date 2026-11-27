/**
 * Temporary file cleanup. Scanning, filters and PDF tools write working files to the
 * cache folder; saved documents live elsewhere (services/local/library.ts), so these
 * can be removed whenever no scan is in progress.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { draftPagePaths, filePath } from './scanDraft';

/** Files the app writes to the cache root, including rendered PDF pages (react-native-pdf-thumbnail). */
// Also: imported PDF pages (import-*.jpg) and outputs already handed to the share sheet
// (Long image, PDF to images, Word/Excel/PPT), which otherwise pile up in the cache.
const OWN_FILE =
  /^(page|preview|thumb|scan|scan-crop|import)-.*\.jpg$|-pdf-thumbnail-\d+-\d+\.jpg$| \((long|images)\)\.(jpg|zip)$|\.(docx|xlsx|pptx)$/;

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

/** Deletes an entry, or (for a folder holding draft pages) everything in it except those. */
function deleteExcept(entry: File | Directory, keep: Set<string>): number {
  const path = filePath(entry.uri);
  if (entry instanceof File) {
    if (keep.has(path)) return 0;
    const size = entry.size ?? 0;
    entry.delete();
    return size;
  }
  const prefix = path.endsWith('/') ? path : `${path}/`;
  const holdsKept = [...keep].some((p) => p.startsWith(prefix));
  if (!holdsKept) {
    const size = entry.size ?? 0;
    entry.delete();
    return size;
  }
  let freed = 0;
  for (const child of entry.list()) {
    try {
      freed += deleteExcept(child, keep);
    } catch {
      // In use or already gone: skip it.
    }
  }
  return freed;
}

/**
 * Deletes temporary files, keeping the page images of unsaved scans (drafts).
 * Call only when no PDF job is in progress (app start, after saving, or from
 * Settings). Returns bytes freed.
 */
export function clearTempFiles(): number {
  const keep = draftPagePaths();
  let freed = 0;
  for (const entry of entries()) {
    if (!isTemp(entry)) continue;
    try {
      freed += deleteExcept(entry, keep);
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
