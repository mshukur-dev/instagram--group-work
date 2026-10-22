'use client';

import type { UserProfile } from '@instagram/shared';
import { Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { FollowButton } from './follow-button';
import { profileButton } from './profile-button';

const bold = (chunks: React.ReactNode) => <span className="font-semibold">{chunks}</span>;

// PROFILE-1: avatar, username, actions, counters, name, bio and link
export function ProfileHeader({ profile }: { profile: UserProfile }) {
  const t = useTranslations('profile');
  const ring = profile.hasUnseenStory ? 'unseen' : profile.hasActiveStory ? 'seen' : 'none';

  return (
    <header className="flex items-start gap-20 pb-11 max-md:gap-6 max-md:px-4 max-md:pb-6">
      <div className="flex w-[200px] shrink-0 justify-center max-md:w-auto">
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
              !profile.isBlocked && <FollowButton profile={profile} />
            )}
          </div>
        </div>

        <ul className="flex gap-10 text-base max-md:gap-6 max-md:text-sm">
          <li>{t.rich('postsCount', { count: profile.postsCount, b: bold })}</li>
          <li>{t.rich('followersCount', { count: profile.followersCount, b: bold })}</li>
          <li>{t.rich('followingCount', { count: profile.followingCount, b: bold })}</li>
        </ul>

        <div className="space-y-0.5 text-sm">
          {profile.fullName && <p className="font-semibold">{profile.fullName}</p>}
          {profile.bio && <p className="whitespace-pre-line break-words">{profile.bio}</p>}
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
    </header>
  );
}
