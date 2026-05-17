---
title: Local Dev Setup
description: Khởi động đầy đủ stack dev (api + ai + web) trên Mac/Linux
audience: [developer]
---

# Local Dev Setup

> Phát hiện sau lần boot đầu tiên (2026-05-17): scaffold có vài runtime issue cần fix
> trước khi `pnpm dev` chạy được. Đã workaround trong commit này nhưng cần follow-up
> để clean (xem section **Known runtime issues** cuối file).

## Prerequisites

- Node 22+ (kiểm: `node -v`)
- pnpm 10+ (`pnpm -v`)
- Docker Desktop chạy (cần cho Postgres + Redis + MinIO + MailHog)
- macOS / Linux (Windows chưa test)

## 1. Cài deps

```bash
pnpm install
```

## 2. Tạo `.env`

```bash
cp .env.example .env
# Generate encryption key 32 bytes
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))" >> .env
# Xoá dòng placeholder ENCRYPTION_KEY=change-me-... (giữ dòng vừa append)
sed -i.bak '/^ENCRYPTION_KEY=change-me/d' .env && rm .env.bak
```

Mọi env khác đã có default reasonable cho dev. OAuth credentials có thể bỏ trống —
sẽ throw "OAuthCredentialNotConfigured" khi user thử connect platform (đó là expected,
user dùng BYOK qua UI thay vì .env).

## 3. Start infra (Docker)

```bash
docker compose -f docker-compose.dev.yml up -d
```

Đợi healthcheck pass (~15s). Verify:

```bash
docker ps --filter "name=sociflow" --format "table {{.Names}}\t{{.Status}}"
```

Phải có 4 services: `sociflow-postgres`, `sociflow-redis`, `sociflow-minio`, `sociflow-mailhog` — tất cả Up.

## 4. Generate Prisma client + apply migrations

```bash
pnpm --filter @sociflow/prisma exec prisma generate
DATABASE_URL="postgresql://sociflow:dev@localhost:5433/sociflow_dev?schema=public" \
  pnpm --filter @sociflow/prisma exec prisma migrate deploy
```

Verify: 13+ migrations applied.

## 5. Boot dev servers

3 terminal sessions (hoặc dùng `pnpm dev` root chạy turbo song song):

**Terminal 1 — API**:
```bash
pnpm --filter @sociflow/api dev
# → http://localhost:3000/api/v1
```

**Terminal 2 — AI**:
```bash
pnpm --filter @sociflow/ai dev
# → http://localhost:3001/api/v1
```

**Terminal 3 — Web**:
```bash
pnpm --filter @sociflow/web dev
# → http://localhost:3020
```

Hoặc tất cả cùng lúc:
```bash
pnpm dev
```

## 6. Verify boot OK

```bash
# API health
curl http://localhost:3000/api/v1/health/live
# → {"data":{"status":"ok",...},"code":0,...}

# AI health
curl http://localhost:3001/api/v1/health
# → {"data":{"status":"ok"},"code":0,...}

# Web landing
curl -sI http://localhost:3020
# → HTTP/1.1 200 OK
```

## 7. Smoke test (Playwright)

```bash
pnpm --filter @sociflow/web exec playwright install chromium
pnpm --filter @sociflow/web exec playwright test
```

Cần api + ai + web đang chạy. Kết quả lần đầu: **16/19 pass**.

