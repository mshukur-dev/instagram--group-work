'use client';

import type { Hashtag, UserPreview } from '@instagram/shared';
import { CircleX, Hash, Loader2, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { storyRing } from '@/components/story-avatar';
import { UserAvatar } from '@/components/user-avatar';
import { useUserSearch } from '@/features/direct/queries';
import {
  useAddToSearchHistory,
  useClearSearchHistory,
  useHashtagSearch,
  useRemoveFromSearchHistory,
  useSearchHistory,
} from '../queries';

const rowClass =
  'flex w-full items-center gap-3 px-6 py-2 outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6 max-md:px-4';
const centerClass = 'grid place-items-center px-6 py-10 text-sm text-muted-foreground';

function UserRow({
  user,
  onSelect,
  onRemove,
}: {
  user: UserPreview;
  onSelect: (user: UserPreview) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations('search');
  return (
    <li className="relative">
      <Link href={`/${user.username}`} onClick={() => onSelect(user)} className={rowClass}>
        <UserAvatar src={user.avatarUrl} alt="" size={44} ring={storyRing(user)} />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-semibold">{user.username}</span>
          <span className="block truncate text-muted-foreground">{user.fullName}</span>
        </span>
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('remove', { username: user.username })}
          className="absolute top-1/2 right-4 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </button>
      )}
    </li>
  );
}

function HashtagRow({ hashtag, onSelect }: { hashtag: Hashtag; onSelect: () => void }) {
  const t = useTranslations('search');
  return (
    <li>
      <Link
        href={`/explore/tags/${encodeURIComponent(hashtag.name)}`}
        onClick={onSelect}
        className={rowClass}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border">
          <Hash className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-semibold">#{hashtag.name}</span>
          <span className="block truncate text-muted-foreground">
            {t('postsCount', { count: hashtag.postsCount })}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Recent({ onSelect }: { onSelect: (user: UserPreview) => void }) {
  const t = useTranslations('search');
  const { data: history, isPending } = useSearchHistory();
  const remove = useRemoveFromSearchHistory();
  const clear = useClearSearchHistory();

  return (
    <>
      <div className="flex items-center justify-between px-6 pt-5 pb-2 max-md:px-4">
        <h3 className="font-semibold">{t('recent')}</h3>
        {history && history.length > 0 && (
          <button
            type="button"
            onClick={() => clear.mutate()}
            className="rounded text-sm font-semibold text-brand outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('clearAll')}
          </button>
        )}
      </div>
      {isPending ? (
        <div className={centerClass}>
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : history && history.length > 0 ? (
        <ul>
          {history.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onSelect={onSelect}
              onRemove={() => remove.mutate(user.id)}
            />
          ))}
        </ul>
      ) : (
        <p className={centerClass}>{t('noRecent')}</p>
      )}
    </>
  );
}

// SEARCH-1…3: accounts and hashtags by name; with an empty field, recent searches.
// A query that starts with # looks for hashtags only.
export function SearchContent({ onSelect }: { onSelect?: () => void }) {
  const t = useTranslations('search');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const tagsOnly = debounced.startsWith('#');
  const tagQuery = debounced.replace(/^#+/, '');
  const people = useUserSearch(tagsOnly ? '' : debounced);
  const hashtags = useHashtagSearch(tagQuery);
  const addToHistory = useAddToSearchHistory();

  const users = tagsOnly ? [] : (people.data ?? []);
  const tags = tagQuery ? (hashtags.data ?? []) : [];
  const searching = people.isFetching || hashtags.isFetching || debounced !== query.trim();

  const selectUser = (user: UserPreview) => {
    addToHistory.mutate(user);
    onSelect?.();
  };

  return (
    <div className="flex h-full flex-col">
      <h2 className="px-6 pt-6 pb-8 text-2xl font-semibold max-md:hidden">{t('title')}</h2>
      <div className="px-4 pb-6 max-md:py-3">
        <label className="flex h-10 items-center gap-2 rounded-lg bg-secondary px-4 transition-shadow focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('clear')}
              className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CircleX className="size-4" />
            </button>
          )}
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border pb-4">
        {!query.trim() ? (
          <Recent onSelect={selectUser} />
        ) : users.length > 0 || tags.length > 0 ? (
          <ul className="pt-2">
            {users.map((user) => (
              <UserRow key={user.id} user={user} onSelect={selectUser} />
            ))}
            {tags.map((hashtag) => (
              <HashtagRow key={hashtag.name} hashtag={hashtag} onSelect={() => onSelect?.()} />
            ))}
          </ul>
        ) : (
          <div className={centerClass}>
            {searching ? <Loader2 className="size-5 animate-spin" /> : t('empty')}
          </div>
        )}
      </div>
    </div>
  );
}
