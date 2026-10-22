import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthSplit } from '@/features/auth/components/auth-split';
import { SignupForm } from '@/features/auth/components/signup-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signUpTitle') };
}

export default async function SignupPage() {
  const t = await getTranslations('auth');

  return (
    <AuthSplit
      heroTitle="signupHeroTitle"
      heading={t('signupTagline')}
      switchLink={{ href: '/accounts/login', label: t('haveAccountLogIn') }}
    >
      <SignupForm />
    </AuthSplit>
  );
}
