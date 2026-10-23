'use client';

import type { ConversationPreview, UserPreview } from '@instagram/shared';
import { CircleX, Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { useOpenDirect, useUserSearch } from '../queries';

/** The search field at the top of the inbox */
export function InboxSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('direct.search');
  return (
    <div className="shrink-0 px-6 pb-2 max-md:px-4">
      <label className="flex h-9 items-center gap-2 rounded-lg bg-secondary px-3 transition-shadow focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && onChange('')}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('clear')}
            className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CircleX className="size-4" />
          </button>
        )}
      </label>
    </div>
  );
}

const matches = (q: string, ...texts: (string | null | undefined)[]) =>
  texts.some((text) => text?.toLowerCase().includes(q));

/**
 * What the inbox shows while searching: my chats whose name matches, then people with no chat
 * with me yet (a tap opens one). `renderChat` draws a chat row the same way as the list does.
 */
export function InboxSearchResults({
  query,
  conversations,
  myId,
  renderChat,
}: {
  query: string;
  conversations: ConversationPreview[];
  myId: string | undefined;
  renderChat: (conversation: ConversationPreview) => React.ReactNode;
}) {
  const t = useTranslations('direct.search');
  const router = useRouter();
  const openDirect = useOpenDirect();
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const people = useUserSearch(debounced);

  const q = query.trim().toLowerCase();
  const chats = conversations.filter((c) =>
    matches(q, c.title, c.otherUser?.username, c.otherUser?.fullName),
  );
  const withChat = new Set(conversations.flatMap((c) => (c.otherUser ? [c.otherUser.id] : [])));
  const strangers = (people.data ?? []).filter((u) => u.id !== myId && !withChat.has(u.id));
  const searching = people.isFetching || debounced !== query.trim();

  const open = (user: UserPreview) =>
    openDirect.mutate(user.id, {
      onSuccess: (conversation) => router.push(`/direct/t/${conversation.id}`),
      onError: () => toast.error(t('failed')),
    });

  const heading = 'px-6 pt-3 pb-1 text-xs font-semibold text-muted-foreground max-md:px-4';

  return (
    <>
      {chats.length > 0 && (
        <>
          <li className={heading}>{t('chats')}</li>
          {chats.map(renderChat)}
        </>
      )}
      {strangers.length > 0 && (
        <>
          <li className={heading}>{t('people')}</li>
          {strangers.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => open(user)}
                disabled={openDirect.isPending}
                className="flex w-full items-center gap-3 px-6 py-2 text-left outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6 max-md:px-4"
              >
                <UserAvatar src={user.avatarUrl} alt="" size={56} />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-semibold">{user.username}</span>
                  <span className="block truncate text-muted-foreground">{user.fullName}</span>
                </span>
              </button>
            </li>
          ))}
        </>
      )}
      {chats.length === 0 && strangers.length === 0 && (
        <li className="grid place-items-center px-6 py-10 text-sm text-muted-foreground">
          {searching ? <Loader2 className="size-5 animate-spin" /> : t('empty')}
        </li>
      )}
    </>
  );
}
