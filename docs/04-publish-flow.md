---
title: Publish flow
description: Luồng đăng bài end-to-end — API path và Automation path
audience: [developer, ai-agent]
---

# Publish flow

## Overview

User tạo 1 post → backend chia thành N `PublishRecord` (mỗi account 1 record) → mỗi record chạy qua **PublishProvider** tương ứng → cập nhật status real-time → notify user.

Có 2 path execute:

| Path | Cơ chế | Khi dùng |
|---|---|---|
| **API** | OAuth, server-to-server HTTP | Default, account đã pass OAuth |
| **Automation** | Browser extension điều khiển DOM | Account không có OAuth, hoặc API rate-limit |
| **Hybrid** | Try API trước, fail → fallback automation | User chọn khi connect |

## Sơ đồ chính

```
USER
 │
 │ POST /api/publish/create
 │ { accountIds[], title, body, mediaIds[],
 │   platformOptions{}, publishTime, flowId? }
 ▼
┌────────────────────────────────────────────────┐
│ PublishController.create()                     │
│ - zod validate qua CreatePublishDto            │
│ - extract userId từ JWT                        │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│ PublishService.createBundle()                  │
│ 1. flowId = flowId || cuid()                   │
│ 2. for each accountId:                         │
│    - load account                              │
│    - getProvider(account.platform, mode)       │
│    - provider.validate(content, account)       │
│    - create PublishRecord(status=PENDING)      │
│ 3. dispatchBundle(records)                     │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│ PublishDispatcher.dispatch(records)            │
│                                                │
│ For each record:                               │
│   if publishTime - now <= 5s:                  │
│     enqueue('publish:immediate', recordId)     │
│     status = DISPATCHED                        │
│   else:                                        │
│     status = SCHEDULED                         │
│     (cron sẽ pick lúc đáo hạn)                 │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│ BullMQ worker: ImmediatePublishConsumer        │
│ - load record + account                        │
│ - provider = providerFor(account)              │
│ - if account.publishMode == API:               │
│     ApiPublishProvider.publish(record)         │
│ - if account.publishMode == AUTOMATION:        │
│     AutomationDispatcher.dispatch(record)      │
│ - if HYBRID:                                   │
│     try API → catch → fallback automation      │
└────────────────┬───────────────────────────────┘
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
   API path           Automation path
       │                   │
       ▼                   ▼
┌──────────────┐  ┌──────────────────────┐
│ YouTube/FB/  │  │ AutomationGateway WS │
│ IG/TikTok    │  │ → extension          │
│ HTTP SDK     │  │ → DOM action         │
└──────┬───────┘  └──────────┬───────────┘
       │                     │
       └──────────┬──────────┘
                  ▼
   ┌─────────────────────────────────┐
   │ PublishResult                   │
   │ { platformPostId, workLink }    │
   │                                 │
   │ status = PUBLISHED               │
   │ Emit publish.published event     │
   └─────────────────────────────────┘
                  ▼
   ┌─────────────────────────────────┐
   │ FinalizePublishConsumer         │
   │ - update record                 │
   │ - send notification              │
   │ - push WS to web (realtime UI)  │
   └─────────────────────────────────┘
```

## Request DTO

```ts
// apps/api/src/core/publish/publish.dto.ts
import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

export const CreatePublishDtoSchema = z.object({
  accountIds: z.array(z.string().cuid()).min(1).max(50)
    .describe('Danh sách account đăng — tối thiểu 1, tối đa 50'),
  title: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
  mediaIds: z.array(z.string().cuid()).max(20).default([]),
  platformOptions: z.record(z.string(), z.unknown()).optional()
    .describe('Override theo platform: { facebook: {...}, youtube: {...} }'),
  publishTime: z.coerce.date().default(() => new Date()),
  flowId: z.string().optional()
    .describe('Idempotent key — request lặp cùng flowId → ko tạo trùng'),
})
export class CreatePublishDto extends createZodDto(CreatePublishDtoSchema, 'CreatePublishDto') {}
```

## Service: PublishService

