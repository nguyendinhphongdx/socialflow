import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config'

/**
 * Server-side resolver — đọc locale từ cookie `NEXT_LOCALE` (set bởi LanguageSwitcher).
 * Fallback `defaultLocale` (vi) nếu cookie thiếu hoặc invalid.
 * Khi roll out i18n routing (sau Phase 7), thay bằng `requestLocale` từ URL segment.
 */
export default getRequestConfig(async () => {
  const cookieStore = cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
