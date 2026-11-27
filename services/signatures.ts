/**
 * Saved signatures: transparent PNGs in app-private storage, reused across documents.
 */
import { Directory, File, Paths } from 'expo-file-system';

export type SavedSignature = { id: string; uri: string; createdAt: number };

const dir = () => new Directory(Paths.document, 'signatures');

/** Signatures folder (for backups). */
export const signaturesDir = () => ensureDir();

function ensureDir() {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

export function listSignatures(): SavedSignature[] {
  const d = ensureDir();
  return d
    .list()
    .filter((e): e is File => e instanceof File && e.name.endsWith('.png'))
    .map((f) => {
      const createdAt = Number(f.name.split('-')[1]?.replace('.png', '')) || 0;
      return { id: f.name, uri: f.uri, createdAt };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Saves PNG bytes as a new signature. */
export function saveSignature(png: Uint8Array): SavedSignature {
  const d = ensureDir();
  const createdAt = Date.now();
  const file = new File(d, `sig-${createdAt}.png`);
  file.create();
  file.write(png);
  return { id: file.name, uri: file.uri, createdAt };
}

export function deleteSignature(id: string) {
  const file = new File(dir(), id);
  if (file.exists) file.delete();
}
