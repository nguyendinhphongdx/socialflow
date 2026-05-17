---
title: ADR-0009 Multi-tenant account group — deferred to v2
status: accepted
date: 2026-05-17
deciders: [founder]
---

# ADR-0009 — Defer multi-tenant isolation to v2

## Status

Accepted (defer).

## Context

[ADR-0008](0008-launch-readiness.md) Tuần 6 (F-716) yêu cầu refactor multi-tenant với `account-group` isolation:
- Tenant boundary qua `groupId` filter Service layer
- Role per group: OWNER / ADMIN / EDITOR / VIEWER
- Group switcher trong web header
- Mọi query repo filter `groupId` nếu user trong group context

Đây là **refactor xuyên modules** — touch hầu hết module (publish, social-account, draft, media, insight, comment, auto-reply, brand-monitor). Risk vỡ existing tests + smoke flow cao.

Sociflow hiện đã có `AccountGroup` model + `accountGroups` field trên SocialAccount, nhưng **chưa có tenant boundary** — user-level isolation đủ cho v1.

## Decision

**Defer F-716 sang post-launch v2.** Lý do:

1. **Solo agency persona đủ với user-level isolation** — 1 user = 1 agency = own pool of accounts. Multi-user team workspace là use case Enterprise tier, không phải MVP.
2. **Risk surface lớn** — chạm 9 module backend + 11 feature folder FE. Smoke runbook Phase 2-6 phải re-execute toàn bộ sau refactor.
3. **Pre-launch focus**: monetize (credits), reliability (sentry/grafana), compliance (App Review) ưu tiên hơn.
4. **User feedback drive**: chờ user thật xác nhận nhu cầu team workspace trước khi build.

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| **Build now (F-716 full)** | Đầy đủ feature parity với AiToEarn | 9 module refactor, smoke regression, +2 tuần | Defer chấp nhận được cho MVP |
| **Build basic version** (filter `groupId` ở 1-2 module quan trọng) | Foundation cho v2 | Half-baked, dễ false-sense-of-security | Inconsistent worse than not having |
| **Defer hoàn toàn** ✅ | Focus MVP, validate trước | Enterprise tier không sellable v1 | Acceptable — chỉ FREE + PRO + BUSINESS launch |

## Consequences

### Positive

- Launch sớm 2 tuần
- Code simpler, ít regression
- Existing tests + flows giữ nguyên

### Negative

- Enterprise tier không có team workspace (mark "Contact sales" / "Coming soon")
- Agency với 5+ team member phải share login (UX kém)
- Sau này refactor multi-tenant sẽ phải migrate data nếu có user > 1 group

### Mitigation

- **Pricing page** mark Enterprise "Team workspace coming Q4 2026" rõ ràng
- **Data model future-proof**: `accountGroups` field đã có, không cần migration đổi schema cho v2 — chỉ cần wire query filter + role check
- **Spike trước v2**: 2-day spike refactor 1 module (publish) làm proof-of-concept

## v2 implementation plan (skeleton)

Khi prep v2:

1. Tạo `GroupMember` model (userId, groupId, role)
2. `RequestContextService.requireGroupId()` đọc từ header `X-Group-Id` + verify membership
3. Repository pattern thêm method `*ByGroupId` — filter sớm trước khi return
4. Service layer thay `requireUserId()` bằng `requireGroupId()` cho group-scoped operations
5. Web sidebar: group switcher dropdown
6. Smoke runbook mới: tenant-isolation.md verify user A không thấy data của user B trong cùng group khác

## References

- [ADR-0008](0008-launch-readiness.md) F-716 row
- [AiToEarn `account-group.controller`](https://github.com/yikart/AiToEarn) — reference pattern
- [PROGRESS.md](../../PROGRESS.md) Phase 7 — F-716 marked deferred
