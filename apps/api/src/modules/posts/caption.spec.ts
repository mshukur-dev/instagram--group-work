import { normalizeHashtag, parseHashtags, parseMentions } from './caption';

describe('caption parsing', () => {
  it('extracts unique lowercase hashtags, including unicode', () => {
    expect(parseHashtags('Sunset #Sun #sun at #мир_2026! #')).toEqual(['sun', 'мир_2026']);
    expect(parseHashtags(null)).toEqual([]);
  });

  it('extracts mentions and ignores emails', () => {
    expect(
      parseMentions('hi @Alex.Morgan. and @emma_design, mail me@example.com @alex.morgan'),
    ).toEqual(['alex.morgan', 'emma_design']);
    expect(parseMentions('@start of text')).toEqual(['start']);
  });

  it('normalizes route hashtag names', () => {
    expect(normalizeHashtag(' #Travel ')).toBe('travel');
  });
});
