import { IUploadService } from '../interfaces';
import { apiClient } from './client';

interface UploadPageResult {
  document: { id: string; title: string };
  page: { cloudinaryUrl: string; cloudinaryPublicId: string };
}

export const uploadService: IUploadService = {
  async uploadImage(uri: string, options?: { title?: string; folderId?: string; documentId?: string }) {
    const formData = new FormData();

    formData.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'scan.jpg',
    } as unknown as Blob);

    if (options?.title) formData.append('title', options.title);
    if (options?.folderId) formData.append('folderId', options.folderId);
    if (options?.documentId) formData.append('documentId', options.documentId);

    const result = await apiClient.uploadFile<UploadPageResult>('/upload/page', formData);

    return {
      url: result.page.cloudinaryUrl,
      publicId: result.page.cloudinaryPublicId,
      documentId: result.document.id,
    };
  },
};
