import { z } from 'zod';

const chunkSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  sizeBytes: z.number().int().positive(),
  checksum: z.string().min(1),
  storageKey: z.string().min(1),
});

export const createFileSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  checksum: z.string().min(1),
  chunks: z.array(chunkSchema).min(1),
});

export const createVersionSchema = createFileSchema.omit({ fileName: true });

export type CreateFileInput = z.infer<typeof createFileSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
