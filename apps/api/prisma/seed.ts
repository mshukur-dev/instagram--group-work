/**
 * The demo world: ~300 people (10 original test accounts, 24 big themed accounts, the rest
 * ordinary users), ~1100 posts and ~270 reels with real photos and videos (Pixabay, copied to our
 * Cloudinary — see prisma/media), likes, comments with replies, follows, fresh stories,
 * highlights, chats and notifications. Password for every account: password123.
 * alex.morgan is the administrator. The 10 original accounts are real people's test logins;
 * everyone else is a demo account (email @bot.instagram.test) that the demo bots may act as.
 *
 * Run: pnpm --filter api db:seed   (WIPES ALL DATA FIRST)
 * Needs prisma/media/library.json (made by prisma/media/upload.ts).
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import type { LibraryItem } from './media/upload';
import {
  AUTHOR_REPLIES,
  BIOS,
  BLOGGERS,
  CAPTIONS,
  CHAT,
  COMMENTS,
  FIRST_EN_F,
  FIRST_EN_M,
  FIRST_RU_F,
  FIRST_RU_M,
  GROUPS,
  HASHTAGS,
  LAST_EN,
  LAST_RU,
  type Lang,
  ORIGINALS,
  PLACES,
  TOPIC_COMMENTS,
  TRANSLIT,
} from './seed-data';

const prisma = new PrismaClient();
const REGULAR_USERS = 266;
export const BOT_EMAIL_DOMAIN = '@bot.instagram.test';

// ───────────── Randomness (fixed seed: the same world every run) ─────────────

let state = 20261024;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;
const shuffle = <T>(list: T[]): T[] => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
};
const sample = <T>(list: readonly T[], n: number): T[] => shuffle([...list]).slice(0, n);
const id = () => `c${Date.now().toString(36)}${randomBytes(9).toString('hex')}`;

const NOW = Date.now();
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW - ms);
const after = (date: Date, maxMs: number) =>
  new Date(Math.min(NOW - 60_000, date.getTime() + rand() * maxMs));

async function insert<T>(label: string, rows: T[], write: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 2000) await write(rows.slice(i, i + 2000));
  console.log(`  ${label}: ${rows.length}`);
}

// ───────────── Media library ─────────────

const libraryPath = join(__dirname, 'media', 'library.json');
if (!existsSync(libraryPath)) {
  throw new Error(
    'prisma/media/library.json is missing: run prisma/media/collect.ts and upload.ts',
  );
}
const library = Object.values(
  JSON.parse(readFileSync(libraryPath, 'utf8')) as Record<string, LibraryItem>,
);

/** Hands out items of a topic in turns, so each one is reused as little as possible */
function pool(kind: LibraryItem['kind']) {
  const byTopic = new Map<string, LibraryItem[]>();
  for (const item of library.filter((i) => i.kind === kind)) {
    byTopic.set(item.topic, [...(byTopic.get(item.topic) ?? []), item]);
  }
  for (const list of byTopic.values()) shuffle(list);
  const cursor = new Map<string, number>();
  const all = [...byTopic.values()].flat();
  return (topic: string): LibraryItem => {
    const list = byTopic.get(topic) ?? all;
    const at = cursor.get(topic) ?? 0;
    cursor.set(topic, at + 1);
    return list[at % list.length]!;
  };
}
const nextImage = pool('image');
const nextVideo = pool('video');
const nextStory = pool('story');
const poster = (videoUrl: string) =>
  videoUrl.replace('/upload/', '/upload/so_1/').replace(/\.[a-z0-9]+$/i, '.jpg');

// ───────────── People ─────────────

type Kind = 'original' | 'blogger' | 'regular';
type Person = {
  id: string;
  username: string;
  fullName: string;
  lang: Lang;
  topics: string[];
  kind: Kind;
  isPrivate: boolean;
  avatarUrl: string | null;
  bio: string | null;
};

