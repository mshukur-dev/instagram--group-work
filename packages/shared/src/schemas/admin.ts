import { z } from 'zod';
import { pageQuerySchema } from './common';

export const BAN_REASON_MAX = 500;

/** GET /admin/users?q=&sort=&banned= */
export const adminUsersQuerySchema = pageQuerySchema.extend({
  /** username, full name or email */
  q: z.string().trim().max(64).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  /** true: only banned, false: only active */
  banned: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

/** GET /admin/posts?type= */
export const adminPostsQuerySchema = pageQuerySchema.extend({
  type: z.enum(['POST', 'REEL']).optional(),
});
export type AdminPostsQuery = z.infer<typeof adminPostsQuerySchema>;

/** POST /admin/users/:id/ban */
export const banUserSchema = z.object({
  reason: z.string().trim().min(1).max(BAN_REASON_MAX),
});
export type BanUserInput = z.infer<typeof banUserSchema>;
