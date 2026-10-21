/**
 * Test data: 10 users (password: password123), follows, posts, reels, stories, chats.
 * Run: pnpm --filter api db:seed  (wipes all data first!)
 */
import { PrismaClient, type User } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const USERS = [
  ['alex.morgan', 'Alex Morgan'],
  ['maria.ivanova', 'Maria Ivanova'],
  ['john_doe', 'John Doe'],
  ['kate.travels', 'Kate Wilson'],
  ['dmitry.photo', 'Dmitry Smirnov'],
  ['sofia.art', 'Sofia Rossi'],
  ['mike.fit', 'Mike Johnson'],
  ['anna_cooks', 'Anna Petrova'],
  ['leo.music', 'Leo Martin'],
  ['emma.design', 'Emma Brown'],
] as const;

// Public sample video from Google's test bucket
const SAMPLE_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const CAPTIONS = [
  'Golden hour never disappoints ☀️ #sunset #photography',
  'Weekend vibes with @maria.ivanova 🌿 #weekend',
  'New recipe turned out amazing 🍝 #food #homemade',
  'City lights 🌃 #travel #city',
  'Morning workout done 💪 #fitness',
  'Coffee first ☕ #mornings',
  'Throwback to the mountains 🏔️ #travel #nature',
  null,
];

const image = (seed: string, w = 1080, h = 1350) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length] as T;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

async function main(): Promise<void> {
  console.log('Wiping data…');
  await prisma.$transaction([
    prisma.notification.deleteMany(),
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
    prisma.user.deleteMany(), // cascades posts, likes, comments, follows, sessions…
  ]);

  console.log('Users…');
  const passwordHash = await argon2.hash('password123');
  const users: User[] = [];
  for (const [i, [username, fullName]] of USERS.entries()) {
    users.push(
      await prisma.user.create({
        data: {
          username,
          fullName,
          email: `${username.replace(/[._]/g, '')}@example.com`,
          passwordHash,
          avatarUrl: `https://i.pravatar.cc/300?img=${i + 10}`,
          bio: i % 2 === 0 ? 'Living my best life ✨' : null,
          isPrivate: i === 9, // emma.design is private
          notificationSettings: { create: {} },
        },
      }),
    );
  }
  const u = (i: number) => users[i % users.length]!;

  console.log('Follows…');
  for (let i = 0; i < users.length; i++) {
    for (let j = 1; j <= 5; j++) {
      const target = u(i + j);
      await prisma.follow.create({
        data: {
          followerId: u(i).id,
          followingId: target.id,
          status: target.isPrivate && j === 5 ? 'PENDING' : 'ACCEPTED',
        },
      });
    }
  }

  console.log('Posts and reels…');
  const hashtags = new Map<string, string>();
  let postIndex = 0;
  for (const author of users) {
    for (let k = 0; k < 4; k++) {
      const isReel = k === 3;
      const caption = pick(CAPTIONS, postIndex);
      const carousel = !isReel && postIndex % 3 === 0 ? 3 : 1;
      const post = await prisma.post.create({
        data: {
          authorId: author.id,
          type: isReel ? 'REEL' : 'POST',
          caption,
          createdAt: hoursAgo(postIndex * 5 + 1),
          media: {
            create: isReel
              ? [
                  {
                    type: 'VIDEO',
                    url: SAMPLE_VIDEO,
                    publicId: `seed/reel_${postIndex}`,
                    width: 1280,
                    height: 720,
                    duration: 15,
                    thumbnailUrl: image(`reel${postIndex}`, 720, 1280),
                    order: 0,
                  },
                ]
              : Array.from({ length: carousel }, (_, m) => ({
                  type: 'IMAGE' as const,
                  url: image(`post${postIndex}_${m}`),
                  publicId: `seed/post_${postIndex}_${m}`,
                  width: 1080,
                  height: 1350,
                  order: m,
                })),
          },
        },
      });
      postIndex++;

      for (const tag of caption?.match(/#[\p{L}\d_]+/gu) ?? []) {
        const name = tag.slice(1).toLowerCase();
        let id = hashtags.get(name);
        if (!id) {
          id = (await prisma.hashtag.create({ data: { name } })).id;
          hashtags.set(name, id);
        }
        await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: id } });
        await prisma.hashtag.update({ where: { id }, data: { postsCount: { increment: 1 } } });
      }

      // likes and comments from the next few users
      const likers = [1, 2, 3, 4].map((n) => u(users.indexOf(author) + n));
      for (const liker of likers.slice(0, (postIndex % 4) + 1)) {
        await prisma.like.create({ data: { userId: liker.id, postId: post.id } });
      }
      await prisma.comment.create({
        data: { postId: post.id, authorId: likers[0]!.id, text: 'Love this! 😍' },
      });
      await prisma.post.update({
        where: { id: post.id },
        data: {
          likesCount: (postIndex % 4) + 1,
          commentsCount: 1,
          viewsCount: isReel ? 100 + postIndex * 37 : 0,
        },
      });
    }
  }

  console.log('Stories…');
  for (const author of users.slice(0, 6)) {
    for (let s = 0; s < 2; s++) {
      const created = hoursAgo(s * 3 + 1);
      await prisma.story.create({
        data: {
          authorId: author.id,
          mediaType: 'IMAGE',
          url: image(`story_${author.username}_${s}`, 1080, 1920),
          publicId: `seed/story_${author.username}_${s}`,
          createdAt: created,
          expiresAt: new Date(created.getTime() + 24 * 3600_000),
        },
      });
    }
  }

  console.log('Conversations…');
  const direct = await prisma.conversation.create({
    data: { members: { create: [{ userId: u(0).id }, { userId: u(1).id }] } },
  });
  const texts = ['Hey! How are you?', 'Great, thanks! Saw your new post 🔥', 'Haha thanks 😄'];
  for (const [i, text] of texts.entries()) {
    await prisma.message.create({
      data: {
        conversationId: direct.id,
        senderId: i % 2 === 0 ? u(0).id : u(1).id,
        text,
        createdAt: hoursAgo(3 - i),
      },
    });
  }

  const group = await prisma.conversation.create({
    data: {
      isGroup: true,
      title: 'Weekend trip 🏕️',
      members: {
        create: [
          { userId: u(0).id, role: 'ADMIN' },
          { userId: u(1).id },
          { userId: u(2).id },
          { userId: u(3).id },
        ],
      },
    },
  });
  await prisma.message.create({
    data: {
      conversationId: group.id,
      senderId: u(0).id,
      type: 'SYSTEM',
      systemData: { action: 'GROUP_CREATED', actorId: u(0).id, targetIds: [] },
    },
  });
  await prisma.message.create({
    data: { conversationId: group.id, senderId: u(2).id, text: 'Who is driving? 🚗' },
  });

  // counters
  for (const user of users) {
    const [postsCount, followersCount, followingCount] = await Promise.all([
      prisma.post.count({ where: { authorId: user.id } }),
      prisma.follow.count({ where: { followingId: user.id, status: 'ACCEPTED' } }),
      prisma.follow.count({ where: { followerId: user.id, status: 'ACCEPTED' } }),
    ]);
    await prisma.user.update({
      where: { id: user.id },
      data: { postsCount, followersCount, followingCount },
    });
  }
  for (const c of [direct, group]) {
    const last = await prisma.message.findFirst({
      where: { conversationId: c.id },
      orderBy: { createdAt: 'desc' },
    });
    if (last) {
      await prisma.conversation.update({
        where: { id: c.id },
        data: { lastMessageAt: last.createdAt },
      });
    }
  }

  console.log(`Done: ${users.length} users, password "password123". Try: alex.morgan`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
