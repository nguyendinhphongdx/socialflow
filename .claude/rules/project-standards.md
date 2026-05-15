---
title: Project standards (HARD)
audience: ai-agent
---

# Project standards — hard rules

Đây là **rule cứng**, không phải suggestion. Vi phạm = revert. Đọc trước khi code.

## Layering bắt buộc

```
HTTP/WS → Controller → Service → Repository → Prisma
```

| Lớp | Trách nhiệm | Cấm |
|---|---|---|
| Controller | Routing, parse param, validate qua DTO, gọi Service, map VO | Logic business, truy cập DB, inject Repository |
| Service | Business logic, orchestration, permission filter, gọi Repository | Truy cập Prisma trực tiếp, return entity ngoài service |
| Repository | Data access, query DB | Business logic, permission check, cross-model operation |

## Naming

| Element | Convention |
|---|---|
| Class / Interface / Enum / Type | `PascalCase` |
| Variable / function / method | `camelCase` |
| Constant | `UPPER_SNAKE_CASE` |
| File | `kebab-case.ts` |
| File suffix | `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.dto.ts`, `*.vo.ts`, `*.repository.ts`, `*.consumer.ts`, `*.scheduler.ts`, `*.provider.ts`, `*.event.ts` |
| Test file | `*.spec.ts` co-located với source |

❌ `userService.ts`, `UserController.ts`, `user_service.ts` → ✅ `user.service.ts`

## Repository naming

| Prefix | Return | Example |
|---|---|---|
| `getXxx` | T \| null | `getById`, `getByEmail` |
| `listXxx` | T[] | `listByUserId`, `listByStatus` |
| `listXxxWithPagination` | Paginated<T> | `listByUserWithPagination` |
| `countXxx` | number | `countByUserId` |
| `existsXxx` | boolean | `existsByEmail` |
| `create` / `createMany` | T / T[] | - |
| `updateXxx` / `updateManyXxx` | T / number | `updateById`, `updateManyByIds` |
| `softDeleteXxx` / `restoreXxx` | T | `softDeleteById` |
| `aggregateXxx`, `sumXxx`, `avgXxx` | object/number | for stats |

**Cấm**: `find*`, `del*`, `add*`, `set*`, `check*`, business verb (`recharge`, `markAsRead`...)

## File size

| | Limit |
|---|---|
| File | ≤ 400 dòng (max 800) |
| Function | ≤ 50 dòng |
| Component React | ≤ 300 dòng |
| Test file | ≤ 600 dòng |

Quá → tách module/component nhỏ hơn.

## Folder structure module NestJS

```
apps/<api|ai>/src/
├── main.ts
├── app.module.ts
├── config/             # registerAs() namespaced config + zod validation
├── common/             # cross-cutting: decorators, filters, guards, interceptors, pipes, context
├── libs/               # @Global infra: database, logger, redis, mail, storage
└── core/               # business modules
    └── <module>/
        ├── <module>.module.ts
        ├── <module>.controller.ts
        ├── <module>.service.ts
        ├── <module>.repository.ts      # BẮT BUỘC nếu module đụng DB
        ├── <module>.dto.ts             # Tất cả DTO 1 file (zod schemas + createZodDto)
        ├── <module>.vo.ts              # Tất cả VO 1 file
        ├── <module>.constants.ts       # Constants riêng module
        ├── <module>.events.ts          # Domain events (nếu có)
        ├── <module>.exception.ts       # Custom exceptions (nếu có)
        ├── <module>.consumer.ts        # BullMQ consumer (nếu có)
        ├── <module>.scheduler.ts       # @Cron (nếu có)
        └── <module>.service.spec.ts    # co-located test
```

Quy tắc folder:
- Không nest `dto/`, `vo/` subfolder. Trừ khi >5 file thì split.
- `core/` cho business module; `libs/` cho infrastructure (database, redis, mail, storage); `common/` cho cross-cutting (decorators, filters, guards).
- Mỗi NestJS app (`apps/api`, `apps/ai`) có structure độc lập — không share `core/`.

## Repository layer (BẮT BUỘC)

Mọi truy cập DB đi qua Repository. Service **KHÔNG** inject `PrismaService`. Chi tiết: [ADR-0006](../../docs/decisions/0006-repository-layer.md).

```ts
// ❌ Sai — service đụng prisma
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  getById(id: string) { return this.prisma.user.findUnique({ where: { id } }) }
}

// ✅ Đúng — qua repository
@Injectable()
export class UserService {
  constructor(private readonly repo: UserRepository) {}
  getById(id: string) { return this.repo.getById(id) }
}
```

Repository cũng KHÔNG được:
- Inject service khác (cross-module → orchestrate ở Service layer)
- Throw `AppException` (chỉ trả `null` / `[]` hoặc raw `Prisma*Error`)
- Permission check (filter qua query condition — Service responsibility)

## Module exports

`module.ts` chỉ export Service:

```ts
@Module({
  imports: [...],
  providers: [UserService, UserRepository],
  controllers: [UserController],
  exports: [UserService],          // ✅ chỉ Service
  // ❌ KHÔNG: exports: [UserRepository]
})
export class UserModule {}
```

