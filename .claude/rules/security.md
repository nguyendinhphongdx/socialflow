---
title: Security (HARD)
audience: ai-agent
---

# Security

## Mandatory checks trước mỗi commit

- [ ] Không hardcode secret (API key, password, token)
- [ ] Mọi user input validate qua zod DTO
- [ ] SQL injection: dùng Prisma (parameterized), không raw SQL với string concat
- [ ] XSS: sanitize HTML khi render rich text user input
- [ ] Auth check ở Service layer
- [ ] Rate limit endpoint public
- [ ] Error message không leak sensitive data
- [ ] Soft-delete entity user-facing

## Secret management

```ts
// ❌ NEVER
const apiKey = "sk-proj-xxxxx"
const apiKey = process.env.OPENAI_API_KEY   // direct env access

// ✅ ALWAYS — qua config object validated
import { config } from '@/config'
const apiKey = config.openai.apiKey
```

- Secret trong `.env` (local) hoặc env vars (production)
- `.env*` trong `.gitignore` (trừ `.env.example`)
- KHÔNG commit token, key, password — checker: `gitleaks` pre-commit
- Khi leak: rotate ngay, không update Git history

## Encryption at rest

Field cần encrypt qua AES-256-GCM:

- `SocialAccount.accessToken`
- `SocialAccount.refreshToken`
- `AutomationAgent.agentToken`

Key từ env `ENCRYPTION_KEY` (32 byte random, base64).

Helper:
```ts
import { encrypt, decrypt } from '@sociflow/common/crypto'

const encrypted = encrypt(token, config.encryptionKey)
const plain = decrypt(encrypted, config.encryptionKey)
```

Hash one-way (không decrypt):
- `User.passwordHash` qua bcrypt (cost factor 12)
- `ApiKey.keyHash` qua sha256 + prefix (8 chars hiển thị, full key chỉ show 1 lần)
- `Session.refreshToken` qua sha256

## Authentication

```ts
// Login endpoint
@Post('/login')
async login(@Body() dto: LoginDto) {
  const user = await this.userRepo.getByEmail(dto.email)
  if (!user || !await bcrypt.compare(dto.password, user.passwordHash)) {
    // Cùng error message dù user không tồn tại HOẶC password sai
    // (chống user enumeration)
    throw new AppException(ResponseCode.InvalidCredentials)
  }
  // ...issue JWT
}
```

- Rate limit login: 5 attempts / 60s / IP
- 2FA optional (Phase 7+)
- Password policy: min 8 chars, không yêu cầu complexity (theo NIST 2024)
- Reset password qua email link, TTL 15 phút, single-use
- Session refresh token: rotate mỗi lần dùng, store hashed in DB

## JWT

```ts
// Access token: 15 min
// Refresh token: 7 days, store hashed in Session table

// Verify
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx): boolean {
    const token = extractFromHeader(ctx.switchToHttp().getRequest())
    const payload = jwt.verify(token, config.auth.jwtSecret)
    // Check user exists, not suspended
    return true
  }
}
```

- Algorithm `HS256` cho symmetric (đơn giản cho monolith)
- KHÔNG dùng `none` algorithm
- **Dual-secret**: `JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET` (defense in depth)
- Access token TTL **15 phút**, refresh **7 ngày**
- KHÔNG store JWT trong `localStorage` (XSS) → web: httpOnly cookie; extension: `chrome.storage.local`

## Token transport — hybrid (theo client)

Chi tiết: [ADR-0005](../../docs/decisions/0005-auth-flow.md).

| Client | Transport | Storage |
|---|---|---|
| `apps/web/` | httpOnly cookie (`SameSite=Lax`, `Secure` prod) | Browser auto |
| `apps/extension/` | `Authorization: Bearer <token>` | `chrome.storage.local` |
| Mobile | `Authorization: Bearer <token>` | OS secure storage |
| 3rd-party API | `Authorization: Bearer <token>` | Client side |

Backend `JwtStrategy` dual extractor (cookie trước, header sau):

```ts
function cookieOrBearerExtractor(cookieName: string) {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()
  return (req) => req?.cookies?.[cookieName] ?? fromHeader(req)
}
```

