'use client';

import { ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ErrorCode } from '@instagram/shared';
import { getErrorCode } from '@/lib/api-error';

// A post that cannot be shown: deleted, hidden by a block, or in a private account
export function PostUnavailable({ error }: { error: unknown }) {
  const t = useTranslations('post');
  const code = getErrorCode(error);
  const kind =
    code === ErrorCode.PRIVATE_ACCOUNT
      ? 'private'
      : code === ErrorCode.POST_NOT_FOUND
        ? 'missing'
        : 'failed';

  return (
    <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full border-2 border-foreground/80">
        <ImageOff className="size-7" />
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold">{t(`unavailable.${kind}.title`)}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{t(`unavailable.${kind}.body`)}</p>
      </div>
    </div>
  );
}
