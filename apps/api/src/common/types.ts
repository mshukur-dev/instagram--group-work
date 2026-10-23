import type { UserRole } from '@instagram/shared';

/** Authenticated user attached to the request by JwtAuthGuard. */
export type AuthUser = {
  id: string;
  username: string;
  /** Session of the current device — used to mark "this device" in settings */
  sessionId: string;
  /** Read from the database on every request, so a role change applies at once */
  role: UserRole;
};