Web axios `withCredentials: true` để browser tự gửi cookie. Extension dùng `fetch` với header explicit.

## Refresh token rotation

- `Session` table lưu **sha256 hash** của refresh token
- Mỗi `/auth/refresh` **rotate single-use**: revoke old row, tạo row mới
- Replay detection: refresh đã revoke được gửi lại → revoke **tất cả** session của user
- Stateless refresh (chỉ verify JWT, không Session table) ❌ — security gap quá lớn

## CSRF (cho cookie flow web)

- Backend whitelist `Origin` header cho mutation endpoints dùng cookie
- Axios mặc định gửi `X-Requested-With: XMLHttpRequest` → backend check header này
- Cookie `sameSite: 'lax'` đủ cho 95% case
- Refresh cookie path-scoped: `path: '/auth/refresh'` — giảm bề mặt
- Form action submit external (nếu có) → CSRF token explicit

## Authorization (permission)

**Ở Service layer**, qua query condition:

```ts
// ✅
async getByUserAndId(userId: string, id: string) {
  const post = await this.repo.getByIdAndUserId(id, userId)
  if (!post) throw new AppException(ResponseCode.PostNotFound)
  return post
}

// ❌ — check sau load
async getById(userId: string, id: string) {
  const post = await this.repo.getById(id)
  if (post.userId !== userId) throw new AppException(ResponseCode.Forbidden)
  return post
}
```

Role-based:
```ts
@Roles('admin')
@Get('/admin/users')
async listAllUsers() { ... }
```

## Input validation

Mọi user input → zod DTO. KHÔNG trust client.

```ts
// ❌
@Post('/posts')
async create(@Body() body: any) {
  await this.service.create(body)   // body có thể là bất cứ gì
}

// ✅
@Post('/posts')
async create(@Body() dto: CreatePostDto) {   // zod validate
  await this.service.create(dto)
}
```

URL param + query: cũng validate.

## SQL injection

Dùng Prisma → tự parameterized. Cấm:

```ts
// ❌
prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`)

// ✅
prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`   // tagged template, safe
prisma.user.findUnique({ where: { email } })   // safest
```

## NoSQL injection (cho JSON field)

Nếu query JSON field user-controlled:

```ts
// ❌ — user có thể inject operator
const filter = { metadata: { tag: req.body.tag } }

// ✅ — sanitize string only
if (typeof req.body.tag !== 'string') throw error
const filter = { metadata: { path: ['tag'], equals: req.body.tag } }
```

## XSS

Frontend:
- React tự escape khi render `{variable}` — OK
- `dangerouslySetInnerHTML` → sanitize qua `DOMPurify` first
- User-generated link: validate URL scheme (http/https only), không `javascript:`

Backend:
- Email template: dùng template engine với auto-escape (vd `eta`, `mjml`)

## CSRF

- API stateless (JWT) → CSRF không applicable cho most endpoint
- Endpoint dùng cookie auth (vd refresh token flow) → CSRF token + SameSite=Lax cookie
- Webhook public → verify signature thay vì CSRF token

## CORS

```ts
app.enableCors({
  origin: [
    'https://app.sociflow.io',
    /^chrome-extension:\/\/.+$/,
    ...(NODE_ENV === 'development' ? ['http://localhost:3010'] : []),
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
})
```

KHÔNG `origin: '*'` ở production.

## Rate limiting

Global:
- 100 req/min/IP
- 500 req/min/user authenticated

Per-endpoint:
- Login: 5 / 60s / IP
- Publish create: 30 / 60s / user
- AI gen: 10 / 60s / user
- Webhook: rate-limit theo platform signature

## File upload

