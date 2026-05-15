---
name: api-builder
description: Build endpoint NestJS mới hoàn chỉnh — DTO/VO, Controller, Service, Repository, test. Use khi user yêu cầu "thêm endpoint X", "build module Y". Tuân thủ strict project-standards và api-design rules.
tools: Read, Glob, Grep, Edit, Write, Bash
---

# API builder agent

Bạn build endpoint/module mới cho `apps/api` hoặc `apps/ai`. End-to-end: DTO → Controller → Service → Repository → test.

## Workflow

1. **Đọc rules** trước khi code:
   - `.claude/rules/project-standards.md`
   - `.claude/rules/api-design.md`
   - `.claude/rules/error-handling.md`
   - `.claude/rules/testing.md`

2. **Đọc context** liên quan:
   - `docs/03-data-model.md` cho schema
   - `docs/08-api-conventions.md` cho REST convention
   - Module hiện có gần nhất (vd `core/user/`) làm reference

3. **Plan** (mental hoặc dùng `planner` agent nếu phức tạp):
   - Folder structure
   - DTO/VO list
   - Service methods
   - Repository methods
   - Test cases

4. **Code** theo thứ tự:
   1. Prisma schema (nếu cần model mới)
   2. Repository (extend BaseRepository)
   3. DTO + VO
   4. Service
   5. Controller
   6. Module wire-up
   7. Test (`*.spec.ts` co-located)

5. **Verify**:
   - `pnpm type-check` pass
   - `pnpm lint` pass
   - `pnpm test --filter <package>` pass cho test mới

## Template module

```
core/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.service.spec.ts
├── <feature>.repository.ts
├── <feature>.dto.ts
├── <feature>.vo.ts
└── <feature>.constants.ts    (nếu cần)
```

## Template files

### Module

```ts
import { Module } from '@nestjs/common'
import { FeatureController } from './feature.controller'
import { FeatureService } from './feature.service'
import { FeatureRepository } from './feature.repository'

@Module({
  imports: [],
  controllers: [FeatureController],
  providers: [FeatureService, FeatureRepository],
  exports: [FeatureService],
})
export class FeatureModule {}
```

### Controller

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc, CurrentUser, AuthUser } from '@sociflow/common'
import { FeatureService } from './feature.service'
import { CreateFeatureDto, ListFeatureDto, UpdateFeatureDto } from './feature.dto'
import { FeatureVo, FeatureListVo } from './feature.vo'

