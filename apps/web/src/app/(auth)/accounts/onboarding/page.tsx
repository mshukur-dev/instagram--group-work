import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard, AuthShell } from '@/features/auth/components/auth-shell';
import { OnboardingForm } from '@/features/auth/components/onboarding-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('onboardingTitle') };
}

export default function OnboardingPage() {
  return (
    <AuthShell>
      <AuthCard>
        <OnboardingForm />
      </AuthCard>
    </AuthShell>
  );
}
