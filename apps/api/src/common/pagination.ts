import type { Page, PageQuery } from '@instagram/shared';

/**
 * Cursor pagination for tables with an `id` column.
 * Fetches one extra row to know whether there is a next page.
 *
 *   const rows = await prisma.post.findMany({
 *     where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
 *     ...cursorArgs(query),
 *   });
 *   return toPage(rows, query.limit, (row) => mapPost(row));
 */
export function cursorArgs(query: PageQuery): {
  take: number;
  skip?: number;
  cursor?: { id: string };
} {
  return query.cursor
    ? { take: query.limit + 1, skip: 1, cursor: { id: query.cursor } }
    : { take: query.limit + 1 };
}

export function toPage<Row extends { id: string }, Item>(
  rows: Row[],
  limit: number,
  map: (row: Row) => Item,
): Page<Item> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map(map),
    nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
  };
}

/**
 * Same as toPage, for rows without `id` (likes, follows…) where the cursor
 * is another unique value, e.g. the related user id.
 */
export function toPageBy<Row, Item>(
  rows: Row[],
  limit: number,
  getCursor: (row: Row) => string,
  map: (row: Row) => Item,
): Page<Item> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  return {
    items: pageRows.map(map),
    nextCursor: hasMore && last ? getCursor(last) : null,
  };
}