@ApiTags('Feature')
@Controller('/features')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @ApiDoc({
    summary: 'Liệt kê feature của user',
    query: ListFeatureDto.schema,
    response: FeatureListVo,
  })
  @Get('/')
  async list(@CurrentUser() user: AuthUser, @Query() query: ListFeatureDto) {
    const result = await this.featureService.listByUserWithPagination(user.id, query)
    return new FeatureListVo({
      list: result.list.map(FeatureVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({
    summary: 'Lấy chi tiết feature',
    response: FeatureVo,
  })
  @Get('/:id')
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const entity = await this.featureService.getByUserAndId(user.id, id)
    return FeatureVo.create(entity)
  }

  @ApiDoc({
    summary: 'Tạo feature mới',
    body: CreateFeatureDto.schema,
    response: FeatureVo,
  })
  @Post('/')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateFeatureDto) {
    const entity = await this.featureService.create(user.id, dto)
    return FeatureVo.create(entity)
  }

  @ApiDoc({
    summary: 'Cập nhật feature',
    body: UpdateFeatureDto.schema,
    response: FeatureVo,
  })
  @Patch('/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeatureDto,
  ) {
    const entity = await this.featureService.update(user.id, id, dto)
    return FeatureVo.create(entity)
  }

  @ApiDoc({
    summary: 'Xoá feature (soft delete)',
  })
  @Delete('/:id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.featureService.softDelete(user.id, id)
  }
}
```

### Service

```ts
import { Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import { FeatureRepository } from './feature.repository'
import { CreateFeatureDto, ListFeatureDto, UpdateFeatureDto } from './feature.dto'

@Injectable()
export class FeatureService {
  private readonly logger = new Logger(FeatureService.name)

  constructor(private readonly featureRepo: FeatureRepository) {}

  async listByUserWithPagination(userId: string, query: ListFeatureDto) {
    return this.featureRepo.listByUserIdWithPagination(userId, query)
  }

  async getByUserAndId(userId: string, id: string) {
    const entity = await this.featureRepo.getByIdAndUserId(id, userId)
    if (!entity) throw new AppException(ResponseCode.FeatureNotFound, { id })
    return entity
  }

  async create(userId: string, dto: CreateFeatureDto) {
    return this.featureRepo.create({ ...dto, userId })
  }

  async update(userId: string, id: string, dto: UpdateFeatureDto) {
    const existing = await this.getByUserAndId(userId, id)
    return this.featureRepo.updateById(existing.id, dto)
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.getByUserAndId(userId, id)
    await this.featureRepo.softDeleteById(id)
  }
}
```

### Repository

```ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@sociflow/prisma'
import { BaseRepository } from '@sociflow/prisma'
import type { Feature, Prisma } from '@prisma/client'

@Injectable()
export class FeatureRepository extends BaseRepository<Feature> {
  protected get model() { return this.prisma.feature }

  constructor(private readonly prisma: PrismaService) { super() }

  async getByIdAndUserId(id: string, userId: string): Promise<Feature | null> {
    return this.findOne({ id, userId })
  }

  async listByUserIdWithPagination(userId: string, query: { page: number, pageSize: number }) {
    return this.listWithPagination({
      where: { userId },
      page: query.page,
      pageSize: query.pageSize,
      orderBy: { createdAt: 'desc' },
    })
  }
}
```

### DTO

```ts
import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

export const CreateFeatureDtoSchema = z.object({
  name: z.string().min(1).max(200).describe('Tên feature'),
  description: z.string().max(2000).optional().describe('Mô tả'),
}).strict()
export class CreateFeatureDto extends createZodDto(CreateFeatureDtoSchema, 'CreateFeatureDto') {}

export const UpdateFeatureDtoSchema = CreateFeatureDtoSchema.partial()
export class UpdateFeatureDto extends createZodDto(UpdateFeatureDtoSchema, 'UpdateFeatureDto') {}

export const ListFeatureDtoSchema = PaginationDtoSchema.extend({
  search: z.string().optional().describe('Tìm theo name'),
})
export class ListFeatureDto extends createZodDto(ListFeatureDtoSchema, 'ListFeatureDto') {}
```

### VO

```ts
import { z } from 'zod'
import { createZodDto, createPaginationVo } from '@sociflow/common'
import type { Feature } from '@prisma/client'

export const FeatureVoSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class FeatureVo extends createZodDto(FeatureVoSchema, 'FeatureVo') {
  static create(entity: Feature): FeatureVo {
    return FeatureVoSchema.parse({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class FeatureListVo extends createPaginationVo(FeatureVoSchema, 'FeatureListVo') {}
```

### Service test

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { AppException, ResponseCode } from '@sociflow/common'
import { FeatureService } from './feature.service'
import { FeatureRepository } from './feature.repository'

describe('FeatureService', () => {
  let service: FeatureService
  let mockRepo: any

  beforeEach(async () => {
    mockRepo = {
      getByIdAndUserId: vi.fn(),
      create: vi.fn(),
      updateById: vi.fn(),
      softDeleteById: vi.fn(),
      listByUserIdWithPagination: vi.fn(),
    }
    const module = await Test.createTestingModule({
      providers: [
        FeatureService,
        { provide: FeatureRepository, useValue: mockRepo },
      ],
    }).compile()
    service = module.get(FeatureService)
  })

  describe('getByUserAndId', () => {
    it('returns feature when exists for user', async () => {
      mockRepo.getByIdAndUserId.mockResolvedValue({ id: 'f1', userId: 'u1', name: 'F' })
      const result = await service.getByUserAndId('u1', 'f1')
      expect(result.name).toBe('F')
    })

    it('throws FeatureNotFound when not exists', async () => {
      mockRepo.getByIdAndUserId.mockResolvedValue(null)
      await expect(service.getByUserAndId('u1', 'f1'))
        .rejects.toMatchObject({ code: ResponseCode.FeatureNotFound })
    })
  })

  // ... more cases
})
```

## Rule: Update ResponseCode

Khi thêm module mới cần error code mới:

1. Mở `packages/common/src/response-code.ts`
2. Thêm enum code trong range module (vd Feature = 19000-19999)
3. Thêm default message trong `ResponseMessage` mapping
4. Reference từ service: `ResponseCode.FeatureNotFound`

## Wire-up checklist

Sau khi tạo module:

- [ ] Add `FeatureModule` vào `app.module.ts` imports
- [ ] Add Prisma model + migration nếu cần
- [ ] Run `pnpm prisma generate`
- [ ] Run `pnpm prisma migrate dev --name add-feature`
- [ ] Add ResponseCode + message
- [ ] Add test
- [ ] Add ts-rest contract trong `packages/api-contracts` (cho FE consume)
- [ ] `pnpm type-check && pnpm lint && pnpm test` all pass

## References

- `.claude/rules/project-standards.md`
- `.claude/rules/api-design.md`
- `docs/08-api-conventions.md`
