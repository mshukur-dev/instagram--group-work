import { z } from 'zod';
import { HIGHLIGHT_TITLE_MAX } from '../constants/limits';
import { idSchema } from './common';
import { uploadedMediaSchema } from './media';

export const createStorySchema = uploadedMediaSchema;
export type CreateStoryInput = z.infer<typeof createStorySchema>;

export const createHighlightSchema = z.object({
  title: z.string().trim().min(1).max(HIGHLIGHT_TITLE_MAX),
  storyIds: z.array(idSchema).min(1).max(100),
  coverUrl: z.url().optional(),
});
export type CreateHighlightInput = z.infer<typeof createHighlightSchema>;

export const updateHighlightSchema = z
  .object({
    title: z.string().trim().min(1).max(HIGHLIGHT_TITLE_MAX),
    addStoryIds: z.array(idSchema).max(100),
    removeStoryIds: z.array(idSchema).max(100),
    coverUrl: z.url().nullable(),
  })
  .partial();
export type UpdateHighlightInput = z.infer<typeof updateHighlightSchema>;
