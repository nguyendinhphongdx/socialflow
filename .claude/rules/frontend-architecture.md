# Frontend architecture (apps/web)

Rule cứng cho Next.js app. Bổ sung cho [coding-style.md](coding-style.md) "React / Next.js" section.

## Feature folder

Tổ chức theo **domain**, self-contained:

```
apps/web/src/
├── app/                  # Next.js App Router (routes only)
│   ├── (auth)/           # Route group — login, register
│   ├── (dashboard)/      # Route group — authed area
│   ├── api/              # API route handlers (BFF — minimal, prefer hit api/ directly)
│   ├── layout.tsx
│   ├── providers.tsx     # Client provider tree
│   ├── error.tsx
│   ├── loading.tsx
│   ├── not-found.tsx
│   └── globals.css
├── features/             # ⭐ Domain-organized features
│   └── <domain>/
│       ├── components/   # UI components scoped to this feature
│       ├── hooks/        # TanStack Query hooks + custom hooks
│       ├── services/     # axios calls — typed via ts-rest contract
│       ├── types/        # Local types (extend from packages/common where possible)
│       ├── views/        # Top-level page composition (LoginView, DashboardView, ...)
│       └── index.ts      # ⭐ Single barrel export — public surface
├── components/
│   ├── ui/               # shadcn-generated primitives (Button, Input, ...)
│   ├── layout/           # Shell, Sidebar, Header, AuthGuard
│   ├── providers/        # ThemeProvider, QueryProvider wrappers
│   └── shared/           # ErrorBoundary, EmptyState, ...
├── hooks/                # Cross-feature hooks (useMobile, useDebounce)
├── lib/
│   ├── api/              # axios client + interceptors + types
│   ├── seo/              # createMetadata, jsonld, SITE
│   ├── utils.ts          # cn(), formatters
│   └── types/            # ID, ISODate, Nullable, Pagination
├── stores/               # zustand stores (UI state only, NOT server state)
└── middleware.ts         # Next.js edge middleware (auth gate)
```

Quy tắc feature folder:
- ✅ 1 feature = 1 folder, không cross-import giữa features (gọi qua hook/service barrel)
- ✅ `index.ts` chỉ re-export những gì cần dùng ngoài feature
- ✅ Pages (`app/**/page.tsx`) chỉ render `<FeatureView />`, không có logic
- ❌ KHÔNG đặt component dùng cross-feature trong `features/` — đặt `components/shared/`
- ❌ KHÔNG export internal helper qua `index.ts` (giữ encapsulation)

Domain ví dụ cho Sociflow: `auth`, `accounts`, `compose`, `publish`, `inbox`, `analytics`, `agents`, `settings`, `billing`.

## App Router conventions

- **Route group** (`(name)/`) cho layouts khác nhau (auth vs dashboard)
- `layout.tsx` server component (default) — wrap children
- `page.tsx` = thin, gọi `<FeatureView />` từ feature
- `loading.tsx` cho mỗi route group (skeleton)
- `error.tsx` mỗi route group (fallback UI)
- `app/error.tsx` root — global error boundary
- `app/not-found.tsx` root
- `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts` cho SEO

```tsx
// app/(dashboard)/publish/page.tsx
import { PublishView, createMetadata } from '@/features/publish'

export const metadata = createMetadata({ title: 'Publish', path: '/publish' })

export default function Page() {
  return <PublishView />
}
```

## Auth gate — double layer

Tránh "auth flash" (render loading state trước khi redirect):

### 1. Edge middleware — server-side cookie check

```ts
// apps/web/src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'sf_access'

export function middleware(req: NextRequest) {
  const hasToken = req.cookies.get(SESSION_COOKIE)?.value
  if (hasToken) return NextResponse.next()
  const url = new URL('/login', req.url)
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/dashboard/:path*', '/compose/:path*', '/settings/:path*'],
}
```

Edge middleware chạy **trước** Next render → user không thấy spinner.

### 2. Client `<AuthGuard>` — secondary check + unverified flow

```tsx
// components/layout/AuthGuard.tsx
'use client'
import { useAuth } from '@/features/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  if (isLoading) return <DashboardSkeleton />
  if (!user) { router.replace('/login'); return null }
  if (!user.isVerified) { router.replace('/verify-email'); return null }

  return <>{children}</>
}
```

Cookie có thể stale (expired sau khi middleware check) → `<AuthGuard>` chặn render UI khi `useAuth()` fail.