function makePeople(): Person[] {
  const people: Person[] = [];
  ORIGINALS.forEach((o, i) =>
    people.push({
      id: id(),
      username: o.username,
      fullName: o.fullName,
      lang: o.lang,
      topics: [...o.topics],
      kind: 'original',
      isPrivate: 'private' in o && o.private,
      avatarUrl: `https://i.pravatar.cc/300?img=${i + 10}`,
      bio: o.bio,
    }),
  );
  for (const b of BLOGGERS) {
    people.push({
      id: id(),
      username: b.username,
      fullName: b.fullName,
      lang: b.lang,
      topics: [b.topic],
      kind: 'blogger',
      isPrivate: false,
      avatarUrl: nextImage(b.avatar === 'topic' ? b.topic : 'people').url,
      bio: b.bio,
    });
  }

  const taken = new Set(people.map((p) => p.username));
  const topicIds = Object.keys(CAPTIONS);
  let menFace = 0;
  let womenFace = 0;
  for (let i = 0; i < REGULAR_USERS; i++) {
    const lang: Lang = chance(0.4) ? 'ru' : 'en';
    const female = chance(0.5);
    const first = pick(
      lang === 'ru' ? (female ? FIRST_RU_F : FIRST_RU_M) : female ? FIRST_EN_F : FIRST_EN_M,
    );
    let last = pick(lang === 'ru' ? LAST_RU : LAST_EN);
    if (lang === 'ru' && female) last = `${last}а`; // Иванова
    const latin = (s: string) => (TRANSLIT[s] ?? s).toLowerCase().replace(/а$/, 'a');
    const lf = latin(first);
    const ll = latin(last.replace(/а$/, ''));
    const shapes = [
      `${lf}.${ll}`,
      `${lf}_${ll}`,
      `${lf}${ll}${int(1, 99)}`,
      `${lf}.${int(90, 2006)}`,
      `its.${lf}`,
      `${lf}_${pick(['art', 'travels', 'life', 'photo', 'daily', 'xo'])}`,
    ];
    let username = pick(shapes);
    while (taken.has(username)) username = `${pick(shapes)}${int(1, 999)}`;
    taken.add(username);

    // Most have a face; a few keep the default picture
    let avatarUrl: string | null = null;
    if (chance(0.9)) {
      avatarUrl =
        female && womenFace < 100
          ? `https://randomuser.me/api/portraits/women/${womenFace++}.jpg`
          : !female && menFace < 100
            ? `https://randomuser.me/api/portraits/men/${menFace++}.jpg`
            : `https://i.pravatar.cc/300?img=${int(1, 70)}`;
    }
    people.push({
      id: id(),
      username,
      fullName: chance(0.85) ? `${first} ${last}` : first,
      lang,
      topics: sample(topicIds, int(2, 3)),
      kind: 'regular',
      isPrivate: chance(0.08),
      avatarUrl,
      bio: chance(0.55) ? pick(BIOS[lang]) : null,
    });
  }
  return people;
}

// ───────────── Main ─────────────

async function wipe() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.adminAction.deleteMany(),
    prisma.liveStream.deleteMany(),
    prisma.callParticipant.deleteMany(),
    prisma.messageReaction.deleteMany(),
    prisma.message.deleteMany(),
    prisma.call.deleteMany(),
    prisma.conversationMember.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.highlightItem.deleteMany(),
    prisma.highlight.deleteMany(),
    prisma.storyView.deleteMany(),
    prisma.story.deleteMany(),
    prisma.postHashtag.deleteMany(),
    prisma.hashtag.deleteMany(),
    prisma.location.deleteMany(),
    prisma.user.deleteMany(), // cascades posts, likes, comments, follows, sessions…
  ]);
}

