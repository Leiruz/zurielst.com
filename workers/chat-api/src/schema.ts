import { z } from 'zod';

import { normalizeInputText } from './normalize';

const ChatTextSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    return normalizeInputText(value) ?? undefined;
  },
  z.string().min(1).max(500),
);

const HistoryItemSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: ChatTextSchema,
  })
  .strict();

export const ChatRequestSchema = z
  .object({
    message: ChatTextSchema,
    history: z.array(HistoryItemSchema).max(4).optional(),
  })
  .strict();

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatHistoryItem = z.infer<typeof HistoryItemSchema>;