## API client (axios)

```ts
// lib/api/client.ts
import axios, { type InternalAxiosRequestConfig } from 'axios'

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  withCredentials: true,    // web dùng cookie auth
})

let refreshInFlight: Promise<void> | null = null
let refreshFailed = false

export function resetSession() { refreshInFlight = null; refreshFailed = false }

async function performRefresh() {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = apiClient.post('/auth/refresh').then(() => { refreshInFlight = null })
  return refreshInFlight
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error.config as RetryableConfig | undefined
    if (refreshFailed || error.response?.status !== 401 || !config || config._retry) {
      return Promise.reject(error)
    }
    config._retry = true
    try {
      await performRefresh()
      return apiClient(config)
    } catch {
      refreshFailed = true
      window.location.href = '/login'
      return Promise.reject(error)
    }
  },
)
```

Quy tắc:
- ✅ Single-flight refresh: 10 request 401 đồng thời → 1 lần `/auth/refresh`
- ✅ `withCredentials: true` để gửi cookie
- ✅ `_retry` flag chống infinite loop
- ✅ `resetSession()` gọi từ `useLogout` để re-arm flag
- ❌ KHÔNG inject `Authorization` header (web dùng cookie)
- ❌ KHÔNG retry ngoài 401 (4xx khác là business error, không phải auth)

## Auth state — TanStack Query

Auth user lưu trong Query cache, **KHÔNG trong zustand**:

```ts
// features/auth/hooks/useAuth.ts
export const authKeys = { me: ['auth', 'me'] as const }

export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: authKeys.me,
    queryFn: authService.getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  return { user: data ?? null, isLoading, isAuthenticated: !!data }
}

export function useLogin() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: authService.login,
    onSuccess: (res) => {
      qc.setQueryData(authKeys.me, res.user)    // optimistic seed, skip roundtrip
      router.push('/dashboard')
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      qc.clear()
      resetSession()
      router.push('/login')
    },
  })
}
```

## SEO helper

```ts
// lib/seo/site.ts
export const SITE = {
  name: 'Sociflow',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sociflow.io',
  description: 'AI-powered social media publishing',
  ogImage: '/og.png',
  twitter: '@sociflow',
}

// lib/seo/metadata.ts
import type { Metadata } from 'next'
import { SITE } from './site'

interface Opts {
  title?: string
  description?: string
  path?: string
  image?: string
  noIndex?: boolean
}

export function createMetadata(opts: Opts = {}): Metadata {
  const title = opts.title ? `${opts.title} | ${SITE.name}` : SITE.name
  const url = opts.path ? `${SITE.url}${opts.path}` : SITE.url
  return {
    title,
    description: opts.description ?? SITE.description,
    alternates: { canonical: url },
    openGraph: { title, url, description: opts.description ?? SITE.description, images: [opts.image ?? SITE.ogImage] },
    twitter: { card: 'summary_large_image', title, description: opts.description, images: [opts.image ?? SITE.ogImage] },
    robots: opts.noIndex ? { index: false, follow: false } : undefined,
  }
}
```

## i18n (sau Phase 1)

- Phase 0: English-only (giảm scope)
- Phase 1+: `next-intl` với locale `vi`, `en`
- Key format: kebab-case (`button.submit`, `error.network-failed`)
- Server component: `getTranslations()`; client: `useTranslations()`

## Anti-patterns

- ❌ `useEffect` để derive state từ Query data → dùng `useMemo`
- ❌ Lưu auth user vào zustand + sync với Query (duplicate source of truth)
- ❌ `try { await mutation.mutateAsync() } catch { toast() }` → dùng `onError` callback
- ❌ Khởi tạo `const queryClient = new QueryClient()` ở module top-level (SSR cache leak)
- ❌ `<script>` inline trong layout — dùng `next/script`
- ❌ Hardcode color: `text-[#FF0000]` → dùng theme variable `text-destructive`
- ❌ Cross-feature import: `features/publish/...` import `features/accounts/internal/...` — chỉ qua barrel `index.ts`

## References

- nextjs-boilerplate `src/features/auth/` — feature folder pattern
- nextjs-boilerplate `src/lib/api/client.ts` — single-flight refresh interceptor
- nextjs-boilerplate `src/components/layout/AuthGuard.tsx` + `src/middleware.ts` — double-layer guard
- [ADR-0005](../../docs/decisions/0005-auth-flow.md) — auth flow
- [coding-style.md](coding-style.md) — base coding style
