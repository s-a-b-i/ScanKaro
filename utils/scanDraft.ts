/**
 * Unsaved scans (drafts). Every scan in progress (page file paths, crop frames, title…)
 * is mirrored to its own small JSON file whenever it changes. Starting a new scan keeps
 * the previous one as a draft, so Home can list them all and continue any of them, even
 * after the app was closed or crashed.
 */
import { Directory, File, Paths } from 'expo-file-system';

import type { DocumentCorners } from './documentFrame';

export type ScanDraft = {
  id: string;
  pages: string[];
  pageCorners: Record<string, DocumentCorners>;
  documentId: string | null;
  title: string;
  folderId: string | null;
  savedAt: number;
};

/** Drafts older than this are dropped (their temp images are likely gone anyway). */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const draftsDir = () => new Directory(Paths.document, 'scan-drafts');
const draftFile = (id: string) => new File(draftsDir(), `${id}.json`);
/** The single draft file written by earlier versions of the app. */
const legacyFile = () => new File(Paths.document, 'scan-draft.json');

export function newDraftId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Writes (or, when it has no pages, removes) the draft with this id. */
export function saveDraft(id: string, draft: Omit<ScanDraft, 'id' | 'savedAt'>) {
  try {
    if (draft.pages.length === 0) {
      deleteDraftFile(id);
      return;
    }
    const dir = draftsDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = draftFile(id);
    if (!file.exists) file.create();
    file.write(JSON.stringify({ ...draft, id, savedAt: Date.now() }));
  } catch {
    // Best effort: losing the draft only loses recovery, not saved documents.
  }
}

/** Moves the old single-draft file into the drafts folder (one time). */
function migrateLegacyDraft() {
  try {
    const legacy = legacyFile();
    if (!legacy.exists) return;
    const old = JSON.parse(legacy.textSync()) as Omit<ScanDraft, 'id'>;
    legacy.delete();
    const dir = draftsDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const id = newDraftId();
    const file = draftFile(id);
    file.create();
    file.write(JSON.stringify({ ...old, id }));
  } catch {
    try {
      legacyFile().delete();
    } catch {
      // ignore
    }
  }
}

/** Reads one draft file, keeping only pages whose images still exist. Drops dead drafts. */
function readDraft(file: File): ScanDraft | null {
  try {
    const draft = JSON.parse(file.textSync()) as ScanDraft;
    const pages = (draft.pages ?? []).filter((uri) => new File(uri).exists);
    if (pages.length === 0 || Date.now() - (draft.savedAt ?? 0) > MAX_AGE_MS) {
      file.delete();
      return null;
    }
    const id = draft.id || file.name.replace(/\.json$/, '');
    return {
      ...draft,
      id,
      pages,
      pageCorners: draft.pageCorners ?? {},
      title: draft.title ?? '',
      documentId: draft.documentId ?? null,
      folderId: draft.folderId ?? null,
    };
  } catch {
    try {
      file.delete();
    } catch {
      // ignore
    }
    return null;
  }
}

/** All unsaved scans, newest first. */
export function listDrafts(): ScanDraft[] {
  migrateLegacyDraft();
  try {
    const dir = draftsDir();
    if (!dir.exists) return [];
    return dir
      .list()
      .filter((e): e is File => e instanceof File && e.name.endsWith('.json'))
      .map(readDraft)
      .filter((d): d is ScanDraft => d !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** A file uri as a plain path, so `file:/x`, `file:///x` and `/x` compare equal. */
export function filePath(uri: string) {
  let path = uri.replace(/^file:\/*/, '/');
  try {
    path = decodeURI(path);
  } catch {
    // keep as is
  }
  return path;
}

/** Page image paths (see filePath) used by any draft; temp-file cleanup must keep these. */
export function draftPagePaths(): Set<string> {
  return new Set(listDrafts().flatMap((d) => d.pages.map(filePath)));
}

function deleteDraftFile(id: string) {
  try {
    const file = draftFile(id);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}

/** Removes a draft record only (its images may be in use, e.g. right after saving). */
export function clearDraft(id: string) {
  deleteDraftFile(id);
}

/** Throws a draft away: its record and its working images no other draft uses. */
export function discardDraft(id: string) {
  const draft = listDrafts().find((d) => d.id === id);
  deleteDraftFile(id);
  if (!draft) return;
  const stillUsed = draftPagePaths();
  const cacheRoot = filePath(Paths.cache.uri);
  for (const uri of draft.pages) {
    const path = filePath(uri);
    // Only working copies in the cache; never touch files elsewhere (e.g. the library).
    if (stillUsed.has(path) || !path.startsWith(cacheRoot)) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // ignore
    }
  }
}
