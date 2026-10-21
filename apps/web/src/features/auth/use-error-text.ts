import { useTranslations } from 'next-intl';
import { getErrorCode } from '@/lib/api-error';

/** Translates an API error by its `code` (docs/spec/i18n.md); unknown codes fall back to errors.UNKNOWN. */
export function useErrorText() {
  const t = useTranslations('errors');
  return (error: unknown) => {
    const code = getErrorCode(error);
    return t.has(code) ? t(code) : t('UNKNOWN');
  };
}
