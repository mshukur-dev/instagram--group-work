import { USERNAME_MAX } from '@instagram/shared';

/** Longest hashtag we store; longer ones are cut. */
export const HASHTAG_MAX = 64;

const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
const MENTION_RE = /(?:^|[^\p{L}\p{N}_.@])@([a-z0-9._]+)/giu;

/** `#Sun #sun #мир` → ['sun', 'мир']: lowercase, unique, in order of appearance. */
export function parseHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const names = [...text.matchAll(HASHTAG_RE)].map((m) =>
    (m[1] ?? '').toLowerCase().slice(0, HASHTAG_MAX),
  );
  return [...new Set(names.filter(Boolean))];
}

/** `hi @Alex.Morgan.` → ['alex.morgan']: lowercase, unique, trailing dots dropped. */
export function parseMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  const names = [...text.matchAll(MENTION_RE)].map((m) =>
    (m[1] ?? '').toLowerCase().replace(/\.+$/, ''),
  );
  return [...new Set(names.filter((n) => n.length > 0 && n.length <= USERNAME_MAX))];
}

/** `#Travel` / `travel` → `travel` (route param of /hashtags/:name). */
export function normalizeHashtag(name: string): string {
  return name.trim().replace(/^#/, '').toLowerCase().slice(0, HASHTAG_MAX);
}
