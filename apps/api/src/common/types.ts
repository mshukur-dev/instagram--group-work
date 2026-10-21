/** Authenticated user attached to the request by JwtAuthGuard. */
export type AuthUser = {
  id: string;
  username: string;
  /** Session of the current device — used to mark "this device" in settings */
  sessionId: string;
};
