'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BAN_REASON_MAX,
  type AdminUser,
  type BanUserInput,
  banUserSchema,
} from '@instagram/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { UserAvatar } from '@/components/user-avatar';
import { ProfileDialog } from '@/features/profile/components/profile-dialog';
import { cn } from '@/lib/utils';
import { useBanUser } from '../queries';

const presets = ['spam', 'harassment', 'fake', 'inappropriate'] as const;

type Props = {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ADMIN-4: the reason is required; it is shown to the user when they try to log in
export function BanDialog({ user, open, onOpenChange }: Props) {
  const t = useTranslations('admin.ban');
  const ban = useBanUser();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isValid },
  } = useForm<BanUserInput>({
    resolver: zodResolver(banUserSchema),
    mode: 'onChange',
    defaultValues: { reason: '' },
  });
  const reason = watch('reason');

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = handleSubmit(({ reason: text }) =>
    ban.mutate({ id: user.id, reason: text }, { onSuccess: () => close(false) }),
  );

  return (
    <ProfileDialog
      open={open}
      onOpenChange={close}
      title={t('title', { username: user.username })}
      className="max-w-110"
    >
      <form onSubmit={submit} className="flex flex-col">
        <div className="flex flex-col items-center gap-3 px-6 pt-7 pb-5 text-center">
          <UserAvatar src={user.avatarUrl} alt={user.username} size={64} />
          <div className="space-y-1">
            <p aria-hidden="true" className="text-[15px] font-semibold">
              {t('title', { username: user.username })}
            </p>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
        </div>

        <div className="space-y-3 px-6 pb-5">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((key) => {
              const text = t(`presets.${key}`);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setValue('reason', text, { shouldValidate: true })}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    reason === text
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:bg-foreground/5',
                  )}
                >
                  {text}
                </button>
              );
            })}
          </div>
          <label className="block">
            <span className="sr-only">{t('reasonLabel')}</span>
            <textarea
              {...register('reason')}
              rows={3}
              maxLength={BAN_REASON_MAX}
              placeholder={t('reasonPlaceholder')}
              className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/40"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!isValid || ban.isPending}
          className="flex w-full items-center justify-center gap-2 border-t border-border/50 py-3.5 text-sm font-bold text-destructive outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6 disabled:opacity-40"
        >
          {ban.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('confirm')}
        </button>
        <button
          type="button"
          onClick={() => close(false)}
          className="w-full border-t border-border/50 py-3.5 text-sm outline-none transition-colors hover:bg-foreground/4 focus-visible:bg-foreground/6"
        >
          {t('cancel')}
        </button>
      </form>
    </ProfileDialog>
  );
}