```ts
// apps/api/src/core/publish/publish.service.ts
@Injectable()
export class PublishService {
  constructor(
    private readonly accountRepo: SocialAccountRepository,
    private readonly recordRepo: PublishRecordRepository,
    private readonly dispatcher: PublishDispatcher,
    @Inject('PUBLISH_PROVIDERS')
    private readonly providers: Record<AccountPlatform, PublishProvider>,
  ) {}

  async createBundle(userId: string, dto: CreatePublishDto) {
    const flowId = dto.flowId ?? cuid()

    // Idempotent guard
    if (dto.flowId) {
      const existing = await this.recordRepo.listByFlowId(dto.flowId)
      if (existing.length > 0) {
        throw new AppException(ResponseCode.PublishFlowAlreadyExists, { flowId })
      }
    }

    const records: PublishRecord[] = []
    for (const accountId of dto.accountIds) {
      const account = await this.accountRepo.getById(accountId)
      if (!account || account.userId !== userId) {
        throw new AppException(ResponseCode.AccountNotFound, { accountId })
      }
      if (account.status !== 'ACTIVE') {
        throw new AppException(ResponseCode.AccountNotActive, { accountId, status: account.status })
      }

      const provider = this.providers[account.platform]
      const validation = await provider.validate(dto, account)
      if (!validation.success) {
        throw new AppException(ResponseCode.PublishContentInvalid, validation.errors)
      }

      const record = await this.recordRepo.create({
        userId,
        accountId,
        flowId,
        publishMode: account.publishMode,
        title: dto.title,
        body: dto.body,
        mediaIds: dto.mediaIds,
        platformOptions: dto.platformOptions ?? {},
        publishTime: dto.publishTime,
        status: 'PENDING',
      })
      records.push(record)
    }

    await this.dispatcher.dispatchBundle(records)
    return { flowId, records: records.map(r => PublishRecordVo.create(r)) }
  }
}
```

## Strategy: PublishProvider interface

```ts
// apps/api/src/core/publish/providers/base.ts
export interface PublishProvider {
  readonly platform: AccountPlatform

  /** Validate content trước khi tạo record */
  validate(dto: CreatePublishDto, account: SocialAccount): Promise<ValidationResult>

  /** Thực thi publish API. Return platformPostId + workLink khi thành công. */
  publish(record: PublishRecord, account: SocialAccount): Promise<PublishResult>

  /** (Optional) Update post đã publish (FB/YT) */
  updatePublished?(record: PublishRecord, account: SocialAccount): Promise<void>

  /** (Optional) Delete post */
  delete?(record: PublishRecord, account: SocialAccount): Promise<void>
}

export interface ValidationResult {
  success: boolean
  errors?: Record<string, string>
}

export interface PublishResult {
  platformPostId: string
  workLink: string
  metadata?: Record<string, unknown>
}
```

### Register providers

```ts
// apps/api/src/core/publish/publish.module.ts
@Module({
  providers: [
    YoutubeProvider,
    FacebookProvider,
    InstagramProvider,
    TiktokProvider,
    AutomationProvider,
    {
      provide: 'PUBLISH_PROVIDERS',
      useFactory: (yt, fb, ig, tt, auto) => ({
        YOUTUBE: yt,
        FACEBOOK: fb,
        INSTAGRAM: ig,
        TIKTOK: tt,
        // Khi mode = AUTOMATION, dispatcher route sang AutomationProvider
        // bất kể platform là gì
        AUTOMATION: auto,
      }),
      inject: [YoutubeProvider, FacebookProvider, InstagramProvider, TiktokProvider, AutomationProvider],
    },
  ],
})
export class PublishModule {}
```

## Dispatcher logic

```ts
// apps/api/src/core/publish/publish.dispatcher.ts
@Injectable()
export class PublishDispatcher {
  private readonly IMMEDIATE_TOLERANCE_MS = 5_000

  constructor(
    @InjectQueue('publish:immediate') private readonly immediateQueue: Queue,
    private readonly recordRepo: PublishRecordRepository,
  ) {}

  async dispatchBundle(records: PublishRecord[]) {
    const now = Date.now()
    for (const r of records) {
      if (r.publishTime.getTime() - now <= this.IMMEDIATE_TOLERANCE_MS) {
        await this.recordRepo.updateStatus(r.id, 'DISPATCHED')
        await this.immediateQueue.add(
          'publish',
          { recordId: r.id },
          {
            jobId: `publish:${r.id}`,   // idempotent
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        )
      } else {
        await this.recordRepo.updateStatus(r.id, 'SCHEDULED')
        // Scheduler cron sẽ pick
      }
    }
  }
}
```

## Consumer

```ts
// apps/api/src/core/publish/consumers/immediate.consumer.ts
@Processor('publish:immediate')
export class ImmediatePublishConsumer extends WorkerHost {
  constructor(
    private readonly recordRepo: PublishRecordRepository,
    private readonly accountRepo: SocialAccountRepository,
    private readonly providerResolver: PublishProviderResolver,
    private readonly eventBus: EventBus,
  ) { super() }

  async process(job: Job<{ recordId: string }>) {
    const record = await this.recordRepo.getById(job.data.recordId)
    if (!record) throw new Error('record not found')
    const account = await this.accountRepo.getById(record.accountId)
    if (!account) throw new Error('account not found')

    await this.recordRepo.updateStatus(record.id, 'IN_PROGRESS')

    const provider = this.providerResolver.resolve(account)
    const result = await provider.publish(record, account)

    await this.recordRepo.completePublish(record.id, result)

    this.eventBus.publish(new PostPublishedEvent(record.id, result))
  }
}
```

