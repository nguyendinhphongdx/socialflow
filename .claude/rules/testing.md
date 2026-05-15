---
title: Testing (HARD)
audience: ai-agent
---

# Testing

## Strategy

Test pyramid (đề xuất phân bố):

```
        ┌─────────┐
        │   E2E   │   ~10% — Playwright critical flow
        └─────────┘
       ┌───────────┐
       │ Integration│  ~20% — supertest API + real DB (test container)
       └───────────┘
      ┌─────────────┐
      │    Unit     │  ~70% — Vitest, mock deps
      └─────────────┘
```

## Minimum coverage

- **Business logic (Service)**: 80% coverage required
- **Controller**: smoke test (status code, shape) đủ
- **Repository**: integration test only
- **DTO/VO**: zod parse + validation rule test
- **Provider (platform integration)**: mock SDK, test logic

## Runners

| Test type | Tool |
|---|---|
| Unit | **Vitest** |
| Integration | Vitest + supertest + testcontainer-postgres |
| E2E (web) | **Playwright** |
| Visual regression | Playwright snapshots (Phase 7+) |
| Load | k6 (one-off) |

## File convention

```
src/
└── core/
    └── user/
        ├── user.service.ts
        ├── user.service.spec.ts          # unit
        └── user.controller.spec.ts       # smoke

test/
├── integration/
│   └── publish-flow.spec.ts
└── e2e/
    └── publish.spec.ts                   # Playwright
```

- Co-located `*.spec.ts` cho unit
- Test-only fixtures trong `test/`
- E2E Playwright trong `apps/web/tests/e2e/`

## Unit test pattern

```ts
// user.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'

describe('UserService', () => {
  let service: UserService
  let mockRepo: { getById: ReturnType<typeof vi.fn>, create: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    mockRepo = { getById: vi.fn(), create: vi.fn() }
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockRepo },
      ],
    }).compile()
    service = module.get(UserService)
  })

  describe('getByEmail', () => {
    it('returns user when exists', async () => {
      mockRepo.getById.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
      const user = await service.getById('u1')
      expect(user.email).toBe('a@b.com')
    })

    it('throws UserNotFound when not exists', async () => {
      mockRepo.getById.mockResolvedValue(null)
      await expect(service.getById('u1'))
        .rejects.toMatchObject({ code: ResponseCode.UserNotFound })
    })
  })
})
```

Quy tắc:
- Mỗi method: ≥1 test happy path + ≥1 error path
- Tên test mô tả behavior: `'throws X when Y'`, `'returns Z when W'`
- Setup chung trong `beforeEach`, KHÔNG global state
- KHÔNG test implementation detail (private method)

## Mock strategy

```ts
// Mock dependency injection
{ provide: UserRepository, useValue: mockRepo }

// Mock module (last resort)
vi.mock('@sociflow/storage', () => ({ R2Client: vi.fn() }))

// Mock external API
import nock from 'nock'
nock('https://graph.facebook.com').post('/me/feed').reply(200, { id: '123' })

// Mock time
vi.useFakeTimers().setSystemTime(new Date('2026-05-15'))
```

## Integration test (API endpoint)

```ts
// test/integration/publish.spec.ts
import { Test } from '@nestjs/testing'
import { AppModule } from '@/app.module'
import * as request from 'supertest'

describe('POST /publish (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await prisma.publishRecord.deleteMany()
  })

  it('creates publish record', async () => {
    const user = await createUser()
    const account = await createAccount({ userId: user.id, platform: 'YOUTUBE' })
    const token = await getJwtToken(user)

    const res = await request(app.getHttpServer())
      .post('/api/v1/publish')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountIds: [account.id],
        title: 'Test',
        publishTime: new Date(Date.now() + 60_000).toISOString(),
      })
      .expect(200)

    expect(res.body.code).toBe(0)
    expect(res.body.data.list).toHaveLength(1)
    expect(res.body.data.list[0].status).toBe('SCHEDULED')
  })
})
```

Setup test DB:
- Test container Postgres mỗi suite (slow but isolated)
- Hoặc reset DB qua truncate giữa test
- Migration: `prisma migrate deploy` lúc setup

### `cleanDatabase()` helper

Thêm method vào `PrismaService` để truncate toàn bộ table giữa test (faster than container restart):

