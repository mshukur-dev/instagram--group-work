import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'ru'] as const;
type Locale = (typeof locales)[number];

// No locale in the URL: the choice lives in the NEXT_LOCALE cookie, English by default
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value;
  const locale: Locale = locales.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : 'en';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
