---
name: add-api-module
description: Tạo module NestJS mới end-to-end (Controller + Service + Repository + DTO + VO + test). Use khi user yêu cầu "/add-api-module xxx" hoặc "tạo module xxx".
---

# Skill: add-api-module

Tạo 1 module CRUD chuẩn theo convention Sociflow.

## Inputs

1. **Module name** (singular, kebab-case): `feature`, `tag`, `notification-template`
2. **Trong app nào?**: `apps/api` hay `apps/ai` (default: `apps/api`)
3. **Có model Prisma không?** Nếu có, các field cần có
4. **Endpoints cần?** Mặc định: list, getById, create, update, softDelete
5. **Permission scope?** Per-user (default), per-team, public

## Output checklist

```
apps/<app>/src/core/<module>/
├── <module>.module.ts          # exports: [Service] only — KHÔNG export Repository
├── <module>.controller.ts      # @ApiTags, @ApiDoc, @CurrentUser, route only
├── <module>.service.ts         # inject Repository + RequestContextService
├── <module>.service.spec.ts    # mock Repository + CLS context
├── <module>.repository.ts      # BẮT BUỘC — getById, listByUserWithPagination, etc.
├── <module>.dto.ts             # zod schemas + createZodDto
└── <module>.vo.ts              # zod schemas + createZodDto + static .create(entity)
```

Plus:
- [ ] Wire vào `app.module.ts`
- [ ] Prisma schema + migration (nếu có model mới)
- [ ] ResponseCode add (nếu có error code mới) — `packages/common/src/response-code.ts`
- [ ] ts-rest contract (`packages/api-contracts/`)
- [ ] Type-check + lint + test pass

## Rule check (gate trước khi báo done)

- [ ] Service KHÔNG inject `PrismaService` — chỉ inject Repository + Service khác
- [ ] Service KHÔNG nhận `userId` qua param khắp nơi — đọc qua `RequestContextService.requireUserId()`
- [ ] Controller KHÔNG inject Repository
- [ ] Repository naming: `getXxx`, `listXxx`, `existsXxx`, `create`, `updateById`, `softDeleteById` — KHÔNG `find*/del*/add*/check*`
- [ ] Repository KHÔNG throw `AppException` — chỉ trả `null` / `[]` hoặc raw Prisma error
- [ ] `module.ts` `exports: [<Service>]` — KHÔNG `[Repository]`
- [ ] Permission filter qua query condition (`getByIdAndUserId`), KHÔNG sau-load check
- [ ] DTO: zod schema + `.strict()` + `.describe()` mọi field
- [ ] VO: static `.create(entity)` method, strip sensitive field

## Step-by-step

### 1. Plan

Hỏi user (hoặc deduce):
- Module name
- Field list (qua Prisma model)
- Endpoint list
- Permission model

### 2. Tạo Prisma model (nếu cần)

```prisma
model Feature {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  @@index([userId])
  @@index([deletedAt])
}
```

Run:
```bash
pnpm prisma migrate dev --name add-feature
pnpm prisma generate
```

### 3. Tạo file theo template (xem `agents/api-builder.md`)

Dùng template trong agent definition.

### 4. Wire-up

```ts
// apps/<app>/src/app.module.ts
import { FeatureModule } from './core/feature/feature.module'

@Module({
  imports: [
    // ...existing
    FeatureModule,
  ],
})
export class AppModule {}
```

### 5. ResponseCode

```ts
// packages/common/src/response-code.ts
export enum ResponseCode {
  // Range theo module — check existing
  FeatureNotFound = 19000,
  FeatureLimitReached = 19001,
}

export const ResponseMessage = {
  // ...
  [ResponseCode.FeatureNotFound]: 'Không tìm thấy feature',
  [ResponseCode.FeatureLimitReached]: 'Đã vượt giới hạn feature',
}
```

### 6. ts-rest contract

```ts
// packages/api-contracts/src/feature.contract.ts
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { CreateFeatureDtoSchema, UpdateFeatureDtoSchema, ListFeatureDtoSchema, FeatureVoSchema, FeatureListVoSchema } from '@sociflow/common'

const c = initContract()

export const featureContract = c.router({
  list: {
    method: 'GET',
    path: '/features',
    query: ListFeatureDtoSchema,
    responses: { 200: ResponseEnvelope(FeatureListVoSchema) },
  },
  getById: {
    method: 'GET',
    path: '/features/:id',
    pathParams: z.object({ id: z.string().cuid() }),
    responses: { 200: ResponseEnvelope(FeatureVoSchema) },
  },
  create: {
    method: 'POST',
    path: '/features',
    body: CreateFeatureDtoSchema,
    responses: { 200: ResponseEnvelope(FeatureVoSchema) },
  },
  update: {
    method: 'PATCH',
    path: '/features/:id',
    pathParams: z.object({ id: z.string().cuid() }),
    body: UpdateFeatureDtoSchema,
    responses: { 200: ResponseEnvelope(FeatureVoSchema) },
  },
  delete: {
    method: 'DELETE',
    path: '/features/:id',
    pathParams: z.object({ id: z.string().cuid() }),
    responses: { 200: ResponseEnvelope(z.object({})) },
  },
})
```

### 7. Verify

```bash
pnpm type-check
pnpm lint
pnpm test --filter @sociflow/api
```

## Variations

### Module có queue consumer

Add file:
- `<module>.consumer.ts`
- Register queue trong `<module>.module.ts`

### Module có scheduler

Add file:
- `<module>.scheduler.ts` với `@Cron('...')`
- Import `ScheduleModule` trong app.module.ts (nếu chưa)

### Module có event listener

Add file:
- `<module>.listener.ts` với `@OnEvent('xxx')`
- Use `EventBus` qua `@nestjs/event-emitter`

## Anti-patterns to avoid

Xem [.claude/rules/project-standards.md](../rules/project-standards.md) "Cấm" section.

Top mistakes:
- ❌ Inject Repository vào Controller
- ❌ Throw `new Error()` thay vì `AppException`
- ❌ Return entity trần thay vì VO
- ❌ Filter permission sau khi load (security risk)
- ❌ Tạo `dto/`, `vo/` subfolder không cần
- ❌ `find*`/`del*` naming
