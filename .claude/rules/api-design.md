---
title: API design (HARD)
audience: ai-agent
---

# API design rules

Quy tắc cho mọi endpoint REST + DTO/VO. Giao tiếp REST chi tiết: [docs/08-api-conventions.md](../../docs/08-api-conventions.md).

## Mandatory checklist

Trước khi PR endpoint mới:

- [ ] DTO sinh từ zod schema qua `createZodDto`, mọi field có `.describe()`
- [ ] VO sinh từ zod schema qua `createZodDto` / `createPaginationVo`
- [ ] Controller có `@ApiTags('Module/SubModule')`
- [ ] Method có `@ApiDoc({ summary, body?, query?, response? })`
- [ ] Path bắt đầu `/`, không trailing `/`
- [ ] HTTP verb đúng (GET/POST/PATCH/DELETE — không dùng PUT)
- [ ] Permission filter qua query condition trong Service (KHÔNG ở Controller)
- [ ] Throw `AppException` với code cụ thể (KHÔNG generic `Forbidden`)
- [ ] Return VO qua `XxxVo.create(entity)`, KHÔNG return entity trần
- [ ] Pagination dùng `PaginationDtoSchema` + response `createPaginationVo`
- [ ] Endpoint mutation hỗ trợ `Idempotency-Key` (POST create)
- [ ] Auth guard đúng (`@Public()` chỉ cho webhook/health)
- [ ] Rate limit nếu public endpoint

## DTO pattern

```ts
import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

export const CreatePostDtoSchema = z.object({
  accountIds: z.array(z.string().cuid()).min(1).max(50)
    .describe('Account IDs to publish to'),
  title: z.string().max(200).optional()
    .describe('Post title'),
  body: z.string().max(5000).optional()
    .describe('Post body / caption'),
  mediaIds: z.array(z.string().cuid()).max(20).default([])
    .describe('Media asset IDs'),
  publishTime: z.coerce.date().default(() => new Date())
    .describe('Scheduled publish time (ISO 8601). Omit = publish now'),
}).strict()   // Reject unknown fields

export class CreatePostDto extends createZodDto(CreatePostDtoSchema, 'CreatePostDto') {}
```

Quy tắc DTO:
- ✅ `.strict()` reject extra field (security)
- ✅ `.describe()` mọi field
- ✅ Coerce date/number nếu nhận query string
- ✅ Default value cho optional field
- ✅ Max length / range hợp lý
- ❌ KHÔNG reuse Prisma model
- ❌ KHÔNG nested DTO sâu > 3 levels (split request)

## VO pattern

```ts
export const PostVoSchema = z.object({
  id: z.string().cuid().describe('Post ID'),
  title: z.string().nullable(),
  status: z.nativeEnum(PublishStatus),
  workLink: z.string().url().nullable(),
  account: z.object({
    id: z.string().cuid(),
    platform: z.nativeEnum(AccountPlatform),
    displayName: z.string(),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class PostVo extends createZodDto(PostVoSchema, 'PostVo') {
  static create(record: PublishRecord & { account: SocialAccount }): PostVo {
    return PostVoSchema.parse({
      id: record.id,
      title: record.title,
      status: record.status,
      workLink: record.workLink,
      account: {
        id: record.account.id,
        platform: record.account.platform,
        displayName: record.account.displayName,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  }
}

// Pagination
export class PostListVo extends createPaginationVo(PostVoSchema, 'PostListVo') {}
```

Quy tắc VO:
- ✅ `.create(entity)` static method để map
- ✅ Strip sensitive field (`accessToken`, `passwordHash`, `apiKeyHash`)
- ✅ Strip internal field (`deletedAt` nếu là soft-delete query đã filter)
- ✅ Include relation nested (như `account` ở trên) thay vì FK + N+1 query

## Controller pattern

