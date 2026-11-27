/**
 * Crash recovery for the scan in progress. The scan session (page file paths, crop
 * frames, title…) is mirrored to a small JSON file whenever it changes, so if the app
 * is closed or crashes before saving, the next launch can offer to continue.
 */
import { File, Paths } from 'expo-file-system';

import type { DocumentCorners } from './documentFrame';

export type ScanDraft = {
  pages: string[];
  pageCorners: Record<string, DocumentCorners>;
  documentId: string | null;
  title: string;
  folderId: string | null;
  savedAt: number;
};

/** Drafts older than this are dropped (their temp images are likely gone anyway). */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const draftFile = () => new File(Paths.document, 'scan-draft.json');

export function saveDraft(draft: Omit<ScanDraft, 'savedAt'>) {
  try {
    const file = draftFile();
    if (draft.pages.length === 0) {
      if (file.exists) file.delete();
      return;
    }
    if (!file.exists) file.create();
    file.write(JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Best effort: losing the draft only loses recovery, not saved documents.
  }
}

export function hasDraft() {
  return draftFile().exists;
}

/** The unsaved scan from a previous run, keeping only pages whose images still exist. */
export function loadDraft(): ScanDraft | null {
  try {
    const file = draftFile();
    if (!file.exists) return null;
    const draft = JSON.parse(file.textSync()) as ScanDraft;
    const pages = (draft.pages ?? []).filter((uri) => new File(uri).exists);
    if (pages.length === 0 || Date.now() - (draft.savedAt ?? 0) > MAX_AGE_MS) {
      clearDraft();
      return null;
    }
    return { ...draft, pages };
  } catch {
    clearDraft();
    return null;
  }
}

export function clearDraft() {
  try {
    const file = draftFile();
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
