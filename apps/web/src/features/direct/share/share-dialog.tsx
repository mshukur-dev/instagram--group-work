'use client';

import type { ConversationPreview, UserPreview } from '@instagram/shared';
import { Check, Link2, Loader2, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { ProfileDialog } from '@/features/profile/components/profile-dialog';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { ConversationAvatar } from '../components/conversation-avatar';
import { type ShareTarget, useConversations, useSharePost, useUserSearch } from '../queries';
import { useShareStore } from './share-store';

type Pick = { key: string; target: ShareTarget; label: string };

const keyOf = (target: ShareTarget) => `${target.kind}:${target.id}`;

// DM-4 / ENGAGE-8: "Share" on a post or Reel. Recent chats as a grid of faces; search finds
// chats and people. Pick one or several, add a note if you like, send: each gets the post.
// Mounted once in the main layout; opened through useShareStore.
export function ShareDialog() {
  const t = useTranslations('direct.share');
  const post = useShareStore((s) => s.post);
  const close = useShareStore((s) => s.close);
  return (
    <ProfileDialog
      open={post !== null}
      onOpenChange={(open) => !open && close()}
      title={t('title')}
      className="flex h-[min(80dvh,560px)] max-w-135 flex-col"
    >
      {post && <ShareSheet key={post.id} postId={post.id} onDone={close} />}
    </ProfileDialog>
  );
}

function ShareSheet({ postId, onDone }: { postId: string; onDone: () => void }) {
  const t = useTranslations('direct.share');
  const { data: me } = useMe();
  const share = useSharePost();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<Pick[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const conversations = useConversations();
  const chats = useMemo(
    () => conversations.data?.pages.flatMap((p) => p.items) ?? [],
    [conversations.data],
  );
  const people = useUserSearch(debounced);

  // Faces to pick from: recent chats, or what matches the search (chats first, then people)
  const q = query.trim().toLowerCase();
  const chatCells = (
    q
      ? chats.filter((c) =>
          [c.title, c.otherUser?.username, c.otherUser?.fullName].some((s) =>
            s?.toLowerCase().includes(q),
          ),
        )
      : chats
  ).slice(0, q ? 24 : 16);
  const withChat = new Set(chats.flatMap((c) => (c.otherUser ? [c.otherUser.id] : [])));
  const personCells = q
    ? (people.data ?? []).filter((u) => u.id !== me?.id && !withChat.has(u.id))
    : [];

  const toggle = (pick: Pick) =>
    setPicked((current) =>
      current.some((p) => p.key === pick.key)
        ? current.filter((p) => p.key !== pick.key)
        : [...current, pick],
    );
  const isPicked = (key: string) => picked.some((p) => p.key === key);

  const send = () =>
    share.mutate(
      { postId, targets: picked.map((p) => p.target), note },
      {
        onSuccess: ({ failed }) => {
          if (failed > 0) toast.error(t('partlyFailed', { count: failed }));
          else toast.success(t('sent'));
          onDone();
        },
        onError: () => toast.error(t('failed')),
      },
    );

  const copyLink = () => {
    void navigator.clipboard
      ?.writeText(`${window.location.origin}/p/${postId}`)
      .then(() => toast.success(t('copied')));
    onDone();
  };

  const searching = debounced !== query.trim() || people.isFetching;
  const empty = chatCells.length === 0 && personCells.length === 0;

  return (
    <>
      <header className="grid h-12 shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-border/50 px-1">
        <span />
        <h2 aria-hidden="true" className="text-center text-base font-bold">
          {t('title')}
        </h2>
        <button
          type="button"
          onClick={onDone}
          aria-label={t('close')}
          className="grid size-10 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="shrink-0 px-4 pt-3 pb-1">
        <label className="flex h-9 items-center gap-2 rounded-lg bg-secondary px-3 transition-shadow focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div data-scrollable className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {empty ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            {conversations.isPending || (q && searching) ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              t(q ? 'noResults' : 'noChats')
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-4 gap-y-4 max-[420px]:grid-cols-3">
            {chatCells.map((chat) => {
              const pick: Pick = {
                key: keyOf({ kind: 'chat', id: chat.id }),
                target: { kind: 'chat', id: chat.id },
                label: chat.title,
              };
              return (
                <Cell
                  key={pick.key}
                  label={chat.title}
                  picked={isPicked(pick.key)}
                  onToggle={() => toggle(pick)}
                  face={<ChatFace chat={chat} />}
                />
              );
            })}
            {personCells.map((user) => {
              const pick: Pick = {
                key: keyOf({ kind: 'user', id: user.id }),
                target: { kind: 'user', id: user.id },
                label: user.username,
              };
              return (
                <Cell
                  key={pick.key}
                  label={user.username}
                  picked={isPicked(pick.key)}
                  onToggle={() => toggle(pick)}
                  face={<PersonFace user={user} />}
                />
              );
            })}
          </ul>
        )}
      </div>

      {/* Nothing picked: copy the link. Someone picked: a note and Send slide in. */}
      <footer className="shrink-0 border-t border-border/50">
        <AnimatePresence initial={false} mode="popLayout">
          {picked.length > 0 ? (
            <motion.div
              key="send"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 520, damping: 36 }}
              className="space-y-2 p-4"
            >
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && !share.isPending && send()}
                placeholder={t('note')}
                aria-label={t('note')}
                maxLength={1000}
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={send}
                disabled={share.isPending}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {share.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : picked.length > 1 ? (
                  t('sendSeparately')
                ) : (
                  t('send')
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="link"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 520, damping: 36 }}
              className="flex justify-center p-3"
            >
              <button
                type="button"
                onClick={copyLink}
                className="flex flex-col items-center gap-1.5 rounded-xl px-4 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-12 place-items-center rounded-full bg-secondary transition-colors hover:bg-foreground/10">
                  <Link2 className="size-5" />
                </span>
                {t('copyLink')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </>
  );
}

function ChatFace({ chat }: { chat: ConversationPreview }) {
  return <ConversationAvatar conversation={chat} size={64} />;
}

function PersonFace({ user }: { user: UserPreview }) {
  return <UserAvatar src={user.avatarUrl} alt="" size={64} />;
}

/** One face in the grid: a tap picks it (it shrinks a little and gets a blue check) */
function Cell({
  label,
  picked,
  onToggle,
  face,
}: {
  label: string;
  picked: boolean;
  onToggle: () => void;
  face: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={picked}
        className="flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Same height for every face (a story ring makes some avatars bigger) */}
        <span className="relative grid size-18 place-items-center">
          <motion.span
            className="block"
            animate={{ scale: picked ? 0.88 : 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          >
            {face}
          </motion.span>
          <AnimatePresence>
            {picked && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 700, damping: 26 }}
                className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full bg-brand text-brand-foreground ring-2 ring-popover"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span
          className={cn(
            'line-clamp-2 w-full text-center text-xs leading-tight wrap-break-word',
            picked && 'font-semibold',
          )}
        >
          {label}
        </span>
      </button>
    </li>
  );
}
