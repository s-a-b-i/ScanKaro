import { IconName, FolderItem } from '../../types';
import { apiClient } from './client';

interface BackendFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  docCount: number;
}

const ICON_MAP: Record<string, IconName> = {
  folder: 'folder',
  receipt: 'receipt',
  school: 'school',
  work: 'work',
  'folder-special': 'folder-special',
};

function mapIcon(icon: string): IconName {
  return ICON_MAP[icon] ?? 'folder';
}

export function mapBackendFolder(folder: BackendFolder): FolderItem {
  const icon = mapIcon(folder.icon);
  return {
    id: folder.id,
    title: folder.name,
    subtitle: `${folder.docCount} document${folder.docCount === 1 ? '' : 's'}`,
    count: folder.docCount,
    icon,
    color: folder.color || 'bg-primary-container',
    iconColor: 'text-primary',
    folderIcon: icon,
  };
}

export const folderService = {
  async list(): Promise<FolderItem[]> {
    const folders = await apiClient.get<BackendFolder[]>('/folders');
    return (folders ?? []).map(mapBackendFolder);
  },

  async getDocuments(folderId: string) {
    return apiClient.get(`/folders/${folderId}/documents?page=1&limit=100`);
  },

  async create(name: string) {
    const folder = await apiClient.post<BackendFolder>('/folders', {
      name,
      color: 'bg-primary-container',
      icon: 'folder',
    });
    return mapBackendFolder(folder);
  },
};