async function main(): Promise<void> {
  console.log('Wiping data…');
  await wipe();

  console.log('People…');
  const people = makePeople();
  const byName = new Map(people.map((p) => [p.username, p]));
  const originals = people.filter((p) => p.kind === 'original');
  const bloggers = people.filter((p) => p.kind === 'blogger');
  const regulars = people.filter((p) => p.kind === 'regular');
  const passwordHash = await argon2.hash('password123');

  await insert(
    'users',
    people.map((p): Prisma.UserCreateManyInput => ({
      id: p.id,
      username: p.username,
      fullName: p.fullName,
      email:
        p.kind === 'original'
          ? `${p.username.replace(/[._]/g, '')}@example.com`
          : `${p.username.replace(/[^a-z0-9]/g, '')}.${p.id.slice(-4)}${BOT_EMAIL_DOMAIN}`,
      passwordHash,
      avatarUrl: p.avatarUrl,
      bio: p.bio,
      isPrivate: p.isPrivate,
      role: p.username === 'alex.morgan' ? 'ADMIN' : 'USER',
      isVerified: p.kind === 'blogger',
      language: p.lang === 'ru' ? 'RU' : 'EN',
      lastSeenAt: chance(0.3) ? ago(int(1, 50) * 60_000) : ago(int(1, 72) * HOUR),
      createdAt: ago(int(200, 900) * DAY),
    })),
    (rows) => prisma.user.createMany({ data: rows }),
  );
  await insert(
    'notification settings',
    people.map((p) => ({ userId: p.id })),
    (rows) => prisma.notificationSettings.createMany({ data: rows }),
  );

  // ── Follows ──
  console.log('Follows…');
  const follows = new Map<string, Prisma.FollowCreateManyInput>();
  const follow = (a: Person, b: Person, when = ago(int(1, 400) * DAY)) => {
    if (a.id === b.id || follows.has(`${a.id}|${b.id}`)) return;
    const pending = b.isPrivate && chance(0.25);
    follows.set(`${a.id}|${b.id}`, {
      followerId: a.id,
      followingId: b.id,
      status: pending ? 'PENDING' : 'ACCEPTED',
      createdAt: when,
    });
  };
  // The originals know each other (emma.design gets a couple of requests to answer)
  for (const a of originals) for (const b of originals) if (chance(0.7)) follow(a, b);
  // Big accounts: popular with almost everyone
  bloggers.forEach((b, i) => {
    const reach = 0.35 + ((i * 7) % 10) / 20; // 35%–80% of people
    for (const p of people) if (p.kind !== 'blogger' && chance(reach)) follow(p, b);
    for (const other of sample(bloggers, int(3, 8))) follow(b, other);
  });
  // Ordinary people follow a few dozen others, the originals get a crowd (some of it this week,
  // so their notifications have fresh follows)
  for (const p of regulars) {
    for (const other of sample(regulars, int(12, 45))) follow(p, other);
    for (const o of originals) {
      if (chance(0.3)) follow(p, o, chance(0.15) ? ago(int(1, 6 * 24) * HOUR) : undefined);
    }
  }
  for (const o of originals) {
    for (const other of sample(regulars, int(15, 35))) follow(o, other);
    for (const b of sample(bloggers, int(10, 18))) follow(o, b);
  }
  // Who follows whom, for picking likers and viewers
  const followersOf = new Map<string, string[]>();
  for (const f of follows.values()) {
    if (f.status !== 'ACCEPTED') continue;
    followersOf.set(f.followingId, [...(followersOf.get(f.followingId) ?? []), f.followerId]);
  }
  await insert('follows', [...follows.values()], (rows) =>
    prisma.follow.createMany({ data: rows }),
  );

  // ── Places and hashtags ──
  const places = PLACES.map((p) => ({ ...p, id: id() }));
  await insert('places', places, (rows) => prisma.location.createMany({ data: rows }));
  const hashtagIds = new Map<string, string>();
  const postHashtags: Prisma.PostHashtagCreateManyInput[] = [];

  // ── Posts and reels ──
  console.log('Posts and reels…');
  const posts: (Prisma.PostCreateManyInput & { id: string; createdAt: Date })[] = [];
  const media: Prisma.PostMediaCreateManyInput[] = [];
  const postTags: Prisma.PostTagCreateManyInput[] = [];
  const authorOf = new Map<string, Person>();
  const topicOf = new Map<string, string>();

  const caption = (author: Person, topic: string, placeName: string | null) => {
    if (chance(0.08)) return null;
    let text = pick(CAPTIONS[topic]?.[author.lang] ?? CAPTIONS.people![author.lang]);
    text = text.replace('{city}', placeName ?? (author.lang === 'ru' ? 'Москва' : 'Lisbon'));
    if (chance(0.65)) {
      const tags = sample(HASHTAGS[topic] ?? [], int(1, 4));
      if (tags.length) text += `\n\n${tags.map((t) => `#${t}`).join(' ')}`;
    }
    return text;
  };

  const addPost = (author: Person, type: 'POST' | 'REEL', createdAt: Date) => {
    const topic = pick(author.topics);
    const place =
      (topic === 'travel' || topic === 'city' || topic === 'coffee' || chance(0.25)) && chance(0.6)
        ? pick(places)
        : null;
    const postId = id();
    const text = caption(author, topic, place?.name ?? null);
    const reel = type === 'REEL';
    posts.push({
      id: postId,
      authorId: author.id,
      type,
      caption: text,
      locationId: place?.id ?? null,
      createdAt,
      viewsCount: reel
        ? author.kind === 'blogger'
          ? int(18_000, 2_400_000)
          : author.kind === 'original'
            ? int(800, 60_000)
            : int(120, 9_000)
        : 0,
    });
    authorOf.set(postId, author);
    topicOf.set(postId, topic);

    if (reel) {
      const video = nextVideo(topic);
      media.push({
        id: id(),
        postId,
        type: 'VIDEO',
        url: video.url,
        publicId: video.publicId,
        width: video.width,
        height: video.height,
        duration: video.duration ?? 15,
        thumbnailUrl: poster(video.url),
        order: 0,
      });
    } else {
      const count = chance(0.25) ? int(2, 4) : 1;
      for (let m = 0; m < count; m++) {
        const image = nextImage(topic);
        media.push({
          id: id(),
          postId,
          type: 'IMAGE',
          url: image.url,
          publicId: image.publicId,
          width: image.width,
          height: image.height,
          order: m,
        });
      }
    }

    for (const tag of text?.match(/#[\p{L}\d_]+/gu) ?? []) {
      const name = tag.slice(1).toLowerCase();
      let hashtagId = hashtagIds.get(name);
      if (!hashtagId) {
        hashtagId = id();
        hashtagIds.set(name, hashtagId);
      }
      postHashtags.push({ postId, hashtagId });
    }
    // Now and then a friend is tagged in the photo
    const friends = followersOf.get(author.id) ?? [];
    if (!reel && friends.length && chance(0.05)) postTags.push({ postId, userId: pick(friends) });
  };

  /** A history going back in time: the newest within `fresh` hours, then a gap each time */
  const history = (
    author: Person,
    total: number,
    reels: number,
    fresh: number,
    gapDays: [number, number],
  ) => {
    const kinds = shuffle([
      ...Array<'POST'>(total).fill('POST'),
      ...Array<'REEL'>(reels).fill('REEL'),
    ]);
    let at = NOW - rand() * fresh * HOUR;
    for (const kind of kinds) {
      addPost(author, kind, new Date(at));
      at -= (gapDays[0] + rand() * (gapDays[1] - gapDays[0])) * DAY;
    }
  };
  for (const b of bloggers) history(b, int(16, 26), int(6, 10), 30, [1, 4]);
  for (const o of originals) history(o, int(10, 16), int(2, 4), 72, [2, 9]);
  for (const r of regulars) {
    if (chance(0.12)) continue; // lurkers: no posts at all
    history(r, int(0, 6), chance(0.25) ? 1 : 0, 24 * 20, [4, 30]);
  }
  await insert('posts', posts, (rows) => prisma.post.createMany({ data: rows }));
  await insert('post media', media, (rows) => prisma.postMedia.createMany({ data: rows }));
  await insert(
    'hashtags',
    [...hashtagIds].map(([name, hid]) => ({ id: hid, name })),
    (rows) => prisma.hashtag.createMany({ data: rows }),
  );
  await insert('post hashtags', postHashtags, (rows) =>
    prisma.postHashtag.createMany({ data: rows, skipDuplicates: true }),
  );
  await insert('photo tags', postTags, (rows) =>
    prisma.postTag.createMany({ data: rows, skipDuplicates: true }),
  );

  // ── Likes, comments, saves ──
  console.log('Likes and comments…');
  const allIds = people.map((p) => p.id);
  const personById = new Map(people.map((p) => [p.id, p]));
  const likes: Prisma.LikeCreateManyInput[] = [];
  const comments: (Prisma.CommentCreateManyInput & { id: string; createdAt: Date })[] = [];
  const commentLikes: Prisma.CommentLikeCreateManyInput[] = [];

  for (const post of posts) {
    const author = authorOf.get(post.id)!;
    const reel = post.type === 'REEL';
    const audience = followersOf.get(author.id) ?? [];
    const [min, max] =
      author.kind === 'blogger' ? [45, 230] : author.kind === 'original' ? [12, 70] : [1, 30];
    const want = Math.round(int(min, max) * (reel ? 1.25 : 1));
    // Mostly their followers, a few strangers from Explore
    const likers = new Set<string>(sample(audience, Math.round(want * 0.85)));
    for (const other of sample(allIds, Math.round(want * 0.25))) {
      if (likers.size >= want) break;
      if (other !== author.id) likers.add(other);
    }
    for (const userId of likers)
      likes.push({ userId, postId: post.id, createdAt: after(post.createdAt, 3 * DAY) });

    const topic = topicOf.get(post.id)!;
    const [cmin, cmax] =
      author.kind === 'blogger' ? [4, 22] : author.kind === 'original' ? [2, 10] : [0, 5];
    const voices = [...likers];
    for (let c = int(cmin, cmax); c > 0 && voices.length; c--) {
      const who = personById.get(pick(voices))!;
      const own = TOPIC_COMMENTS[topic]?.[who.lang];
      const commentId = id();
      const createdAt = after(post.createdAt, 2 * DAY);
      comments.push({
        id: commentId,
        postId: post.id,
        authorId: who.id,
        text: own && chance(0.5) ? pick(own) : pick(COMMENTS[who.lang]),
        createdAt,
      });
      // The author answers some and likes more
      if (chance(0.22)) {
        comments.push({
          id: id(),
          postId: post.id,
          authorId: author.id,
          parentId: commentId,
          text: `@${who.username} ${pick(AUTHOR_REPLIES[author.lang])}`,
          createdAt: after(createdAt, 6 * HOUR),
        });
      }
      if (chance(0.35)) commentLikes.push({ userId: author.id, commentId });
      for (const fan of sample(voices, int(0, 3))) {
        if (fan !== who.id && fan !== author.id) commentLikes.push({ userId: fan, commentId });
      }
    }
  }
  await insert('likes', likes, (rows) =>
    prisma.like.createMany({ data: rows, skipDuplicates: true }),
  );
  await insert(
    'comments',
    comments.filter((c) => !c.parentId),
    (rows) => prisma.comment.createMany({ data: rows }),
  );
  await insert(
    'replies',
    comments.filter((c) => c.parentId),
    (rows) => prisma.comment.createMany({ data: rows }),
  );
  await insert('comment likes', commentLikes, (rows) =>
    prisma.commentLike.createMany({ data: rows, skipDuplicates: true }),
  );

  const saves: Prisma.SavedPostCreateManyInput[] = [];
  for (const o of originals) {
    for (const post of sample(posts, int(10, 22))) {
      if (post.authorId !== o.id)
        saves.push({ userId: o.id, postId: post.id, createdAt: after(post.createdAt, 5 * DAY) });
    }
  }
  await insert('saves', saves, (rows) =>
    prisma.savedPost.createMany({ data: rows, skipDuplicates: true }),
  );

  // ── Stories (fresh, for today) and highlights ──
  console.log('Stories…');
  const stories: (Prisma.StoryCreateManyInput & { id: string; createdAt: Date })[] = [];
  const views: Prisma.StoryViewCreateManyInput[] = [];
  const storyFor = (author: Person, createdAt: Date) => {
    const topic = pick(author.topics);
    const storyId = id();
    if (chance(0.25)) {
      const video = nextVideo(topic);
      stories.push({
        id: storyId,
        authorId: author.id,
        mediaType: 'VIDEO',
        url: video.url,
        publicId: video.publicId,
        thumbnailUrl: poster(video.url),
        duration: Math.min(video.duration ?? 15, 15),
        createdAt,
        expiresAt: new Date(createdAt.getTime() + DAY),
      });
    } else {
      const image = nextStory(topic);
      stories.push({
        id: storyId,
        authorId: author.id,
        mediaType: 'IMAGE',
        url: image.url,
        publicId: image.publicId,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + DAY),
      });
    }
    return storyId;
  };
  const storytellers = [...bloggers, ...originals, ...regulars.filter(() => chance(0.38))];
  for (const author of storytellers) {
    for (let s = int(1, 4); s > 0; s--) {
      const storyId = storyFor(author, ago((0.2 + rand() * 19) * HOUR));
      // Followers watch; the originals leave plenty unseen so their tray has colored rings
      for (const viewer of followersOf.get(author.id) ?? []) {
        const v = personById.get(viewer)!;
        if (!chance(v.kind === 'original' ? 0.25 : 0.55)) continue;
        views.push({
          storyId,
          viewerId: viewer,
          liked: chance(0.08),
          createdAt: ago(rand() * 0.2 * HOUR),
        });
      }
    }
  }
  // Highlights: old stories kept on the profile
  const highlights: Prisma.HighlightCreateManyInput[] = [];
  const highlightItems: Prisma.HighlightItemCreateManyInput[] = [];
  const titles: Record<Lang, string[]> = {
    en: ['Best of', 'Trips', 'Friends', 'Food', 'Behind the scenes', 'Summer', 'Q&A'],
    ru: ['Лучшее', 'Поездки', 'Друзья', 'Еда', 'Закулисье', 'Лето', 'Вопросы'],
  };
  for (const owner of [...bloggers, ...originals]) {
    for (const title of sample(titles[owner.lang], int(2, 4))) {
      const highlightId = id();
      const items = Array.from({ length: int(3, 5) }, () =>
        storyFor(owner, ago(int(30, 300) * DAY + int(0, 20) * HOUR)),
      );
      const cover = stories.find((s) => s.id === items[0])!;
      highlights.push({
        id: highlightId,
        ownerId: owner.id,
        title,
        coverUrl: cover.thumbnailUrl ?? cover.url,
        createdAt: ago(int(20, 200) * DAY),
      });
      for (const storyId of items) highlightItems.push({ highlightId, storyId });
    }
  }
  await insert('stories', stories, (rows) => prisma.story.createMany({ data: rows }));
  await insert('story views', views, (rows) =>
    prisma.storyView.createMany({ data: rows, skipDuplicates: true }),
  );
  await insert('highlights', highlights, (rows) => prisma.highlight.createMany({ data: rows }));
  await insert('highlight items', highlightItems, (rows) =>
    prisma.highlightItem.createMany({ data: rows }),
  );

  // ── Chats ──
  console.log('Chats…');
  const conversations: Prisma.ConversationCreateManyInput[] = [];
  const members: Prisma.ConversationMemberCreateManyInput[] = [];
  const messages: (Prisma.MessageCreateManyInput & { id: string })[] = [];
  const reactions: Prisma.MessageReactionCreateManyInput[] = [];
  const pairs = new Set<string>();
  const reels = posts.filter((p) => p.type === 'REEL');

  for (const me of originals) {
    const partners = [
      ...sample(
        originals.filter((o) => o.id !== me.id),
        3,
      ),
      ...sample(bloggers, 2),
      ...sample(regulars, 8),
    ];
    for (const other of partners) {
      const key = [me.id, other.id].sort().join('|');
      if (pairs.has(key)) continue;
      pairs.add(key);
      const conversationId = id();
      const lang: Lang =
        me.lang === 'ru' || other.lang === 'ru' ? (chance(0.8) ? 'ru' : 'en') : 'en';
      const lines = [...pick(CHAT[lang]), ...(chance(0.4) ? pick(CHAT[lang]) : [])];
      // Recent chats first in the inbox: the last message minutes to days ago
      let at =
        NOW - (chance(0.4) ? rand() * 5 * HOUR : rand() * 9 * DAY) - lines.length * 4 * 60_000;
      const starter = chance(0.5) ? me : other;
      let last = { at, sender: starter.id };
      lines.forEach((text, i) => {
        const sender = i % 2 === 0 ? starter : starter === me ? other : me;
        at += int(1, 25) * 60_000;
        const messageId = id();
        messages.push({
          id: messageId,
          conversationId,
          senderId: sender.id,
          text,
          createdAt: new Date(at),
        });
        if (chance(0.15)) {
          const reactor = sender === me ? other : me;
          reactions.push({ messageId, userId: reactor.id, emoji: pick(['❤️', '😂', '🔥', '👍']) });
        }
        last = { at, sender: sender.id };
      });
      // Someone shares a reel now and then
      if (chance(0.3) && reels.length) {
        at += int(2, 60) * 60_000;
        messages.push({
          id: id(),
          conversationId,
          senderId: other.id,
          type: 'POST_SHARE',
          postId: pick(reels).id,
          createdAt: new Date(at),
        });
        last = { at, sender: other.id };
      }
      const lastAt = new Date(Math.min(at, NOW - 60_000));
      conversations.push({
        id: conversationId,
        lastMessageAt: lastAt,
        createdAt: ago(int(10, 200) * DAY),
      });
      // A few unread chats waiting for the originals
      const unread = last.sender !== me.id && chance(0.45);
      members.push(
        {
          conversationId,
          userId: me.id,
          lastReadAt: unread ? new Date(lastAt.getTime() - 60_000 * int(2, 30)) : new Date(NOW),
        },
        { conversationId, userId: other.id, lastReadAt: new Date(NOW) },
      );
    }
  }
  for (const g of GROUPS) {
    const conversationId = id();
    const crew = [...sample(originals, 3), ...sample(regulars, int(2, 3))];
    const admin = crew[0]!;
    let at = NOW - int(2, 48) * HOUR;
    messages.push({
      id: id(),
      conversationId,
      senderId: admin.id,
      type: 'SYSTEM',
      systemData: { action: 'GROUP_CREATED', actorId: admin.id, targetIds: [] },
      createdAt: new Date(at - DAY),
    });
    for (const text of g.lines) {
      at += int(1, 40) * 60_000;
      messages.push({
        id: id(),
        conversationId,
        senderId: pick(crew).id,
        text,
        createdAt: new Date(at),
      });
    }
    conversations.push({
      id: conversationId,
      isGroup: true,
      title: g.title,
      lastMessageAt: new Date(Math.min(at, NOW - 60_000)),
      createdAt: new Date(at - DAY),
    });
    crew.forEach((member, i) =>
      members.push({
        conversationId,
        userId: member.id,
        role: i === 0 ? 'ADMIN' : 'MEMBER',
        lastReadAt: chance(0.5) ? new Date(NOW) : new Date(at - 30 * 60_000),
        joinedAt: new Date(at - DAY),
      }),
    );
  }
  await insert('conversations', conversations, (rows) =>
    prisma.conversation.createMany({ data: rows }),
  );
  await insert('members', members, (rows) => prisma.conversationMember.createMany({ data: rows }));
  await insert('messages', messages, (rows) => prisma.message.createMany({ data: rows }));
  await insert('reactions', reactions, (rows) =>
    prisma.messageReaction.createMany({ data: rows, skipDuplicates: true }),
  );

  // ── Notifications for the originals (from what happened above) ──
  console.log('Notifications…');
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const fresh = (date: Date) => date.getTime() > NOW - 14 * DAY;
  const read = (date: Date) => date.getTime() < NOW - 20 * HOUR || chance(0.4);
  for (const o of originals) {
    const mine = new Set(posts.filter((p) => p.authorId === o.id).map((p) => p.id));
    const recentLikes = likes.filter((l) => mine.has(l.postId) && fresh(l.createdAt as Date));
    for (const l of sample(recentLikes, 45)) {
      notifications.push({
        recipientId: o.id,
        actorId: l.userId,
        type: 'POST_LIKE',
        postId: l.postId,
        isRead: read(l.createdAt as Date),
        createdAt: l.createdAt,
      });
    }
    for (const c of comments
      .filter((x) => mine.has(x.postId) && x.authorId !== o.id && fresh(x.createdAt))
      .slice(0, 25)) {
      notifications.push({
        recipientId: o.id,
        actorId: c.authorId,
        type: 'COMMENT',
        postId: c.postId,
        commentId: c.id,
        isRead: read(c.createdAt),
        createdAt: c.createdAt,
      });
    }
    for (const f of follows.values()) {
      if (f.followingId !== o.id || !fresh(f.createdAt as Date)) continue;
      notifications.push({
        recipientId: o.id,
        actorId: f.followerId,
        type: f.status === 'PENDING' ? 'FOLLOW_REQUEST' : 'FOLLOW',
        isRead: read(f.createdAt as Date),
        createdAt: f.createdAt,
      });
    }
    const myStories = new Set(stories.filter((s) => s.authorId === o.id).map((s) => s.id));
    for (const v of views.filter((x) => x.liked && myStories.has(x.storyId))) {
      notifications.push({
        recipientId: o.id,
        actorId: v.viewerId,
        type: 'STORY_LIKE',
        storyId: v.storyId,
        isRead: false,
        createdAt: v.createdAt,
      });
    }
  }
  await insert('notifications', notifications, (rows) =>
    prisma.notification.createMany({ data: rows }),
  );

  // ── Counters, all at once ──
  console.log('Counters…');
  await prisma.$executeRawUnsafe(`
    UPDATE "users" u SET
      "postsCount" = (SELECT count(*) FROM "posts" p WHERE p."authorId" = u.id),
      "followersCount" = (SELECT count(*) FROM "follows" f WHERE f."followingId" = u.id AND f.status = 'ACCEPTED'),
      "followingCount" = (SELECT count(*) FROM "follows" f WHERE f."followerId" = u.id AND f.status = 'ACCEPTED')`);
  await prisma.$executeRawUnsafe(`
    UPDATE "posts" p SET
      "likesCount" = (SELECT count(*) FROM "likes" l WHERE l."postId" = p.id),
      "commentsCount" = (SELECT count(*) FROM "comments" c WHERE c."postId" = p.id)`);
  await prisma.$executeRawUnsafe(`
    UPDATE "comments" c SET
      "likesCount" = (SELECT count(*) FROM "comment_likes" cl WHERE cl."commentId" = c.id),
      "repliesCount" = (SELECT count(*) FROM "comments" r WHERE r."parentId" = c.id)`);
  await prisma.$executeRawUnsafe(`
    UPDATE "hashtags" h SET "postsCount" = (SELECT count(*) FROM "post_hashtags" ph WHERE ph."hashtagId" = h.id)`);
  await prisma.$executeRawUnsafe(`
    UPDATE "stories" s SET "viewsCount" = (SELECT count(*) FROM "story_views" v WHERE v."storyId" = s.id)`);
  // Big accounts look big: their follower count includes an audience beyond this small world
  for (const b of bloggers) {
    await prisma.user.update({
      where: { id: b.id },
      data: { followersCount: { increment: int(8, 900) * 1000 + int(0, 999) } },
    });
  }

  console.log(
    `Done: ${people.length} people, ${posts.length} posts (${reels.length} reels), ${likes.length} likes, ${comments.length} comments, ${stories.length} stories.`,
  );
  console.log('Password for everyone: password123. Try alex.morgan (admin) or john_doe.');
  void byName;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
