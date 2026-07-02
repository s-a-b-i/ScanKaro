import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  color: z.string().trim().min(1).max(64).optional(),
  icon: z.string().trim().min(1).max(64).optional(),
});

export const updateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    color: z.string().trim().min(1).max(64).optional(),
    icon: z.string().trim().min(1).max(64).optional(),
  })
  .refine((data) => data.name !== undefined || data.color !== undefined || data.icon !== undefined, {
    message: 'At least one field (name, color, icon) is required',
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
