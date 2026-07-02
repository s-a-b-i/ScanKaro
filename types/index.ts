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

export type AppSettings = {
  biometricUnlock: boolean;
  stealthMode: boolean;
  darkMode: boolean;
  emailNotifications: boolean;
  googleDriveConnected: boolean;
  dropboxConnected: boolean;
};
