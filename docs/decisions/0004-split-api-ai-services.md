---
title: ADR-0004 Tách api và ai thành 2 service ngay từ đầu
status: accepted
date: 2026-05-15
deciders: [founder]
---

# ADR-0004 — Tách `api` và `ai` thành 2 service riêng từ đầu

## Status

Accepted.

## Context

Solo dev — có nên gộp `api` và `ai` vào 1 NestJS service để đỡ overhead, sau này có nhu cầu mới tách? Hay tách ngay?

## Decision

**Tách ngay từ Phase 0**, dù cả 2 chạy chung 1 docker compose trên 1 VPS lúc đầu.

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| Monolith (1 service) | Đơn giản, 1 codebase, share DI | Tách sau cực kỳ đau (refactor toàn bộ module boundary) | Future regret |
| **Split ngay** ✓ | Boundary cứng ngay từ đầu, scale dễ | 2 service phải maintain, overhead nhỏ | Long-term win |
| Split + microservice extreme (5+ service) | Microservice purist | Solo over-engineering | Không cần thiết |

## Reasoning

Tách ngay vì:

1. **Resource pattern khác hẳn**:
   - `api`: request ngắn (CRUD, < 500ms)
   - `ai`: request dài (gen video 5 phút)
2. **Dependency nặng**:
   - `ai`: OpenAI/Anthropic/Replicate SDK + ffmpeg = image ~500MB
   - `api`: image ~200MB
   - Gộp → image nặng + cold start chậm
3. **Scale roadmap**:
   - Phase 6 sẽ cần `ai` scale GPU → tách trước cho đỡ disruption
4. **Failure isolation**:
   - AI video gen OOM kill → không ảnh hưởng login/dashboard
5. **API key security**:
   - GPT-4 / Veo key đắt → giảm blast radius
6. **Refactor cost sau này quá cao**:
   - Service boundary phải design qua DTO/Internal API ngay từ đầu
   - Pull `ai` module ra khỏi monolith sau = phải tách event handlers, queue consumers, transaction → mất 2-4 tuần

## Consequences

### Positive

- Boundary rõ ràng — `api` gọi `ai` qua HTTP REST internal
- 2 image Docker riêng, deploy độc lập
- Sau này thêm `ai` replica chỉ cần `docker compose scale ai=3`
- Mock `ai` trong test `api` dễ
- Team scale sau này: 1 dev focus `api`, 1 dev focus `ai`

### Negative

- 2 NestJS app phải maintain: 2 main.ts, 2 config, 2 dockerfile
- Network call latency thêm 5-20ms cho mỗi gọi `api → ai`
- Auth giữa 2 service (shared `INTERNAL_TOKEN`)
- Debug e2e khó hơn (cross-service log)

### Mitigation

- Shared package `packages/common`, `packages/auth`, `packages/queue` để KHÔNG duplicate
- Logger tag `service=api|ai` cho dễ filter
- Local dev: 2 process song song qua `pnpm dev` (Turbo)
- Internal HTTP wrap qua client lib `packages/ai-client` để API gọi `ai` typed

## References

- [02-architecture.md](../02-architecture.md)
- [06-ai-services.md](../06-ai-services.md)
- AiToEarn cũng tách như vậy (`aitoearn-server` + `aitoearn-ai`) — proven pattern
