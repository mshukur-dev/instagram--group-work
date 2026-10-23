'use client';

import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SettingsNav } from './settings-nav';

// /accounts. Phone: the list of sections. Desktop: the list is already on the left,
// so the right side only invites to pick a section.
export function SettingsIndex() {
  const t = useTranslations('settings');
  return (
    <>
      <div className="md:hidden">
        <SettingsNav variant="list" />
      </div>
      <div className="flex h-dvh flex-col items-center justify-center gap-3 text-center max-md:hidden">
        <span className="grid size-16 place-items-center rounded-full border-2 border-foreground">
          <Settings className="size-8" strokeWidth={1.5} />
        </span>
        <p className="font-semibold">{t('pickSection')}</p>
      </div>
    </>
  );
}
