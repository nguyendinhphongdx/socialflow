---
title: Engagement
description: Comment fetch, AI auto-reply, brand monitoring
audience: [developer, ai-agent]
---

# Engagement

Tự động hoá tương tác với comment + theo dõi mention brand.

## Mục tiêu

1. **Fetch comment** từ platform về DB → user xem thống nhất 1 nơi
2. **AI auto-reply** comment theo tone của brand
3. **Brand monitoring** — track mention keyword trên các platform
4. **Comment mining** — phát hiện intent mua hàng / câu hỏi sản phẩm

## Comment fetch

### Cron-based polling

```ts
// apps/api/src/core/engagement/comment-fetcher.scheduler.ts
@Injectable()
export class CommentFetcherScheduler {
  @Cron('*/10 * * * *')   // mỗi 10 phút
  async tick() {
    const accounts = await this.accountRepo.listActiveByPlatforms([
      'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'TIKTOK',
    ])
    for (const acc of accounts) {
      await this.fetchQueue.add('fetch', { accountId: acc.id }, {
        jobId: `fetch-comments:${acc.id}`,  // idempotent
      })
    }
  }
}
```

### Fetch consumer

```ts
@Processor('engagement:fetch-comments')
class FetchCommentsConsumer {
  async process(job) {
    const account = await this.accountRepo.getById(job.data.accountId)
    const provider = this.providerResolver.resolve(account)

    // Lấy time cursor lần trước
    const lastFetchedAt = account.lastCommentFetchAt ?? subHours(new Date(), 24)

    // Fetch comments từ N post gần nhất
    const recentPosts = await this.publishRecordRepo.listRecentByAccount(account.id, 50)
    for (const post of recentPosts) {
      const comments = await provider.fetchComments(post, { since: lastFetchedAt })
      for (const c of comments) {
        await this.upsertComment(account, post, c)
      }
    }

    await this.accountRepo.updateLastFetch(account.id)
  }

  private async upsertComment(account, post, c) {
    const existing = await this.commentRepo.findByPlatformId(account.id, c.platformCommentId)
    if (existing) return

    // AI sentiment + intent (lightweight)
    const analysis = await this.aiClient.analyzeComment(c.text)

    await this.commentRepo.create({
      accountId: account.id,
      publishRecordId: post.id,
      platformCommentId: c.id,
      platformPostId: post.platformPostId,
      authorPlatformId: c.author.id,
      authorName: c.author.name,
      text: c.text,
      sentiment: analysis.sentiment,
      intent: analysis.intent,
      publishedAt: c.publishedAt,
    })

    // Trigger auto-reply nếu enabled
    if (await this.shouldAutoReply(account, c, analysis)) {
      await this.replyQueue.add('reply', { commentId: c.id })
    }
  }
}
```

### Provider interface

```ts
export interface CommentProvider {
  readonly platform: AccountPlatform
  fetchComments(post: PublishRecord, opts: { since: Date }): Promise<RawComment[]>
  postReply(account: SocialAccount, comment: Comment, body: string): Promise<{ platformReplyId: string }>
  hide?(account: SocialAccount, comment: Comment): Promise<void>
}
```

Implement riêng cho mỗi platform:
- `FacebookCommentProvider` (Graph API)
- `InstagramCommentProvider` (Graph API)
- `YoutubeCommentProvider` (YouTube Data API)
- `TiktokCommentProvider` (Display API + automation hybrid — TT API engagement giới hạn)

## AI auto-reply

### Reply policy

User config per-account:

```prisma
model EngagementPolicy {
  id           String   @id @default(cuid())
  accountId    String   @unique
  account      SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  autoReplyEnabled Boolean @default(false)
  autoReplyMode    ReplyMode @default(AI_DRAFT_HUMAN)
  replyToIntents   CommentIntent[]    // chỉ reply intent nào
  excludeKeywords  String[]
  tone             String              // 'friendly' | 'formal' | 'playful'
  signature        String?
  maxRepliesPerDay Int @default(50)

  updatedAt    DateTime @updatedAt
}

enum ReplyMode {
  AI_AUTO         // gen + post tự động
  AI_DRAFT_HUMAN  // gen draft, user approve trước khi post
  HUMAN           // chỉ tự viết
}
```

### Reply flow

```ts
// apps/api/src/core/engagement/consumers/reply.consumer.ts
@Processor('engagement:auto-reply')
class ReplyConsumer {
  async process(job) {
    const comment = await this.commentRepo.getById(job.data.commentId)
    const account = await this.accountRepo.getById(comment.accountId)
    const policy = await this.policyRepo.getByAccount(account.id)

    // Check rate limit
    const todayCount = await this.commentReplyRepo.countByAccountToday(account.id)
    if (todayCount >= policy.maxRepliesPerDay) {
      throw new AppException(ResponseCode.EngagementRateLimit)
    }

    // Gen reply qua AI
    const replyText = await this.aiClient.generateReply({
      comment: comment.text,
      tone: policy.tone,
      productContext: account.metadata?.brandContext,
      signature: policy.signature,
    })

    if (policy.autoReplyMode === 'AI_DRAFT_HUMAN') {
      // Lưu draft, notify user
      await this.commentReplyRepo.create({
        commentId: comment.id,
        body: replyText,
        source: 'AI_DRAFT_HUMAN',
        status: 'PENDING',   // user duyệt rồi mới publish
      })
      this.notify.send(account.userId, 'NEW_REPLY_DRAFT', { commentId: comment.id })
      return
    }

    // AI_AUTO mode: post luôn
    const provider = this.commentProviderResolver.resolve(account)
    const result = await provider.postReply(account, comment, replyText)

    await this.commentReplyRepo.create({
      commentId: comment.id,
      body: replyText,
      source: 'AI_AUTO',
      status: 'PUBLISHED',
      platformReplyId: result.platformReplyId,
      publishedAt: new Date(),
    })
    await this.commentRepo.markReplied(comment.id)
  }
}
```

