import type { Prisma } from '@prisma/client';

/**
 * Hashtag bookkeeping inside the post transaction (docs/spec/database.md §4):
 * PostHashtag links + Hashtag.postsCount. Hashtags that drop to 0 posts are deleted,
 * so search never suggests empty tags.
 */
export async function attachHashtags(
  tx: Prisma.TransactionClient,
  postId: string,
  names: string[],
): Promise<void> {
  if (names.length === 0) return;
  const hashtagIds: string[] = [];
  for (const name of names) {
    const tag = await tx.hashtag.upsert({
      where: { name },
      create: { name, postsCount: 1 },
      update: { postsCount: { increment: 1 } },
      select: { id: true },
    });
    hashtagIds.push(tag.id);
  }
  await tx.postHashtag.createMany({
    data: hashtagIds.map((hashtagId) => ({ postId, hashtagId })),
    skipDuplicates: true,
  });
}

export async function detachHashtags(
  tx: Prisma.TransactionClient,
  postId: string,
  hashtagIds: string[],
): Promise<void> {
  if (hashtagIds.length === 0) return;
  await tx.postHashtag.deleteMany({ where: { postId, hashtagId: { in: hashtagIds } } });
  await tx.hashtag.updateMany({
    where: { id: { in: hashtagIds } },
    data: { postsCount: { decrement: 1 } },
  });
  await tx.hashtag.deleteMany({ where: { id: { in: hashtagIds }, postsCount: { lte: 0 } } });
}
