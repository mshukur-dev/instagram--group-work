import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AuthCard, AuthShell, AuthSwitchCard } from '@/features/auth/components/auth-shell';
import { SignupForm } from '@/features/auth/components/signup-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signUpTitle') };
}

export default async function SignupPage() {
  const t = await getTranslations('auth');

  return (
    <AuthShell>
      <AuthCard>
        <SignupForm />
      </AuthCard>
      <AuthSwitchCard>
        {t('haveAccount')}{' '}
        <Link href="/accounts/login" className="text-brand hover:text-brand-hover font-semibold">
          {t('logIn')}
        </Link>
      </AuthSwitchCard>
    </AuthShell>
  );
}
