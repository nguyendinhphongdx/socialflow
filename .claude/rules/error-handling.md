---
title: Error handling (HARD)
audience: ai-agent
---

# Error handling

## Triết lý

- **Business error** = expected condition (account not found, content invalid) → `AppException`
- **Infrastructure error** = bug or unexpected (DB connection lost, OOM) → log + retry / crash
- **External error** (API platform fail) = retry policy + map to business error sau N attempt

## AppException

```ts
import { AppException, ResponseCode } from '@sociflow/common'

throw new AppException(ResponseCode.AccountNotFound, { accountId: id })
```

Global filter catch → response:
```json
{
  "data": { "accountId": "acc_xxx" },
  "code": 13000,
  "message": "Không tìm thấy tài khoản",
  "timestamp": 1731234567890
}
```

HTTP status **200** (trừ exception infra).

## ResponseCode

Số nguyên, range 10000+, chia theo module (xem [docs/08-api-conventions.md](../../docs/08-api-conventions.md)).

Naming: PascalCase, **specific resource**:
- ✅ `AccountNotFound`, `PublishTaskInvalid`, `AgentOffline`
- ❌ `Forbidden`, `NotFound`, `BadRequest`, `Unauthorized` (chỉ dùng cho auth layer)

Thêm code mới:
1. Add enum `ResponseCode` trong `packages/common/src/response-code.ts`
2. Add default message trong `ResponseMessage` mapping
3. Use trong service

```ts
// packages/common/src/response-code.ts
export enum ResponseCode {
  // ...
  EngagementRateLimit = 17000,
  EngagementInvalidComment = 17001,
}

export const ResponseMessage: Record<ResponseCode, string> = {
  // ...
  [ResponseCode.EngagementRateLimit]: 'Đã vượt giới hạn auto-reply trong ngày',
  [ResponseCode.EngagementInvalidComment]: 'Comment không tồn tại hoặc đã bị xoá',
}
```

## Không bao giờ làm

```ts
// ❌ throw new Error
throw new Error('Account not found')

// ❌ Generic exception
throw new AppException(ResponseCode.Forbidden)

// ❌ Override message
throw new AppException(ResponseCode.AccountNotFound, undefined, 'Custom message')

// ❌ Custom HTTP status
throw new HttpException('...', 418)

// ❌ Try-catch wrap business
try {
  const account = await this.repo.getById(id)
} catch (err) {
  this.logger.error(err)
  throw new AppException(ResponseCode.AccountNotFound)
}

// ❌ Console
console.error('error:', err)
```

## Cách đúng

```ts
// ✅ Specific business error
const account = await this.repo.getById(id)
if (!account || account.userId !== userId) {
  throw new AppException(ResponseCode.AccountNotFound, { accountId: id })
}

// ✅ Let framework handle exception
return account   // no try-catch needed
```

## Try-catch cho infrastructure

Chỉ wrap khi gọi external API hoặc I/O:

```ts
async publish(record) {
  let response
  try {
    response = await this.youtube.videos.insert({...})
  } catch (err) {
    this.logger.error('youtube upload failed', err)

    if (isOAuthExpired(err)) {
      await this.tokenRefresher.refresh(account)
      throw new RetryableError('token refreshed')
    }
    if (isContentPolicy(err)) {
      throw new AppException(ResponseCode.PublishRejectedByPlatform, {
        platform: 'YOUTUBE',
        reason: extractReason(err),
      })
    }
    throw err   // unknown → BullMQ retry
  }
  return response
}
```

## Retry vs fail

```ts
// Retryable infrastructure error
import { RetryableError } from '@sociflow/common'

throw new RetryableError('temporary network')   // BullMQ retry with backoff
```

`RetryableError` extends `Error`, BullMQ retry attempt.

`AppException` business error → log + fail final (worker mark job FAILED, status = FAILED).

## Logger trong error handling

```ts
catch (err) {
  // Log với context
  this.logger.error(
    `Publish failed for record ${recordId} on ${platform}`,
    err.stack,
    { recordId, platform, accountId: record.accountId }
  )

  // Sentry tự capture (qua interceptor)

  // Map to business error
  throw new AppException(ResponseCode.PublishFailed, { recordId })
}
```

