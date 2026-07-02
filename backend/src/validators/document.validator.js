import { z } from 'zod';

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  folderId: z.string().optional(),
  rootOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true')
    .pipe(z.boolean().default(false)),
});

export const searchDocumentsQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search query must be at least 2 characters').max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateDocumentOcrSchema = z.object({
  ocrText: z.string().max(500_000),
});

export const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    isFavorite: z.boolean().optional(),
    folderId: z.string().nullable().optional(),
  })
  .refine((data) => data.title !== undefined || data.isFavorite !== undefined || data.folderId !== undefined, {
    message: 'At least one field (title, isFavorite, folderId) is required',
  });