## Error handling

```ts
// Trong provider:
async publish(record, account): Promise<PublishResult> {
  try {
    const res = await this.youtube.videos.insert({...})
    return { platformPostId: res.id, workLink: `https://youtu.be/${res.id}` }
  } catch (err) {
    if (isOAuthExpired(err)) {
      await this.tokenRefresher.refresh(account)
      throw new RetryableError('token refreshed, retry')   // BullMQ retry
    }
    if (isContentPolicyViolation(err)) {
      throw new AppException(ResponseCode.PublishRejectedByPlatform, {
        platform: 'YOUTUBE',
        reason: err.message,
      })
    }
    if (isQuotaExceeded(err)) {
      throw new AppException(ResponseCode.PublishQuotaExceeded)
    }
    throw err   // unknown → BullMQ retry
  }
}
```

Map exception → `PublishStatus`:

| Exception | Final status sau retry | Action |
|---|---|---|
| `RetryableError` | (retry tới khi pass hoặc hết attempts) | - |
| `PublishRejectedByPlatform` | `REJECTED` | Notify user, KHÔNG retry |
| `PublishQuotaExceeded` | `FAILED` | Notify user, retry sau quota window |
| Unknown | `FAILED` (sau 3 retry) | Log + alert |

## Webhook flow

Một số platform báo trạng thái async sau khi publish (vd TikTok review):

```
1. Provider.publish() returns IDs nhưng status = REVIEW_PENDING
2. Platform process → call webhook URL
3. WebhookController.handle(source, body)
   - verify signature
   - lưu vào WebhookEvent table (audit)
   - find PublishRecord by platformPostId
   - update status → PUBLISHED | REJECTED
   - emit event → notify user
```

## Scheduled publish

```ts
// apps/api/src/core/publish/scheduler/publish.scheduler.ts
@Injectable()
export class PublishScheduler {
  @Cron('* * * * *')   // mỗi 1 phút
  async tickScheduled() {
    const now = new Date()
    const window = new Date(now.getTime() + this.dispatcher.IMMEDIATE_TOLERANCE_MS)
    const due = await this.recordRepo.listScheduledDueBefore(window)

    for (const r of due) {
      await this.dispatcher.dispatchBundle([r])
    }
  }
}
```

## Retry strategy

| Loại lỗi | Retry? | Backoff |
|---|---|---|
| Network timeout, 5xx từ platform | ✅ | Exponential 1s, 5s, 30s — max 3 lần |
| OAuth 401 token expired | ✅ + refresh | Sau refresh, 0s delay |
| Rate limit 429 | ✅ | Delay theo `Retry-After` header |
| Content rejected | ❌ | - |
| Account suspended | ❌ + mark account `SUSPENDED` | - |

## Idempotent guarantees

- `flowId` ở DTO: client gửi cùng flowId → ko tạo bundle mới
- `jobId` BullMQ = `publish:{recordId}` → dù enqueue 2 lần cùng recordId, BullMQ chỉ chạy 1
- Provider: trước khi insert, kiểm tra `record.platformPostId` đã có chưa → skip publish (recovery sau crash)

## Multi-platform 1 bundle

User đăng 1 video lên YT + TT + FB cùng lúc:

```
POST /api/publish/create {
  accountIds: ['acc_yt_1','acc_tt_1','acc_fb_1'],
  body: 'Hello world',
  mediaIds: ['m_vid_1'],
  platformOptions: {
    YOUTUBE: { categoryId: '22', privacyStatus: 'public' },
    TIKTOK: { privacyLevel: 'PUBLIC_TO_EVERYONE', disableComment: false },
    FACEBOOK: { contentCategory: 'post' },
  },
  publishTime: '2026-05-16T10:00:00Z'
}

→ 3 records cùng flowId="bundle_xxx"
→ 3 worker jobs parallel
→ Web UI hiển thị 3 progress bar
```

## Tài liệu liên quan

- [03-data-model.md](03-data-model.md) — `PublishRecord` schema
- [05-automation-extension.md](05-automation-extension.md) — Automation path chi tiết
- [platforms/](platforms/) — quirk từng platform
- [.claude/rules/error-handling.md](../.claude/rules/error-handling.md) — AppException + ResponseCode
