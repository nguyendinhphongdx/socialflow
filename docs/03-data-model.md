---
title: Data model
description: Prisma schema, entity relationships, indexing strategy
audience: [developer, ai-agent]
---

# Data model

Postgres 16 + Prisma 5. File schema sống ở `packages/prisma/schema.prisma`.

## Convention chung

- **Primary key**: `cuid()` string (`id @id @default(cuid())`)
- **Timestamps**: `createdAt @default(now())`, `updatedAt @updatedAt`
- **Soft delete**: `deletedAt DateTime?` (KHÔNG hard delete với entity user-facing)
- **Naming**: model singular PascalCase (`User`, `PublishRecord`); field camelCase
- **Enum**: prefix theo domain (`PublishStatus`, `AccountPlatform`)
- **Index**: thêm `@@index` cho mọi field filter trong query thường gặp
- **JSON field**: dùng khi schema động (vd `platformOptions`); strongly-typed bằng zod ở app layer

## Full schema sketch

```prisma
// packages/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER & AUTH
// ============================================

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  emailVerified Boolean  @default(false)
  passwordHash String?   // null nếu chỉ OAuth
  name         String?
  avatarUrl    String?
  locale       String    @default("vi")
  role         UserRole  @default(USER)

  // Quota
  planTier     PlanTier  @default(FREE)
  planExpiry   DateTime?
  aiCredits    Int       @default(100)   // refresh hàng tháng

  // Relations
  accounts     SocialAccount[]
  groups       AccountGroup[]
  publishRecords PublishRecord[]
  drafts       Draft[]
  agents       AutomationAgent[]
  notifications Notification[]
  apiKeys      ApiKey[]
  sessions     Session[]

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  @@index([email])
  @@index([deletedAt])
}

enum UserRole { USER  ADMIN }
enum PlanTier { FREE  PRO  BUSINESS  ENTERPRISE }

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String   @unique     // hashed
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model ApiKey {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  keyHash      String   @unique
  prefix       String   // 8 chars hiển thị (sf_XXXXXX...)
  name         String
  lastUsedAt   DateTime?
  expiresAt    DateTime?
  revokedAt    DateTime?
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([keyHash])
}

// ============================================
// SOCIAL ACCOUNTS (platform connections)
// ============================================

model SocialAccount {
  id             String    @id @default(cuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  platform       AccountPlatform
  platformUid    String              // user/page/channel ID trên platform
  displayName    String              // tên hiển thị
  avatarUrl      String?
  publishMode    PublishMode @default(API)

  // API mode credentials
  accessToken    String?   @db.Text  // encrypted
  refreshToken   String?   @db.Text  // encrypted
  tokenExpiresAt DateTime?
  scopes         String[]            // OAuth scopes granted

  // Automation mode
  agentId        String?
  agent          AutomationAgent? @relation(fields: [agentId], references: [id])

  // Group
  groupId        String?
  group          AccountGroup? @relation(fields: [groupId], references: [id])

  // Status
  status         AccountStatus @default(ACTIVE)
  lastSyncAt     DateTime?
  metadata       Json?               // platform-specific (vd FB page category)

  // Relations
  publishRecords PublishRecord[]
  comments       Comment[]
  insights       AccountInsight[]

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  @@unique([userId, platform, platformUid])
  @@index([userId, platform])
  @@index([status])
  @@index([tokenExpiresAt])
}

enum AccountPlatform {
  YOUTUBE
  FACEBOOK
  INSTAGRAM
  TIKTOK
  // Future: TWITTER, LINKEDIN, ZALO
}

enum PublishMode {
  API           // OAuth, server-to-server
  AUTOMATION    // Browser extension
  HYBRID        // API default, fallback automation
}

enum AccountStatus {
  ACTIVE
  TOKEN_EXPIRED
  REVOKED
  SUSPENDED
}

model AccountGroup {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  color        String?
  isDefault    Boolean  @default(false)
  accounts     SocialAccount[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  @@index([userId])
}

// ============================================
// AUTOMATION (Browser Extension)
// ============================================

model AutomationAgent {
  id           String     @id @default(cuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  type         AgentType  @default(EXTENSION)
  pairCode     String?    @unique     // 6-digit, TTL 5 phút
  pairCodeExpiresAt DateTime?
  agentToken   String?    @unique     // hashed long-lived JWT
  publicId     String     @unique @default(cuid())   // hiển thị trong popup

  // Runtime state
  os           String?
  browserName  String?
  version      String?
  capabilities String[]   // ['youtube','facebook','tiktok','instagram','ffmpeg']
  online       Boolean    @default(false)
  lastSeenAt   DateTime?

  // Relations
  accounts     SocialAccount[]
  tasks        AutomationTask[]

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  revokedAt    DateTime?

  @@index([userId])
  @@index([online, lastSeenAt])
}

enum AgentType { EXTENSION  DESKTOP }

model AutomationTask {
  id           String    @id @default(cuid())
  agentId      String
  agent        AutomationAgent @relation(fields: [agentId], references: [id], onDelete: Cascade)
  publishRecordId String?
  publishRecord PublishRecord? @relation(fields: [publishRecordId], references: [id])

  command      String              // 'PUBLISH_POST' | 'FETCH_COMMENTS' | ...
  payload      Json
  status       AutomationTaskStatus @default(PENDING)
  stage        String?             // 'downloading' | 'uploading' | ...
  progress     Int       @default(0)
  result       Json?
  errorMessage String?
  errorScreenshotUrl String?

  dispatchedAt DateTime?
  acknowledgedAt DateTime?
  completedAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([agentId, status])
  @@index([publishRecordId])
}

enum AutomationTaskStatus {
  PENDING
  DISPATCHED
  ACKNOWLEDGED
  IN_PROGRESS
  SUCCESS
  FAILED
  CANCELLED
  TIMEOUT
}

// ============================================
// MEDIA & CONTENT
// ============================================

model MediaAsset {
  id           String     @id @default(cuid())
  userId       String
  type         MediaType
  filename     String
  mimeType     String
  sizeBytes    Int
  durationMs   Int?              // cho video/audio
  width        Int?
  height       Int?
  r2Key        String     @unique
  r2Url        String              // public URL (R2 custom domain)
  thumbnailUrl String?
  source       MediaSource @default(UPLOAD)
  aiGenJobId   String?             // nếu source=AI_GEN
  metadata     Json?

  createdAt    DateTime   @default(now())
  deletedAt    DateTime?

  @@index([userId, type])
  @@index([deletedAt])
}

enum MediaType  { IMAGE  VIDEO  AUDIO  TEXT }
enum MediaSource { UPLOAD  AI_GEN  EXTERNAL_URL }

model Draft {
  id           String     @id @default(cuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  title        String?
  body         String?    @db.Text
  mediaIds     String[]            // FK lỏng tới MediaAsset
  platformOptions Json?            // per-platform override (caption, hashtags, privacy)
  tags         String[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  deletedAt    DateTime?

  @@index([userId])
}

// ============================================
// PUBLISH
// ============================================

model PublishRecord {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId    String
  account      SocialAccount @relation(fields: [accountId], references: [id])

  // Bundle id — nhiều record cùng 1 lần publish multi-platform
  flowId       String?       @db.Text

  // Mode snapshot
  publishMode  PublishMode

  // Content
  title        String?
  body         String?       @db.Text
  mediaIds     String[]
  platformOptions Json?      // strongly-typed in app layer (per platform)

  // Timing
  publishTime  DateTime              // scheduled time
  publishedAt  DateTime?
  expiresAt    DateTime?             // optional auto-delete

  // Status
  status       PublishStatus @default(PENDING)
  stage        String?               // free-form (provider-specific progress)
  errorMessage String?
  retryCount   Int           @default(0)

  // Platform-specific result
  platformPostId String?             // ID trên platform sau khi publish
  workLink     String?               // URL public của post

  // Automation specific
  automationTasks AutomationTask[]

  // Analytics rollup
  insights     PostInsight[]

  // Relations
  comments     Comment[]

  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  deletedAt    DateTime?

  @@index([userId, status])
  @@index([accountId, status])
  @@index([publishTime, status])
  @@index([flowId])
  @@index([platformPostId])
}

enum PublishStatus {
  PENDING           // mới tạo, chưa enqueue
  SCHEDULED         // đợi tới publishTime
  WAITING_AGENT     // automation mode, agent offline
  DISPATCHED        // đã push vào queue/agent
  IN_PROGRESS       // provider đang xử lý
  REVIEW_PENDING    // platform đang review (TT/Douyin/B站)
  PUBLISHED         // thành công
  FAILED            // lỗi cuối cùng (sau retry)
  CANCELLED         // user cancel
  REJECTED          // platform reject (content policy)
}

// ============================================
// ENGAGEMENT
// ============================================

model Comment {
  id             String    @id @default(cuid())
  accountId      String
  account        SocialAccount @relation(fields: [accountId], references: [id])
  publishRecordId String?
  publishRecord  PublishRecord? @relation(fields: [publishRecordId], references: [id])

  platformCommentId String              // ID comment trên platform
  platformPostId    String?
  authorPlatformId  String?
  authorName        String?
  authorAvatar      String?
  text              String   @db.Text
  parentCommentId   String?            // reply chain

  sentiment    Sentiment?            // AI scored
  intent       CommentIntent?        // 'question' | 'purchase' | 'complaint' | ...
  isHidden     Boolean   @default(false)
  isReplied    Boolean   @default(false)

  publishedAt  DateTime
  fetchedAt    DateTime  @default(now())

  replies      CommentReply[]

  @@unique([accountId, platformCommentId])
  @@index([accountId, publishedAt])
  @@index([publishRecordId])
  @@index([isReplied])
}

enum Sentiment       { POSITIVE  NEUTRAL  NEGATIVE }
enum CommentIntent   { QUESTION  PURCHASE  COMPLAINT  PRAISE  SPAM  OTHER }

model CommentReply {
  id           String   @id @default(cuid())
  commentId    String
  comment      Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  body         String   @db.Text
  source       ReplySource    // 'AI_AUTO' | 'AI_DRAFT_HUMAN' | 'HUMAN'
  status       PublishStatus  @default(PENDING)
  platformReplyId String?
  errorMessage String?
  publishedAt  DateTime?
  createdAt    DateTime @default(now())

  @@index([commentId])
}

enum ReplySource { AI_AUTO  AI_DRAFT_HUMAN  HUMAN }

model BrandKeyword {
  id           String   @id @default(cuid())
  userId       String
  keyword      String
  isRegex      Boolean  @default(false)
  notifyEmail  Boolean  @default(true)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@index([userId, active])
}

model BrandMention {
  id           String   @id @default(cuid())
  userId       String
  keyword      String
  platform     AccountPlatform
  postUrl      String
  authorName   String?
  text         String   @db.Text
  fetchedAt    DateTime @default(now())
  acknowledged Boolean  @default(false)

  @@index([userId, acknowledged])
}

// ============================================
// AI & CREDITS
// ============================================

model AiJob {
  id           String      @id @default(cuid())
  userId       String
  type         AiJobType
  provider     String              // 'openai' | 'anthropic' | 'replicate' | 'veo'
  model        String              // 'gpt-4o' | 'flux-schnell' | ...
  input        Json
  output       Json?
  status       AiJobStatus @default(PENDING)
  errorMessage String?
  costCredits  Int?
  durationMs   Int?
  createdAt    DateTime    @default(now())
  completedAt  DateTime?

  @@index([userId, type])
  @@index([status])
}

enum AiJobType    { TEXT_GEN  IMAGE_GEN  VIDEO_GEN  VIDEO_EDIT  TRANSCRIBE  TRANSLATE }
enum AiJobStatus  { PENDING  RUNNING  SUCCESS  FAILED  CANCELLED }

model CreditTransaction {
  id           String   @id @default(cuid())
  userId       String
  amount       Int                  // dương = nạp, âm = trừ
  reason       String               // 'AI_TEXT_GEN' | 'AI_VIDEO_GEN' | 'TOPUP' | 'REFUND' | 'MONTHLY_GRANT'
  refId        String?              // FK lỏng (AiJob.id, Payment.id...)
  balanceAfter Int
  createdAt    DateTime @default(now())

  @@index([userId, createdAt])
}

// ============================================
// ANALYTICS
// ============================================

model PostInsight {
  id           String   @id @default(cuid())
  publishRecordId String
  publishRecord PublishRecord @relation(fields: [publishRecordId], references: [id], onDelete: Cascade)
  snapshotAt   DateTime @default(now())

  impressions  Int @default(0)
  reach        Int @default(0)
  likes        Int @default(0)
  comments     Int @default(0)
  shares       Int @default(0)
  saves        Int @default(0)
  views        Int @default(0)             // video
  watchTimeMs  Int @default(0)             // video

  raw          Json?                        // raw platform metric

  @@unique([publishRecordId, snapshotAt])
  @@index([publishRecordId])
}

model AccountInsight {
  id           String   @id @default(cuid())
  accountId    String
  account      SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  snapshotAt   DateTime
  followers    Int
  following    Int?
  totalPosts   Int?
  raw          Json?

  @@unique([accountId, snapshotAt])
  @@index([accountId, snapshotAt])
}

// ============================================
// NOTIFICATION & FEATURE FLAG
// ============================================

model Notification {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type         String              // 'PUBLISH_SUCCESS' | 'TOKEN_EXPIRED' | 'NEW_COMMENT'
  title        String
  body         String   @db.Text
  payload      Json?
  readAt       DateTime?
  createdAt    DateTime @default(now())

  @@index([userId, readAt])
}

model FeatureFlag {
  key          String   @id            // 'F-405-batch-gen'
  enabled      Boolean  @default(false)
  rolloutPct   Int      @default(0)    // 0-100
  userAllowlist String[]               // user IDs override
  description  String?
  updatedAt    DateTime @updatedAt
}

// ============================================
// WEBHOOK (incoming)
// ============================================

model WebhookEvent {
  id           String   @id @default(cuid())
  source       String              // 'tiktok' | 'facebook' | 'youtube'
  signature    String?
  headers      Json
  body         Json
  processed    Boolean  @default(false)
  errorMessage String?
  createdAt    DateTime @default(now())
  processedAt  DateTime?

  @@index([source, processed])
  @@index([createdAt])
}
```