```ts
@Post('/media/upload')
async upload(@UploadedFile() file: Express.Multer.File) {
  // Validate
  if (file.size > 100 * 1024 * 1024) throw ...   // 100MB max
  if (!ALLOWED_MIME.includes(file.mimetype)) throw ...

  // Check magic bytes thực tế, không trust mimetype
  const realType = await fileType.fromBuffer(file.buffer)
  if (!ALLOWED_MIME.includes(realType.mime)) throw ...

  // Generate filename mới, KHÔNG dùng filename user
  const key = `user-uploads/${userId}/${cuid()}.${realType.ext}`

  // Strip metadata (EXIF có thể leak GPS)
  const cleaned = await sharp(file.buffer).withMetadata({ exif: {} }).toBuffer()

  await this.r2.upload(key, cleaned)
}
```

Allowed mime:
- Image: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Video: `video/mp4`, `video/quicktime`, `video/webm`
- KHÔNG: `application/*`, `text/html`, `image/svg+xml` (SVG có thể chứa JS)

## Webhook signature verification

```ts
// TikTok
const expected = crypto.createHmac('sha256', secret)
  .update(timestamp + JSON.stringify(body))
  .digest('hex')
if (signature !== expected) throw new AppException(ResponseCode.Unauthorized)

// Stripe
stripe.webhooks.constructEvent(rawBody, signature, secret)

// Meta (FB/IG)
const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
if (`sha256=${expected}` !== signature) throw ...
```

**Lưu ý**: cần `rawBody` (string), không `JSON.parse(body)` rồi `JSON.stringify` (khác encoding).

## Logging hygiene

```ts
// ❌
this.logger.error(`Login failed for ${dto.email} password=${dto.password}`)

// ✅
this.logger.warn('Login failed', { email: dto.email })   // no password
```

Pino redact config:
```ts
{
  redact: {
    paths: ['*.password', '*.token', '*.accessToken', '*.refreshToken', '*.apiKey', '*.creditCard'],
    censor: '***',
  }
}
```

## Headers

NestJS với `helmet`:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Extension security

- Manifest `host_permissions` tối thiểu — chỉ platform support
- KHÔNG `<all_urls>`
- CSP: `script-src 'self'`, KHÔNG `unsafe-inline`
- `agentToken` store trong `chrome.storage.local`, KHÔNG `chrome.storage.sync` (sync sang device khác)
- Content script: KHÔNG inject 3rd-party script
- WS connection: validate origin chỉ sociflow.io

## R2 bucket security

- Bucket public ACL: chỉ read prefix `media/`, `ai-gen/`
- Pre-signed URL TTL 15 phút cho upload
- Cấm public write
- Custom domain `cdn.sociflow.io` qua Cloudflare → DDoS protection

## Dependency security

- Renovate Bot auto PR security update
- `pnpm audit` trong CI, fail nếu high+ severity
- Dependabot GitHub
- Periodic: `npm audit signatures` verify integrity

### Single-version pinning (monorepo)

`packages/common` export zod schemas. Nếu `apps/api` và `packages/common` resolve **2 version zod khác nhau** → `error instanceof ZodError` **fail silently** (instanceof check returns false vì 2 class khác instance). Bug rất khó debug.

Pin single version qua `pnpm.overrides`:

```json
// root package.json
{
  "pnpm": {
    "overrides": {
      "zod": "^4.0.0",
      "@prisma/client": "^5.0.0"
    }
  }
}
```

Áp dụng cho: `zod`, `@prisma/client`, `react` (FE monorepo). CI add check `pnpm list zod --depth=10` chỉ thấy 1 version.

## Production hardening

- VPS firewall: chỉ 22 (SSH key only), 80, 443
- SSH password disabled, key-only
- Docker socket KHÔNG mount vào container
- Run container as non-root user (UID 1000)
- Postgres không expose ra public network
- Backup encryption at rest

## Incident response

Nếu phát hiện compromise:

1. **STOP** — Không deploy thêm
2. **Rotate** — JWT_SECRET, INTERNAL_TOKEN, encrypt key, R2 key
3. **Revoke** — Tất cả Session, ApiKey, AutomationAgent
4. **Force re-login** — flag tất cả user
5. **Audit** — Check log, Sentry, suspicious DB query
6. **Report** — Email user nếu data ảnh hưởng (GDPR / Việt Nam ND-13)

Chi tiết: tạo runbook ở `docs/runbooks/incident-response.md` khi cần.
