/**
 * On-device document library: the app's offline-first store.
 *
 * Layout (app-private storage, survives restarts, removed on uninstall):
 *   <documents>/library/library.json        index of documents and folders
 *   <documents>/library/docs/<id>/<n>.jpg   page images
 *
 * All writes go through a queue so concurrent actions cannot clobber the index.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { DocumentItem, FolderItem } from '../../types';

type LocalDocument = {
  id: string;
  title: string;
  folderId: string | null;
  favorite: boolean;
  /** Page file names inside docs/<id>/, in order. */
  pages: string[];
  ocrText?: string;
  tags?: string[];
  expiresAt?: number;
  /** Visual fingerprint per page file (for duplicate detection), filled in lazily. */
  pageHashes?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
};

type LocalFolder = {
  id: string;
  title: string;
  colorIndex: number;
  createdAt: number;
};

type LibraryIndex = {
  version: 1;
  documents: LocalDocument[];
  folders: LocalFolder[];
};

/** Folder colours cycle through these (all safelisted in tailwind.config.js). */
const FOLDER_COLORS = [
  { color: 'bg-primary-container', iconColor: 'text-on-primary-container' },
  { color: 'bg-tertiary-container', iconColor: 'text-on-tertiary-container' },
  { color: 'bg-secondary-container', iconColor: 'text-on-secondary-container' },
  { color: 'bg-error-container', iconColor: 'text-on-error-container' },
];

const root = () => new Directory(Paths.document, 'library');
const docsDir = () => new Directory(root(), 'docs');
const docDir = (id: string) => new Directory(docsDir(), id);
const trashDir = () => new Directory(root(), 'trash');

/** Trashed documents are kept this long before being erased for good. */
const TRASH_DAYS = 30;

/**
 * Soft delete: a removed document's folder is moved to trash/ (with its meta.json), so it
 * can be recovered by moving it back into docs/. Emptied after TRASH_DAYS.
 */
/** Moves a document's folder into trash/ and returns its trash id (for Undo). */
function moveToTrash(id: string): string | undefined {
  const dir = docDir(id);
  if (!dir.exists) return undefined;
  const trash = trashDir();
  if (!trash.exists) trash.create({ intermediates: true });
  const trashId = `${id}__${Date.now()}`;
  dir.move(new Directory(trash, trashId));
  return trashId;
}

/** Erases trashed documents older than TRASH_DAYS. Safe to call at any time. */
export function emptyOldTrash() {
  const trash = trashDir();
  if (!trash.exists) return;
  const cutoff = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000;
  for (const entry of trash.list()) {
    const stamp = Number(entry.name.split('__')[1]);
    if (entry instanceof Directory && stamp && stamp < cutoff) entry.delete();
  }
}
const indexFile = () => new File(root(), 'library.json');

function ensureDirs() {
  for (const dir of [root(), docsDir()]) {
    if (!dir.exists) dir.create({ intermediates: true });
  }
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let cache: LibraryIndex | null = null;
let queue: Promise<unknown> = Promise.resolve();

function parseIndex(file: File, text: string): LibraryIndex | null {
  try {
    const parsed = JSON.parse(text) as LibraryIndex;
    return { version: 1, documents: parsed.documents ?? [], folders: parsed.folders ?? [] };
  } catch {
    // Corrupt: keep a copy for recovery instead of overwriting it.
    try {
      file.copy(new File(root(), `library.corrupt-${Date.now()}.json`));
    } catch {
      // ignore
    }
    return null;
  }
}

/** Per-document copy of its index entry, so a document can be fully rebuilt from disk. */
function writeMeta(doc: LocalDocument) {
  try {
    const dir = docDir(doc.id);
    if (!dir.exists) return;
    const file = new File(dir, 'meta.json');
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(doc));
  } catch {
    // Best effort: the index is the source of truth.
  }
}

function readMeta(id: string): LocalDocument | null {
  try {
    const file = new File(docDir(id), 'meta.json');
    return file.exists ? (JSON.parse(file.textSync()) as LocalDocument) : null;
  } catch {
    return null;
  }
}

/**
 * Safety net: any document folder on disk that the index does not list is added back,
 * so saved pages can never silently disappear from the app.
 */
