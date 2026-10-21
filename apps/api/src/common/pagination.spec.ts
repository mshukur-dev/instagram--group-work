import { cursorArgs, toPage } from './pagination';

describe('pagination', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('builds prisma args for the first page', () => {
    expect(cursorArgs({ limit: 2 })).toEqual({ take: 3 });
  });

  it('builds prisma args after a cursor', () => {
    expect(cursorArgs({ limit: 2, cursor: 'b' })).toEqual({
      take: 3,
      skip: 1,
      cursor: { id: 'b' },
    });
  });

  it('returns nextCursor when there are more rows', () => {
    expect(toPage(rows, 2, (r) => r.id)).toEqual({ items: ['a', 'b'], nextCursor: 'b' });
  });

  it('returns null nextCursor on the last page', () => {
    expect(toPage(rows, 3, (r) => r.id)).toEqual({ items: ['a', 'b', 'c'], nextCursor: null });
  });
});
