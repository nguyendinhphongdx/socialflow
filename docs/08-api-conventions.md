---
title: API conventions
description: REST design, DTO/VO with zod, error code, pagination, idempotency
audience: [developer, ai-agent]
---

# API conventions

Áp dụng cho `apps/api` và `apps/ai`. Tất cả endpoint public/private/internal đều phải tuân.

## Response envelope

Mọi response wrap qua `ResponseInterceptor`:

```ts
{
  "data": <T>,
  "code": 0,
  "message": "ok",
  "timestamp": 1731234567890
}
```

- `code: 0` = success
- `code: 10000+` = business error (xem [ResponseCode](#response-code))
- HTTP status: **luôn 200** trừ:
  - 401 Unauthorized (chưa login)
  - 403 Forbidden (login rồi nhưng không quyền)
  - 404 Route not found (path không tồn tại)
  - 429 Rate limit
  - 5xx Infra error

Lý do dùng `code` thay vì HTTP status: dễ extend nhiều business error mà không cần map HTTP code.

## DTO (input)

**Phải** sinh từ zod schema qua helper:

```ts
import { createZodDto } from '@sociflow/common'
import { z } from 'zod'

export const CreatePublishDtoSchema = z.object({
  accountIds: z.array(z.string().cuid()).min(1).max(50)
    .describe('Danh sách account đăng'),
  body: z.string().max(5000).optional()
    .describe('Nội dung post'),
  publishTime: z.coerce.date().default(() => new Date())
    .describe('Thời gian đăng (ISO 8601). Bỏ qua = đăng ngay'),
})
export class CreatePublishDto extends createZodDto(CreatePublishDtoSchema, 'CreatePublishDto') {}
```

Quy tắc:

- ✅ Mọi field có `.describe()` cho Swagger
- ✅ Validate strict (max length, min, enum)
- ✅ Coerce date/number nếu nhận từ query string
- ❌ Không reuse Prisma model làm DTO
- ❌ Không có DTO không zod

### Pagination DTO

```ts
export const PaginationDtoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export class PaginationDto extends createZodDto(PaginationDtoSchema, 'PaginationDto') {}
```

Pagination response:

```ts
{
  "data": {
    "list": [...],
    "page": 1,
    "pageSize": 20,
    "total": 234,
    "totalPages": 12
  },
  "code": 0,
  "message": "ok"
}
```

Helper:

```ts
export class PublishListVo extends createPaginationVo(PublishRecordVoSchema, 'PublishListVo') {}
```

## VO (output)

```ts
export const SocialAccountVoSchema = z.object({
  id: z.string().cuid().describe('Account ID'),
  platform: z.nativeEnum(AccountPlatform).describe('Platform'),
  displayName: z.string().describe('Tên hiển thị'),
  avatarUrl: z.string().url().nullable(),
  publishMode: z.nativeEnum(PublishMode),
  status: z.nativeEnum(AccountStatus),
  createdAt: z.date(),
})

export class SocialAccountVo extends createZodDto(SocialAccountVoSchema, 'SocialAccountVo') {
  static create(account: SocialAccount): SocialAccountVo {
    return SocialAccountVoSchema.parse({
      id: account.id,
      platform: account.platform,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      publishMode: account.publishMode,
      status: account.status,
      createdAt: account.createdAt,
    })
  }
}
```

Quy tắc:

- ❌ **Không** return Prisma entity trực tiếp — luôn map qua VO
- ❌ Không expose `accessToken`, `refreshToken`, password hash
- ❌ Không expose internal ID khác user owned
- ✅ Field `id` ổn định, đừng đổi format

## Controller pattern

```ts
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'

@ApiTags('Account')
@Controller('/accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @ApiDoc({
    summary: 'Liệt kê tài khoản đã connect',
    query: ListAccountsDtoSchema,
    response: [SocialAccountVo],
  })
  @Get('/')
  async list(@CurrentUser() user: AuthUser, @Query() query: ListAccountsDto) {
    const accounts = await this.accountService.listByUser(user.id, query)
    return accounts.map(SocialAccountVo.create)
  }

  @ApiDoc({
    summary: 'Lấy chi tiết tài khoản',
    response: SocialAccountVo,
  })
  @Get('/:id')
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const account = await this.accountService.getByUserAndId(user.id, id)
    return SocialAccountVo.create(account)
  }
}
```

Quy tắc:

- ✅ Mọi `@Controller` có `@ApiTags`
- ✅ Mọi method có `@ApiDoc({ summary, body?, query?, response? })`
- ✅ Path bắt đầu `/`, không trailing slash
- ✅ HTTP verb đúng nghĩa: GET (read), POST (create), PATCH (partial update), DELETE
- ❌ Không dùng `@Put()` cho update (dùng `@Patch()`)
- ❌ Không inject Repository vào Controller
- ❌ Không viết business logic trong Controller — chỉ routing + VO transform

## Service pattern

```ts
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name)

  constructor(
    private readonly accountRepo: SocialAccountRepository,
    private readonly eventBus: EventBus,
  ) {}

  async listByUser(userId: string, query: ListAccountsDto): Promise<SocialAccount[]> {
    return this.accountRepo.listByUserId(userId, query)
  }

  async getByUserAndId(userId: string, id: string): Promise<SocialAccount> {
    const account = await this.accountRepo.getById(id)
    if (!account || account.userId !== userId) {
      throw new AppException(ResponseCode.AccountNotFound, { accountId: id })
    }
    return account
  }
}
```

Quy tắc:

- ✅ Permission filter qua query condition (`userId` match)
- ✅ Resource không tồn tại / không owned → throw `AccountNotFound` (cụ thể), KHÔNG dùng generic `Forbidden`
- ✅ Logic bus event → `eventBus.publish(new XxxEvent(...))`
- ❌ Không truy cập Prisma trực tiếp — qua Repository
- ❌ Không `try-catch` business — let framework handle

## Repository pattern

```ts
// packages/prisma/src/repositories/base.repository.ts
export abstract class BaseRepository<TModel extends { id: string }> {
  protected abstract get model(): { findUnique, findMany, create, update, count }

  async getById(id: string): Promise<TModel | null> {
    return this.model.findUnique({ where: { id, deletedAt: null } })
  }

  async create(data: Partial<TModel>): Promise<TModel> {
    return this.model.create({ data })
  }

  async updateById(id: string, data: Partial<TModel>): Promise<TModel | null> {
    return this.model.update({ where: { id, deletedAt: null }, data })
  }

  async softDeleteById(id: string): Promise<TModel | null> {
    return this.model.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async count(where: object): Promise<number> {
    return this.model.count({ where: { ...where, deletedAt: null } })
  }

  protected async findOne(where: object): Promise<TModel | null> { ... }
  protected async find(where: object): Promise<TModel[]> { ... }
  protected async listWithPagination(params: PaginationParams) { ... }
}

// Subclass
@Injectable()
export class SocialAccountRepository extends BaseRepository<SocialAccount> {
  protected get model() { return this.prisma.socialAccount }
  constructor(private readonly prisma: PrismaService) { super() }

  async listByUserId(userId: string, query: ListAccountsDto): Promise<SocialAccount[]> {
    return this.find({ userId, ...this.buildFilter(query) })
  }

  async getByUserAndPlatformUid(userId: string, platform: AccountPlatform, platformUid: string) {
    return this.findOne({ userId, platform, platformUid })
  }
}
```

Method naming rule (giống AiToEarn):

| Prefix | Return | Example |
|---|---|---|
| `getXxx` | single (T \| null) | `getById`, `getByEmail` |
| `listXxx` | array | `listByUserId`, `listByStatus` |
| `listXxxWithPagination` | paginated | `listByUserWithPagination` |
| `countXxx` | number | `countByUserId` |
| `create`/`createMany` | T | - |
| `updateXxx`/`updateManyXxx` | T | - |
| `deleteXxx`/`softDeleteXxx` | void/T | - |
| `aggregateXxx` | object | for stats |

**Cấm**:
- `find*` (dùng `get`/`list`)
- `del*`, `add*`, `set*`, `check*` (dùng verb chuẩn)
- Business verb (`recharge`, `withdraw`, `markAsRead`...) — dùng `updateXxxById`

## Response code

Định nghĩa ở `packages/common/src/response-code.ts`:

```ts
export enum ResponseCode {
  Success = 0,

  // === 10000-10999: Common ===
  UnknownError = 10000,
  ValidationFailed = 10001,
  RateLimitExceeded = 10002,
  ResourceNotFound = 10003,

  // === 11000-11999: Auth ===
  Unauthorized = 11000,
  InvalidCredentials = 11001,
  TokenExpired = 11002,
  EmailAlreadyExists = 11003,
  EmailNotVerified = 11004,

  // === 12000-12999: User ===
  UserNotFound = 12000,
  UserSuspended = 12001,

  // === 13000-13999: Account (social) ===
  AccountNotFound = 13000,
  AccountNotActive = 13001,
  AccountTokenExpired = 13002,
  OAuthCallbackInvalid = 13003,

  // === 14000-14999: Publish ===
  PublishContentInvalid = 14000,
  PublishFlowAlreadyExists = 14001,
  PublishTaskNotFound = 14002,
  PublishRejectedByPlatform = 14003,
  PublishQuotaExceeded = 14004,
  PublishMediaTooLarge = 14005,

  // === 15000-15999: Automation ===
  AgentNotPaired = 15000,
  AgentOffline = 15001,
  AgentTokenInvalid = 15002,
  AutomationTimeout = 15003,

  // === 16000-16999: AI ===
  AiQuotaExceeded = 16000,
  AiProviderUnknown = 16001,
  AiJobFailed = 16002,
  AiContentRejected = 16003,

  // === 17000-17999: Engagement ===
  EngagementRateLimit = 17000,
  CommentNotFound = 17001,

  // === 18000-18999: Credit / Billing ===
  CreditInsufficient = 18000,
  PaymentFailed = 18001,
  PlanRequired = 18002,
}

export const ResponseMessage: Record<ResponseCode, string> = {
  [ResponseCode.Success]: 'ok',
  [ResponseCode.UnknownError]: 'Lỗi không xác định',
  [ResponseCode.ValidationFailed]: 'Dữ liệu không hợp lệ',
  [ResponseCode.AccountNotFound]: 'Không tìm thấy tài khoản',
  // ...
}
```

Quy tắc:

- ❌ KHÔNG hardcode message khi throw — dùng mapping
- ❌ KHÔNG dùng generic `Forbidden`/`Unauthorized` cho business — dùng `XxxNotFound` cụ thể
- ❌ KHÔNG reuse code giữa module (mỗi module 1 range)
- ✅ Thêm code mới → add enum + add message mapping ở cùng commit

## AppException

```ts
export class AppException extends Error {
  constructor(
    public readonly code: ResponseCode,
    public readonly data?: Record<string, unknown>,
  ) {
    super(ResponseMessage[code] ?? 'Unknown error')
  }
}

// Usage:
throw new AppException(ResponseCode.AccountNotFound, { accountId: id })
```

Global filter (`GlobalExceptionFilter`) catch → response:

```json
{
  "data": { "accountId": "acc_xxx" },
  "code": 13000,
  "message": "Không tìm thấy tài khoản",
  "timestamp": 1731234567890
}
```

## Idempotency

Endpoint write operations support header `Idempotency-Key`:

```http
POST /api/publish/create
Idempotency-Key: 7d3a8c2f-...
```

Backend:

1. Check Redis: `idempotency:{userId}:{key}` → nếu có → return cached response
2. Nếu chưa có → execute → cache response 24h

Helper `@Idempotent()` decorator hoặc Interceptor.

## API versioning

Phase 1-6: dùng path prefix `/api/v1/`. Đã design ngay từ đầu.

Khi breaking change (V2): thêm `/api/v2/`, V1 vẫn chạy 6 tháng overlap.

Internal API (`api ↔ ai`): không versioning, sync deploy.

## Rate limiting

Global: 100 req/min/IP, 500 req/min/user.

Per-endpoint:

```ts
@RateLimit({ limit: 10, windowSec: 60, scope: 'user' })
@Post('/publish/create')
async create() { ... }
```

Header response:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1731234567
```

## CORS

- Web: chỉ origin `https://app.sociflow.io` + dev `http://localhost:3000`
- Webhook: không CORS (server-to-server)
- Extension: `chrome-extension://*` được whitelist qua `Origin` check

## Webhook endpoints

Pattern path: `/api/webhook/{platform}`

```ts
@Controller('/webhook')
export class WebhookController {
  @Public()  // không yêu cầu JWT
  @Post('/tiktok')
  async tiktokWebhook(
    @Headers('x-tiktok-signature') sig: string,
    @Body() body: any,
  ) {
    if (!this.tiktokVerifier.verify(sig, body)) {
      throw new AppException(ResponseCode.Unauthorized)
    }
    await this.webhookService.handleTiktok(body)
    return { ok: true }   // platform check 200
  }
}
```

Lưu raw webhook vào `WebhookEvent` table cho audit + replay.

## Internal API conventions

`apps/api` ↔ `apps/ai`:

```ts
@Controller('/internal/ai')
@UseGuards(InternalTokenGuard)   // verify x-internal-token header
export class InternalAiController {
  @Post('/chat/caption')
  async caption(@Body() dto: CaptionInternalDto) { ... }
}
```

- Path prefix `/internal/`
- Auth bằng `INTERNAL_TOKEN` shared secret
- KHÔNG expose qua nginx public

## ts-rest contract

Để FE/BE sync types tự động:

```ts
// packages/api-contracts/src/account.contract.ts
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { SocialAccountVoSchema } from '@sociflow/common'

const c = initContract()

export const accountContract = c.router({
  list: {
    method: 'GET',
    path: '/accounts',
    query: ListAccountsDtoSchema,
    responses: {
      200: z.object({ data: z.array(SocialAccountVoSchema), code: z.literal(0), message: z.string() }),
    },
  },
  // ...
})
```

Frontend dùng:

```ts
import { initClient } from '@ts-rest/core'
import { accountContract } from '@sociflow/api-contracts'

const client = initClient(accountContract, { baseUrl: '/api/v1', baseHeaders: {} })
const res = await client.list({ query: { page: 1 } })   // res.body is fully typed
```

## OpenAPI / Swagger

Auto-generated từ `@ApiDoc()` + zod schemas. Expose ở `/api/docs` (development only, prod tắt).

## Tài liệu liên quan

- [.claude/rules/api-design.md](../.claude/rules/api-design.md) — hard rules
- [.claude/rules/error-handling.md](../.claude/rules/error-handling.md) — AppException + ResponseCode
- [.claude/rules/project-standards.md](../.claude/rules/project-standards.md) — naming + conventions
