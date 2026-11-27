import { appConfig } from '../constants/config';
import { documentService as apiDocumentService } from './api/document';
import { folderService as apiFolderService } from './api/folder';
import { uploadService as apiUploadService } from './api/upload';
import { firebaseAuthService } from './firebase/auth';
import { localDocumentService, localFolderService } from './local/library';
import { authService as mockAuthService } from './mock';
import { settingsService } from './settings';

export const authService = appConfig.firebase.enabled ? firebaseAuthService : mockAuthService;

/** Documents and folders: on the device by default; the backend only in cloud mode. */
const cloud = appConfig.cloud.enabled;

export const documentService = cloud ? apiDocumentService : localDocumentService;

export const folderService = cloud ? apiFolderService : localFolderService;

/** Cloud uploads (cloud mode only). Local saving goes through services/uploadScan.ts. */
export const uploadService = cloud ? apiUploadService : null;

export async function getDocumentById(id: string) {
  return documentService.getById(id);
}

export async function getDocumentsByFolder(folderId: string) {
  const list = await documentService.list();
  return list.filter((d) => d.folderId === folderId);
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
