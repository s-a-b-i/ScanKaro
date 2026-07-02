import { z } from 'zod';

export const uploadPageBodySchema = z.object({
  documentId: z.string().optional(),
  pageNumber: z.coerce.number().int().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().optional(),
});

export const uploadPagesBodySchema = z.object({
  documentId: z.string().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  startPageNumber: z.coerce.number().int().min(1).optional(),
  folderId: z.string().optional(),
});

export const deletePageBodySchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  publicId: z.string().min(1, 'publicId is required'),
});

export const reorderPagesBodySchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  orderedPublicIds: z.array(z.string().min(1)).min(1, 'At least one page id is required'),
});
