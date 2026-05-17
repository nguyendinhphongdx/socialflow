'use client'
import { useTransition, type FC } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { locales, localeLabels, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/config'

/**
 * Dropdown đổi ngôn ngữ — set cookie `NEXT_LOCALE` rồi `router.refresh()`.
 * next-intl/plugin với `localePrefix: 'never'` đọc cookie ở `i18n/request.ts`.
 */
export const LanguageSwitcher: FC = () => {
  const current = useLocale() as Locale
  const t = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    if (!isLocale(next) || next === current) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    startTransition(() => {
      window.location.reload()
    })
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{t('language')}</span>
      <select
        value={current}
        onChange={onChange}
        disabled={isPending}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        aria-label={t('language')}
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeLabels[loc]}
          </option>
        ))}
      </select>
    </label>
  )
}
