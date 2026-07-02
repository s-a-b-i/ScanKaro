import { appConfig } from '../constants/config';
import { firebaseAuthService } from './firebase/auth';
import { authService as mockAuthService } from './mock';
import { documentService as apiDocumentService } from './api/document';
import { folderService as apiFolderService } from './api/folder';
import { uploadService as apiUploadService } from './api/upload';
import {
  documentService as mockDocumentService,
  getDocumentById as mockGetDocumentById,
  getDocumentsByFolder as mockGetDocumentsByFolder,
} from './mock';
import { settingsService } from './settings';

export const authService = appConfig.firebase.enabled ? firebaseAuthService : mockAuthService;

export const documentService = appConfig.api.enabled ? apiDocumentService : mockDocumentService;

export const folderService = appConfig.api.enabled
  ? apiFolderService
  : {
      async list() {
        const { MOCK_FOLDERS } = await import('./mock/data');
        return MOCK_FOLDERS;
      },
      async create(name: string) {
        const { MOCK_FOLDERS } = await import('./mock/data');
        const folder = {
          id: `folder-${Date.now()}`,
          title: name,
          subtitle: '0 documents',
          count: 0,
          icon: 'folder' as const,
          color: 'bg-primary-container',
          iconColor: 'text-primary',
          folderIcon: 'folder' as const,
        };
        MOCK_FOLDERS.unshift(folder);
        return folder;
      },
      async getDocuments(folderId: string) {
        return mockGetDocumentsByFolder(folderId);
      },
    };

export const uploadService = appConfig.api.enabled ? apiUploadService : null;

export async function getDocumentById(id: string) {
  if (appConfig.api.enabled) {
    return apiDocumentService.getById(id);
  }
  return mockGetDocumentById(id) ?? null;
}

export function getDocumentsByFolder(folderId: string) {
  if (appConfig.api.enabled) {
    return documentService.list().then((docs) => docs.filter((d) => d.folderId === folderId));
  }
  return Promise.resolve(mockGetDocumentsByFolder(folderId));
}

export async function searchDocuments(query: string) {
  if (documentService.search) {
    return documentService.search(query);
  }
  const list = await documentService.list();
  const q = query.trim().toLowerCase();
  return list.filter((d) => d.title.toLowerCase().includes(q));
}

export { settingsService };
