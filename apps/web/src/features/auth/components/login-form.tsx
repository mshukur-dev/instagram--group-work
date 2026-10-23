'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { ErrorCode, type LoginInput, loginSchema } from '@instagram/shared';
import { getErrorCode, getErrorDetails } from '@/lib/api-error';
import { useLogin } from '../queries';
import { useErrorText } from '../use-error-text';
import { AuthField } from './auth-field';
import { FormError } from './form-error';
import { GoogleButton, OrDivider } from './google-button';
import { SubmitButton } from './submit-button';

const redirectErrorKeys = {
  google_failed: 'googleFailed',
  google_not_configured: 'googleNotConfigured',
  account_banned: 'accountBanned',
} as const;

export function LoginForm({
  redirectError,
}: {
  redirectError?: 'google_failed' | 'google_not_configured' | 'account_banned';
}) {
  const t = useTranslations('auth');
  const errorText = useErrorText();
  const login = useLogin();
  // ADMIN-4: a banned account sees the admin's reason
  const banReason =
    login.isError && getErrorCode(login.error) === ErrorCode.ACCOUNT_BANNED
      ? getErrorDetails(login.error).reason
      : undefined;
  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: 'onTouched' });

  return (
    <>
      <form
        onSubmit={handleSubmit((values) => login.mutate(values))}
        className="flex flex-col gap-2"
        noValidate
      >
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
        <SubmitButton pending={login.isPending} disabled={!isValid} className="mt-2 rounded-full">
          {t('logIn')}
        </SubmitButton>
      </form>

      <OrDivider />
      <GoogleButton variant="outline" />

      <FormError>
        {login.isError ? (
          <>
            {errorText(login.error)}
            {typeof banReason === 'string' && banReason && (
              <span className="mt-1 block">{t('banReason', { reason: banReason })}</span>
            )}
          </>
        ) : redirectError ? (
          t(redirectErrorKeys[redirectError])
        ) : null}
      </FormError>
    </>
  );
}
