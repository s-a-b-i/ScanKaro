import { uploadService } from '../services';

export async function uploadScanPages(
  pages: string[],
  options: { title: string; folderId?: string | null; documentId?: string | null },
): Promise<{ documentId: string }> {
  if (!uploadService) {
    throw new Error('Upload service is not available');
  }

  if (pages.length === 0) {
    throw new Error('No pages to upload');
  }

  let documentId: string | undefined = options.documentId ?? undefined;

  for (let i = 0; i < pages.length; i++) {
    const result = await uploadService.uploadImage(pages[i], {
      title: i === 0 && !documentId ? options.title : undefined,
      folderId: options.folderId ?? undefined,
      documentId,
    });
    documentId = result.documentId ?? documentId;
  }

  if (!documentId) {
    throw new Error('Upload failed — no document created');
  }

  return { documentId };
}
