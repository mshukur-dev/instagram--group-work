'use client';

import type { SessionInfo } from '@instagram/shared';
import { Laptop, Smartphone } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { profileButton } from '@/features/profile/components/profile-button';
import {
  useBlocked,
  useLogoutOtherSessions,
  useLogoutSession,
  useSessions,
  useUnblock,
} from '../queries';
import { SettingsCard, SettingsLoading, SettingsPage } from './settings-ui';

const isPhone = (session: SessionInfo) => /android|ios|iphone/i.test(session.os);

// SETTINGS-5: the devices logged in to this account; log out of one or of all the others
export function SessionsSettings() {
  const t = useTranslations('settings.sessions');
  const tSettings = useTranslations('settings');
  const format = useFormatter();
  const { data: sessions } = useSessions();
  const logoutOne = useLogoutSession();
  const logoutOthers = useLogoutOtherSessions();
  const failed = () => toast.error(tSettings('saveFailed'));

  return (
    <SettingsPage title={t('title')} description={t('description')}>
      {!sessions ? (
        <SettingsLoading />
      ) : (
        <>
          <SettingsCard>
            {sessions.map((session) => {
              const Icon = isPhone(session) ? Smartphone : Laptop;
              return (
                <div key={session.id} className="flex items-center gap-4 p-4">
                  <Icon className="size-7 shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">
                      {t('device', { browser: session.browser, os: session.os })}
                    </p>
                    <p className={session.isCurrent ? 'text-brand' : 'text-muted-foreground'}>
                      {session.isCurrent
                        ? t('current')
                        : t('lastActive', {
                            time: format.relativeTime(new Date(session.lastUsedAt), new Date()),
                          })}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <button
                      type="button"
                      disabled={logoutOne.isPending}
                      onClick={() => logoutOne.mutate(session.id, { onError: failed })}
                      className={profileButton('secondary')}
                    >
                      {t('logOut')}
                    </button>
                  )}
                </div>
              );
            })}
          </SettingsCard>
          {sessions.some((s) => !s.isCurrent) && (
            <button
              type="button"
              disabled={logoutOthers.isPending}
              onClick={() => logoutOthers.mutate(undefined, { onError: failed })}
              className="text-sm font-semibold text-destructive hover:opacity-70"
            >
              {t('logOutOthers')}
            </button>
          )}
        </>
      )}
    </SettingsPage>
  );
}

// SETTINGS-8: people I blocked; unblocking lets them find me and follow me again
export function BlockedSettings() {
  const t = useTranslations('settings.blocked');
  const tSettings = useTranslations('settings');
  const { data: users } = useBlocked();
  const unblock = useUnblock();

  return (
    <SettingsPage title={t('title')} description={t('description')}>
      {!users ? (
        <SettingsLoading />
      ) : users.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <SettingsCard>
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-4">
              <Link href={`/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar src={user.avatarUrl} alt={user.username} size={44} />
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-semibold">{user.username}</span>
                  <span className="block truncate text-muted-foreground">{user.fullName}</span>
                </span>
              </Link>
              <button
                type="button"
                disabled={unblock.isPending}
                onClick={() =>
                  unblock.mutate(user, { onError: () => toast.error(tSettings('saveFailed')) })
                }
                className={profileButton('secondary')}
              >
                {t('unblock')}
              </button>
            </div>
          ))}
        </SettingsCard>
      )}
    </SettingsPage>
  );
}
