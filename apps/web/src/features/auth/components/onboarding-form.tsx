'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { usernameSchema } from '@instagram/shared';
import { useMe } from '@/features/profile/queries';
import { useChangeUsername } from '../queries';
import { useErrorText } from '../use-error-text';
import { AuthField } from './auth-field';
import { FormError } from './form-error';
import { SubmitButton } from './submit-button';

const schema = z.object({ username: usernameSchema });
type Values = z.infer<typeof schema>;

// Shown once after the first Google sign-in: the username was generated from the email
export function OnboardingForm() {
  const t = useTranslations('auth');
  const errorText = useErrorText();
  const me = useMe();
  const change = useChangeUsername();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, errors, touchedFields },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  useEffect(() => {
    if (me.data) reset({ username: me.data.username }, { keepDefaultValues: false });
  }, [me.data, reset]);

  return (
    <>
      <h1 className="mb-1 text-center text-[17px] font-semibold">{t('onboardingTitle')}</h1>
      <p className="text-muted-foreground mb-6 text-center text-sm leading-snug">
        {t('onboardingHint')}
      </p>

      <form
        onSubmit={handleSubmit(({ username }) => change.mutate(username))}
        noValidate
        className="flex flex-col"
      >
        <AuthField
          id="username"
          label={t('username')}
          autoComplete="username"
          autoCapitalize="none"
          invalid={Boolean(touchedFields.username && errors.username)}
          {...register('username')}
        />
        <SubmitButton
          pending={change.isPending}
          disabled={!isValid || me.isPending}
          className="mt-4"
        >
          {t('continue')}
        </SubmitButton>
      </form>

      <FormError>{change.isError ? errorText(change.error) : null}</FormError>
    </>
  );
}
