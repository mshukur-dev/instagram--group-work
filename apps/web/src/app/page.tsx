import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('common');

  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">{t('appName')}</h1>
    </main>
  );
}
