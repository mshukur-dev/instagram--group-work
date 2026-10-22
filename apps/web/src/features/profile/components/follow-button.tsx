'use client';

import type { UserProfile, ViewerFollowStatus } from '@instagram/shared';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { useToggleFollow } from '../queries';
import { ConfirmDialog } from './profile-dialog';
import { profileButton } from './profile-button';

type FollowActionProps = {
  username: string;
  avatarUrl: string | null;
  status: ViewerFollowStatus;
  followsMe?: boolean;
  isPrivate?: boolean;
  /** `true` follows (or requests), `false` unfollows or cancels the request */
  onChange: (follow: boolean) => void;
  className?: string;
};

// Follow / Follow back → Requested (private account) or Following.
// Unfollowing asks first, like Instagram; cancelling a request does not.
export function FollowAction({
  username,
  avatarUrl,
  status,
  followsMe,
  isPrivate,
  onChange,
  className,
}: FollowActionProps) {
  const t = useTranslations('profile');
  const [confirming, setConfirming] = useState(false);

  if (status === 'NONE') {
    return (
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(profileButton('primary'), className)}
      >
        {t(followsMe ? 'followBack' : 'follow')}
      </button>
    );
  }

  if (status === 'PENDING') {
    return (
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(profileButton('secondary'), className)}
      >
        {t('requested')}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={cn(profileButton('secondary'), className)}
      >
        {t('following')}
        <ChevronDown className="size-4" />
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        picture={<UserAvatar src={avatarUrl} alt={username} size={90} />}
        title={isPrivate ? t('unfollowPrivate', { username }) : t('unfollowTitle', { username })}
        confirmLabel={t('unfollow')}
        cancelLabel={t('cancel')}
        onConfirm={() => onChange(false)}
      />
    </>
  );
}

// The button in the profile header: changes the profile and its counter at once
export function FollowButton({ profile }: { profile: UserProfile }) {
  const toggle = useToggleFollow(profile.username);
  return (
    <FollowAction
      username={profile.username}
      avatarUrl={profile.avatarUrl}
      status={profile.followStatus}
      followsMe={profile.followsMe}
      isPrivate={profile.isPrivate}
      onChange={(follow) => toggle.mutate(follow)}
    />
  );
}
