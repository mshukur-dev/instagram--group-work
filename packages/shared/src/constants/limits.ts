// Limits shared by client-side checks and server-side validation

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_REGEX = /^[a-z0-9._]+$/;
/**
 * Usernames that would clash with web routes (/explore vs /[username]), API routes
 * (/users/me) or files in apps/web/public. Add new top-level routes here.
 */
export const RESERVED_USERNAMES: readonly string[] = [
  // web routes
  'accounts',
  'archive',
  'direct',
  'explore',
  'notifications',
  'reel',
  'reels',
  'stories',
  // API routes under /users
  'me',
  'suggestions',
  // framework and public files
  'api',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'manifest.webmanifest',
  'sw.js',
  // brand and staff-looking names
  'instagram',
  'admin',
  'support',
  'help',
  'settings',
];

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase());
}
export const FULL_NAME_MAX = 64;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const BIO_MAX = 150;
export const WEBSITE_MAX = 200;

export const CAPTION_MAX = 2200;
export const COMMENT_MAX = 2200;
export const MESSAGE_MAX = 4000;
/** Voice messages: longest recording and how many bars its waveform has */
export const VOICE_MAX_SECONDS = 60;
export const VOICE_WAVEFORM_BARS = 40;
export const GROUP_TITLE_MAX = 64;
export const GROUP_MEMBERS_MAX = 32;
export const HIGHLIGHT_TITLE_MAX = 30;

export const CAROUSEL_MAX_ITEMS = 10;
export const MAX_TAGGED_USERS = 20;

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const POST_VIDEO_MAX_SECONDS = 60;
export const REEL_MAX_SECONDS = 90;
export const STORY_VIDEO_MAX_SECONDS = 60;
export const STORY_IMAGE_SECONDS = 5;
export const STORY_TTL_HOURS = 24;

export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 50;

export const CALL_RING_TIMEOUT_SECONDS = 30;
export const CALL_MAX_PARTICIPANTS = 8;
/** LIVE-6: a live ends by itself when its host has been gone this long */
export const LIVE_HOST_GRACE_SECONDS = 60;
/** Live chat message length */
export const LIVE_COMMENT_MAX = 150;

export const MEDIA_FOLDERS = ['avatars', 'posts', 'reels', 'stories', 'messages'] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];
