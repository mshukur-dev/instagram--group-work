'use client';

import type { UserProfile } from '@instagram/shared';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToggleFollow } from '../queries';
import { profileButton } from './profile-button';

// Follow / Follow back → Requested (private account) or Following; a second click undoes it
export function FollowButton({ profile }: { profile: UserProfile }) {
  const t = useTranslations('profile');
  const toggle = useToggleFollow(profile.username);
  const { followStatus } = profile;

  if (followStatus === 'NONE') {
    return (
      <button
        type="button"
        onClick={() => toggle.mutate(true)}
        className={profileButton('primary')}
      >
        {t(profile.followsMe ? 'followBack' : 'follow')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle.mutate(false)}
      className={profileButton('secondary')}
    >
      {t(followStatus === 'PENDING' ? 'requested' : 'following')}
      {followStatus === 'ACCEPTED' && <ChevronDown className="size-4" />}
    </button>
  );
}
