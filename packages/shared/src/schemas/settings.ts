import { z } from 'zod';
import { idSchema, pageQuerySchema } from './common';

export const updateSettingsSchema = z
  .object({
    isPrivate: z.boolean(),
    showActivityStatus: z.boolean(),
    messagePermission: z.enum(['EVERYONE', 'FOLLOWING']),
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
    language: z.enum(['EN', 'RU']),
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const updateNotificationSettingsSchema = z
  .object({
    pushEnabled: z.boolean(),
    likes: z.boolean(),
    comments: z.boolean(),
    follows: z.boolean(),
    messages: z.boolean(),
    calls: z.boolean(),
    /** 0 = resume, otherwise pause all pushes for N hours */
    pauseHours: z.union([z.literal(0), z.literal(1), z.literal(8), z.literal(24)]),
  })
  .partial();
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z.url(),
});
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchHistorySchema = z.object({
  userId: idSchema,
});
export type SearchHistoryInput = z.infer<typeof searchHistorySchema>;

/** Posts / reels whose caption or hashtags match (the Reels and Top tabs of search) */
export const searchPostsQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().min(1).max(64),
  type: z.enum(['POST', 'REEL']).optional(),
});
export type SearchPostsQuery = z.infer<typeof searchPostsQuerySchema>;
