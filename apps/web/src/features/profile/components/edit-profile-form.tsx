'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BIO_MAX,
  ErrorCode,
  type Me,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@instagram/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useErrorText } from '@/features/auth/use-error-text';
import { getErrorCode } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { useMe, useUpdateProfile } from '../queries';
import { AvatarPicker } from './avatar-picker';
import { profileButton } from './profile-button';

type FormValues = z.input<typeof updateProfileSchema>;

const fieldClass =
  'w-full rounded-xl border border-border bg-background px-4 text-[15px] outline-none transition-colors focus:border-foreground/40 aria-invalid:border-destructive';

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function EditForm({ me }: { me: Me }) {
  const t = useTranslations('editProfile');
  const errorText = useErrorText();
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues, unknown, UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: me.fullName,
      username: me.username,
      website: me.website ?? '',
      bio: me.bio ?? '',
    },
  });

  const onSubmit = (values: UpdateProfileInput) =>
    // After saving, the saved values become the new "clean" state of the form
    update.mutate(values, {
      onSuccess: (saved) =>
        reset({ ...values, website: saved.website ?? '', bio: saved.bio ?? '' }),
    });

  const serverCode = update.isError ? getErrorCode(update.error) : null;
  const bioLength = watch('bio')?.length ?? 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Field id="fullName" label={t('name')} error={errors.fullName && t('nameInvalid')}>
        <input
          id="fullName"
          autoComplete="name"
          aria-invalid={Boolean(errors.fullName)}
          className={cn(fieldClass, 'h-11')}
          {...register('fullName')}
        />
      </Field>

      <Field
        id="username"
        label={t('username')}
        error={
          errors.username
            ? t('usernameInvalid')
            : serverCode === ErrorCode.USERNAME_TAKEN
              ? errorText(update.error)
              : null
        }
      >
        <input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          aria-invalid={Boolean(errors.username) || serverCode === ErrorCode.USERNAME_TAKEN}
          className={cn(fieldClass, 'h-11')}
          {...register('username')}
        />
      </Field>

      <Field id="website" label={t('website')} error={errors.website && t('websiteInvalid')}>
        <input
          id="website"
          type="url"
          placeholder={t('websitePlaceholder')}
          aria-invalid={Boolean(errors.website)}
          className={cn(fieldClass, 'h-11')}
          {...register('website')}
        />
      </Field>

      <Field id="bio" label={t('bio')}>
        <div className="relative">
          <textarea
            id="bio"
            rows={3}
            maxLength={BIO_MAX}
            className={cn(fieldClass, 'resize-none py-3 pb-7')}
            {...register('bio')}
          />
          <span className="absolute right-4 bottom-2 text-xs text-muted-foreground">
            {bioLength} / {BIO_MAX}
          </span>
        </div>
      </Field>

      <div className="flex items-center justify-end gap-4">
        {update.isSuccess && !isDirty && (
          <p className="text-sm text-muted-foreground">{t('saved')}</p>
        )}
        {update.isError && serverCode !== ErrorCode.USERNAME_TAKEN && (
          <p className="text-sm text-destructive">{errorText(update.error)}</p>
        )}
        <button
          type="submit"
          disabled={!isDirty || update.isPending}
          className={cn(profileButton('primary'), 'h-11 w-62.5 rounded-xl max-md:w-full')}
        >
          {update.isPending ? <Loader2 className="size-4 animate-spin" /> : t('submit')}
        </button>
      </div>
    </form>
  );
}

// PROFILE-3: photo, name, username, website and bio
export function EditProfile() {
  const t = useTranslations('editProfile');
  const { data: me } = useMe();

  return (
    <div className="mx-auto w-full max-w-175 space-y-8 px-5 py-9 max-md:py-5">
      <h1 className="text-xl font-bold">{t('title')}</h1>
      {me ? (
        <>
          <AvatarPicker me={me} />
          <EditForm me={me} />
        </>
      ) : (
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      )}
    </div>
  );
}
