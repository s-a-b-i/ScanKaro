/**
 * Library backup and restore as a single .zip, streamed one file at a time so memory
 * stays low on budget phones. Pages are already JPEG, so entries are stored, not deflated.
 *
 * Layout:  manifest.json · library/library.json · library/docs/<id>/... · signatures/*.png
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Unzip, UnzipInflate, UnzipPassThrough, Zip, ZipPassThrough } from 'fflate';

import { libraryRootDir, mergeFromBackup } from '../services/local/library';
import { signaturesDir } from '../services/signatures';

const BACKUP_VERSION = 1;
/** Only these paths may appear in a backup (blocks "zip slip" path tricks). */
const ALLOWED = /^(manifest\.json|library\/library\.json|library\/docs\/[\w-]+\/[\w.-]+|signatures\/[\w.-]+\.png)$/;
const READ_CHUNK = 512 * 1024;

type Entry = { path: string; file: File };

/** Every file to back up: the library (except trash) and saved signatures. */
function collectEntries(): Entry[] {
  const entries: Entry[] = [];
  const lib = libraryRootDir();
  const index = new File(lib, 'library.json');
  if (index.exists) entries.push({ path: 'library/library.json', file: index });

  const docs = new Directory(lib, 'docs');
  if (docs.exists) {
    for (const doc of docs.list()) {
      if (!(doc instanceof Directory)) continue;
      for (const f of doc.list()) {
        if (f instanceof File) entries.push({ path: `library/docs/${doc.name}/${f.name}`, file: f });
      }
    }
  }
  for (const f of signaturesDir().list()) {
    if (f instanceof File && f.name.endsWith('.png')) entries.push({ path: `signatures/${f.name}`, file: f });
  }
  return entries;
}

/** Writes a backup .zip to the cache and returns it (share it to save to Drive/Files). */
export async function createBackup(onProgress?: (done: number, total: number) => void): Promise<File> {
  const entries = collectEntries();
  const date = new Date().toISOString().slice(0, 10);
  const out = new File(Paths.cache, `ScanKaro-backup-${date}.zip`);
  if (out.exists) out.delete();
  out.create();
  const handle = out.open();

  let failed: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) failed = err;
    else handle.writeBytes(chunk);
  });

  try {
    const add = (path: string, bytes: Uint8Array) => {
      const entry = new ZipPassThrough(path);
      zip.add(entry);
      entry.push(bytes, true);
    };

    const docCount = entries.filter((e) => e.path.endsWith('/meta.json')).length;
    add(
      'manifest.json',
      new TextEncoder().encode(
        JSON.stringify({ app: 'ScanKaro', version: BACKUP_VERSION, createdAt: Date.now(), documents: docCount }),
      ),
    );

    for (let i = 0; i < entries.length; i++) {
      add(entries[i].path, await entries[i].file.bytes());
      onProgress?.(i + 1, entries.length);
      if (failed) throw failed;
    }
    zip.end();
    if (failed) throw failed;
  } catch (error) {
    handle.close();
    if (out.exists) out.delete();
    throw error;
  }
  handle.close();
  return out;
}

export async function shareBackup(file: File) {
  await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: file.name });
}

export type BackupDocument = {
  id: string;
  title: string;
  pages: number;
  /** Already in this library (restoring would skip it). */
  exists: boolean;
  /** Set when pages are missing or damaged. */
  problem?: string;
};

export type OpenedBackup = {
  createdAt?: number;
  documents: BackupDocument[];
  /** Call when done (deletes the unpacked copy). */
  close: () => void;
  /** Restores the chosen documents (plus saved signatures). */
  restore: (ids: string[]) => Promise<{ added: number; skipped: number }>;
};

