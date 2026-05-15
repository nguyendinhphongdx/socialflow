---
title: ADR-0005 Auth flow — Hybrid cookie (web) + Bearer (extension/mobile/3rd-party) + Session table với hashed refresh
status: accepted
date: 2026-05-15
deciders: [founder]
---

# ADR-0005 — Auth flow: Hybrid cookie (web) + Bearer header (extension/mobile/3rd-party)

## Status

Accepted.

## Context

Sociflow có **multi-client**:
- `apps/web/` — Next.js SaaS UI (browser, same-origin với api)
- `apps/extension/` — Chrome MV3 (cross-origin, không share cookie với web)
- 3rd-party API consumer tương lai — qua `ApiKey` hoặc Bearer JWT
- Mobile app tương lai (React Native / Flutter) — Bearer

1 auth scheme phải support cả 4 client types. Cần quyết định:
1. Token transport: cookie httpOnly vs Bearer header vs cả hai?
2. Refresh strategy: stateless JWT verify vs Session table + rotation?

## Decision

### 1. Hybrid transport — JwtStrategy dual extractor

Backend `JwtStrategy` thử **cookie trước, fallback Authorization header**:

```ts
function cookieOrBearerExtractor(cookieName: string) {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()
  return (req: Request) => req?.cookies?.[cookieName] ?? fromHeader(req)
}

super({
  jwtFromRequest: cookieOrBearerExtractor('sf_access'),
  secretOrKey: config.auth.jwtAccessSecret,
  ...
})
```

Client chọn transport theo capability:

| Client | Transport | Storage | Lý do |
|---|---|---|---|
| `apps/web/` | **Cookie httpOnly** (SameSite=Lax, Secure prod) | Browser auto, JS không touch | XSS-safer — JS không đọc được token |
| `apps/extension/` | **Bearer Authorization header** | `chrome.storage.local` | Extension không share cookie với api domain |
| Mobile (React Native) | **Bearer Authorization header** | Secure storage (Keychain/Keystore) | Cookie không thuận tiện trên mobile WebView |
| 3rd-party API | **Bearer Authorization header** | Client's responsibility | Industry standard |

Web axios:
```ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,    // gửi cookie tự động
})
// KHÔNG cần Authorization header — backend đọc cookie
```

Extension fetch:
```ts
await fetch(url, {
  headers: { Authorization: `Bearer ${await getStoredToken()}` },
})
```

### 2. Token structure

- **Access token**: JWT HS256, TTL **15 phút**, secret `JWT_ACCESS_SECRET`
- **Refresh token**: JWT HS256, TTL **7 ngày**, secret riêng `JWT_REFRESH_SECRET`
- Dual-secret: leak access secret KHÔNG cho phép forge refresh

### 3. Session table + rotation (giữ nguyên)

Mọi refresh token đều có row `Session` với `refreshTokenSha256` (one-way hash). Mỗi `/auth/refresh` rotate single-use:
- Revoke old session row, tạo row mới với refresh token mới
- **Replay detection**: nếu refresh đã revoke được gửi lại → revoke toàn bộ session của user đó (suspicious)
- Refresh stateless (chỉ verify JWT) KHÔNG được dùng — security gap quá lớn

### 4. Cookie config (web)

```ts
// apps/api setAuthCookies(res, tokens)
res.cookie('sf_access', accessToken, {
  httpOnly: true,
  secure: config.app.env === 'production',
  sameSite: 'lax',          // 'lax' cho phép OAuth redirect; 'strict' nếu không cần
  maxAge: 15 * 60 * 1000,   // 15 phút
  path: '/',
})
res.cookie('sf_refresh', refreshToken, {
  httpOnly: true,
  secure: config.app.env === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/auth/refresh',    // chỉ gửi cho refresh endpoint — giảm bề mặt CSRF
})
```

### 5. CSRF protection (web cookie flow)

Cookie auth ⇒ phải có CSRF defense:
- `SameSite=Lax` đủ cho 95% case
- POST/PATCH/DELETE đụng cookie auth → check header `X-Requested-With: XMLHttpRequest` (axios mặc định) HOẶC `Origin` whitelist
- Form action submit ngoài SPA (nếu sau có) → CSRF token explicit
- Webhook endpoint `@Public()` KHÔNG dùng cookie — không cần CSRF

### 6. Decorators + Guards

- `@Public()` — bypass `JwtAuthGuard` (cho `/auth/login`, `/health`, `/webhook/*`)
- `@CurrentUser()` / `@CurrentUser('id')` — inject `req.user` (auth user)
- `OptionalAuthGuard` — endpoint hoạt động cả anonymous và authed
- `JwtAuthGuard.handleRequest` populate CLS context (`userId`, `sessionId`) — xem [0007-cls-context.md](0007-cls-context.md)

### 7. Logout flow

```ts
@Post('/logout')
async logout(@Req() req, @Res({ passthrough: true }) res) {
  const refreshToken = req.cookies?.sf_refresh ?? extractBearerRefresh(req)
  if (refreshToken) {
    await this.sessionRepo.revokeByRefreshHash(sha256(refreshToken))
  }
  clearAuthCookies(res)
  return { ok: true }
}
```

