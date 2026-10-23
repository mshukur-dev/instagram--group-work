'use client';

import type { UserPreview } from '@instagram/shared';
import { CircleX, Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  useAddToSearchHistory,
  useClearSearchHistory,
  useRemoveFromSearchHistory,
  useSearchHistory,
} from '../queries';
import { UserRow } from './result-rows';
import { SearchResults } from './search-results';
import { TopReels } from './top-reels';

const centerClass = 'grid place-items-center py-10 text-sm text-muted-foreground';

function Recent({ onSelect }: { onSelect: (user: UserPreview) => void }) {
  const t = useTranslations('search');
  const { data: history, isPending } = useSearchHistory();
  const remove = useRemoveFromSearchHistory();
  const clear = useClearSearchHistory();

  return (
    <>
      <div className="flex items-center justify-between px-3 pt-2 pb-2">
        <h2 className="font-semibold">{t('recent')}</h2>
        {history && history.length > 0 && (
          <button
            type="button"
            onClick={() => clear.mutate()}
            className="rounded text-sm font-semibold text-brand outline-none transition-colors hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-ring"
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

// SEARCH-1…5: a page of its own. While the field is in use it shows recent searches or the
// results in tabs (Top, Accounts, Reels, Tags, Places); otherwise the Top grid.
export function SearchPage() {
  const t = useTranslations('search');
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const addToHistory = useAddToSearchHistory();
  const tagsOnly = debounced.startsWith('#');

  const cancel = () => {
    setQuery('');
    setActive(false);
    inputRef.current?.blur();
  };

  return (
    <div className="mx-auto w-full max-w-233.75 px-5 pt-8 pb-10 max-md:px-3 max-md:pt-3">
      <div className="mx-auto flex max-w-150 items-center gap-3">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-secondary px-4 transition-shadow focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setActive(true)}
            onKeyDown={(event) => event.key === 'Escape' && cancel()}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
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
        {active && (
          <button
            type="button"
            onClick={cancel}
            className="text-sm font-semibold outline-none hover:opacity-70 focus-visible:underline"
          >
            {t('cancel')}
          </button>
        )}
      </div>

      {!active ? (
        <TopReels />
      ) : (
        <div className="mx-auto mt-4 max-w-150">
          {debounced.replace(/^#+/, '') && query.trim() ? (
            <SearchResults
              key={tagsOnly ? 'tags' : 'all'}
              q={debounced}
              onSelectUser={(user) => addToHistory.mutate(user)}
            />
          ) : (
            <Recent onSelect={(user) => addToHistory.mutate(user)} />
          )}
        </div>
      )}
    </div>
  );
}