const isJpeg = (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/**
 * Unpacks a backup and checks every document before anything is restored: all pages
 * present, sizes match the zip, and each page is a real JPEG.
 */
export async function openBackup(zipUri: string, existingIds: string[]): Promise<OpenedBackup> {
  const work = new Directory(Paths.cache, `restore-${Date.now()}`);
  work.create({ intermediates: true });
  const close = () => {
    if (work.exists) work.delete();
  };
  try {
    const damaged = await extract(zipUri, work);
    const manifestFile = new File(work, 'manifest.json');
    if (!manifestFile.exists) throw new Error('This is not a ScanKaro backup.');
    const manifest = JSON.parse(await manifestFile.text()) as { app?: string; version?: number; createdAt?: number };
    if (manifest.app !== 'ScanKaro') throw new Error('This is not a ScanKaro backup.');
    if ((manifest.version ?? 0) > BACKUP_VERSION)
      throw new Error('This backup is from a newer ScanKaro. Update the app first.');
    const indexFile = new File(work, 'library', 'library.json');
    if (!indexFile.exists) throw new Error('This backup has no library index.');
    const index = JSON.parse(await indexFile.text()) as {
      documents?: { id: string; title: string; pages: string[] }[];
    };

    const documents: BackupDocument[] = [];
    for (const doc of index.documents ?? []) {
      let problem: string | undefined;
      let bad = 0;
      for (const page of doc.pages ?? []) {
        const path = `library/docs/${doc.id}/${page}`;
        const file = new File(work, 'library', 'docs', doc.id, page);
        if (!file.exists || damaged.has(path)) {
          bad++;
          continue;
        }
        const handle = file.open();
        try {
          if (!isJpeg(handle.readBytes(3))) bad++;
        } finally {
          handle.close();
        }
      }
      if (!doc.pages?.length) problem = 'No pages';
      else if (bad)
        problem = `${bad} of ${doc.pages.length} page${doc.pages.length === 1 ? '' : 's'} damaged or missing`;
      documents.push({
        id: doc.id,
        title: doc.title || 'Untitled Scan',
        pages: doc.pages?.length ?? 0,
        exists: existingIds.includes(doc.id),
        problem,
      });
    }

    const restore = async (ids: string[]) => {
      const sigSource = new Directory(work, 'signatures');
      if (sigSource.exists) {
        const target = signaturesDir();
        for (const f of sigSource.list()) {
          if (f instanceof File && !new File(target, f.name).exists) f.copy(new File(target, f.name));
        }
      }
      // Damaged documents are never restored, even if asked.
      const safe = ids.filter((id) => !documents.find((d) => d.id === id)?.problem);
      return mergeFromBackup(new Directory(work, 'library'), safe);
    };

    return { createdAt: manifest.createdAt, documents, close, restore };
  } catch (error) {
    close();
    throw error;
  }
}

/**
 * Streams a zip into `target`, writing each allowed entry straight to disk.
 * Returns the paths whose written size differs from the size recorded in the zip.
 */
async function extract(zipUri: string, target: Directory): Promise<Set<string>> {
  const damaged = new Set<string>();
  const source = new File(zipUri);
  if (!source.exists) throw new Error('The backup file could not be opened.');
  const input = source.open();

  let failed: Error | null = null;
  const unzip = new Unzip((entry) => {
    if (!ALLOWED.test(entry.name)) {
      return; // Ignore anything unexpected instead of writing it.
    }
    const parts = entry.name.split('/');
    let dir = target;
    for (const part of parts.slice(0, -1)) {
      dir = new Directory(dir, part);
      if (!dir.exists) dir.create({ intermediates: true });
    }
    const file = new File(dir, parts[parts.length - 1]);
    if (file.exists) file.delete();
    file.create();
    const handle = file.open();
    let written = 0;
    entry.ondata = (err, chunk, final) => {
      if (err) {
        // A broken entry marks that file as damaged instead of failing the whole restore.
        damaged.add(entry.name);
        handle.close();
        return;
      }
      handle.writeBytes(chunk);
      written += chunk.length;
      if (final) {
        handle.close();
        if (typeof entry.originalSize === 'number' && entry.originalSize !== written) damaged.add(entry.name);
      }
    };
    entry.start();
  });
  unzip.register(UnzipPassThrough);
  unzip.register(UnzipInflate);

  try {
    const size = input.size ?? source.size;
    let read = 0;
    while (read < size) {
      const chunk = input.readBytes(Math.min(READ_CHUNK, size - read));
      read += chunk.length;
      unzip.push(chunk, read >= size);
      if (failed) throw failed;
      if (chunk.length === 0) break;
    }
  } finally {
    input.close();
  }
  if (failed) throw failed;
  return damaged;
}
