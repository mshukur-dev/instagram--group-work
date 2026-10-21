'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { ErrorCode, type RegisterInput, registerSchema } from '@instagram/shared';
import { getErrorCode } from '@/lib/api-error';
import { useRegister } from '../queries';
import { useErrorText } from '../use-error-text';
import { AuthField } from './auth-field';
import { FormError } from './form-error';
import { GoogleButton, OrDivider } from './google-button';
import { SubmitButton } from './submit-button';

export function SignupForm() {
  const t = useTranslations('auth');
  const errorText = useErrorText();
  const signup = useRegister();
  const {
    register,
    handleSubmit,
    formState: { isValid, errors, touchedFields },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), mode: 'onTouched' });

  // Show the red mark only after the user left the field, or when the server rejected the value
  const code = signup.isError ? getErrorCode(signup.error) : null;
  const invalid = (name: keyof RegisterInput) => Boolean(touchedFields[name] && errors[name]);

  return (
    <>
      <p className="text-muted-foreground mb-5 text-center text-[17px] leading-tight font-semibold">
        {t('signupTagline')}
      </p>
      <GoogleButton variant="primary" />
      <OrDivider />

      <form onSubmit={handleSubmit((values) => signup.mutate(values))} className="flex flex-col gap-2" noValidate>
        <AuthField
          id="email"
          type="email"
          label={t('email')}
          autoComplete="email"
          invalid={invalid('email') || code === ErrorCode.EMAIL_TAKEN}
          {...register('email')}
        />
        <AuthField
          id="fullName"
          label={t('fullName')}
          autoComplete="name"
          invalid={invalid('fullName')}
          {...register('fullName')}
        />
        <AuthField
          id="username"
          label={t('username')}
          autoComplete="username"
          autoCapitalize="none"
          invalid={invalid('username') || code === ErrorCode.USERNAME_TAKEN}
          {...register('username')}
        />
        <AuthField
          id="password"
          type="password"
          label={t('password')}
          autoComplete="new-password"
          invalid={invalid('password')}
          {...register('password')}
        />
        <SubmitButton pending={signup.isPending} disabled={!isValid} className="mt-3">
          {t('signUp')}
        </SubmitButton>
      </form>

      <FormError>{signup.isError ? errorText(signup.error) : null}</FormError>
    </>
  );
}
