---
title: ADR-0001 Postgres + Prisma làm data layer
status: accepted
date: 2026-05-15
deciders: [founder]
---

# ADR-0001 — Postgres + Prisma làm data layer

## Status

Accepted.

## Context

Cần chọn database + ORM cho `apps/api` và `apps/ai`. Yêu cầu:

- Hỗ trợ transaction + foreign key (publish record, credit transaction)
- Type-safe queries (solo dev cần safety net)
- Migration tooling tốt
- Có thể bổ sung vector search sau (cho RAG)
- Mature ecosystem
- VPS-friendly (chạy được trong docker compose)

AiToEarn dùng MongoDB + Mongoose nhưng nhiều limitation: không có transaction native trước Mongo 4.0+ replica set, schema lỏng dễ inconsistent, type sync với TS yếu.

## Decision

- **Database**: Postgres 16
- **ORM**: Prisma 5

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| MongoDB + Mongoose | Schema-less, AiToEarn proven | Transaction phức tạp, type weak | Sociflow cần ACID cho credit/publish |
| Postgres + Drizzle | Type-safe nhất, gần SQL | Tooling kém, migration tự manage | Solo cần migration auto |
| Postgres + TypeORM | Mature | DX kém Prisma, decorator-heavy | DX |
| Supabase | Postgres + auth + storage all-in-one | Vendor lock-in | Tự host được, đỡ phụ thuộc |
| MySQL + Prisma | Cheaper hosting | Yếu JSON, không có pgvector | Mất tính năng |

## Consequences

### Positive

- Type-safe query autocomplete
- `prisma migrate` tự gen migration từ schema diff
- `pgvector` extension sẵn cho RAG (Phase 6+)
- Transaction `$transaction()` đảm bảo atomicity credit charge
- Foreign key constraint = data integrity

### Negative

- Prisma codegen step trong build pipeline
- Type instantiation chậm với schema rất lớn (chưa thấy ở quy mô MVP)
- Lock-in vào Prisma DSL (migrate ra Drizzle/Kysely sau khó)

### Mitigation

- Schema split nếu > 50 model: dùng Prisma multi-schema
- Wrap Prisma client qua Repository pattern → migrate ORM khác sau này dễ hơn
- Backup strategy: daily `pg_dump` → R2

## References

- [09-tech-stack.md](../09-tech-stack.md)
- [03-data-model.md](../03-data-model.md)
- Prisma docs: https://www.prisma.io/docs
