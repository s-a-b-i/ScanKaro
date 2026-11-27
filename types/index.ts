import { ComponentProps } from 'react';

import { Icon } from '../components/Icon';

export type IconName = ComponentProps<typeof Icon>['name'];

export type DocumentItem = {
  id: string;
  title: string;
  meta: string;
  size: string;
  date: string;
  format: string;
  pages: number;
  image: string;
  folderId?: string;
  tags: string[];
  /** Expiry date (ms) for IDs, passports, contracts…; reminders are scheduled from it. */
  expiresAt?: number;
  favorite: boolean;
  encrypted?: boolean;
  pageUrls?: string[];
  pagePublicIds?: string[];
  firstPagePublicId?: string;
  ocrText?: string;
};

export type FolderItem = {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  icon: IconName;
  color: string;
  iconColor: string;
  folderIcon?: IconName;
};

export type UserProfile = {
  uid?: string;
  name: string;
  email: string;
  plan: string;
  avatar: string;
};

export type Appearance = 'system' | 'light' | 'dark';

export type AppSettings = {
  biometricUnlock: boolean;
  stealthMode: boolean;
  /** Old on/off switch; read only when `appearance` has never been set. */
  darkMode: boolean;
  /** Follow the phone (default), or always light or dark. */
  appearance?: Appearance;
  emailNotifications: boolean;
  googleDriveConnected: boolean;
  dropboxConnected: boolean;
};
