'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { type LoginInput, loginSchema } from '@instagram/shared';
import { useLogin } from '../queries';
import { useErrorText } from '../use-error-text';
import { AuthField } from './auth-field';
import { FormError } from './form-error';
import { GoogleButton, OrDivider } from './google-button';
import { SubmitButton } from './submit-button';

export function LoginForm({
  redirectError,
}: {
  redirectError?: 'google_failed' | 'google_not_configured';
}) {
  const t = useTranslations('auth');
  const errorText = useErrorText();
  const login = useLogin();
  const reduceMotion = useReducedMotion();
  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: 'onTouched' });

  return (
    <>
      {/* A wrong password shakes the form, like a head saying "no" */}
      <motion.form
        onSubmit={handleSubmit((values) => login.mutate(values))}
        animate={login.isError && !reduceMotion ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
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
      </motion.form>

      <OrDivider />
      <GoogleButton variant="outline" />

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
