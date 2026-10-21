import { z } from 'zod';
import { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from '../constants/limits';

export const idSchema = z.string().min(1).max(64);

/** Query params for every paginated list: ?cursor=&limit= */
export const pageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

/** Paginated list with an optional text filter (followers, likes…). */
export const filteredPageQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(64).optional(),
});
export type FilteredPageQuery = z.infer<typeof filteredPageQuerySchema>;

export const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(10),
});
export type LimitQuery = z.infer<typeof limitQuerySchema>;
