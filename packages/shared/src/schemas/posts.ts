import { z } from 'zod';
import {
  CAPTION_MAX,
  CAROUSEL_MAX_ITEMS,
  COMMENT_MAX,
  MAX_TAGGED_USERS,
} from '../constants/limits';
import { idSchema, pageQuerySchema } from './common';
import { uploadedMediaSchema } from './media';

/** A place picked from the location search (OpenStreetMap through Photon) */
export const placeSchema = z.object({
  osmId: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type PlaceInput = z.infer<typeof placeSchema>;

export const createPostSchema = z
  .object({
    type: z.enum(['POST', 'REEL']).default('POST'),
    caption: z.string().trim().max(CAPTION_MAX).optional(),
    media: z.array(uploadedMediaSchema).min(1).max(CAROUSEL_MAX_ITEMS),
    taggedUserIds: z.array(idSchema).max(MAX_TAGGED_USERS).optional(),
    location: placeSchema.optional(),
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
    /** null removes the place */
    location: placeSchema.nullable(),
  })
  .partial();
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(COMMENT_MAX),
  parentId: idSchema.optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/** GET /feed?seed=: with a seed the followed posts come in a shuffled (but stable) order */
export const feedQuerySchema = pageQuerySchema.extend({
  seed: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;
