'use client';

import type { Conversation, ConversationMember } from '@instagram/shared';
import { Camera, ChevronLeft, Loader2, UserPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { getMediaSignature } from '@/features/posts/api';
import { ConfirmDialog } from '@/features/profile/components/profile-dialog';
import { useMe } from '@/features/profile/queries';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';
import { cn } from '@/lib/utils';
import { useMediaViewer } from '../media-viewer-store';
import { useLeaveGroup, useRemoveMember, useUpdateGroup } from '../queries';
import { ConversationAvatar } from './conversation-avatar';
import { NewMessageDialog } from './new-message-dialog';

type Props = { conversation: Conversation; open: boolean; onClose: () => void };

// DM-4: the chat's details, sliding over the chat from the right like Instagram's (i) panel.
// A group: its photo and name (the admin changes them), the members, adding and removing
// people, leaving. A 1:1 chat: who it is with.
export function ThreadDetails({ conversation, open, onClose }: Props) {
  const t = useTranslations('direct.details');

  // Esc closes the panel, unless a dialog or the photo viewer above it takes the key
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (useMediaViewer.getState().messageId) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="details"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 42 }}
          aria-label={t('title')}
          className="absolute inset-0 z-20 flex flex-col bg-background"
        >
          <header className="flex h-18.75 shrink-0 items-center gap-2 border-b border-border/60 px-4 max-md:h-14 max-md:px-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="grid size-10 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-7" />
            </button>
            <h2 className="text-xl font-bold">{t('title')}</h2>
          </header>
          <div data-scrollable className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {conversation.isGroup ? (
              <GroupDetails conversation={conversation} />
            ) : (
              <DirectDetails conversation={conversation} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function DirectDetails({ conversation }: { conversation: Conversation }) {
  const t = useTranslations('direct.details');
  const other = conversation.otherUser;
  if (!other) return null;
  return (
    <div className="flex flex-col items-center gap-1 px-6 pt-10 pb-8 text-center">
      <UserAvatar
        src={other.avatarUrl}
        alt=""
        size={96}
        ring={other.hasUnseenStory ? 'unseen' : other.hasActiveStory ? 'seen' : 'none'}
        ringWidth="thick"
        className={cn(other.hasActiveStory && 'p-1')}
      />
      <p className="mt-3 text-xl font-semibold">{other.username}</p>
      {other.fullName && <p className="text-sm text-muted-foreground">{other.fullName}</p>}
      <Link
        href={`/${other.username}`}
        className="mt-4 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('viewProfile')}
      </Link>
    </div>
  );
}

function GroupDetails({ conversation }: { conversation: Conversation }) {
  const t = useTranslations('direct.details');
  const tDirect = useTranslations('direct');
  const router = useRouter();
  const { data: me } = useMe();
  const isAdmin = conversation.myRole === 'ADMIN';
  const update = useUpdateGroup(conversation.id);
  const remove = useRemoveMember(conversation.id);
  const leave = useLeaveGroup(conversation.id, me?.id);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ConversationMember | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  // Admins first, then by name; me among them
  const members = [...conversation.members].sort(
    (a, b) =>
      Number(b.role === 'ADMIN') - Number(a.role === 'ADMIN') ||
      a.username.localeCompare(b.username),
  );

  const changePhoto = async (file: File) => {
    setPhotoBusy(true);
    try {
      const signature = await getMediaSignature({ folder: 'avatars' });
      const uploaded = await uploadToCloudinary(file, signature);
      await update.mutateAsync({ avatarUrl: uploaded.url });
      toast.success(t('photoChanged'));
    } catch {
      toast.error(t('failed'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const avatar = <ConversationAvatar conversation={conversation} size={88} />;

  return (
    <>
      <div className="flex flex-col items-center gap-2 px-6 pt-8 pb-6 text-center">
        {isAdmin ? (
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            disabled={photoBusy}
            aria-label={t('changePhoto')}
            className="group/photo relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {avatar}
            <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-foreground text-background ring-[3px] ring-background transition-transform group-hover/photo:scale-110">
              <Camera className="size-4" />
            </span>
            {photoBusy && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
                <Loader2 className="size-6 animate-spin text-white" />
              </span>
            )}
          </button>
        ) : (
          avatar
        )}
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void changePhoto(file);
          }}
        />
        <GroupName conversation={conversation} editable={isAdmin} />
        <p className="text-sm text-muted-foreground">
          {tDirect('members', { count: conversation.members.length })}
        </p>
      </div>

      <section className="border-t border-border/60 py-2">
        <div className="flex items-center justify-between px-6 py-2">
          <h3 className="text-base font-bold">{t('members')}</h3>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-md text-sm font-semibold text-brand outline-none transition-colors hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserPlus className="size-4" />
              {t('addPeople')}
            </button>
          )}
        </div>
        <ul>
          <AnimatePresence initial={false}>
            {members.map((member) => {
              const isMe = member.id === me?.id;
              return (
                <motion.li
                  key={member.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="group/member overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-6 py-2 transition-colors hover:bg-foreground/4">
                    <Link
                      href={`/${member.username}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <UserAvatar src={member.avatarUrl} alt="" size={44} />
                      <span className="min-w-0 text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{member.username}</span>
                          {member.role === 'ADMIN' && <Tag>{t('admin')}</Tag>}
                          {isMe && <Tag>{t('you')}</Tag>}
                        </span>
                        {member.fullName && (
                          <span className="block truncate text-muted-foreground">
                            {member.fullName}
                          </span>
                        )}
                      </span>
                    </Link>
                    {isAdmin && !isMe && (
                      <button
                        type="button"
                        onClick={() => setRemoving(member)}
                        className="rounded-md px-2 py-1 text-sm font-semibold text-destructive opacity-0 outline-none transition-opacity group-hover/member:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring max-md:opacity-100"
                      >
                        {t('remove')}
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </section>

      <section className="border-t border-border/60 py-2">
        <button
          type="button"
          onClick={() => setLeaving(true)}
          className="w-full px-6 py-3 text-left text-[15px] font-semibold text-destructive outline-none transition-colors hover:bg-destructive/6 focus-visible:bg-destructive/6"
        >
          {t('leave')}
        </button>
      </section>

      <NewMessageDialog open={adding} onOpenChange={setAdding} addTo={conversation} />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('removeTitle', { username: removing?.username ?? '' })}
        description={t('removeText')}
        picture={removing && <UserAvatar src={removing.avatarUrl} alt="" size={72} />}
        confirmLabel={t('remove')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          if (!removing) return;
          const { id, username } = removing;
          remove.mutate(id, {
            onSuccess: () => toast.success(t('removed', { username })),
            onError: () => toast.error(t('failed')),
          });
        }}
      />

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t('leaveTitle')}
        description={t('leaveText')}
        picture={<ConversationAvatar conversation={conversation} size={72} />}
        confirmLabel={t('leave')}
        cancelLabel={t('cancel')}
        onConfirm={() =>
          leave.mutate(undefined, {
            onSuccess: () => {
              router.replace('/direct/inbox');
              toast.success(t('left'));
            },
            onError: () => toast.error(t('failed')),
          })
        }
      />
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-md bg-foreground/6 px-1.5 py-px text-[11px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

// The group's name, edited in place by an admin: Enter or clicking away saves, Esc undoes
function GroupName({ conversation, editable }: { conversation: Conversation; editable: boolean }) {
  const t = useTranslations('direct.details');
  const update = useUpdateGroup(conversation.id);
  const [draft, setDraft] = useState(conversation.title);
  const [editing, setEditing] = useState(false);

  // Someone else renamed it while the panel is open
  const [seen, setSeen] = useState(conversation.title);
  if (seen !== conversation.title && !editing) {
    setSeen(conversation.title);
    setDraft(conversation.title);
  }

  if (!editable) return <p className="text-xl font-semibold">{conversation.title}</p>;

  const save = () => {
    setEditing(false);
    const title = draft.trim();
    if (!title || title === conversation.title) {
      setDraft(conversation.title);
      return;
    }
    update.mutate(
      { title },
      {
        onSuccess: () => toast.success(t('renamed')),
        onError: () => {
          setDraft(conversation.title);
          toast.error(t('failed'));
        },
      },
    );
  };

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.stopPropagation();
          setDraft(conversation.title);
          setEditing(false);
          requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
        }
      }}
      maxLength={64}
      aria-label={t('groupName')}
      title={t('rename')}
      className="w-full max-w-xs rounded-lg bg-transparent px-2 py-1 text-center text-xl font-semibold outline-none transition-colors hover:bg-foreground/4 focus:bg-foreground/6"
    />
  );
}