```ts
// packages/prisma/src/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect() }
  async onModuleDestroy() { await this.$disconnect() }

  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() chỉ chạy trong test environment')
    }
    const tables = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `
    for (const { tablename } of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`)
    }
  }
}
```

Usage:
```ts
beforeEach(async () => {
  await prisma.cleanDatabase()
})
```

Guard `NODE_ENV !== 'test'` **bắt buộc** — bug 1 lần trong prod = mất toàn bộ data.

### Test helper với CLS context

Service nào đọc `userId` từ CLS → test phải setup context:

```ts
import { ClsService } from 'nestjs-cls'

async function withContext<T>(ctx: { userId: string, traceId?: string }, fn: () => Promise<T>): Promise<T> {
  const cls = app.get(ClsService)
  return cls.run({}, async () => {
    cls.set('userId', ctx.userId)
    cls.set('traceId', ctx.traceId ?? 'test-trace-id')
    return fn()
  })
}

// Usage
it('creates post for current user', async () => {
  await withContext({ userId: 'u1' }, async () => {
    const post = await service.createBundle({ accountIds: ['a1'], title: 'Hi' })
    expect(post.userId).toBe('u1')
  })
})
```

## TDD workflow

Bắt buộc cho feature mới:

1. **RED**: Viết test trước, fail
   ```bash
   pnpm test path/to/spec   # FAIL
   ```
2. **GREEN**: Viết minimum code để pass
3. **REFACTOR**: Clean up
4. **REPEAT**

## E2E test

```ts
// apps/web/tests/e2e/publish.spec.ts
import { test, expect } from '@playwright/test'

test('user can schedule a YouTube post', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name=email]', 'test@sociflow.io')
  await page.fill('[name=password]', 'password123')
  await page.click('button[type=submit]')

  await page.waitForURL('/dashboard')
  await page.click('[data-testid=compose-button]')
  await page.fill('[data-testid=title-input]', 'Hello YT')
  // ... select account, media, time
  await page.click('[data-testid=publish-button]')

  await expect(page.locator('text=Scheduled')).toBeVisible()
})
```

Selector: dùng `data-testid` thay vì class.

E2E test SLOW → chỉ test critical path:
- Login
- Connect account
- Compose + schedule post
- View dashboard

Không E2E mọi feature.

## Browser extension test

```ts
// apps/extension/tests/tiktok.spec.ts
import { test, expect, type BrowserContext } from '@playwright/test'
import * as path from 'node:path'

test.describe('TikTok extension', () => {
  let context: BrowserContext

  test.beforeEach(async ({ browser }) => {
    const extensionPath = path.resolve('dist')
    context = await browser.newContext({
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    })
  })

  test('pair flow works', async () => {
    const popup = await openExtensionPopup(context)
    await popup.fill('[data-testid=pair-code-input]', '123456')
    await popup.click('button[type=submit]')
    await expect(popup.locator('text=Connected')).toBeVisible()
  })
})
```

## Provider test (mock SDK)

```ts
// youtube.provider.spec.ts
vi.mock('googleapis', () => ({
  google: {
    youtube: vi.fn().mockReturnValue({
      videos: {
        insert: vi.fn().mockResolvedValue({ data: { id: 'video123' } }),
      },
    }),
  },
}))

it('publishes video', async () => {
  const result = await provider.publish(record, account)
  expect(result.platformPostId).toBe('video123')
  expect(result.workLink).toBe('https://youtu.be/video123')
})
```

## Snapshot test

Use sparingly:
- VO mapping output
- API response shape
- Component visual

Cấm snapshot lớn (> 50 dòng) — sẽ trở thành noise.

## Test data factories

```ts
// test/factories/user.factory.ts
export function makeUser(overrides?: Partial<User>): User {
  return {
    id: cuid(),
    email: `test-${Date.now()}@sociflow.io`,
    passwordHash: '$2b$12$...',
    name: 'Test User',
    role: 'USER',
    planTier: 'FREE',
    aiCredits: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as User
}

// Usage
const admin = makeUser({ role: 'ADMIN' })
```

## CI test

```yaml
# .github/workflows/ci.yml (snippet)
- run: pnpm test                       # all packages
- run: pnpm --filter @sociflow/web test:e2e   # Playwright (mỗi PR critical, mỗi night full)
- run: pnpm test:coverage              # generate coverage
- run: bash <(curl -s codecov.io/bash) # upload
```

Fail PR if:
- Test fail
- Coverage drop > 2% so với main
- E2E critical test fail

## Test command convention

```
pnpm test                  # tất cả unit + integration
pnpm test:watch            # watch mode
pnpm test:coverage         # coverage report
pnpm --filter <pkg> test   # 1 package
pnpm test:e2e              # Playwright (chỉ web)
pnpm test:e2e:ui           # Playwright UI mode
```

## Anti-patterns

- ❌ Test mock-only (mock cả implementation đang test) — không test gì cả
- ❌ Test snapshot lớn (>50 line)
- ❌ Test mà có `setTimeout(..., 5000)` chờ — dùng `vi.useFakeTimers()`
- ❌ Test share state qua module-scoped variable
- ❌ Test với production DB
- ❌ Skip test (`it.skip`) mà không có ticket fix
- ❌ Test chỉ assert "không throw" — assert behavior cụ thể
