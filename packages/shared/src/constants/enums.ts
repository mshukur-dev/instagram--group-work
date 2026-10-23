// Mirrors of Prisma enums, so the frontend never depends on @prisma/client.
// Keep in sync with apps/api/prisma/schema.prisma.

export const FollowStatus = { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED' } as const;
export type FollowStatus = (typeof FollowStatus)[keyof typeof FollowStatus];

/** Relationship from the viewer to another user. */
export type ViewerFollowStatus = 'NONE' | FollowStatus;

export const PostType = { POST: 'POST', REEL: 'REEL' } as const;
export type PostType = (typeof PostType)[keyof typeof PostType];

export const MediaType = { IMAGE: 'IMAGE', VIDEO: 'VIDEO' } as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const MessageType = {
  TEXT: 'TEXT',
  MEDIA: 'MEDIA',
  POST_SHARE: 'POST_SHARE',
  STORY_REPLY: 'STORY_REPLY',
  VOICE: 'VOICE',
  CALL: 'CALL',
  SYSTEM: 'SYSTEM',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const UserRole = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AdminActionType = {
  BAN_USER: 'BAN_USER',
  UNBAN_USER: 'UNBAN_USER',
  DELETE_POST: 'DELETE_POST',
  DELETE_COMMENT: 'DELETE_COMMENT',
} as const;
export type AdminActionType = (typeof AdminActionType)[keyof typeof AdminActionType];

export const MemberRole = { ADMIN: 'ADMIN', MEMBER: 'MEMBER' } as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const CallType = { AUDIO: 'AUDIO', VIDEO: 'VIDEO' } as const;
export type CallType = (typeof CallType)[keyof typeof CallType];

export const CallStatus = {
  RINGING: 'RINGING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  MISSED: 'MISSED',
} as const;
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const NotificationType = {
  POST_LIKE: 'POST_LIKE',
  COMMENT: 'COMMENT',
  COMMENT_REPLY: 'COMMENT_REPLY',
  COMMENT_LIKE: 'COMMENT_LIKE',
  FOLLOW: 'FOLLOW',
  FOLLOW_REQUEST: 'FOLLOW_REQUEST',
  FOLLOW_ACCEPTED: 'FOLLOW_ACCEPTED',
  MENTION: 'MENTION',
  POST_TAG: 'POST_TAG',
  STORY_LIKE: 'STORY_LIKE',
  LIVE_STARTED: 'LIVE_STARTED',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const MessagePermission = { EVERYONE: 'EVERYONE', FOLLOWING: 'FOLLOWING' } as const;
export type MessagePermission = (typeof MessagePermission)[keyof typeof MessagePermission];

export const Theme = { LIGHT: 'LIGHT', DARK: 'DARK', SYSTEM: 'SYSTEM' } as const;
export type Theme = (typeof Theme)[keyof typeof Theme];

export const Language = { EN: 'EN', RU: 'RU' } as const;
export type Language = (typeof Language)[keyof typeof Language];

export const SystemMessageAction = {
  GROUP_CREATED: 'GROUP_CREATED',
  MEMBER_ADDED: 'MEMBER_ADDED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  MEMBER_LEFT: 'MEMBER_LEFT',
  TITLE_CHANGED: 'TITLE_CHANGED',
  AVATAR_CHANGED: 'AVATAR_CHANGED',
} as const;
export type SystemMessageAction = (typeof SystemMessageAction)[keyof typeof SystemMessageAction];
