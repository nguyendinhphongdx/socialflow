import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { defaultLocale, locales } from './i18n/config'

const SESSION_COOKIE = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? 'sf_access'

// next-intl với `localePrefix: 'never'` — không inject prefix vào URL, chỉ
// negotiate locale qua cookie/header. Cookie `NEXT_LOCALE` set bởi
// LanguageSwitcher, fallback `defaultLocale`.
const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'never',
})

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requiresAuth = pathname.startsWith('/dashboard')
    || pathname.startsWith('/compose')
    || pathname.startsWith('/settings')

  if (requiresAuth) {
    const hasSession = req.cookies.get(SESSION_COOKIE)?.value
    if (!hasSession) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', pathname + req.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }
  }

  return intlMiddleware(req)
}

export const config = {
  // Match toàn bộ route trừ asset / API / internal — để intl negotiate locale,
  // auth check chỉ áp dụng cho protected prefix trong handler.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
