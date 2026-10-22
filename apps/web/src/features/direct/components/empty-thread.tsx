'use client';

import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { NewMessageDialog } from './new-message-dialog';

// The right side before a chat is picked: an invitation to start one
export function EmptyThread() {
  const t = useTranslations('direct');
  const [composing, setComposing] = useState(false);
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-24 place-items-center rounded-full border-2 border-foreground">
          <Send className="size-11 -translate-x-0.5 translate-y-0.5" strokeWidth={1.5} />
        </span>
        <h2 className="mt-4 text-xl">{t('empty.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty.body')}</p>
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="mt-5 h-8 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors outline-none hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('empty.action')}
        </button>
      </div>
      {composing && <NewMessageDialog open onOpenChange={setComposing} />}
    </div>
  );
}
