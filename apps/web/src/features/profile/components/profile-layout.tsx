'use client';

import { ErrorCode } from '@instagram/shared';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { getErrorCode } from '@/lib/api-error';
import { useProfile } from '../queries';
import { ProfileHeader } from './profile-header';
import { ProfileTabs } from './profile-tabs';

function HeaderSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-20 pb-11 max-md:gap-6 max-md:px-4">
      <div className="flex w-[200px] justify-center max-md:w-auto">
        <div className="size-[150px] rounded-full bg-muted max-md:size-[77px]" />
      </div>
      <div className="flex-1 space-y-4">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="h-4 w-64 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
    </div>
  );
}

function NotFound() {
  const t = useTranslations('profile');
  return (
    <div className="space-y-5 py-10 text-center">
      <h1 className="text-2xl font-semibold">{t('notFoundTitle')}</h1>
      <p>
        {t('notFoundBody')}{' '}
        <Link href="/" className="text-brand transition-colors hover:text-brand-hover">
          {t('backHome')}
        </Link>
      </p>
    </div>
  );
}

// Shared by every profile tab: header on top, tab content (grid) below
export function ProfileLayout({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('profile');
  const { data: profile, error, isPending } = useProfile(username);

  let content: React.ReactNode;
  if (isPending) {
    content = <HeaderSkeleton />;
  } else if (error) {
    content =
      getErrorCode(error) === ErrorCode.USER_NOT_FOUND ? (
        <NotFound />
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">{t('error')}</p>
      );
  } else {
    content = (
      <>
        <ProfileHeader profile={profile} />
        {profile.canViewContent ? (
          <>
            <ProfileTabs username={profile.username} isMe={profile.isMe} />
            {children}
          </>
        ) : (
          profile.isPrivate &&
          !profile.isBlocked && (
            <div className="flex flex-col items-center gap-3 border-t border-border py-14 text-center">
              <span className="grid size-15.5 place-items-center rounded-full border-2 border-foreground">
                <Lock className="size-7" strokeWidth={1.5} />
              </span>
              <p className="font-semibold">{t('privateTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('privateHint')}</p>
            </div>
          )
        )}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[935px] px-5 pt-8 pb-10 max-md:px-0 max-md:pt-4">
      {content}
    </div>
  );
}
