/**
 * Locker: private photos and files behind their own 4-digit PIN (separate from the app lock).
 *
 * Items are copied into the app's private storage, which the gallery, file managers and
 * other apps cannot see. The PIN is stored only as a salted SHA-256 hash in the Android
 * Keystore (expo-secure-store). Files themselves are not encrypted.
 */
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY_HASH = 'scankaro.locker.pinHash';
const KEY_SALT = 'scankaro.locker.pinSalt';
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

let failedAttempts = 0;
let lockedUntil = 0;

export type LockerItem = {
  id: string;
  name: string;
  kind: 'image' | 'file';
  mimeType: string;
  size: number;
  addedAt: number;
  /** File name inside the locker folder. */
  file: string;
};

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------

const hashPin = (pin: string, salt: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `locker:${salt}:${pin}`);

export async function lockerHasPin(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(KEY_HASH));
}

export async function setLockerPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('The PIN must be 4 digits.');
  const salt = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY_SALT, salt);
  await SecureStore.setItemAsync(KEY_HASH, await hashPin(pin, salt));
}

export type LockerPinCheck = { ok: true } | { ok: false; waitSeconds?: number; attemptsLeft?: number };

export async function verifyLockerPin(pin: string): Promise<LockerPinCheck> {
  const now = Date.now();
  if (now < lockedUntil) return { ok: false, waitSeconds: Math.ceil((lockedUntil - now) / 1000) };
  const [hash, salt] = await Promise.all([SecureStore.getItemAsync(KEY_HASH), SecureStore.getItemAsync(KEY_SALT)]);
  if (!hash || !salt) return { ok: false };
  if ((await hashPin(pin, salt)) === hash) {
    failedAttempts = 0;
    return { ok: true };
  }
  failedAttempts += 1;
  if (failedAttempts >= MAX_ATTEMPTS) {
    failedAttempts = 0;
    lockedUntil = Date.now() + COOLDOWN_MS;
    return { ok: false, waitSeconds: COOLDOWN_MS / 1000 };
  }
  return { ok: false, attemptsLeft: MAX_ATTEMPTS - failedAttempts };
}

/** Fingerprint/face unlock, when the phone has it set up. */
export async function unlockLockerWithBiometrics(): Promise<boolean> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Open Locker',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function lockerBiometricsAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const folder = () => {
  const dir = new Directory(Paths.document, 'locker');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};
const indexFile = () => new File(folder(), 'index.json');

function readIndex(): LockerItem[] {
  const f = indexFile();
  if (!f.exists) return [];
  try {
    return JSON.parse(f.textSync()) as LockerItem[];
  } catch {
    return [];
  }
}

function writeIndex(items: LockerItem[]) {
  const f = indexFile();
  if (!f.exists) f.create();
  f.write(JSON.stringify(items));
}

export function listLocker(): LockerItem[] {
  return readIndex().sort((a, b) => b.addedAt - a.addedAt);
}

export function lockerItemUri(item: LockerItem): string {
  return new File(folder(), item.file).uri;
}

const extOf = (name: string, mime: string) => {
  const m = name.match(/\.([a-z0-9]{1,6})$/i);
  if (m) return m[1].toLowerCase();
  if (mime === 'image/png') return 'png';
  if (mime.startsWith('image/')) return 'jpg';
  if (mime === 'application/pdf') return 'pdf';
  return 'bin';
};

/** Copies files into the Locker. The originals are left where they were. */
export function addToLocker(sources: { uri: string; name?: string | null; mimeType?: string | null }[]): number {
  const items = readIndex();
  const dir = folder();
  let added = 0;
  for (const src of sources) {
    const mimeType = src.mimeType || (/\.(jpe?g|png|webp|heic)$/i.test(src.uri) ? 'image/jpeg' : 'application/octet-stream');
    const name = src.name || src.uri.split('/').pop() || 'File';
    const id = `lk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const fileName = `${id}.${extOf(name, mimeType)}`;
    const dest = new File(dir, fileName);
    new File(src.uri).copy(dest);
    items.push({
      id,
      name,
      kind: mimeType.startsWith('image/') ? 'image' : 'file',
      mimeType,
      size: dest.size ?? 0,
      addedAt: Date.now() + added,
      file: fileName,
    });
    added++;
  }
  writeIndex(items);
  return added;
}

export function renameLockerItem(id: string, name: string) {
  const items = readIndex();
  const item = items.find((i) => i.id === id);
  if (!item || !name.trim()) return;
  item.name = name.trim();
  writeIndex(items);
}

/** Deletes for good (the Locker has no Recently deleted, by design). */
export function deleteLockerItems(ids: string[]) {
  const items = readIndex();
  for (const item of items.filter((i) => ids.includes(i.id))) {
    const f = new File(folder(), item.file);
    if (f.exists) f.delete();
  }
  writeIndex(items.filter((i) => !ids.includes(i.id)));
}

/** Forgot PIN: erases every item and the PIN, so the Locker can be set up again. */
export async function resetLocker() {
  const dir = new Directory(Paths.document, 'locker');
  if (dir.exists) dir.delete();
  await Promise.all([SecureStore.deleteItemAsync(KEY_HASH), SecureStore.deleteItemAsync(KEY_SALT)]);
}
