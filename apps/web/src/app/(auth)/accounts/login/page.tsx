import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthSplit } from '@/features/auth/components/auth-split';
import { LoginForm } from '@/features/auth/components/login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('logInTitle') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations('auth');
  const { error } = await searchParams;
  const redirectError =
    error === 'google_failed' || error === 'google_not_configured' || error === 'account_banned'
      ? error
      : undefined;

  return (
    <AuthSplit
      heroTitle="loginHeroTitle"
      heading={t('loginHeading')}
      switchLink={{ href: '/accounts/emailsignup', label: t('createAccount') }}
    >
      <LoginForm redirectError={redirectError} />
    </AuthSplit>
  );
}