function recoverOrphans(index: LibraryIndex): boolean {
  const known = new Set(index.documents.map((d) => d.id));
  let changed = false;
  for (const entry of docsDir().list()) {
    if (!(entry instanceof Directory) || known.has(entry.name)) continue;
    const pages = entry
      .list()
      .filter((e): e is File => e instanceof File && e.name.endsWith('.jpg'))
      .map((e) => e.name)
      .sort();
    if (pages.length === 0) continue;
    const meta = readMeta(entry.name);
    const now = Date.now();
    const folderKnown = meta?.folderId && index.folders.some((f) => f.id === meta.folderId);
    index.documents.push({
      id: entry.name,
      title: meta?.title || 'Recovered scan',
      folderId: folderKnown ? meta!.folderId : null,
      favorite: meta?.favorite ?? false,
      // Keep the saved page order when it still matches the files on disk.
      pages: meta?.pages?.length && meta.pages.every((p) => pages.includes(p)) ? meta.pages : pages,
      ocrText: meta?.ocrText,
      tags: meta?.tags,
      expiresAt: meta?.expiresAt,
      createdAt: meta?.createdAt ?? now,
      updatedAt: meta?.updatedAt ?? now,
    });
    changed = true;
  }
  return changed;
}

async function readIndex(): Promise<LibraryIndex> {
  if (cache) return cache;
  ensureDirs();
  const file = indexFile();
  const tmp = new File(root(), 'library.json.tmp');
  // The temp file only exists during a write; use it if the main index is missing.
  const source = file.exists ? file : tmp.exists ? tmp : null;
  const loaded = source ? parseIndex(source, await source.text()) : null;
  const index = loaded ?? { version: 1 as const, documents: [], folders: [] };
  if (recoverOrphans(index)) writeIndex(index);
  cache = index;
  return cache;
}

function writeIndex(index: LibraryIndex) {
  ensureDirs();
  // Write the temp file first, then swap it in: a crash mid-write cannot corrupt the
  // index, and readIndex falls back to the temp file during the swap.
  const tmp = new File(root(), 'library.json.tmp');
  if (tmp.exists) tmp.delete();
  tmp.create();
  tmp.write(JSON.stringify(index));
  const target = indexFile();
  if (target.exists) target.delete();
  tmp.move(target);
  cache = index;
  // Mirror changed documents into their own folders (see writeMeta).
  for (const doc of index.documents) {
    const stamp = `${doc.updatedAt}|${doc.title}|${doc.folderId}|${doc.favorite}|${doc.pages.join(",")}|${doc.ocrText?.length ?? 0}|${(doc.tags ?? []).join(",")}|${doc.expiresAt ?? ""}`;
    if (metaStamps.get(doc.id) !== stamp) {
      writeMeta(doc);
      metaStamps.set(doc.id, stamp);
    }
  }
}

const metaStamps = new Map<string, string>();

/** Runs a read-modify-write on the index, one at a time. */
function mutate<T>(fn: (index: LibraryIndex) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const index = await readIndex();
    const result = await fn(index);
    writeIndex(index);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDocumentItem(doc: LocalDocument): DocumentItem {
  const dir = docDir(doc.id);
  const pageUris = doc.pages.map((name) => new File(dir, name).uri);
  const bytes = doc.pages.reduce((sum, name) => {
    const f = new File(dir, name);
    return sum + (f.exists ? f.size : 0);
  }, 0);
  return {
    id: doc.id,
    title: doc.title,
    meta: `${formatDate(doc.updatedAt)} · ${doc.pages.length} page${doc.pages.length === 1 ? '' : 's'}`,
    size: formatSize(bytes),
    date: new Date(doc.updatedAt).toISOString(),
    format: 'JPG',
    pages: doc.pages.length,
    image: pageUris[0] ?? '',
    pageUrls: pageUris,
    folderId: doc.folderId ?? undefined,
    tags: doc.tags ?? [],
    expiresAt: doc.expiresAt,
    favorite: doc.favorite,
    ocrText: doc.ocrText,
  };
}

function toFolderItem(folder: LocalFolder, documents: LocalDocument[]): FolderItem {
  const count = documents.filter((d) => d.folderId === folder.id).length;
  const colors = FOLDER_COLORS[folder.colorIndex % FOLDER_COLORS.length];
  return {
    id: folder.id,
    title: folder.title,
    subtitle: `${count} document${count === 1 ? '' : 's'}`,
    count,
    icon: 'folder',
    folderIcon: 'folder',
    ...colors,
  };
}

const byNewest = (a: LocalDocument, b: LocalDocument) => b.updatedAt - a.updatedAt;

/** Max differing bits (of 64) for two pages to count as the same. */
const DUPLICATE_DISTANCE = 6;

function hammingHex(a: string, b: string) {
  let bits = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      bits += x & 1;
      x >>= 1;
    }
  }
  return bits + Math.abs(a.length - b.length) * 4;
}

