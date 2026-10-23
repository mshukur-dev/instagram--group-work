'use client';

import type { UpdateNotificationSettingsInput } from '@instagram/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { enablePush, pushSupported } from '@/features/push/push';
import { useSettings, useUpdateNotificationSettings } from '../queries';
import { OptionRow, SettingsCard, SettingsLoading, SettingsPage, SwitchRow } from './settings-ui';

const categories = ['likes', 'comments', 'follows', 'messages', 'calls'] as const;
const pauseOptions = [0, 1, 8, 24] as const;

// SETTINGS-2: browser notifications on / off, which kinds of events send them, pause all
export function NotificationsSettings() {
  const t = useTranslations('settings.notifications');
  const format = useFormatter();
  const { data: settings } = useSettings();
  const update = useUpdateNotificationSettings();

  if (!settings) {
    return (
      <SettingsPage title={t('title')}>
        <SettingsLoading />
      </SettingsPage>
    );
  }

  const n = settings.notifications;
  const save = (input: UpdateNotificationSettingsInput) => update.mutate(input);
  const pausedUntil = n.pausedUntil && new Date(n.pausedUntil) > new Date() ? n.pausedUntil : null;

  // Turning push on also asks this browser for permission and subscribes it
  const togglePush = async (on: boolean) => {
    if (on && pushSupported() && !(await enablePush())) {
      toast.error(t('permissionDenied'));
      return;
    }
    save({ pushEnabled: on });
  };

  return (
    <SettingsPage title={t('title')} description={t('description')}>
      <SettingsCard>
        <SwitchRow
          label={t('push')}
          description={t('pushHint')}
          checked={n.pushEnabled}
          onChange={(on) => void togglePush(on)}
        />
      </SettingsCard>

      <section className="space-y-3">
        <h2 className="font-semibold">{t('kindsTitle')}</h2>
        <SettingsCard>
          {categories.map((key) => (
            <SwitchRow
              key={key}
              label={t(`kinds.${key}`)}
              checked={n[key]}
              disabled={!n.pushEnabled}
              onChange={(on) => save({ [key]: on })}
            />
          ))}
        </SettingsCard>
      </section>

      <section className="space-y-3" role="radiogroup" aria-label={t('pauseTitle')}>
        <h2 className="font-semibold">{t('pauseTitle')}</h2>
        {pausedUntil && (
          <p className="text-sm text-muted-foreground">
            {t('pausedUntil', {
              time: format.dateTime(new Date(pausedUntil), {
                hour: 'numeric',
                minute: '2-digit',
                weekday: 'short',
              }),
            })}
          </p>
        )}
        <SettingsCard>
          {pauseOptions.map((hours) => (
            <OptionRow
              key={hours}
              label={hours === 0 ? t('pauseOff') : t('pauseFor', { hours })}
              selected={hours === 0 ? !pausedUntil : false}
              disabled={!n.pushEnabled}
              onSelect={() => save({ pauseHours: hours })}
            />
          ))}
        </SettingsCard>
      </section>
    </SettingsPage>
  );
}
