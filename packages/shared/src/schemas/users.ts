import { z } from 'zod';
import { BIO_MAX, WEBSITE_MAX } from '../constants/limits';
import { fullNameSchema, passwordSchema, usernameSchema } from './auth';

export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema,
    username: usernameSchema,
    bio: z.string().trim().max(BIO_MAX).nullable(),
    website: z.url().max(WEBSITE_MAX).nullable().or(z.literal('').transform(() => null)),
    avatarUrl: z.url().nullable(),
    isPrivate: z.boolean(),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  /** Not required for Google-only accounts that set a password for the first time */
  currentPassword: z.string().max(128).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
