import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? 'sf_access'

// i18n locale negotiate qua cookie `NEXT_LOCALE` trong `i18n/request.ts` —
// KHÔNG dùng next-intl URL rewrite middleware (app routes không có [locale]
// segment). LanguageSwitcher set cookie, getRequestConfig đọc cookie.
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

  return NextResponse.next()
}

export const config = {
  // Match toàn bộ route trừ asset / API / internal — để intl negotiate locale,
  // auth check chỉ áp dụng cho protected prefix trong handler.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
