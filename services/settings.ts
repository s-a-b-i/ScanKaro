import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppSettings } from '../types';
import { ISettingsService } from './interfaces';
import { MOCK_SETTINGS } from './mock/data';

const STORAGE_KEY = '@scankaro/settings';

export const settingsService: ISettingsService = {
  async get() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...MOCK_SETTINGS, ...JSON.parse(raw) } as AppSettings;
      }
    } catch {
      // fall through to defaults
    }
    return { ...MOCK_SETTINGS };
  },

  async update(partial: Partial<AppSettings>) {
    const current = await settingsService.get();
    const next = { ...current, ...partial };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  },
};
