'use client';

import type { Post, UserPreview } from '@instagram/shared';
import { Loader2, SearchX } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useInView } from 'react-intersection-observer';
import { useUserSearch } from '@/features/direct/queries';
import { cn } from '@/lib/utils';
import { useHashtagSearch, useSearchPlaces, useSearchPosts } from '../queries';
import { PostTile } from './post-tile';
import { HashtagRow, PlaceRow, UserRow } from './result-rows';
import { TopReelViewer } from './top-reel-viewer';

const TABS = ['top', 'accounts', 'reels', 'tags', 'places'] as const;
type Tab = (typeof TABS)[number];

// How much of each kind the Top tab shows before "See all"
const TOP_ACCOUNTS = 3;
const TOP_TAGS = 3;
const TOP_PLACES = 2;
const TOP_POSTS = 9;

const centerClass = 'grid place-items-center py-12 text-sm text-muted-foreground';

// SEARCH-1…5: what the field found, in tabs like Instagram's: Top (a little of everything),
// Accounts, Reels, Tags and Places. A query starting with # opens on Tags. Each tab asks the
// API only once it is shown (Top asks for everything). The page remounts it when a # is typed
// or removed, so the tab starts over.
export function SearchResults({
  q,
  onSelectUser,
}: {
  q: string;
  onSelectUser: (user: UserPreview) => void;
}) {
  const t = useTranslations('search');
  const reduceMotion = useReducedMotion();
  const tagsOnly = q.startsWith('#');
  const words = q.replace(/^#+/, '');
  const [tab, setTab] = useState<Tab>(tagsOnly ? 'tags' : 'top');
  const [openReel, setOpenReel] = useState<string | null>(null);
  const closeReel = useCallback(() => setOpenReel(null), []);

  const wants = (kind: Tab) => tab === kind || tab === 'top';
  const people = useUserSearch(wants('accounts') && !tagsOnly ? words : '');
  const tags = useHashtagSearch(wants('tags') ? words : '');
  const places = useSearchPlaces(wants('places') && !tagsOnly ? words : '');
  const mixed = useSearchPosts(tab === 'top' ? words : '');
  const reels = useSearchPosts(tab === 'reels' ? words : '', 'REEL');

  const users = people.data ?? [];
  const hashtags = tags.data ?? [];
  const spots = places.data ?? [];
  const mixedPosts = mixed.data?.pages.flatMap((p) => p.items) ?? [];
  const reelPosts = reels.data?.pages.flatMap((p) => p.items) ?? [];

  const pending = (query: { isPending: boolean; fetchStatus: string }) =>
    query.isPending && query.fetchStatus !== 'idle';

  const openTile = (post: Post) => (post.type === 'REEL' ? () => setOpenReel(post.id) : undefined);

  const empty = (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="grid size-15.5 place-items-center rounded-full border-2 border-foreground">
        <SearchX className="size-7" strokeWidth={1.5} />
      </span>
      <p className="max-w-64 text-sm text-muted-foreground">{t('noResults', { q })}</p>
    </div>
  );
  const spinner = (
    <div className={centerClass}>
      <Loader2 className="size-5 animate-spin" />
    </div>
  );

  let body: ReactNode;
  if (tab === 'top') {
    const anything = users.length + hashtags.length + spots.length + mixedPosts.length > 0;
    const loading = [people, tags, places, mixed].some(pending);
    body = !anything ? (
      loading ? (
        spinner
      ) : (
        empty
      )
    ) : (
      <div className="space-y-5">
        {users.length > 0 && (
          <Section
            title={t('sections.accounts')}
            more={users.length > TOP_ACCOUNTS}
            onMore={() => setTab('accounts')}
          >
            <ul>
              {users.slice(0, TOP_ACCOUNTS).map((user) => (
                <UserRow key={user.id} user={user} onSelect={onSelectUser} />
              ))}
            </ul>
          </Section>
        )}
        {hashtags.length > 0 && (
          <Section
            title={t('sections.tags')}
            more={hashtags.length > TOP_TAGS}
            onMore={() => setTab('tags')}
          >
            <ul>
              {hashtags.slice(0, TOP_TAGS).map((hashtag) => (
                <HashtagRow key={hashtag.name} hashtag={hashtag} />
              ))}
            </ul>
          </Section>
        )}
        {spots.length > 0 && (
          <Section
            title={t('sections.places')}
            more={spots.length > TOP_PLACES}
            onMore={() => setTab('places')}
          >
            <ul>
              {spots.slice(0, TOP_PLACES).map((place) => (
                <PlaceRow key={place.id} place={place} />
              ))}
            </ul>
          </Section>
        )}
        {mixedPosts.length > 0 && (
          <Section
            title={t('sections.posts')}
            more={mixedPosts.some((p) => p.type === 'REEL')}
            moreLabel={t('sections.allReels')}
            onMore={() => setTab('reels')}
          >
            <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl max-md:-mx-3 max-md:rounded-none">
              {mixedPosts.slice(0, TOP_POSTS).map((post) => (
                <PostTile key={post.id} post={post} cell onOpen={openTile(post)} />
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  } else if (tab === 'accounts') {
    body = pending(people) ? (
      spinner
    ) : users.length === 0 ? (
      empty
    ) : (
      <ul>
        {users.map((user) => (
          <UserRow key={user.id} user={user} onSelect={onSelectUser} />
        ))}
      </ul>
    );
  } else if (tab === 'tags') {
    body = pending(tags) ? (
      spinner
    ) : hashtags.length === 0 ? (
      empty
    ) : (
      <ul>
        {hashtags.map((hashtag) => (
          <HashtagRow key={hashtag.name} hashtag={hashtag} />
        ))}
      </ul>
    );
  } else if (tab === 'places') {
    body = pending(places) ? (
      spinner
    ) : spots.length === 0 ? (
      empty
    ) : (
      <ul>
        {spots.map((place) => (
          <PlaceRow key={place.id} place={place} />
        ))}
      </ul>
    );
  } else {
    body = pending(reels) ? (
      spinner
    ) : reelPosts.length === 0 ? (
      empty
    ) : (
      <ReelGrid
        reels={reelPosts}
        onOpen={setOpenReel}
        hasMore={Boolean(reels.hasNextPage)}
        loadingMore={reels.isFetchingNextPage}
        loadMore={() => void reels.fetchNextPage()}
      />
    );
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={t('tabsLabel')}
        className="-mx-1 mb-3 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]"
      >
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'relative shrink-0 px-3 pt-2 pb-3 text-sm font-semibold outline-none transition-colors focus-visible:text-foreground',
              tab === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${key}`)}
            {tab === key && (
              <motion.span
                layoutId="search-tab"
                transition={
                  reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
                }
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.14 }}
        >
          {body}
        </motion.div>
      </AnimatePresence>

      {openReel && <TopReelViewer startId={openReel} onClose={closeReel} searchQuery={words} />}
    </div>
  );
}

/** A block of the Top tab: a title, and "See all" that switches to the full tab */
function Section({
  title,
  more,
  moreLabel,
  onMore,
  children,
}: {
  title: string;
  more: boolean;
  moreLabel?: string;
  onMore: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('search');
  return (
    <section>
      <div className="mb-1 flex items-center justify-between px-3">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {more && (
          <button
            type="button"
            onClick={onMore}
            className="rounded text-sm font-semibold text-brand outline-none transition-colors hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-ring"
          >
            {moreLabel ?? t('seeAll')}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** The Reels tab: tall tiles three across, more as you scroll */
function ReelGrid({
  reels,
  onOpen,
  hasMore,
  loadingMore,
  loadMore,
}: {
  reels: Post[];
  onOpen: (id: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}) {
  const { ref, inView } = useInView({ rootMargin: '400px' });
  useEffect(() => {
    if (inView && hasMore && !loadingMore) loadMore();
  }, [inView, hasMore, loadingMore, loadMore]);

  return (
    <>
      <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl max-md:-mx-3 max-md:rounded-none">
        {reels.map((reel) => (
          <PostTile
            key={reel.id}
            post={reel}
            tall
            href={`/reel/${reel.id}`}
            onOpen={() => onOpen(reel.id)}
          />
        ))}
      </div>
      <div ref={ref} className="flex justify-center py-4">
        {loadingMore && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      </div>
    </>
  );
}
