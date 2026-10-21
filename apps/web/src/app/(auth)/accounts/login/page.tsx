import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AuthCard, AuthShell, AuthSwitchCard } from '@/features/auth/components/auth-shell';
import { LoginForm } from '@/features/auth/components/login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('logInTitle') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getTranslations('auth');
  const { error } = await searchParams;
  const redirectError = error === 'google_failed' || error === 'google_not_configured' ? error : undefined;

  return (
    <AuthShell>
      <AuthCard>
        <LoginForm redirectError={redirectError} />
      </AuthCard>
      <AuthSwitchCard>
        {t('noAccount')}{' '}
        <Link href="/accounts/emailsignup" className="text-brand hover:text-brand-hover font-semibold">
          {t('signUp')}
        </Link>
      </AuthSwitchCard>
    </AuthShell>
  );
}
