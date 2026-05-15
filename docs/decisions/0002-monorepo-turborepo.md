---
title: ADR-0002 Monorepo với Turborepo
status: accepted
date: 2026-05-15
deciders: [founder]
---

# ADR-0002 — Monorepo với Turborepo

## Status

Accepted.

## Context

Sociflow có 4 deployable artifact: `api`, `ai`, `web`, `extension` — cộng nhiều shared package (`common`, `prisma`, `api-contracts`, `auth`, `queue`, `storage`, `ws-protocol`). Câu hỏi: monorepo hay polyrepo?

Yêu cầu:
- Type sharing FE ↔ BE (zod schema, ts-rest contract)
- Fast build với cache
- Single PR thay đổi cross-cutting (vd thêm field DTO + cập nhật FE)
- Solo dev — không có người maintain CI phức tạp

## Decision

**Monorepo** với **Turborepo** + pnpm workspaces.

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| Polyrepo (4 repo riêng) | Boundary rõ | Type sync khó, PR cross-repo đau | Solo cần velocity |
| Nx | Powerful, AiToEarn dùng | Phức tạp, config nhiều | Solo overhead |
| **Turborepo** ✓ | Đơn giản, fast cache, vercel-friendly | Ít plugin hơn Nx | Match scale solo |
| Lerna | Legacy | Maintenance giảm | Outdated |
| Rush | Mạnh | Microsoft-style verbose | Overkill |

## Consequences

### Positive

- 1 PR, 1 review, 1 deploy artifact bundle
- `turbo run build --filter=...` chỉ build phần changed
- Cache build trên CI lẫn local
- Type-check xuyên project tự động phát hiện break
- Shared dev dependencies → giảm `node_modules` size

### Negative

- CI scope tính toán phức tạp hơn polyrepo (cần `turbo prune`)
- Một số tool chưa tốt với monorepo (vd Sentry source map upload)
- Onboard người mới: phải hiểu workspace + Turbo

### Mitigation

- Tài liệu rõ trong [02-architecture.md](../02-architecture.md) về structure
- Enforce dependency boundary qua `eslint-plugin-import` + tsconfig references
- Auto-pruning Docker build qua `turbo prune --scope=@sociflow/api`

## References

- Turborepo docs: https://turbo.build/repo/docs
- pnpm workspaces: https://pnpm.io/workspaces
- [02-architecture.md](../02-architecture.md)