## Index strategy

| Pattern truy vấn | Index |
|---|---|
| User login by email | `User.email` |
| List user accounts theo platform | `SocialAccount (userId, platform)` |
| Cron quét token sắp hết hạn | `SocialAccount.tokenExpiresAt` |
| Cron tìm publish tới hạn | `PublishRecord (publishTime, status)` |
| Hiển thị record của user theo status | `PublishRecord (userId, status)` |
| Webhook lookup theo platformPostId | `PublishRecord.platformPostId` |
| Bundle record theo flowId | `PublishRecord.flowId` |
| Comment chưa reply | `Comment.isReplied` |
| Dispatch task tới agent | `AutomationTask (agentId, status)` |
| User credit transaction history | `CreditTransaction (userId, createdAt)` |

## Migration strategy

- **Mỗi PR có schema change** → 1 migration file mới qua `pnpm prisma migrate dev --name <desc>`
- **Production**: chạy `prisma migrate deploy` trong CI/CD step, KHÔNG dùng `migrate dev`
- **Breaking change**: deploy 2 bước (add new field → backfill → drop old field)
- **Backfill data**: tạo migration thuần SQL (`prisma migrate dev --create-only`), edit SQL tay
- **Never** `prisma db push` ở production

## Encryption

Field cần encrypt at rest:

- `SocialAccount.accessToken` / `refreshToken`
- `AutomationAgent.agentToken`
- `ApiKey.keyHash` (đã hash, không decrypt)

Dùng AES-256-GCM với key từ env `ENCRYPTION_KEY`. Helper ở `packages/common/crypto.ts`.

## Soft delete query helper

Mọi service query phải tự filter `deletedAt: null`:

```ts
// ❌ Sai
const account = await this.prisma.socialAccount.findUnique({ where: { id } })

// ✅ Đúng — qua repository wrapper
const account = await this.accountRepo.getById(id)
// repository internally: where: { id, deletedAt: null }
```

Cân nhắc dùng [Prisma extension](https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions) để auto-filter — đề xuất ADR khi triển khai.