function requireDoc(index: LibraryIndex, id: string): LocalDocument {
  const doc = index.documents.find((d) => d.id === id);
  if (!doc) throw new Error('Document not found.');
  return doc;
}

/** Copies page images into a document's folder, returning the new file names. */
function copyPages(id: string, sourceUris: string[], startIndex: number): string[] {
  const dir = docDir(id);
  if (!dir.exists) dir.create({ intermediates: true });
  return sourceUris.map((uri, i) => {
    // Unique per write, so a replaced or rotated page never shows a stale cached image.
    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${startIndex + i + 1}.jpg`;
    new File(uri).copy(new File(dir, name));
    return name;
  });
}

export const localDocumentService = {
  async list(): Promise<DocumentItem[]> {
    const index = await readIndex();
    return [...index.documents].sort(byNewest).map(toDocumentItem);
  },

  async getById(id: string): Promise<DocumentItem | null> {
    const doc = (await readIndex()).documents.find((d) => d.id === id);
    return doc ? toDocumentItem(doc) : null;
  },

  async search(query: string): Promise<DocumentItem[]> {
    const q = query.trim().toLowerCase();
    const index = await readIndex();
    return index.documents
      .filter((d) => d.title.toLowerCase().includes(q) || (d.ocrText ?? '').toLowerCase().includes(q))
      .sort(byNewest)
      .map(toDocumentItem);
  },

  toggleFavorite(id: string): Promise<DocumentItem> {
    return mutate((index) => {
      const doc = index.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found.');
      doc.favorite = !doc.favorite;
      return toDocumentItem(doc);
    });
  },

  update(id: string, data: { title?: string; folderId?: string | null; isFavorite?: boolean }): Promise<DocumentItem> {
    return mutate((index) => {
      const doc = index.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found.');
      if (data.title !== undefined) doc.title = data.title.trim() || doc.title;
      if (data.folderId !== undefined) doc.folderId = data.folderId;
      if (data.isFavorite !== undefined) doc.favorite = data.isFavorite;
      doc.updatedAt = Date.now();
      return toDocumentItem(doc);
    });
  },

  saveOcrText(id: string, ocrText: string): Promise<void> {
    return mutate((index) => {
      const doc = index.documents.find((d) => d.id === id);
      if (doc) doc.ocrText = ocrText;
    });
  },

  /** Moves a document to Recently deleted. Returns its trash id, so it can be restored (Undo). */
  remove(id: string): Promise<string | undefined> {
    return mutate((index) => {
      if (!id) throw new Error('Missing document id.');
      const doc = index.documents.find((d) => d.id === id);
      // Fresh meta.json travels with the folder, so the document can be restored as it was.
      if (doc) writeMeta(doc);
      index.documents = index.documents.filter((d) => d.id !== id);
      return moveToTrash(id);
    });
  },

  /** Replaces a document's tags (trimmed, de-duplicated, case-insensitive). */
  setTags(id: string, tags: string[]): Promise<void> {
    return mutate((index) => {
      const doc = requireDoc(index, id);
      const seen = new Set<string>();
      doc.tags = tags
        .map((t) => t.trim().replace(/\s+/g, ' '))
        .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
    });
  },

  /** Sets or clears (null) the expiry date. */
  setExpiry(id: string, expiresAt: number | null): Promise<void> {
    return mutate((index) => {
      const doc = requireDoc(index, id);
      if (expiresAt) doc.expiresAt = expiresAt;
      else delete doc.expiresAt;
    });
  },

  /** Renames documents to "<base> 1", "<base> 2"… in the order given. */
  renameMany(ids: string[], base: string): Promise<void> {
    const name = base.trim();
    if (!name) return Promise.reject(new Error('Enter a name.'));
    return mutate((index) => {
      const now = Date.now();
      ids.forEach((docId, i) => {
        const doc = index.documents.find((d) => d.id === docId);
        if (!doc) return;
        doc.title = ids.length === 1 ? name : `${name} ${i + 1}`;
        // 1 ms apart, so the list (newest first) keeps "1" above "2".
        doc.updatedAt = now - i;
      });
    });
  },

  /** Every tag in use, most used first. */
  async allTags(): Promise<string[]> {
    const counts = new Map<string, number>();
    for (const d of (await readIndex()).documents) {
      for (const t of d.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  },

  /**
   * Groups of documents that look the same: same page count and every page's visual
   * fingerprint within a small distance (so the same scan saved twice, or re-saved with
   * another filter, is found). Fingerprints are cached per page file.
   */
  async findDuplicates(
    fingerprint: (uri: string) => Promise<string>,
    onProgress?: (done: number, total: number) => void,
  ): Promise<string[][]> {
    const index = await readIndex();
    const docs = [...index.documents];
    const hashes = new Map<string, string[]>();
    let changed = false;
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const cache = (doc.pageHashes ??= {});
      const list: string[] = [];
      for (const page of doc.pages) {
        if (!cache[page]) {
          try {
            cache[page] = await fingerprint(new File(docDir(doc.id), page).uri);
            changed = true;
          } catch {
            cache[page] = '';
          }
        }
        list.push(cache[page]);
      }
      // Forget fingerprints of pages that no longer exist.
      for (const key of Object.keys(cache)) if (!doc.pages.includes(key)) delete cache[key];
      hashes.set(doc.id, list);
      onProgress?.(i + 1, docs.length);
    }
    if (changed) await mutate(() => undefined); // persists the cached fingerprints

    const same = (a: string[], b: string[]) =>
      a.length === b.length && a.every((h, i) => h && b[i] && hammingHex(h, b[i]) <= DUPLICATE_DISTANCE);
    const groups: string[][] = [];
    const used = new Set<string>();
    for (const a of docs) {
      if (used.has(a.id)) continue;
      const group = [a.id];
      for (const b of docs) {
        if (b.id === a.id || used.has(b.id)) continue;
        if (same(hashes.get(a.id)!, hashes.get(b.id)!)) group.push(b.id);
      }
      if (group.length > 1) {
        group.forEach((g) => used.add(g));
        groups.push(group);
      }
    }
    return groups;
  },

  /** Puts pages in a new order. `order` lists current page indices in their new order. */
  reorderPages(id: string, order: number[]): Promise<void> {
    return mutate((index) => {
      const doc = requireDoc(index, id);
      if (order.length !== doc.pages.length || new Set(order).size !== order.length) {
        throw new Error('Invalid page order.');
      }
      doc.pages = order.map((i) => doc.pages[i]);
      doc.updatedAt = Date.now();
    });
  },

  /** Deletes one page. The last page cannot be deleted (delete the document instead). */
  deletePage(id: string, pageIndex: number): Promise<void> {
    return mutate((index) => {
      const doc = requireDoc(index, id);
      if (doc.pages.length <= 1) throw new Error('A document needs at least one page.');
      const [name] = doc.pages.splice(pageIndex, 1);
      const file = new File(docDir(id), name);
      if (file.exists) file.delete();
      doc.updatedAt = Date.now();
    });
  },

  /** Inserts a copy of a page right after it. */
  duplicatePage(id: string, pageIndex: number): Promise<void> {
    return mutate((index) => {
      const doc = requireDoc(index, id);
      const source = new File(docDir(id), doc.pages[pageIndex]);
      const [copy] = copyPages(id, [source.uri], doc.pages.length);
      doc.pages.splice(pageIndex + 1, 0, copy);
      doc.updatedAt = Date.now();
    });
  },

  /** Swaps a page's image for another file (new scan, rotation, edit…). */
  replacePage(id: string, pageIndex: number, sourceUri: string): Promise<void> {
    return mutate((index) => {
      const doc = requireDoc(index, id);
      const old = new File(docDir(id), doc.pages[pageIndex]);
      const [name] = copyPages(id, [sourceUri], pageIndex);
      doc.pages[pageIndex] = name;
      if (old.exists) old.delete();
      doc.updatedAt = Date.now();
    });
  },

  /**
   * Saves scanned pages on the device. With `documentId`, pages are appended to that
   * document; otherwise a new document is created. Source files are copied, so the
   * caller may delete its temporary files afterwards.
   */
  savePages(
    pageUris: string[],
    options: { title: string; folderId?: string | null; documentId?: string | null },
  ): Promise<{ documentId: string }> {
    if (pageUris.length === 0) return Promise.reject(new Error('No pages to save.'));
    return mutate((index) => {
      const now = Date.now();
      const existing = options.documentId ? index.documents.find((d) => d.id === options.documentId) : undefined;
      if (existing) {
        existing.pages.push(...copyPages(existing.id, pageUris, existing.pages.length));
        existing.updatedAt = now;
        return { documentId: existing.id };
      }
      const id = newId('doc');
      index.documents.push({
        id,
        title: options.title.trim() || 'Untitled Scan',
        folderId: options.folderId ?? null,
        favorite: false,
        pages: copyPages(id, pageUris, 0),
        createdAt: now,
        updatedAt: now,
      });
      return { documentId: id };
    });
  },
};

export const localFolderService = {
  async list(): Promise<FolderItem[]> {
    const index = await readIndex();
    return [...index.folders]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((f) => toFolderItem(f, index.documents));
  },

  create(name: string): Promise<FolderItem> {
    const title = name.trim();
    if (!title) return Promise.reject(new Error('Enter a folder name.'));
    return mutate((index) => {
      if (index.folders.some((f) => f.title.toLowerCase() === title.toLowerCase())) {
        throw new Error(`A folder named "${title}" already exists.`);
      }
      const folder: LocalFolder = {
        id: newId('folder'),
        title,
        colorIndex: index.folders.length,
        createdAt: Date.now(),
      };
      index.folders.push(folder);
      return toFolderItem(folder, index.documents);
    });
  },

  rename(id: string, name: string): Promise<void> {
    return mutate((index) => {
      const folder = index.folders.find((f) => f.id === id);
      if (folder && name.trim()) folder.title = name.trim();
    });
  },

  /** Deletes a folder; its documents move to the root (they are not deleted). */
  remove(id: string): Promise<void> {
    return mutate((index) => {
      index.folders = index.folders.filter((f) => f.id !== id);
      index.documents.forEach((d) => {
        if (d.folderId === id) d.folderId = null;
      });
    });
  },

  async getDocuments(folderId: string): Promise<DocumentItem[]> {
    const index = await readIndex();
    return index.documents.filter((d) => d.folderId === folderId).sort(byNewest).map(toDocumentItem);
  },
};

/** Bytes used by saved documents. */
export async function libraryBytes(): Promise<number> {
  const dir = root();
  return dir.exists ? (dir.size ?? 0) : 0;
}

/**
 * Deletes every saved document and folder (used by "Delete account" only).
 * Requires an explicit confirmation token so it can never run by accident.
 */
export function wipeLibrary(confirm: 'DELETE_ALL_DOCUMENTS'): Promise<void> {
  if (confirm !== 'DELETE_ALL_DOCUMENTS') return Promise.reject(new Error('Wipe not confirmed.'));
  return mutate((index) => {
    index.documents = [];
    index.folders = [];
    const docs = docsDir();
    if (docs.exists) docs.delete();
    const trash = trashDir();
    if (trash.exists) trash.delete();
    ensureDirs();
  });
}

/** Library root folder (for backups). */
export function libraryRootDir(): Directory {
  ensureDirs();
  return root();
}

/**
 * Merges documents and folders from an extracted backup into this library.
 * Never overwrites: items whose id already exists here are skipped.
 */
export function mergeFromBackup(
  backupLibraryDir: Directory,
  /** Only these documents (all when omitted). */
  onlyIds?: string[],
): Promise<{ added: number; skipped: number }> {
  return mutate(async (index) => {
    const backupIndexFile = new File(backupLibraryDir, 'library.json');
    if (!backupIndexFile.exists) throw new Error('This backup has no library index.');
    const backup = JSON.parse(await backupIndexFile.text()) as LibraryIndex;

    // Bring back folders, but only those the restored documents use when restoring a selection.
    const wanted = onlyIds
      ? new Set((backup.documents ?? []).filter((d) => onlyIds.includes(d.id)).map((d) => d.folderId))
      : null;
    for (const folder of backup.folders ?? []) {
      if (wanted && !wanted.has(folder.id)) continue;
      if (!index.folders.some((f) => f.id === folder.id)) index.folders.push(folder);
    }

    let added = 0;
    let skipped = 0;
    const backupDocs = new Directory(backupLibraryDir, 'docs');
    for (const doc of backup.documents ?? []) {
      if (onlyIds && !onlyIds.includes(doc.id)) continue;
      const source = new Directory(backupDocs, doc.id);
      if (index.documents.some((d) => d.id === doc.id) || !source.exists) {
        skipped++;
        continue;
      }
      source.copy(docDir(doc.id));
      index.documents.push(doc);
      added++;
    }
    return { added, skipped };
  });
}

export type TrashedDocument = {
  /** Folder name inside trash/ ("<id>__<deletedAt>"). */
  trashId: string;
  title: string;
  pages: number;
  image: string;
  deletedAt: number;
  /** Whole days before it is erased for good. */
  daysLeft: number;
};

function trashedMeta(dir: Directory): LocalDocument | null {
  try {
    const file = new File(dir, 'meta.json');
    return file.exists ? (JSON.parse(file.textSync()) as LocalDocument) : null;
  } catch {
    return null;
  }
}

/** Documents in Recently deleted, newest first. */
export function listTrash(): TrashedDocument[] {
  const trash = trashDir();
  if (!trash.exists) return [];
  const items: TrashedDocument[] = [];
  for (const entry of trash.list()) {
    if (!(entry instanceof Directory)) continue;
    const deletedAt = Number(entry.name.split('__')[1]) || 0;
    const meta = trashedMeta(entry);
    const files = entry
      .list()
      .filter((e): e is File => e instanceof File && e.name.endsWith('.jpg'))
      .map((e) => e.name)
      .sort();
    const pages = meta?.pages?.filter((p) => files.includes(p)) ?? files;
    if (pages.length === 0) continue;
    const msLeft = deletedAt + TRASH_DAYS * 24 * 60 * 60 * 1000 - Date.now();
    items.push({
      trashId: entry.name,
      title: meta?.title || 'Untitled Scan',
      pages: pages.length,
      image: new File(entry, pages[0]).uri,
      deletedAt,
      daysLeft: Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
    });
  }
  return items.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Moves a document from Recently deleted back into the library. */
export function restoreFromTrash(trashId: string): Promise<void> {
  return mutate((index) => {
    const source = new Directory(trashDir(), trashId);
    if (!source.exists) throw new Error('This document is no longer in Recently deleted.');
    const meta = trashedMeta(source);
    const id = meta?.id ?? trashId.split('__')[0];
    if (index.documents.some((d) => d.id === id) || docDir(id).exists) {
      throw new Error('A document with the same id is already in your library.');
    }
    source.move(docDir(id));
    const files = docDir(id)
      .list()
      .filter((e): e is File => e instanceof File && e.name.endsWith('.jpg'))
      .map((e) => e.name)
      .sort();
    const now = Date.now();
    index.documents.push({
      id,
      title: meta?.title || 'Restored scan',
      // Its folder may have been deleted meanwhile; then it goes to the main library.
      folderId: meta?.folderId && index.folders.some((f) => f.id === meta.folderId) ? meta.folderId : null,
      favorite: meta?.favorite ?? false,
      pages: meta?.pages?.length && meta.pages.every((p) => files.includes(p)) ? meta.pages : files,
      ocrText: meta?.ocrText,
      tags: meta?.tags,
      expiresAt: meta?.expiresAt,
      createdAt: meta?.createdAt ?? now,
      // Restored documents show up at the top of Recent.
      updatedAt: now,
    });
  });
}

/** Erases one document from Recently deleted, or all of them when no id is given. */
export function deleteFromTrash(trashId?: string) {
  const target = trashId ? new Directory(trashDir(), trashId) : trashDir();
  if (target.exists) target.delete();
}
