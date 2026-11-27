/**
 * App lock: a 4-digit PIN (stored only as a salted SHA-256 hash in the Android
 * Keystore / iOS Keychain via expo-secure-store) plus optional fingerprint/face unlock.
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY_HASH = 'scankaro.lock.pinHash';
const KEY_SALT = 'scankaro.lock.pinSalt';
const KEY_BIOMETRIC = 'scankaro.lock.biometric';

export const PIN_LENGTH = 4;
/** Wrong PIN attempts before a cool-down. */
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

let failedAttempts = 0;
let lockedUntil = 0;

async function hashPin(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function isLockEnabled(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(KEY_HASH));
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('The PIN must be 4 digits.');
  const salt = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY_SALT, salt);
  await SecureStore.setItemAsync(KEY_HASH, await hashPin(pin, salt));
}

/** Turns the lock off and forgets the PIN and biometric choice. */
export async function disableLock(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_HASH),
    SecureStore.deleteItemAsync(KEY_SALT),
    SecureStore.deleteItemAsync(KEY_BIOMETRIC),
  ]);
}

export type PinCheck = { ok: true } | { ok: false; waitSeconds?: number; attemptsLeft?: number };

/** Checks a PIN, with a short cool-down after repeated wrong attempts. */
export async function verifyPin(pin: string): Promise<PinCheck> {
  const now = Date.now();
  if (now < lockedUntil) return { ok: false, waitSeconds: Math.ceil((lockedUntil - now) / 1000) };

  const [hash, salt] = await Promise.all([SecureStore.getItemAsync(KEY_HASH), SecureStore.getItemAsync(KEY_SALT)]);
  if (!hash || !salt) return { ok: true };

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

/** True when the phone has fingerprint/face hardware with something enrolled. */
export async function biometricsAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_BIOMETRIC)) === '1';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) await SecureStore.setItemAsync(KEY_BIOMETRIC, '1');
  else await SecureStore.deleteItemAsync(KEY_BIOMETRIC);
}

/** Shows the system fingerprint/face prompt. Resolves true on success. */
export async function unlockWithBiometrics(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock ScanKaro',
      cancelLabel: 'Use PIN',
      // The in-app PIN is the fallback, not the phone's own screen lock.
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}