Module khác cần data từ User → import `UserModule`, inject `UserService`. KHÔNG được import `UserRepository`.

## Request context (CLS)

Mọi `apps/<api|ai>/` setup `nestjs-cls` từ Phase 0. Chi tiết: [ADR-0007](../../docs/decisions/0007-cls-context.md).

- `userId`, `sessionId`, `traceId` propagate xuyên call stack qua AsyncLocalStorage.
- `JwtAuthGuard.handleRequest` populate `userId`, `sessionId` sau khi verify.
- BullMQ producer attach context; worker restore context — **luôn dùng `@sociflow/queue` wrapper**, không expose raw `Queue.add`.
- Service đọc `userId` qua `RequestContextService.requireUserId()`, KHÔNG nhận qua method param khắp nơi.
- pino logger child auto-bind `{ userId, traceId }` từ CLS.

```ts
@Injectable()
export class PublishService {
  constructor(
    private readonly repo: PublishRepository,
    private readonly ctx: RequestContextService,
  ) {}

  async createBundle(dto: CreatePostDto) {
    const userId = this.ctx.requireUserId()      // throw AuthRequired nếu rỗng
    return this.repo.create({ userId, ...dto })
  }
}
```

## DTO / VO

- **DTO** = input → zod schema → `createZodDto`
- **VO** = output → zod schema → `createZodDto` hoặc `createPaginationVo`
- KHÔNG return Prisma entity từ Controller
- KHÔNG dùng Prisma entity làm DTO

Chi tiết: [api-design.md](api-design.md).

## Error handling

Đọc [error-handling.md](error-handling.md).

Tóm tắt:
- Business error → `throw new AppException(ResponseCode.X, data?)`
- Infrastructure error → log + retry (BullMQ)
- KHÔNG `try-catch` business
- KHÔNG `throw new Error(...)` trong business code

## Logging

```ts
import { Logger } from '@nestjs/common'

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  async foo() {
    this.logger.log('msg')          // info
    this.logger.warn('msg')         // warn
    this.logger.error('msg', err)   // error
    this.logger.debug('msg')        // debug, off in prod
  }
}
```

❌ Cấm `console.log/.warn/.error` trong source. Lint enforce.

## Config

KHÔNG đọc `process.env.X` rải rác. Chỉ truy cập qua `config` object đã validate:

```ts
import { config } from '@/config'

const apiKey = config.openai.apiKey
```

Schema trong `apps/<service>/src/config.ts`, validate bằng zod, fail-fast nếu thiếu.

## Async / await

- Luôn `await` Promise (eslint `no-floating-promises`)
- KHÔNG `.then().catch()` mix với async (consistency)
- `Promise.all` cho parallel; `Promise.allSettled` khi 1 fail không stop others
- Concurrency limit > 5 → dùng `p-limit` thay vì naive `Promise.all`

## TypeScript

- `strict: true` ở tsconfig (noImplicitAny, strictNullChecks...)
- Cấm `any` → dùng `unknown` rồi narrow
- Cấm `as any` → fix type tại nguồn (extend interface, union)
- Cấm `@ts-ignore` → dùng `@ts-expect-error` với lý do trong comment
- Cấm `!` non-null assertion trừ khi runtime đã guarantee (vẫn comment lý do)
- Type narrowing dùng predicate function thay vì cast

## Immutability

```ts
// ❌ Mutation
function updateUser(user, name) {
  user.name = name
  return user
}

// ✅ Spread
function updateUser(user, name) {
  return { ...user, name }
}
```

- Cấm `let` array/object rồi push/assign trừ khi tạo trong cùng hàm
- `readonly` properties cho DTO/VO/value object
- Cấm mutate function argument

## Soft delete

Tất cả entity user-facing: `deletedAt DateTime?`.

Repository auto-filter `deletedAt: null` qua wrapper.

Cron job xoá thật sau 30 ngày.

## Commit message

Format: `<type>: <description>` (max 72 char tổng)

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `style`

Example: `feat: add youtube oauth flow`

Chi tiết: [git-workflow.md](git-workflow.md).

## Khi không chắc

- Pattern không có trong rules → kiểm tra `docs/decisions/` xem có ADR chưa
- Vẫn không rõ → tạo ADR mới + hỏi
- Khẩn cấp → ưu tiên rule trong file này, ADR có thể làm sau

## Lint & format

```bash
pnpm lint              # check
pnpm lint --fix        # fix
pnpm type-check        # tsc --noEmit
```

Pre-commit hook chạy `lint-staged` (chỉ file changed).

## Build verification

Trước khi báo "done":

```bash
pnpm type-check   # phải pass
pnpm lint         # phải pass
pnpm test         # phải pass (cho file liên quan)
```

CI sẽ verify cả 3. PR đỏ = không merge.

## Rule index

| Topic | File |
|---|---|
| API design (DTO/VO/Controller) | [api-design.md](api-design.md) |
| Error handling | [error-handling.md](error-handling.md) |
| Coding style | [coding-style.md](coding-style.md) |
| Security | [security.md](security.md) |
| Testing | [testing.md](testing.md) |
| Git workflow | [git-workflow.md](git-workflow.md) |
