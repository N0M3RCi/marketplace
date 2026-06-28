import { z } from 'zod';

export const sendMessage = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  content: z.string().min(1, 'Message content is required').max(5000),
  isBuyer: z.boolean().optional(),
  imageUrl: z.string().max(500).optional().nullable(),
  fileUrl: z.string().max(500).optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().max(10485760).optional().nullable(),
});