Web client: cookie tự clear. Extension client: xoá `chrome.storage.local` token.

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| Cookie httpOnly only | XSS-safest, browser auto-attach | Extension/mobile/3rd-party không reach | Sociflow multi-client |
| Bearer only | 1 transport, đơn giản | Web phải lưu token vào JS-readable storage (XSS risk) | XSS gap cho web |
| **Hybrid (cookie web + Bearer rest)** ✓ | XSS-safer web, flexible cross-client | JwtStrategy phức tạp hơn 1 chút (dual extractor) | Worth |
| Bearer + stateless refresh | Đơn giản, không DB query | Không revoke, leak = mất 7 ngày | Security gap |
| OAuth 2.0 PKCE full | Industry standard | Overkill first-party app | Sau có thể thêm 3rd-party |

## Reasoning

- **Web XSS bề mặt lớn nhất** (3rd-party scripts, npm supply chain). httpOnly cookie là defense layer mạnh.
- Extension is **first-class client** từ Phase 5. Cookie không reach → Bearer.
- Refresh rotation chuẩn [RFC 6819 §5.2.2.3](https://datatracker.ietf.org/doc/html/rfc6819#section-5.2.2.3) — replay detection.
- Dual-secret JWT: defense in depth.
- CLS context: tránh truyền `userId` qua mọi service method.

## Consequences

### Positive

- Web bảo vệ XSS tốt — token không reach JS.
- Extension/mobile/3rd-party dùng Bearer chuẩn industry.
- 1 auth backend, 1 user model, 1 Session table cho 4 client types.
- Revoke session ngay khi logout/suspicious.
- `JwtStrategy` chỉ cần dual extractor — code thêm ~5 dòng.

### Negative

- CSRF defense bắt buộc cho cookie flow (sameSite + origin check).
- Cookie path-scoped (`/auth/refresh` cho refresh cookie) — phải document kỹ.
- 1 query `Session.findUnique` mỗi `/auth/refresh`.
- 2 transport → 2 code path trên FE (axios web có `withCredentials`, fetch extension có header).

### Mitigation

- `sameSite: 'lax'` + axios mặc định gửi `X-Requested-With` → 95% CSRF blocked.
- Cookie refresh path-scoped giảm bề mặt: cookie chỉ kèm `/auth/refresh`.
- Index `Session.refreshTokenSha256` + `(userId, revokedAt)`.
- Cron daily: cleanup expired session.
- Concurrent refresh từ 2 tab: `findUniqueOrThrow` + atomic update với `where: { revokedAt: null }` — race-safe.
- 401 trên FE: **single-flight refresh interceptor** (xem nextjs-boilerplate pattern) — chỉ 1 request `/auth/refresh` tại 1 thời điểm.
- ESLint rule (TODO): cấm `localStorage.setItem('token', ...)` để tránh dev vô tình lưu token JS-readable.

## Implementation checklist

- [ ] `packages/auth/`: `JwtStrategy` (cookieOrBearerExtractor), `JwtAuthGuard`, `OptionalAuthGuard`
- [ ] `packages/auth/`: `@Public()`, `@CurrentUser()` decorators
- [ ] `packages/auth/`: `setAuthCookies()`, `clearAuthCookies()` helpers
- [ ] `packages/auth/`: `SessionRepository` (`create`, `rotateByRefreshHash`, `revokeBySha256`, `revokeAllByUserId`)
- [ ] `apps/api/src/core/auth/`: controller `/register`, `/login`, `/refresh`, `/logout`, `/me`
- [ ] CLS context wire trong `JwtAuthGuard.handleRequest`
- [ ] `apps/web/src/lib/api/client.ts`: axios `withCredentials: true` + 401 single-flight refresh interceptor
- [ ] `apps/api/src/main.ts`: `app.use(cookieParser())`, CORS `credentials: true`, origin whitelist nghiêm
- [ ] `apps/extension/src/background/`: token storage trong `chrome.storage.local`, refresh logic via `chrome.alarms` (không setInterval)
- [ ] Cron `cleanup-expired-sessions` daily
- [ ] CSRF defense: check `X-Requested-With` HOẶC `Origin` cho mutation endpoint dùng cookie

## References

- [.claude/rules/security.md](../../.claude/rules/security.md)
- [.claude/rules/api-design.md](../../.claude/rules/api-design.md)
- [02-architecture.md](../02-architecture.md)
- nestjs-boilerplate `src/modules/auth/` + `src/modules/auth/strategies/jwt.strategy.ts` — `cookieOrBearerExtractor` reference (port nguyên)
- nextjs-boilerplate `src/lib/api/client.ts` — `withCredentials: true` + single-flight refresh interceptor
- [RFC 6819 §5.2.2.3](https://datatracker.ietf.org/doc/html/rfc6819#section-5.2.2.3) — refresh rotation
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
