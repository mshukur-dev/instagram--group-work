'use client';

import { type Conversation, GROUP_MEMBERS_MAX, type UserPreview } from '@instagram/shared';
import { Check, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { ProfileDialog } from '@/features/profile/components/profile-dialog';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { useAddMembers, useCreateGroup, useOpenDirect, useUserSearch } from '../queries';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Add people" to this group instead of starting a new chat */
  addTo?: Conversation;
};

// DM-1 / DM-4: pick one person (a 1:1 chat) or several (a group, with an optional name).
// With `addTo` the same picker adds people to an existing group.
export function NewMessageDialog({ open, onOpenChange, addTo }: Props) {
  const t = useTranslations('direct.dialog');
  const tDirect = useTranslations('direct');
  const router = useRouter();
  const { data: me } = useMe();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<UserPreview[]>([]);
  const [title, setTitle] = useState('');
  const openDirect = useOpenDirect();
  const createGroup = useCreateGroup();
  const addMembers = useAddMembers(addTo?.id ?? '');
  const search = useUserSearch(debounced);
  const pending = openDirect.isPending || createGroup.isPending || addMembers.isPending;
  const memberIds = new Set(addTo?.members.map((m) => m.id));
  const room = addTo ? GROUP_MEMBERS_MAX - addTo.members.length : GROUP_MEMBERS_MAX - 1;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const toggle = (user: UserPreview) =>
    setPicked((current) =>
      current.some((u) => u.id === user.id)
        ? current.filter((u) => u.id !== user.id)
        : current.length < room
          ? [...current, user]
          : current,
    );

  const go = (conversationId: string) => {
    onOpenChange(false);
    router.push(`/direct/t/${conversationId}`);
  };
  const fail = () => toast.error(t('createFailed'));

  const start = () => {
    if (addTo) {
      addMembers.mutate(
        picked.map((u) => u.id),
        {
          onSuccess: () => {
            onOpenChange(false);
            setPicked([]);
            setQuery('');
            toast.success(tDirect('details.added', { count: picked.length }));
          },
          onError: () => toast.error(tDirect('details.failed')),
        },
      );
      return;
    }
    const [only] = picked;
    if (picked.length === 1 && only) {
      openDirect.mutate(only.id, { onSuccess: (c) => go(c.id), onError: fail });
    } else if (picked.length > 1) {
      createGroup.mutate(
        { memberIds: picked.map((u) => u.id), title: title.trim() || undefined },
        { onSuccess: (c) => go(c.id), onError: fail },
      );
    }
  };

  const results = (search.data ?? []).filter((u) => u.id !== me?.id && !memberIds.has(u.id));
  const heading = addTo ? tDirect('details.addPeople') : tDirect('newMessage');

  return (
    <ProfileDialog
      open={open}
      onOpenChange={onOpenChange}
      title={heading}
      className="flex h-[min(80dvh,620px)] max-w-135 flex-col"
    >
      <header className="grid h-12 shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-border/50 px-1">
        <span />
        <h2 aria-hidden="true" className="text-center text-base font-bold">
          {heading}
        </h2>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={tDirect('close')}
          className="grid size-10 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/50 px-4 py-2">
        <span className="mr-2 text-[15px] font-semibold">{t('to')}</span>
        <AnimatePresence initial={false}>
          {picked.map((user) => (
            <motion.button
              key={user.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 600, damping: 34 }}
              type="button"
              onClick={() => toggle(user)}
              aria-label={t('remove', { username: user.username })}
              className="flex items-center gap-1 rounded-full bg-brand/10 py-1 pr-2 pl-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/15"
            >
              {user.username}
              <X className="size-3.5" />
            </motion.button>
          ))}
        </AnimatePresence>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="min-w-30 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <ul data-scrollable className="min-h-0 flex-1 overflow-y-auto py-2">
        {!debounced ? (
          <li className="px-6 py-6 text-sm text-muted-foreground">{t('hint')}</li>
        ) : search.isPending ? (
          <li className="grid place-items-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </li>
        ) : results.length === 0 ? (
          <li className="px-6 py-6 text-sm text-muted-foreground">{t('noResults')}</li>
        ) : (
          results.map((user) => {
            const selected = picked.some((u) => u.id === user.id);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  aria-pressed={selected}
                  className="flex w-full items-center gap-3 px-6 py-2 text-left outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6"
                >
                  <UserAvatar src={user.avatarUrl} alt="" size={44} />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-semibold">{user.username}</span>
                    <span className="block truncate text-muted-foreground">{user.fullName}</span>
                  </span>
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
                      selected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border',
                    )}
                  >
                    {selected && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <footer className="shrink-0 space-y-2 border-t border-border/50 p-4">
        {!addTo && picked.length > 1 && (
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('groupName')}
            aria-label={t('groupName')}
            maxLength={60}
            className="h-10 w-full rounded-lg bg-secondary px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        )}
        <button
          type="button"
          onClick={start}
          disabled={picked.length === 0 || pending}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground transition-colors outline-none hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : addTo ? (
            tDirect('details.add')
          ) : (
            t('chat')
          )}
        </button>
      </footer>
    </ProfileDialog>
  );
}
