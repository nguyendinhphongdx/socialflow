---
title: ADR-0007 Dùng nestjs-cls cho request context (userId, sessionId, traceId)
status: accepted
date: 2026-05-15
deciders: [founder]
---

# ADR-0007 — `nestjs-cls` cho request context propagation

## Status

Accepted.

## Context

Sociflow có 3 nguồn cần propagate context xuyên call stack:
- `userId` — từ JWT, cần ở audit log, permission filter, AI billing
- `sessionId` — từ JWT, cần khi revoke session
- `traceId` — request UUID, cần xuyên service log + cross-service (api → ai)

Cách naive: truyền `userId` qua mọi service method param.

```ts
// Sai — bị cancer truyền userId xuyên 10 layer
async createPost(userId: string, dto) {
  const account = await this.accountService.getById(userId, dto.accountId)
  const media = await this.mediaService.getByIds(userId, dto.mediaIds)
  // ...
}
```

→ Code rác, dễ quên truyền, lỗi permission khi truyền nhầm.

nestjs-boilerplate dùng `nestjs-cls` (AsyncLocalStorage wrapper) với `RequestContextService`. Solution sạch.

## Decision

**Adopt `nestjs-cls` từ Phase 0**.

- `ContextModule` `@Global` setup CLS middleware bắt mọi request.
- `JwtAuthGuard.handleRequest` set `userId`, `sessionId` vào CLS sau khi verify.
- Middleware riêng generate `traceId` (UUID v7 — sortable by time) cho mọi request, set vào CLS + response header `X-Trace-Id`.
- `RequestContextService` expose getter: `userId`, `sessionId`, `traceId`, `requireUserId()` (throw nếu null).
- **BullMQ producer** đọc context khi `add(jobName, data)`, attach vào `data.__ctx = { userId, traceId }`. **Worker** restore context vào CLS khi process job.
- **HTTP client gọi `ai` service** attach `X-Trace-Id` header. `ai` middleware đọc header, set CLS.
- **pino logger** child logger auto-bind `{ userId, traceId }` từ CLS — log line nào cũng tagged.

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| Truyền `userId` qua param | Explicit, no magic | Code rác, dễ quên, hard refactor | Đã ruled out |
| Custom AsyncLocalStorage wrapper | Không phụ thuộc 3rd-party | Reinvent wheel | nestjs-cls đã production-grade |
| **nestjs-cls** ✓ | Maintained, NestJS-native, lifecycle hook integration | +1 dep | Best |
| Zone.js | Browser legacy | Server overhead, deprecated path | Không phù hợp |
| Request-scoped DI (NestJS native) | Built-in | Performance hit (new instance per request), không cross-async-boundary | Không scale |

## Reasoning

- AsyncLocalStorage là Node 14+ feature, mature.
- nestjs-cls thin wrapper, đã được test cross-async (Promise, setTimeout, queue).
- BullMQ context propagation **rất khó làm tay** — `nestjs-cls` có `ClsModule.forRoot({ middleware: { setup: ... } })` + custom plugin pattern.
- Cross-service trace ID là **đầu vào** cho observability sau này (OpenTelemetry, Sentry trace).

## Consequences

### Positive

- Service method signature sạch: `createPost(dto)` thay vì `createPost(userId, dto)`.
- Log auto-tagged, không cần manual.
- Audit trail consistent.
- Cross-service debug dễ — search 1 `traceId` ra tất cả log.

### Negative

- **"Magic"** — userId không xuất hiện trong signature, junior dev khó trace.
- Test phải setup CLS: `cls.run({ userId: 'u1' }, () => testFn())`.
- BullMQ worker phải restore context — quên = log/permission sai user.
- 1 trường hợp memory leak nếu CLS không cleanup đúng (handled by nestjs-cls).

### Mitigation

- **Document trong [project-standards.md](../../.claude/rules/project-standards.md)** — junior phải biết.
- Test helper `withContext({ userId }, async () => ...)` — wrap test code.
- BullMQ wrapper `@sociflow/queue` **bắt buộc** restore context — không expose raw `Worker.process`.
- `RequestContextService.requireUserId()` throw rõ ràng nếu CLS rỗng — fail-fast.
- `getCurrentUser()` helper static, **chỉ dùng trong Service** — Controller dùng `@CurrentUser()` decorator, KHÔNG dùng helper.

## Implementation

### Module setup

```ts
// apps/api/src/common/context/context.module.ts
import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'
import { v7 as uuidv7 } from 'uuid'
import { RequestContextService } from './request-context.service'

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: () => uuidv7(),
        setup: (cls, req) => {
          cls.set('traceId', req.headers['x-trace-id'] ?? cls.getId())
          cls.set('ip', req.ip)
          cls.set('userAgent', req.headers['user-agent'])
        },
      },
    }),
  ],
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class ContextModule {}
```

### Service

```ts
import { Injectable } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { AppException, ResponseCode } from '@sociflow/common'

@Injectable()
export class RequestContextService {
  constructor(private readonly cls: ClsService) {}

  get userId(): string | undefined { return this.cls.get('userId') }
  get sessionId(): string | undefined { return this.cls.get('sessionId') }
  get traceId(): string { return this.cls.get('traceId') }

  requireUserId(): string {
    const u = this.userId
    if (!u) throw new AppException(ResponseCode.AuthRequired)
    return u
  }

  set(data: Partial<{ userId: string, sessionId: string }>): void {
    Object.entries(data).forEach(([k, v]) => v !== undefined && this.cls.set(k, v))
  }
}
```

### JwtAuthGuard populate

```ts
handleRequest(err, user, info, ctx) {
  if (err || !user) throw new AppException(ResponseCode.AuthRequired)
  this.contextService.set({ userId: user.id, sessionId: user.sessionId })
  return user
}
```

### BullMQ propagate

```ts
// packages/queue/src/producer.ts
async add<T>(name: string, data: T, opts?: JobsOptions) {
  const ctx = {
    userId: this.contextService.userId,
    traceId: this.contextService.traceId,
  }
  return this.queue.add(name, { ...data, __ctx: ctx }, opts)
}

// packages/queue/src/consumer.ts (worker wrapper)
async process(job: Job) {
  const ctx = job.data.__ctx ?? {}
  return this.cls.run({}, async () => {
    this.cls.set('userId', ctx.userId)
    this.cls.set('traceId', ctx.traceId ?? uuidv7())
    return this.handler(job)
  })
}
```

### pino logger child

```ts
LoggerModule.forRootAsync({
  inject: [ClsService],
  useFactory: (cls: ClsService) => ({
    pinoHttp: {
      formatters: {
        log: (object) => ({
          ...object,
          traceId: cls.get('traceId'),
          userId: cls.get('userId'),
        }),
      },
      redact: { paths: ['*.password', '*.token', '*.accessToken', '*.refreshToken'], censor: '***' },
    },
  }),
})
```

## References

- [.claude/rules/project-standards.md](../../.claude/rules/project-standards.md) — sẽ thêm CLS section
- nestjs-boilerplate `src/common/context/request-context.service.ts` — reference (sociflow thêm traceId)
- [nestjs-cls](https://github.com/Papooch/nestjs-cls) docs
- [0005-auth-flow.md](0005-auth-flow.md) — JwtAuthGuard populate CLS
