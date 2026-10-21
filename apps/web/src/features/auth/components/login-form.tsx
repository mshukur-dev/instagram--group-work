'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { type LoginInput, loginSchema } from '@instagram/shared';
import { useLogin } from '../queries';
import { useErrorText } from '../use-error-text';
import { AuthField } from './auth-field';
import { FormError } from './form-error';
import { GoogleButton, OrDivider } from './google-button';
import { SubmitButton } from './submit-button';

export function LoginForm({ redirectError }: { redirectError?: 'google_failed' | 'google_not_configured' }) {
  const t = useTranslations('auth');
  const errorText = useErrorText();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: 'onTouched' });

  return (
    <>
      <form onSubmit={handleSubmit((values) => login.mutate(values))} className="flex flex-col gap-2" noValidate>
        <AuthField
          id="login"
          label={t('loginLabel')}
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          {...register('login')}
        />
        <AuthField
          id="password"
          type="password"
          label={t('password')}
          autoComplete="current-password"
          {...register('password')}
        />
        <SubmitButton pending={login.isPending} disabled={!isValid} className="mt-3">
          {t('logIn')}
        </SubmitButton>
      </form>

      <OrDivider />
      <GoogleButton variant="link" />

      <FormError>
        {login.isError
          ? errorText(login.error)
          : redirectError
            ? t(redirectError === 'google_failed' ? 'googleFailed' : 'googleNotConfigured')
            : null}
      </FormError>
    </>
  );
}