## Comment mining (intent detection)

```ts
// AI prompt:
const ANALYZE_PROMPT = `
Phân tích comment sau và trả JSON:
- sentiment: POSITIVE | NEUTRAL | NEGATIVE
- intent: PURCHASE (hỏi mua/giá/link), QUESTION (hỏi thông tin), COMPLAINT, PRAISE, SPAM, OTHER
- summary: 1 câu < 20 từ

Comment: "{text}"
`
```

User filter dashboard "Show purchase intent" → list comment cần ưu tiên trả lời / chuyển sale.

## Brand monitoring

Track mention keyword across platform.

### Setup

```
User → /settings/brand-monitor → thêm keyword:
  - "NikeVN" (exact)
  - "/giày nike .*/i" (regex)
```

### Fetch loop

```ts
@Injectable()
export class BrandMonitorScheduler {
  @Cron('*/30 * * * *')
  async tick() {
    const users = await this.brandKeywordRepo.listUsersWithActiveKeywords()
    for (const userId of users) {
      const keywords = await this.brandKeywordRepo.listByUser(userId)
      for (const kw of keywords) {
        await this.searchQueue.add('search', { userId, keywordId: kw.id })
      }
    }
  }
}

@Processor('brand-monitor:search')
class BrandSearchConsumer {
  async process(job) {
    const kw = await this.brandKeywordRepo.getById(job.data.keywordId)

    // Multi-platform search
    const results = await Promise.allSettled([
      this.searchFacebook(kw),       // FB Pages public search (limited)
      this.searchInstagram(kw),      // IG hashtag search
      this.searchYoutube(kw),        // YT search API
      this.searchTiktok(kw),         // TT search via discovery
    ])

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const mention of result.value) {
          await this.upsertMention(kw, mention)
        }
      }
    }
  }

  private async upsertMention(kw, mention) {
    const existing = await this.mentionRepo.findByUrl(kw.userId, mention.url)
    if (existing) return

    await this.mentionRepo.create({
      userId: kw.userId,
      keyword: kw.keyword,
      platform: mention.platform,
      postUrl: mention.url,
      authorName: mention.author,
      text: mention.text,
    })

    if (kw.notifyEmail) {
      await this.notify.email(kw.userId, 'BRAND_MENTION', { keyword: kw.keyword, mention })
    }
  }
}
```

## Reply via automation

Khi `publishMode = AUTOMATION` cho account:

Reply không qua API mà qua extension:

```ts
// Backend
async postReply(account, comment, body) {
  if (account.publishMode === 'AUTOMATION') {
    return this.automationDispatcher.dispatch({
      command: 'POST_COMMENT',
      platform: account.platform,
      payload: { postUrl: comment.publishRecord.workLink, replyTo: comment.platformCommentId, body },
    })
  }
  return this.apiProvider.postReply(account, comment, body)
}
```

Extension content-script:

```ts
// content-scripts/facebook.ts
async function postComment({ postUrl, replyTo, body }) {
  // 1. Navigate
  if (!location.href.includes(postUrl)) location.href = postUrl
  await waitForSelector(SEL.commentList)

  // 2. Find original comment
  const target = findCommentByPlatformId(replyTo)
  if (!target) throw new Error('comment not found in DOM')

  // 3. Click Reply
  target.querySelector(SEL.replyButton)?.click()
  await sleep(500)

  // 4. Type
  await typeInto(target.querySelector(SEL.replyInput), body)

  // 5. Submit
  await humanDelay()
  target.querySelector(SEL.submitButton)?.click()

  // 6. Get reply ID
  await sleep(2000)
  const replyEl = findNewestReply(target)
  return { platformReplyId: replyEl.dataset.id }
}
```

## Rate limit per account

| Action | Default limit/day | Reason |
|---|---|---|
| Auto-reply | 50 | Avoid spam detection |
| Auto-like | 200 | Same |
| Auto-follow | 10 | TT/IG quick ban |
| Comment fetch | unlimited (read-only) | - |

Configurable per-user (Pro plan = higher).

## Notification flow

| Event | Channel |
|---|---|
| New comment with PURCHASE intent | In-app + email digest |
| Brand mention | In-app + email immediate |
| AI draft reply waiting | In-app |
| Auto-reply posted | In-app (silent) |
| Rate limit hit | In-app warning |

## Tài liệu liên quan

- [03-data-model.md](03-data-model.md) — `Comment`, `CommentReply`, `BrandKeyword`, `BrandMention`
- [06-ai-services.md](06-ai-services.md) — `analyzeComment`, `generateReply`
- [05-automation-extension.md](05-automation-extension.md) — automation comment post
