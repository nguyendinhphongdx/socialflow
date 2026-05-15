import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? 'sf_access'

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.get(SESSION_COOKIE)?.value
  if (hasSession) return NextResponse.next()
  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/dashboard/:path*', '/compose/:path*', '/settings/:path*'],
}