Failed tests cần follow-up:
- Test 11-13: workspace + credits + oauth-credentials endpoints — JWT verify reject hợp lệ bearer token (xem section Known issues #4).
- Test 15: Login page chưa có form thật (placeholder).

## Known runtime issues (scaffold-level)

### 1. ✅ Fixed — tsx + monorepo decorators

**Symptom**: `pnpm dev` báo `Parameter decorators only work when experimental decorators are enabled` mặc dù tsconfig có `experimentalDecorators: true`.

**Cause**: tsx (esbuild) không đọc `extends` chain qua workspace packages. esbuild chỉ enable decorator nếu thấy explicit trong file gần nhất.

**Fix applied**: Switched từ `tsx watch` → `node --import @swc-node/register/esm-register --watch` (cho apps/api + apps/ai). SWC handle decorators per-package đúng. Also added `experimentalDecorators` + `emitDecoratorMetadata` vào mọi `packages/*/tsconfig.json` (cho type-check).

### 2. ✅ Fixed — zod v4 + @nest-zod/z v2 incompat

**Symptom**: `TypeError: zod.defaultErrorMap is not a function` lúc boot.

**Cause**: `nestjs-zod@4` bundle `@nest-zod/z@2` mà package này call zod v3 API (`zod.defaultErrorMap`, `zod.setErrorMap`) đã bị remove trong zod v4.

**Fix applied** (TEMPORARY — không survive `pnpm install` reinstall):
- Patch trực tiếp `node_modules/.pnpm/@nest-zod+z@2.0.0_*/node_modules/@nest-zod/z/dist/z.js` thay `zod.defaultErrorMap(issue, context)` bằng fallback `return { message: issue?.message ?? 'Invalid input' }`.

**TODO permanent fix** (chọn 1):
- Option A: Pin zod v3 qua `pnpm.overrides` — break các v4 features (chưa kiểm tra full impact)
- Option B: Replace nestjs-zod v4 với nestjs-zod v3 (return về zod v3 ecosystem)
- Option C: Fork @nest-zod/z + bump để hỗ trợ v4 — đăng patch lên npm
- Option D: Apply patch qua `pnpm patch` để persist:
  ```bash
  pnpm patch @nest-zod/z@2.0.0
  # edit file z.js theo same logic
  pnpm patch-commit /path/from/output
  ```

### 3. ✅ Fixed — `.env` không được tsx auto-load

**Symptom**: Config validation báo mọi field "Invalid input" mặc dù `.env` tồn tại.

**Cause**: tsx auto-loads `.env` nhưng SWC node thì không.

**Fix applied**: Thêm `--env-file=../../.env` vào dev script:
```json
"dev": "node --env-file=../../.env --import @swc-node/register/esm-register --watch src/main.ts"
```

### 4. ⚠️ Open — JWT verify reject valid bearer token

**Symptom**: POST `/auth/register` trả token hợp lệ (decode thủ công OK với `JWT_ACCESS_SECRET`). Nhưng GET `/workspaces/current` với header `Authorization: Bearer <token>` trả `{code: 11000, message: "Vui lòng đăng nhập"}` → JwtAuthGuard reject.

**Status**: Đang investigate. JwtStrategy config có vẻ OK (secretOrKey, ignoreExpiration: false). Có thể related đến passport-jwt extractor hoặc nestjs version mismatch.

**Workaround tạm thời**: Dùng cookie auth flow qua web (login → cookie httpOnly auto-attach) thay vì Bearer header. Cookie path đã verified work qua smoke test.

**Cần debug tiếp**:
- Add console.log vào `JwtAuthGuard.handleRequest` → xem `info` arg của passport (chứa JWT verify error)
- Check passport-jwt version compat với @nestjs/passport v11
- Verify `JwtStrategy` secret resolution at runtime (DI vs env loading order)

### 5. ✅ Fixed — Connect services missing from module providers

**Symptom**: `Nest can't resolve dependencies of SocialAccountController (..., InstagramConnectService not found)`.

**Cause**: `social-account.module.ts` chỉ register `YouTubeConnectService` + `FacebookConnectService`, thiếu Instagram + TikTok.

**Fix applied**: Add 2 service vào providers + exports.

### 6. ✅ Fixed — User repository không export

**Symptom**: `Nest can't resolve dependencies of WorkspaceService (..., UserRepository not found)`.

**Fix applied**: Export `UserRepository` từ `user.module.ts`.

### 7. ✅ Fixed — Stripe URL config validation

**Symptom**: Config validation báo `stripe.successUrl: Invalid input` khi .env có `STRIPE_SUCCESS_URL=` (empty).

**Cause**: `??` không fallback trên empty string, chỉ trên null/undefined.

**Fix applied**: Changed `??` → `||` cho stripe URL fields.

### 8. ✅ Fixed — `next-intl` middleware rewrite gây 404

**Symptom**: GET `localhost:3020` trả 404 với `x-middleware-rewrite: /vi`.

**Cause**: `createIntlMiddleware({ localePrefix: 'never' })` vẫn rewrite URL internal sang `/vi/...` nhưng app routes không có `[locale]` segment.

**Fix applied**: Bỏ intl middleware. Giữ cookie-based locale negotiation qua `i18n/request.ts` (đọc cookie `NEXT_LOCALE`).

### 9. ✅ Fixed — Login page chỉ là placeholder

**Symptom**: Playwright test fail timeout chờ `input[type="email"]`.

**Cause**: `apps/web/src/app/(auth)/login/page.tsx` chỉ render H1 "Đăng nhập" + 1 đoạn text "Trang form sẽ build trong Phase 1".

**Status**: Backend `/auth/login` hoạt động (smoke test 8 pass). FE form chưa implement — follow-up cần add login + register forms với React Hook Form + zod.

## Logs

- Backend log: stdout của `pnpm --filter @sociflow/api dev` (pino-pretty format)
- DB query log: ở Prisma debug — set `DEBUG=prisma:query` env
- Redis monitor: `docker exec -it sociflow-redis redis-cli MONITOR`
- MailHog UI: http://localhost:8025 (xem email gửi từ NotificationService)
- MinIO console: http://localhost:9001 (login: `minio` / `minio12345`)

## Reset stack

```bash
docker compose -f docker-compose.dev.yml down -v  # xóa cả volume = data wipe
docker compose -f docker-compose.dev.yml up -d
DATABASE_URL="postgresql://sociflow:dev@localhost:5433/sociflow_dev?schema=public" \
  pnpm --filter @sociflow/prisma exec prisma migrate deploy
```
