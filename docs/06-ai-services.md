---
title: AI services
description: AI multi-provider gateway, content generation, video/image gen
audience: [developer, ai-agent]
---

# AI services

`apps/ai` là NestJS service riêng, expose REST cho `apps/api` qua internal HTTP (header `x-internal-token`).

## Service responsibilities

| Module | Mô tả |
|---|---|
| **chat** | Text generation (caption, title, hashtag, idea) |
| **adapt** | Adapt 1 nội dung → variant theo platform |
| **image** | Image generation (DALL-E, Flux, Imagen) |
| **video** | Video generation (Veo, Seedance, Replicate) |
| **transcribe** | Audio/video → text |
| **translate** | Multi-language translation |
| **agent** | LLM agent loop với tool calling (advanced) |

## Provider abstraction

Không hard-code provider trong service — dùng strategy pattern:

```ts
// apps/ai/src/core/providers/text/base.ts
export interface TextGenProvider {
  readonly name: 'openai' | 'anthropic' | 'gemini'
  readonly capabilities: TextCapability[]

  generate(input: TextGenInput): Promise<TextGenOutput>
  stream(input: TextGenInput): AsyncIterable<TextGenChunk>
}

export interface TextGenInput {
  model: string
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  responseFormat?: 'text' | 'json'
  jsonSchema?: object
}
```

Tương tự cho `ImageGenProvider`, `VideoGenProvider`.

### Provider registry

```ts
// apps/ai/src/core/providers/registry.ts
@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly openai: OpenAIProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly gemini: GeminiProvider,
    private readonly replicate: ReplicateProvider,
  ) {}

  textProvider(name: string): TextGenProvider {
    switch (name) {
      case 'openai': return this.openai
      case 'anthropic': return this.anthropic
      case 'gemini': return this.gemini
      default: throw new AppException(ResponseCode.AiProviderUnknown, { name })
    }
  }

  // ... image / video
}
```

### Model config in DB

```prisma
model AiModelConfig {
  id          String   @id @default(cuid())
  type        AiJobType        // TEXT_GEN | IMAGE_GEN | VIDEO_GEN
  provider    String
  model       String           // 'gpt-4o', 'claude-haiku-4-5-20251001', 'flux-schnell'
  enabled     Boolean  @default(true)
  costCredits Int              // credit/call hoặc /1M token
  priority    Int      @default(0)  // routing priority
  config      Json             // provider-specific (vd Veo aspectRatio default)
  updatedAt   DateTime @updatedAt

  @@unique([provider, model])
  @@index([type, enabled])
}
```

→ Admin có thể bật/tắt model, đổi cost, route traffic mà không cần deploy.

## Content generation flow

### Text gen (caption, hashtag)

```ts
// apps/ai/src/core/chat/chat.service.ts
@Injectable()
export class ChatService {
  async generateCaption(input: CaptionInput, userId: string): Promise<CaptionOutput> {
    // 1. Check user quota
    const quota = await this.creditService.check(userId, 'TEXT_GEN')
    if (!quota.ok) throw new AppException(ResponseCode.AiQuotaExceeded)

    // 2. Pick model
    const cfg = await this.aiModelRepo.pickByType('TEXT_GEN')
    const provider = this.registry.textProvider(cfg.provider)

    // 3. Create job record
    const job = await this.aiJobRepo.create({
      userId, type: 'TEXT_GEN', provider: cfg.provider, model: cfg.model,
      input, status: 'RUNNING',
    })

    try {
      // 4. Build prompt
      const messages = this.buildCaptionMessages(input)

      // 5. Call provider
      const output = await provider.generate({
        model: cfg.model,
        prompt: messages.user,
        systemPrompt: messages.system,
        maxTokens: 500,
        temperature: 0.7,
      })

      // 6. Parse + validate
      const parsed = this.parseCaption(output.text)

      // 7. Charge credits
      await this.creditService.charge(userId, cfg.costCredits, {
        reason: 'AI_TEXT_GEN', refId: job.id,
      })

      // 8. Complete job
      await this.aiJobRepo.complete(job.id, parsed, output.usage)
      return parsed
    } catch (err) {
      await this.aiJobRepo.fail(job.id, err)
      throw err
    }
  }
}
```

