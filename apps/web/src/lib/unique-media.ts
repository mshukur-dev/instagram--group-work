import type { Post } from '@instagram/shared';

/** What a post shows first: two posts with the same picture or video look like a repeat */
export const mediaKey = (post: Post) => post.media[0]?.url ?? post.id;

/**
 * Keeps the first post for each picture / video. The demo world reuses some media between
 * accounts; a feed or Reels showing the same thing twice looks broken.
 */
export function uniqueByMedia(posts: Post[], seen: ReadonlySet<string> = new Set()): Post[] {
  const taken = new Set(seen);
  return posts.filter((post) => {
    const key = mediaKey(post);
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  });
}
