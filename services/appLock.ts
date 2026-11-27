/**
 * App lock: a 4-digit PIN (stored only as a salted SHA-256 hash in the Android
 * Keystore / iOS Keychain via expo-secure-store) plus optional fingerprint/face unlock.
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { pinWaitSeconds, recordPinFailure, recordPinSuccess } from '../utils/pinAttempts';

const KEY_HASH = 'scankaro.lock.pinHash';
const KEY_SALT = 'scankaro.lock.pinSalt';
const KEY_BIOMETRIC = 'scankaro.lock.biometric';

export const PIN_LENGTH = 4;

async function hashPin(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function isLockEnabled(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(KEY_HASH));
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('The PIN must be 4 digits.');
  await recordPinSuccess('appLock'); // a new PIN starts with a clean attempt count
  const salt = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY_SALT, salt);
  await SecureStore.setItemAsync(KEY_HASH, await hashPin(pin, salt));
}

/** Turns the lock off and forgets the PIN and biometric choice. */
export async function disableLock(): Promise<void> {
  await recordPinSuccess('appLock');
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_HASH),
    SecureStore.deleteItemAsync(KEY_SALT),
    SecureStore.deleteItemAsync(KEY_BIOMETRIC),
  ]);
}

export type PinCheck = { ok: true } | { ok: false; waitSeconds?: number; attemptsLeft?: number };

/** Checks a PIN, with a short cool-down after repeated wrong attempts. */
export async function verifyPin(pin: string): Promise<PinCheck> {
  const wait = await pinWaitSeconds('appLock');
  if (wait > 0) return { ok: false, waitSeconds: wait };

  const [hash, salt] = await Promise.all([SecureStore.getItemAsync(KEY_HASH), SecureStore.getItemAsync(KEY_SALT)]);
  if (!hash || !salt) return { ok: true };

  if ((await hashPin(pin, salt)) === hash) {
    await recordPinSuccess('appLock');
    return { ok: true };
  }
  return { ok: false, ...(await recordPinFailure('appLock')) };
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

/**
 * Forgot-PIN check: the phone's own screen lock (its PIN, pattern, password or
 * fingerprint) proves the owner is holding the phone, with or without a ScanKaro account.
 */
export async function verifyPhoneOwner(): Promise<'ok' | 'failed' | 'no-screen-lock'> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return 'no-screen-lock';
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm it is you to reset your ScanKaro PIN',
      // Here the phone's screen lock IS the check, so allow its PIN/pattern too.
      disableDeviceFallback: false,
    });
    return result.success ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
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
