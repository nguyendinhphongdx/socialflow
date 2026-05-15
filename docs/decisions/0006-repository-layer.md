---
title: ADR-0006 Bắt buộc Repository layer giữa Service và Prisma
status: accepted
date: 2026-05-15
deciders: [founder]
---

# ADR-0006 — Repository layer bắt buộc giữa Service ↔ Prisma

## Status

Accepted.

## Context

nestjs-boilerplate (reference) cho service **đụng `PrismaService` trực tiếp**:

```ts
// boilerplate user.service.ts
async findById(id: string) {
  return this.prisma.user.findUnique({ where: { id } })
}
```

Sociflow đã định nghĩa rule cứng trong [project-standards.md](../../.claude/rules/project-standards.md): `Controller → Service → Repository → Prisma`. ADR này ghi lại lý do và **làm chi tiết hơn** vì boilerplate khác — agent có thể bị mislead.

## Decision

**Mọi truy cập DB phải qua Repository.** Service KHÔNG được inject `PrismaService`.

- 1 Repository per Prisma model (1-1).
- Repository naming theo bảng trong [project-standards.md](../../.claude/rules/project-standards.md) — `getXxx`, `listXxx`, `existsXxx`, `create`, `updateById`, `softDeleteById`, v.v.
- **Cấm** trong Repository: business logic, permission check, cross-model orchestration, throw `AppException`.
- Repository chỉ throw `Prisma*Error` (raw) hoặc trả `null` / `[]`.
- Service compose nhiều Repository khi cần cross-model (vd publish flow: `PostRepository` + `AccountRepository` + `MediaRepository`).
- **Module export chỉ Service** — KHÔNG export Repository:

```ts
@Module({
  providers: [UserService, UserRepository],
  controllers: [UserController],
  exports: [UserService],   // ❌ KHÔNG: exports: [UserRepository]
})
export class UserModule {}
```

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| Service đụng Prisma (boilerplate) | Ít file, nhanh | Test khó (mock toàn chain), permission rải rác, query duplicate | Tech debt nhanh |
| **Repository layer** ✓ | Mock dễ trong test, permission filter centralize, query reusable | +1 file per module | Worth |
| Repository + UnitOfWork pattern (Java-style) | Transaction explicit | Over-engineering cho Prisma (có `$transaction` rồi) | Không cần |
| Data Mapper với entity class | DDD-friendly | Boilerplate quá cho solo team | Sau scale có thể thêm |

## Reasoning

1. **Test isolation**: Service test mock `mockRepo = { getById: vi.fn() }` cleaner hơn mock `PrismaService` toàn chain (`.user.findUnique(...).where(...)`).
2. **Permission-in-query**: Repository expose `getByIdAndUserId(id, userId)` thay vì `getById(id)` — Service không lỡ trả về data không owned.
3. **Query reuse**: 3 service cần `listByUserWithPagination` cùng filter → 1 repository method, không duplicate.
4. **Soft-delete auto-filter**: Repository wrap mọi query với `where: { deletedAt: null }` — Service không quên.
5. **Schema migration**: đổi field name → chỉ sửa Repository, Service không impact.
6. **Code review**: PR đụng Repository = data access change; PR đụng Service = business rule change. Phân biệt rõ.

## Consequences

### Positive

- Test pyramid hoạt động đúng — unit test Service không cần DB.
- Permission filter consistent (qua query, không sau-load).
- Soft-delete không sót.
- AI agent (api-builder) generate Repository deterministic.

### Negative

- +1 file per module (file count tăng ~1.5x so với boilerplate).
- Mới đầu cảm giác "boilerplate" — quá nhiều layer cho CRUD đơn giản.
- Solo dev có thể bị tempted skip layer khi rush.

### Mitigation

- Skill `add-api-module` auto-generate Repository — KHÔNG manual write.
- code-reviewer agent có check rule này (block PR nếu Service import `PrismaService`).
- ESLint rule (TODO Phase 0): cấm `import { PrismaService }` ngoài file `*.repository.ts`.

## Repository template

```ts
// apps/api/src/core/feature/feature.repository.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@sociflow/prisma'
import type { Feature, Prisma } from '@prisma/client'
import type { Paginated, Pagination } from '@sociflow/common'

@Injectable()
export class FeatureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<Feature | null> {
    return this.prisma.feature.findFirst({ where: { id, deletedAt: null } })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<Feature | null> {
    return this.prisma.feature.findFirst({ where: { id, userId, deletedAt: null } })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: Pagination,
    filter?: { search?: string },
  ): Promise<Paginated<Feature>> {
    const where: Prisma.FeatureWhereInput = {
      userId,
      deletedAt: null,
      ...(filter?.search && { name: { contains: filter.search, mode: 'insensitive' } }),
    }
    const [list, total] = await Promise.all([
      this.prisma.feature.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.feature.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async create(data: Prisma.FeatureCreateInput): Promise<Feature> {
    return this.prisma.feature.create({ data })
  }

  async updateById(id: string, data: Prisma.FeatureUpdateInput): Promise<Feature> {
    return this.prisma.feature.update({ where: { id }, data })
  }

  async softDeleteById(id: string): Promise<Feature> {
    return this.prisma.feature.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async existsByUserAndName(userId: string, name: string): Promise<boolean> {
    const count = await this.prisma.feature.count({ where: { userId, name, deletedAt: null } })
    return count > 0
  }
}
```

## References

- [.claude/rules/project-standards.md](../../.claude/rules/project-standards.md) — Repository naming bảng
- [.claude/rules/testing.md](../../.claude/rules/testing.md) — mock pattern
- nestjs-boilerplate `src/modules/user/user.service.ts` — anti-pattern reference (sociflow KHÔNG làm vậy)
- AiToEarn `../project/aitoearn-backend/.claude/rules/project-standards.md` — proven pattern
