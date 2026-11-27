/**
 * Web stand-in for expo-secure-store (see metro.config.js), for checking UI in a browser.
 * The package has no web implementation and the app lock reads it on start, which
 * crashed the web app. Values go to localStorage: NOT secure, preview use only.
 */
const PREFIX = 'scankaro-web-secure:';

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function getItemAsync(key) {
  return storage()?.getItem(PREFIX + key) ?? null;
}

export async function setItemAsync(key, value) {
  storage()?.setItem(PREFIX + key, String(value));
}

export async function deleteItemAsync(key) {
  storage()?.removeItem(PREFIX + key);
}

export function getItem(key) {
  return storage()?.getItem(PREFIX + key) ?? null;
}

export function setItem(key, value) {
  storage()?.setItem(PREFIX + key, String(value));
}

export async function isAvailableAsync() {
  return storage() !== null;
}

export function canUseBiometricAuthentication() {
  return false;
}

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
