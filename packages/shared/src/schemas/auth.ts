import { z } from 'zod';
import {
  FULL_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_REGEX,
} from '../constants/limits';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN)
  .max(USERNAME_MAX)
  .regex(USERNAME_REGEX, 'Usernames can only use letters, numbers, underscores and periods.')
  .refine((v) => !v.startsWith('.') && !v.endsWith('.') && !v.includes('..'), {
    message: "Usernames can't start or end with a period or contain two periods in a row.",
  });

export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

export const fullNameSchema = z.string().trim().min(1).max(FULL_NAME_MAX);

export const registerSchema = z.object({
  email: z.email().trim().toLowerCase(),
  fullName: fullNameSchema,
  username: usernameSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** Email or username */
  login: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(PASSWORD_MAX),
});
export type LoginInput = z.infer<typeof loginSchema>;
