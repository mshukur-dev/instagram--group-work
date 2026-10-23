'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, ErrorCode, PASSWORD_MIN } from '@instagram/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useErrorText } from '@/features/auth/use-error-text';
import { profileButton } from '@/features/profile/components/profile-button';
import { getErrorCode } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { useChangePassword, useSettings } from '../queries';
import { SettingsLoading, SettingsPage } from './settings-ui';

const formSchema = changePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'] });
type FormValues = z.infer<typeof formSchema>;

const fieldClass =
  'h-11 w-full rounded-xl border border-border bg-background px-4 text-[15px] outline-none transition-colors focus:border-foreground/40 aria-invalid:border-destructive';

// SETTINGS-4: change the password; an account made with Google sets its first one here.
// The other sessions are logged out after a change.
export function PasswordSettings() {
  const t = useTranslations('settings.password');
  const errorText = useErrorText();
  const { data: settings } = useSettings();
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  if (!settings) {
    return (
      <SettingsPage title={t('title')}>
        <SettingsLoading />
      </SettingsPage>
    );
  }

  const hasPassword = settings.hasPassword;

  const submit = handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate(
      { currentPassword: hasPassword ? currentPassword : undefined, newPassword },
      {
        onSuccess: () => {
          reset();
          toast.success(t('changed'));
        },
        onError: (error) => {
          if (getErrorCode(error) === ErrorCode.WRONG_PASSWORD) {
            setError('currentPassword', { message: errorText(error) });
          } else {
            toast.error(errorText(error));
          }
        },
      },
    ),
  );

  const fields: { name: keyof FormValues; label: string; autoComplete: string }[] = [
    { name: 'newPassword', label: t('new'), autoComplete: 'new-password' },
    { name: 'confirmPassword', label: t('confirm'), autoComplete: 'new-password' },
  ];
  if (hasPassword) {
    fields.unshift({
      name: 'currentPassword',
      label: t('current'),
      autoComplete: 'current-password',
    });
  }

  const messageFor = (name: keyof FormValues) => {
    const error = errors[name];
    if (!error) return null;
    if (name === 'newPassword') return t('tooShort', { min: PASSWORD_MIN });
    if (name === 'confirmPassword') return t('mismatch');
    return error.message || t('required');
  };

  return (
    <SettingsPage
      title={hasPassword ? t('title') : t('createTitle')}
      description={hasPassword ? t('description') : t('createDescription')}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {fields.map(({ name, label, autoComplete }) => {
          const message = messageFor(name);
          return (
            <div key={name} className="space-y-2">
              <label htmlFor={name} className="block font-semibold">
                {label}
              </label>
              <input
                id={name}
                type="password"
                autoComplete={autoComplete}
                aria-invalid={Boolean(message)}
                className={fieldClass}
                {...register(name)}
              />
              {message && <p className="text-sm text-destructive">{message}</p>}
            </div>
          );
        })}
        <button
          type="submit"
          disabled={change.isPending}
          className={cn(profileButton('primary'), 'h-11 w-full')}
        >
          {change.isPending ? <Loader2 className="size-4 animate-spin" /> : t('save')}
        </button>
      </form>
    </SettingsPage>
  );
}