```ts
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'

@ApiTags('Publish')
@Controller('/publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @ApiDoc({
    summary: 'Tạo publish task',
    description: 'Tạo bundle publish cho nhiều account cùng lúc',
    body: CreatePostDtoSchema,
    response: PostListVo,
  })
  @Post('/')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
  ) {
    const bundle = await this.publishService.createBundle(user.id, dto)
    return new PostListVo({
      list: bundle.records.map(PostVo.create),
      page: 1, pageSize: bundle.records.length,
      total: bundle.records.length, totalPages: 1,
    })
  }

  @ApiDoc({
    summary: 'Liệt kê publish task của user',
    query: ListPostsDtoSchema,
    response: PostListVo,
  })
  @Get('/')
  async list(@CurrentUser() user: AuthUser, @Query() query: ListPostsDto) {
    return this.publishService.listByUserWithPagination(user.id, query)
  }

  @ApiDoc({
    summary: 'Lấy chi tiết publish task',
    response: PostVo,
  })
  @Get('/:id')
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const record = await this.publishService.getByUserAndId(user.id, id)
    return PostVo.create(record)
  }
}
```

**Cấm trong Controller**:
- Inject Repository
- Truy cập Prisma
- Try-catch business
- Logic phức tạp (>10 dòng)
- Return entity trần

## Auth decorators + guards

Chi tiết auth flow: [ADR-0005](../../docs/decisions/0005-auth-flow.md).

### `@Public()` — bypass JwtAuthGuard

```ts
import { Public } from '@sociflow/common'

@Controller('/auth')
export class AuthController {
  @Public()
  @Post('/login')
  async login(@Body() dto: LoginDto) { ... }

  @Public()
  @Get('/health')
  async health() { return { ok: true } }
}
```

Dùng cho: `/auth/{login,register,refresh}`, `/health`, `/webhook/*`.

### `@CurrentUser()` — inject authed user

```ts
import { CurrentUser, AuthUser } from '@sociflow/common'

@Get('/me')
me(@CurrentUser() user: AuthUser) {
  return UserVo.create(user)
}

@Get('/posts')
list(@CurrentUser('id') userId: string, @Query() q: ListPostsDto) {
  return this.service.listByUserWithPagination(userId, q)
}
```

`AuthUser` shape: `{ id, email, role, sessionId }`. `@CurrentUser('field')` shorthand inject 1 field.

**Đổi tên cũ → mới**: `@GetToken() token: TokenInfo` ❌ → `@CurrentUser() user: AuthUser` ✅.

### `OptionalAuthGuard` — anonymous + authed

```ts
import { OptionalAuthGuard } from '@sociflow/auth'

@UseGuards(OptionalAuthGuard)
@Get('/templates')
listTemplates(@CurrentUser() user: AuthUser | null) {
  // user null nếu anonymous; vẫn cho phép xem template public
  return this.service.list({ includePrivate: !!user, userId: user?.id })
}
```

### Service lấy `userId` qua CLS context

Trong Service không nên nhận `userId` qua param khắp nơi — dùng `RequestContextService` (xem [ADR-0007](../../docs/decisions/0007-cls-context.md)):

```ts
@Injectable()
export class PublishService {
  constructor(
    private readonly repo: PublishRepository,
    private readonly ctx: RequestContextService,
  ) {}

  async createBundle(dto: CreatePostDto) {
    const userId = this.ctx.requireUserId()    // throw nếu CLS rỗng
    return this.repo.create({ userId, ...dto })
  }
}
```

Controller chỉ pass `userId` cho service khi service đó **public-facing không có CLS** (rare). Mặc định: service đọc từ CLS.

## HTTP verb

| Verb | Mục đích | Path example |
|---|---|---|
| GET | Read, list | `/posts`, `/posts/:id` |
| POST | Create, action | `/posts`, `/posts/:id/publish` |
| PATCH | Partial update | `/posts/:id` |
| DELETE | Delete (soft) | `/posts/:id` |
| ~~PUT~~ | (cấm) | - |

❌ POST cho list/search → dùng GET với query (trừ khi query phức tạp >2KB)

## Path

- bắt đầu `/`
- kebab-case multi-word: `/api-keys`, không `/apiKeys`
- Plural collection: `/accounts`, `/posts`
- ID là `:id` (cuid format)
- Verb action: `POST /:id/<verb>` — `/posts/:id/cancel`, `/accounts/:id/refresh-token`
- Nested resource: tối đa 1 cấp — `/accounts/:id/posts`, KHÔNG `/users/:uid/accounts/:aid/posts/:pid`