KHÔNG log raw:
- Password, token, API key
- Personal data (email, phone trong full)
- Card number
- Secret

→ Log redact qua pino redact config.

## Validation error

Zod parse fail → `ZodError` → global filter map to `ValidationFailed`:

```ts
// ValidationExceptionFilter
catch(err: ZodError) {
  return {
    code: ResponseCode.ValidationFailed,
    message: 'Dữ liệu không hợp lệ',
    data: {
      errors: err.errors.map(e => ({ path: e.path, message: e.message }))
    }
  }
}
```

Client thấy:
```json
{
  "code": 10001,
  "message": "Dữ liệu không hợp lệ",
  "data": {
    "errors": [
      { "path": ["title"], "message": "max 200 chars" }
    ]
  }
}
```

## Error mapping table

| Layer | Error type | Action |
|---|---|---|
| zod validate | `ZodError` | Filter → `ValidationFailed` |
| Service business | `AppException` | Return business error response |
| Service infra (DB) | `PrismaClientKnownRequestError` | Log + map specific (`P2002` unique constraint → `EmailAlreadyExists`) |
| Worker (BullMQ) | `AppException` (business) | Mark job failed, no retry |
| Worker (RetryableError or unknown) | retry (default 3) | After max attempts → mark failed + Sentry |
| External SDK | platform-specific Error | Catch in provider, map to business code or rethrow as Retryable |
| HTTP framework | unknown | 500 Internal Server Error, Sentry capture, generic message |

## Crash policy

- Service không tự `process.exit(1)` trừ infra init fail (config invalid, DB unreachable startup)
- Unhandled promise rejection → log + Sentry, nhưng KHÔNG crash process (NestJS keeps alive)
- Worker error → BullMQ handle retry/DLQ
- Memory leak → restart cycle (docker restart policy)

## Testing error path

Mỗi business case có error path → test case ngược:

```ts
it('throws AccountNotFound when account does not exist', async () => {
  await expect(service.getByUserAndId('user_1', 'nonexistent'))
    .rejects.toThrow(new AppException(ResponseCode.AccountNotFound, { accountId: 'nonexistent' }))
})

it('throws when account belongs to other user', async () => {
  const account = await createAccount({ userId: 'user_2' })
  await expect(service.getByUserAndId('user_1', account.id))
    .rejects.toMatchObject({ code: ResponseCode.AccountNotFound })
})
```

## Frontend error handling

```ts
const res = await client.post.create({ body: dto })
if (res.body.code !== 0) {
  toast.error(res.body.message)
  if (res.body.code === ResponseCode.AccountNotFound) {
    router.push('/accounts')
  }
  return
}
// success
```

- Toast cho error generic
- Specific code → branch UX (redirect, retry button)
- Network error / 5xx → toast "Lỗi hệ thống, thử lại"

## Webhook idempotency

Platform có thể gửi webhook nhiều lần:

```ts
async handleTiktokWebhook(body) {
  const exists = await this.webhookEventRepo.existsByPlatformEventId(body.event_id)
  if (exists) return   // idempotent

  // Process...
  await this.webhookEventRepo.create({ ...body })
}
```

## Tổng kết: decision tree

```
Có lỗi xảy ra → là gì?
├── Validation input → throw ZodError (zod tự throw, filter map)
├── Resource không tồn tại / không owned → throw AppException(XxxNotFound)
├── Quy tắc business vi phạm → throw AppException(SpecificCode)
├── Infrastructure (DB, Redis fail) → log error + let framework retry / crash
├── External API fail (OAuth, platform)
│   ├── Token expired → refresh + RetryableError
│   ├── Rate limit → wait + RetryableError
│   ├── Content rejected → AppException(PublishRejectedByPlatform)
│   ├── Server 5xx → RetryableError (backoff)
│   └── Unknown → log + rethrow → BullMQ retry
└── Bug / unexpected → log full stack + Sentry + crash worker
```
