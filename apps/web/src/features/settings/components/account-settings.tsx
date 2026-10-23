'use client';

import type { Language, MessagePermission, Theme } from '@instagram/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useSettings, useUpdateSettings } from '../queries';
import { OptionRow, SettingsCard, SettingsLoading, SettingsPage, SwitchRow } from './settings-ui';

// The short sections that are one switch or one choice each

function Loading({ title }: { title: string }) {
  return (
    <SettingsPage title={title}>
      <SettingsLoading />
    </SettingsPage>
  );
}

// SETTINGS-3: private account
export function PrivacySettings() {
  const t = useTranslations('settings.privacy');
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  if (!settings) return <Loading title={t('title')} />;

  return (
    <SettingsPage title={t('title')}>
      <SettingsCard>
        <SwitchRow
          label={t('private')}
          description={settings.isPrivate ? t('privateOn') : t('privateOff')}
          checked={settings.isPrivate}
          onChange={(isPrivate) => update.mutate({ isPrivate })}
        />
      </SettingsCard>
    </SettingsPage>
  );
}

const permissions: MessagePermission[] = ['EVERYONE', 'FOLLOWING'];

// SETTINGS-3: who can message me, and whether others see when I'm online
export function MessagesSettings() {
  const t = useTranslations('settings.messages');
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  if (!settings) return <Loading title={t('title')} />;

  return (
    <SettingsPage title={t('title')}>
      <section className="space-y-3" role="radiogroup" aria-label={t('whoTitle')}>
        <h2 className="font-semibold">{t('whoTitle')}</h2>
        <SettingsCard>
          {permissions.map((permission) => (
            <OptionRow
              key={permission}
              label={t(`who.${permission}`)}
              selected={settings.messagePermission === permission}
              onSelect={() => update.mutate({ messagePermission: permission })}
            />
          ))}
        </SettingsCard>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">{t('activityTitle')}</h2>
        <SettingsCard>
          <SwitchRow
            label={t('activity')}
            description={t('activityHint')}
            checked={settings.showActivityStatus}
            onChange={(showActivityStatus) => update.mutate({ showActivityStatus })}
          />
        </SettingsCard>
      </section>
    </SettingsPage>
  );
}

const themes: Theme[] = ['LIGHT', 'DARK', 'SYSTEM'];

// SETTINGS-6: light, dark or as the device
export function AppearanceSettings() {
  const t = useTranslations('settings.appearance');
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  if (!settings) return <Loading title={t('title')} />;

  return (
    <SettingsPage title={t('title')} description={t('description')}>
      <div role="radiogroup" aria-label={t('title')}>
        <SettingsCard>
          {themes.map((theme) => (
            <OptionRow
              key={theme}
              label={t(`themes.${theme}`)}
              selected={settings.theme === theme}
              onSelect={() => update.mutate({ theme })}
            />
          ))}
        </SettingsCard>
      </div>
    </SettingsPage>
  );
}

const languages: Language[] = ['EN', 'RU'];

// SETTINGS-10: the interface language, saved in the account for every device
export function LanguageSettings() {
  const t = useTranslations('settings.language');
  const tLanguages = useTranslations('common.languages');
  const router = useRouter();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  if (!settings) return <Loading title={t('title')} />;

  const choose = (language: Language) =>
    update.mutate(
      { language },
      {
        // The texts come from the NEXT_LOCALE cookie, so set it and render again
        onSuccess: () => {
          document.cookie = `NEXT_LOCALE=${language.toLowerCase()}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        },
      },
    );

  return (
    <SettingsPage title={t('title')} description={t('description')}>
      <div role="radiogroup" aria-label={t('title')}>
        <SettingsCard>
          {languages.map((language) => (
            <OptionRow
              key={language}
              label={tLanguages(language.toLowerCase())}
              selected={settings.language === language}
              onSelect={() => choose(language)}
            />
          ))}
        </SettingsCard>
      </div>
    </SettingsPage>
  );
}
