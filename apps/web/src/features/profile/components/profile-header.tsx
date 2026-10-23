'use client';

import type { UserProfile } from '@instagram/shared';
import { Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import type { FollowListKind } from '../api';
import { MessageButton } from '@/features/direct/components/message-button';
import { FollowButton } from './follow-button';
import { FollowListDialog } from './follow-list-dialog';
import { profileButton } from './profile-button';

const bold = (chunks: React.ReactNode) => <span className="font-semibold">{chunks}</span>;

// PROFILE-1: avatar, username, actions, counters, name, bio and link
export function ProfileHeader({ profile }: { profile: UserProfile }) {
  const t = useTranslations('profile');
  const ring = profile.hasUnseenStory ? 'unseen' : profile.hasActiveStory ? 'seen' : 'none';
  const [list, setList] = useState<FollowListKind | null>(null);
  // Lists of a private profile are closed to people who don't follow it (403 from the API)
  const canOpenLists = profile.canViewContent;

  const counter = (kind: FollowListKind, text: React.ReactNode) =>
    canOpenLists ? (
      <button
        type="button"
        onClick={() => setList(kind)}
        className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {text}
      </button>
    ) : (
      text
    );

  const avatars = (
    <>
      {/* Desktop and phone sizes; only one of them is visible */}
      <UserAvatar
        src={profile.avatarUrl}
        alt={profile.username}
        size={150}
        ring={ring}
        ringWidth="thick"
        // The big avatar gets a wider colored ring than the thick default
        className={cn('max-md:hidden', ring !== 'none' && 'p-1.25')}
      />
      <UserAvatar
        src={profile.avatarUrl}
        alt={profile.username}
        size={77}
        ring={ring}
        ringWidth="thick"
        className="hidden max-md:inline-flex"
      />
    </>
  );

  return (
    <header className="flex items-start gap-20 pb-11 max-md:gap-6 max-md:px-4 max-md:pb-6">
      <div className="flex w-50 shrink-0 justify-center max-md:w-auto">
        {/* With an active story the avatar opens it, like on Instagram */}
        {profile.hasActiveStory && profile.canViewContent ? (
          <Link
            href={`/stories/${profile.username}`}
            aria-label={t('openStory', { username: profile.username })}
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {avatars}
          </Link>
        ) : (
          avatars
        )}
      </div>

      <section className="min-w-0 flex-1 space-y-5 max-md:space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h1 className="truncate text-xl">{profile.username}</h1>
          <div className="flex gap-2">
            {profile.isMe ? (
              <Link href="/accounts/edit" className={profileButton('secondary')}>
                {t('editProfile')}
              </Link>
            ) : (
              !profile.isBlocked && (
                <>
                  <FollowButton profile={profile} />
                  <MessageButton userId={profile.id} />
                </>
              )
            )}
          </div>
        </div>

        <ul className="flex gap-10 text-base max-md:gap-6 max-md:text-sm">
          <li>{t.rich('postsCount', { count: profile.postsCount, b: bold })}</li>
          <li>
            {counter(
              'followers',
              t.rich('followersCount', { count: profile.followersCount, b: bold }),
            )}
          </li>
          <li>
            {counter(
              'following',
              t.rich('followingCount', { count: profile.followingCount, b: bold }),
            )}
          </li>
        </ul>

        <div className="space-y-0.5 text-sm">
          {profile.fullName && <p className="font-semibold">{profile.fullName}</p>}
          {profile.bio && <p className="whitespace-pre-line wrap-break-word">{profile.bio}</p>}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex max-w-full items-center gap-1 font-semibold text-brand transition-colors hover:text-brand-hover"
            >
              <Link2 className="size-4 shrink-0 -rotate-45" />
              <span className="truncate">{profile.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
      </section>

      {list && (
        <FollowListDialog
          username={profile.username}
          kind={list}
          isMine={profile.isMe}
          open
          onOpenChange={(open) => !open && setList(null)}
        />
      )}
    </header>
  );
}
