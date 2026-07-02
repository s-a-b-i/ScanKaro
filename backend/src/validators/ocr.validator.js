import { z } from 'zod';

export const extractOcrSchema = z
  .object({
    imageUrl: z.string().url().optional(),
    publicId: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.imageUrl || data.publicId), {
    message: 'Either imageUrl or publicId is required',
  });

export const ocrJobIdParamSchema = z.object({
  jobId: z.string().trim().min(1),
});