### Adapt content theo platform

Mỗi platform có constraint khác nhau:

| Platform | Title | Caption max | Hashtag style | Tone |
|---|---|---|---|---|
| YouTube | ≤100 char | description ≤5000 | `#tag` rời | Informative |
| Facebook | - | ≤63K (đề xuất ≤500) | optional | Conversational |
| Instagram | - | ≤2200 | nhiều, theo cluster | Visual storytelling |
| TikTok | - | ≤300 | inline `#tag` | Trendy, ngắn |

```ts
async adaptToPlatform(content: string, platform: AccountPlatform): Promise<AdaptedContent> {
  const prompt = `
Adapt nội dung sau cho ${platform}.
Constraints:
${this.platformConstraints[platform]}

Original:
${content}

Output JSON: { title?, caption, hashtags[] }
  `
  const out = await provider.generate({
    prompt, responseFormat: 'json', jsonSchema: AdaptedContentSchema,
  })
  return JSON.parse(out.text)
}
```

### Image gen

```ts
// apps/ai/src/core/image/image.service.ts
async generateImage(input: ImageGenInput, userId: string) {
  const job = await this.aiJobRepo.create({...})

  // Enqueue → return jobId ngay, không block HTTP request
  await this.imageQueue.add('gen', { jobId: job.id, input })

  return { jobId: job.id, status: 'PENDING' }
}

// Consumer
@Processor('ai:image-gen')
class ImageGenConsumer {
  async process(job) {
    const provider = this.registry.imageProvider(...)
    const result = await provider.generate(job.data.input)

    // Save image to R2
    const r2Key = `ai-gen/${job.data.jobId}.png`
    await this.storage.uploadFromUrl(r2Key, result.imageUrl)

    // Create MediaAsset
    const media = await this.mediaRepo.create({
      userId: job.data.userId,
      type: 'IMAGE',
      source: 'AI_GEN',
      aiGenJobId: job.data.jobId,
      r2Key,
      r2Url: this.storage.publicUrl(r2Key),
      ...
    })

    await this.aiJobRepo.complete(job.data.jobId, { mediaId: media.id })

    // Push WS to web: user thấy ảnh xuất hiện trong gallery
    this.eventBus.publish(new AiJobCompletedEvent(job.data.jobId))
  }
}
```

### Video gen

Phức tạp hơn: long-running (3-10 phút), cần poll provider:

```ts
// apps/ai/src/core/video/video.service.ts
async generateVideo(input: VideoGenInput, userId: string) {
  const job = await this.aiJobRepo.create({...})
  await this.videoQueue.add('gen', { jobId: job.id, input })
  return { jobId: job.id, status: 'PENDING' }
}

// Consumer
@Processor('ai:video-gen')
class VideoGenConsumer {
  async process(job) {
    const provider = this.registry.videoProvider(...)

    // 1. Submit
    const remoteJobId = await provider.submit(job.data.input)

    // 2. Poll (delegate to scheduler)
    await this.videoPollQueue.add(
      'poll',
      { localJobId: job.data.jobId, remoteJobId, provider: provider.name },
      { delay: 10_000 },  // poll mỗi 10s
    )
  }
}

@Processor('ai:video-poll')
class VideoPollConsumer {
  async process(job) {
    const provider = this.registry.videoProvider(job.data.provider)
    const status = await provider.checkStatus(job.data.remoteJobId)

    if (status.state === 'pending') {
      // Re-enqueue
      throw new RetryableError('still pending')   // BullMQ retry với delay
    }
    if (status.state === 'success') {
      // Download → R2 → MediaAsset → complete job
      await this.handleSuccess(job.data.localJobId, status.videoUrl)
    }
    if (status.state === 'failed') {
      await this.aiJobRepo.fail(job.data.localJobId, status.error)
    }
  }
}
```

## Credit system