## Pagination

Input:
```ts
{ page: 1, pageSize: 20, ...filters }
```

Output:
```ts
{
  list: [...],
  page: 1,
  pageSize: 20,
  total: 234,
  totalPages: 12
}
```

Helper `createPaginationVo(itemSchema)`.

Service:
```ts
async listWithPagination(filter, pagination): Promise<Paginated<Post>> {
  const [list, total] = await Promise.all([
    this.repo.find(filter, pagination),
    this.repo.count(filter),
  ])
  return {
    list,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.ceil(total / pagination.pageSize),
  }
}
```

## Permission filter

**Ở Service layer, qua query condition**:

```ts
// ❌ Sai — check sau khi load
async getById(userId: string, id: string) {
  const post = await this.repo.getById(id)
  if (post.userId !== userId) throw new AppException(ResponseCode.Forbidden)
  return post
}

// ✅ Đúng — filter trong query
async getByUserAndId(userId: string, id: string) {
  const post = await this.repo.getByIdAndUserId(id, userId)
  if (!post) throw new AppException(ResponseCode.PostNotFound)
  return post
}
```

Lý do:
- Tránh data leak (lỡ trả về trước khi check)
- Tránh expose thông tin (resource tồn tại nhưng không owned)
- Cleaner permission model

## Exception

Mọi business error → `AppException(ResponseCode.X, data?)`.

KHÔNG:
- Generic `Forbidden` / `Unauthorized` cho business
- Custom HTTP status — chỉ Framework's 4xx/5xx khi infra
- `throw new Error(...)` business code
- Override message: message lấy từ `ResponseMessage` mapping

Chi tiết: [error-handling.md](error-handling.md).

## Internal API (api ↔ ai)

Path prefix `/internal/`, guard `InternalTokenGuard`:

```ts
@Controller('/internal/ai')
@UseGuards(InternalTokenGuard)
export class InternalAiController {
  @Post('/chat/caption')
  async caption(@Body() dto: GenerateCaptionInternalDto) { ... }
}
```

KHÔNG expose path `/internal/*` qua nginx public block.

## Webhook

```ts
@Controller('/webhook')
export class WebhookController {
  @Public()                                   // bypass JWT
  @Post('/:source')
  async handle(
    @Param('source') source: WebhookSource,
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ) {
    await this.webhookService.handle(source, headers, body)
    return { ok: true }
  }
}
```

- Verify signature trong service trước khi process
- Lưu raw vào `WebhookEvent` table audit
- Return 200 sau khi acknowledge (process async qua queue) — platform không block

## ts-rest contract

Định nghĩa ở `packages/api-contracts/`:

```ts
import { initContract } from '@ts-rest/core'

const c = initContract()

export const postContract = c.router({
  list: {
    method: 'GET',
    path: '/posts',
    query: ListPostsDtoSchema,
    responses: { 200: ResponseEnvelope(PostListVoSchema) },
  },
  create: {
    method: 'POST',
    path: '/posts',
    body: CreatePostDtoSchema,
    responses: { 200: ResponseEnvelope(PostListVoSchema) },
  },
})
```

Frontend dùng client typed tự động.

## Versioning

Path prefix: `/api/v1/...`. Setup từ Phase 0.

Breaking change → `/api/v2/...`, V1 deprecation 6 tháng.

## Rate limit

Public endpoint:

```ts
@RateLimit({ limit: 10, windowSec: 60, scope: 'user' })
@Post('/publish/create')
async create() { ... }
```

Auth flow: `RateLimit({ limit: 5, windowSec: 60, scope: 'ip' })`.

## Documentation

Mỗi endpoint cần `@ApiDoc({...})` để generate OpenAPI:

```ts
@ApiDoc({
  summary: 'Liệt kê post',           // required
  description: 'Long description',    // optional
  body: CreatePostDtoSchema,           // POST/PATCH only
  query: ListPostsDtoSchema,           // GET with query
  response: PostVo,                    // VO class
  // hoặc array response:
  // response: [PostVo],
})
```

OpenAPI expose ở `/api/docs` (dev), tắt prod.
