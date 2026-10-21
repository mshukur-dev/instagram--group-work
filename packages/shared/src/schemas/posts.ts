import { z } from 'zod';
import {
  CAPTION_MAX,
  CAROUSEL_MAX_ITEMS,
  COMMENT_MAX,
  MAX_TAGGED_USERS,
} from '../constants/limits';
import { idSchema } from './common';
import { uploadedMediaSchema } from './media';

export const createPostSchema = z
  .object({
    type: z.enum(['POST', 'REEL']).default('POST'),
    caption: z.string().trim().max(CAPTION_MAX).optional(),
    media: z.array(uploadedMediaSchema).min(1).max(CAROUSEL_MAX_ITEMS),
    taggedUserIds: z.array(idSchema).max(MAX_TAGGED_USERS).optional(),
  })
  .refine((p) => p.type !== 'REEL' || (p.media.length === 1 && p.media[0]?.type === 'VIDEO'), {
    message: 'A reel must contain exactly one video.',
    path: ['media'],
  });
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z
  .object({
    caption: z.string().trim().max(CAPTION_MAX).nullable(),
    commentsDisabled: z.boolean(),
  })
  .partial();
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(COMMENT_MAX),
  parentId: idSchema.optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