```ts
// apps/api/src/core/credits/credits.service.ts
async check(userId: string, jobType: AiJobType): Promise<{ ok: boolean, balance: number }> {
  const user = await this.userRepo.getById(userId)
  const cfg = await this.aiModelRepo.pickByType(jobType)
  return { ok: user.aiCredits >= cfg.costCredits, balance: user.aiCredits }
}

async charge(userId: string, amount: number, meta: { reason: string, refId?: string }) {
  // Atomic update + transaction record
  return this.prisma.$transaction(async tx => {
    const user = await tx.user.update({
      where: { id: userId, aiCredits: { gte: amount } },
      data: { aiCredits: { decrement: amount } },
    })
    if (!user) throw new AppException(ResponseCode.AiQuotaExceeded)
    await tx.creditTransaction.create({
      data: { userId, amount: -amount, reason: meta.reason, refId: meta.refId, balanceAfter: user.aiCredits },
    })
    return user
  })
}
```

## Multi-provider routing strategy

Lý do nhiều provider:

1. **Cost**: model rẻ cho task đơn giản (`gpt-4o-mini` cho hashtag), model đắt cho task phức tạp (`gpt-4o` cho ý tưởng)
2. **Reliability**: provider 1 fail → fallback provider 2
3. **Capability**: Veo gen video, OpenAI không có
4. **Latency**: provider gần geo dùng trước

```ts
// Routing logic (đơn giản)
async pickProvider(type: AiJobType, options: { fast?: boolean, cheap?: boolean }): Promise<TextGenProvider> {
  const configs = await this.aiModelRepo.listEnabledByType(type)
  // Sort by priority + cost
  const sorted = configs.sort((a, b) => b.priority - a.priority)
  if (options.cheap) sorted.sort((a, b) => a.costCredits - b.costCredits)
  return this.registry.textProvider(sorted[0].provider)
}
```

Phase 4 đầu chỉ cần 1 provider chính + 1 fallback. Routing nâng cao là phase 5+.

## Prompt management

Để không hard-code prompt trong service:

```
apps/ai/src/prompts/
├── caption-instagram.md
├── caption-tiktok.md
├── caption-youtube.md
├── adapt-platform.md
├── reply-comment.md
└── system/
    └── tone-friendly.md
```

Load qua helper:

```ts
import { loadPrompt } from '@sociflow/common/prompts'

const systemPrompt = await loadPrompt('caption-instagram', {
  variables: { brand: 'NikeVN', tone: 'energetic' }
})
```

Sau này có thể move prompt vào DB để admin edit không cần deploy.

## Agent loop (advanced, phase 5+)

Cho user "tạo 5 post Instagram về sản phẩm X" — Agent tự:

1. Search internet (tool: webSearch)
2. Gen caption (tool: textGen)
3. Gen ảnh (tool: imageGen)
4. Tạo draft (tool: createDraft API)
5. Báo cáo

```ts
// apps/ai/src/core/agent/agent.service.ts
async runAgent(userId: string, instruction: string) {
  const tools = [webSearchTool, textGenTool, imageGenTool, createDraftTool]
  const llm = new AnthropicAgent({ model: 'claude-opus-4-7', tools })

  for await (const event of llm.run({ instruction })) {
    // Stream event qua WS về web
    this.ws.send(userId, event)
  }
}
```

Chi tiết design sau qua ADR.

## Internal API (api ↔ ai)

```
POST /internal/ai/chat/caption
POST /internal/ai/chat/adapt
POST /internal/ai/image/generate
POST /internal/ai/video/generate
GET  /internal/ai/jobs/:id              # poll status
POST /internal/ai/transcribe
```

Auth: `x-internal-token: <secret>` header.

Idempotency: client gửi `idempotencyKey` header, server cache result 24h.

## Cost tracking

Mọi provider call lưu:
- `AiJob.durationMs`
- `AiJob.costCredits` (charge user)
- `AiJob.output.usage` (raw token count từ provider)

Cron daily aggregate → dashboard admin:
- Cost per user
- Cost per platform / model
- ROI: cost AI vs revenue (paid plan)

## Tài liệu liên quan

- [02-architecture.md](02-architecture.md) — vì sao tách api/ai
- [03-data-model.md](03-data-model.md) — `AiJob`, `AiModelConfig`, `CreditTransaction`
- [01-features.md](01-features.md) — F-401 đến F-406
