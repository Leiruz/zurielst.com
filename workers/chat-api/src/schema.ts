import { z } from 'zod';

const HistoryItemSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(500),
  })
  .strict();

export const ChatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
    history: z.array(HistoryItemSchema).max(4).optional(),
  })
  .strict();

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatHistoryItem = z.infer<typeof HistoryItemSchema>;
