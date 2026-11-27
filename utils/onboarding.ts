import AsyncStorage from '@react-native-async-storage/async-storage';

/** Set once the intro slides were finished or skipped, so they show only on first launch. */
const KEY = '@scankaro/onboarded';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // Storage unreadable: don't trap the user in the intro.
    return true;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Worst case the intro shows once more.
  }
}
