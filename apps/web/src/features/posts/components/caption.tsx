'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Fragment, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Same rules as the API (apps/api/src/modules/posts/caption.ts), so a link appears exactly
// for the hashtags and mentions the server stored.
const TOKEN_RE = /#[\p{L}\p{N}_]+|(?<![\p{L}\p{N}_.@])@[a-z0-9._]+/giu;

const linkClass =
  'rounded-sm font-medium text-brand outline-none transition-colors hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-ring/60';

// POST-4: `#tag` and `@user` in a caption are links
export function renderCaption(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index;
    const raw = match[0];
    nodes.push(text.slice(cursor, start));

    if (raw.startsWith('#')) {
      const name = raw.slice(1).toLowerCase().slice(0, 64);
      nodes.push(
        <Link key={start} href={`/explore/tags/${encodeURIComponent(name)}`} className={linkClass}>
          {raw}
        </Link>,
      );
      cursor = start + raw.length;
    } else {
      // "@alex." at the end of a sentence: the dot is punctuation, not part of the name
      const name = raw.replace(/\.+$/, '');
      nodes.push(
        <Link key={start} href={`/${name.slice(1).toLowerCase()}`} className={linkClass}>
          {name}
        </Link>,
      );
      cursor = start + name.length;
    }
  }
  nodes.push(text.slice(cursor));
  return nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}

type Props = {
  username: string;
  text: string;
  className?: string;
};

// Author name + caption. Long captions are cut to two lines with a "more" button, as in Instagram.
export function Caption({ username, text, className }: Props) {
  const t = useTranslations('post');
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 110 || text.split('\n').length > 2;

  return (
    <div className={className}>
      <p className={cn('break-words whitespace-pre-line', isLong && !expanded && 'line-clamp-2')}>
        <Link href={`/${username}`} className="mr-1 font-semibold">
          {username}
        </Link>
        {renderCaption(text)}
      </p>
      {isLong && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-muted-foreground hover:text-foreground rounded-sm text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {t('captionMore')}
        </button>
      )}
    </div>
  );
}
