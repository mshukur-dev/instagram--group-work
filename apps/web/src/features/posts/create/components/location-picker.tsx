'use client';

import type { Place } from '@instagram/shared';
import { Loader2, MapPin, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { usePlaceSearch } from '../../queries';

type Props = { value: Place | null; onChange: (place: Place | null) => void };

// "Add location" in the post details: a row that turns into a search field; places come from
// OpenStreetMap (through our API). The picked place shows with its address and a cross.
export function LocationPicker({ value, onChange }: Props) {
  const t = useTranslations('createPost.location');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const places = usePlaceSearch(debounced);
  const results = places.data ?? [];
  const waiting = query.trim().length >= 2 && (debounced !== query.trim() || places.isFetching);

  const pick = (place: Place) => {
    onChange(place);
    setSearching(false);
    setQuery('');
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 border-t border-border/50 px-4 py-3">
        <MapPin className="size-5 shrink-0 text-brand" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-semibold">{value.name}</span>
          {value.address && (
            <span className="block truncate text-xs text-muted-foreground">{value.address}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('remove')}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (!searching) {
    return (
      <button
        type="button"
        onClick={() => {
          setSearching(true);
          requestAnimationFrame(() => field.current?.focus());
        }}
        className="flex w-full items-center justify-between border-t border-border/50 px-4 py-3.5 text-left text-[15px] outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6"
      >
        {t('add')}
        <MapPin className="size-5" />
      </button>
    );
  }

  return (
    <div className="flex min-h-0 flex-col border-t border-border/50">
      <div className="flex items-center gap-2 px-4 py-2">
        <MapPin className="size-5 shrink-0 text-muted-foreground" />
        <input
          ref={field}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setSearching(false);
              setQuery('');
            }
            const [first] = results;
            if (event.key === 'Enter' && first) {
              event.preventDefault();
              pick(first);
            }
          }}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {waiting ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => {
              setSearching(false);
              setQuery('');
            }}
            aria-label={t('cancel')}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {query.trim().length >= 2 && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            data-scrollable
            className="max-h-56 overflow-y-auto"
          >
            {places.isError ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">{t('unavailable')}</li>
            ) : results.length === 0 && !waiting ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">{t('empty')}</li>
            ) : (
              results.map((place) => (
                <li key={place.osmId}>
                  <button
                    type="button"
                    onClick={() => pick(place)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary">
                      <MapPin className="size-4" />
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-semibold">{place.name}</span>
                      {place.address && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {place.address}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
