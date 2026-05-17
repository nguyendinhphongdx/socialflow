---
title: ADR-0010 BYOK — OAuth & AI credentials at workspace level
status: accepted
date: 2026-05-17
deciders: [founder]
---

# ADR-0010 — BYOK (Bring Your Own Keys) cho OAuth platform + AI provider

## Status

Accepted.

## Context

Sociflow hiện lưu OAuth platform credentials (Google/TikTok/FB Client ID + Secret) và AI provider keys (OpenAI/Anthropic) trong `.env`:
- Developer config — không thân thiện cho self-host admin (phải sửa file + restart)
- Single OAuth app cho mọi user → quota share + bắt buộc App Review trước launch
- Single AI provider key → user agency không track riêng được cost

Đối chiếu với competitor:
- **Buffer/Hootsuite**: single app model (chấp nhận App Review marathon)
- **AiToEarn**: dùng `api-key` module per-user, nhưng OAuth vẫn single
- **Self-hosted tools** (Plausible, Bitwarden): admin UI thay vì env

Sociflow là **solo dev + VN agency target market**:
- Pre-launch chưa pass App Review → cần unblock user
- Agency manage nhiều brand → muốn isolate OAuth app per brand
- Có quota OpenAI riêng → tránh share rate limit + tự track cost

Đồng thời, Sociflow có **2 cơ chế publishing co-exist** (xem [docs/05-automation-extension.md](../05-automation-extension.md)):
- **API mode**: OAuth access token → platform API call
- **AUTOMATION mode**: Chrome extension DOM scripting (không cần OAuth)
- **HYBRID mode**: API first, automation fallback

BYOK chỉ áp dụng cho API mode — automation không có OAuth app concept.

## Decision

Implement **3-layer credential fallback** cho cả OAuth (4 platform) và AI (OpenAI/Anthropic):

```
Lookup order khi cần credential:
1. WorkspaceCredential (workspace owner setup qua UI)
2. SystemCredential (admin global setup qua UI — self-host case)
3. .env defaults (Sociflow Cloud production)
4. Throw `CredentialNotConfigured`
```

**Scope**:
- Tách 2 entity: `OAuthCredential` (platform) + `AiCredential` (provider)
- Cùng pattern lookup chain, khác schema (OAuth có redirectUri/scopes, AI chỉ có apiKey + baseUrl)
- Encrypt secret AES-256-GCM (helper `@sociflow/common/crypto` đã có)
- Permission: chỉ `OWNER` hoặc `ADMIN` role workspace được manage credential
- Audit: `createdBy` + `updatedAt` track ai sửa

**Smart default per-platform** cho connect flow:
- YouTube → API recommended
- TikTok → AUTOMATION recommended pre-review
- Facebook/Instagram → HYBRID recommended
- User có thể override per-account

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| **Workspace only — bắt buộc BYOK** | Đơn giản, không cần App Review | Mất casual UX (mọi user phải setup) | Sociflow Cloud cần default cho user lười |
| **Workspace → .env** (skip System layer) | Đơn giản 2-layer | Self-host admin phải sửa env | Mất 1 use case quan trọng |
| **Single OAuth app + force App Review** | Standard SaaS | Launch chậm 2-6 tuần (TT), agency không có quota riêng | Không phù hợp solo dev pre-launch |
| **3-layer Workspace → System → .env** ✅ | Cover mọi use case (Cloud + self-host + agency) | Phức tạp hơn 1 layer | Effort acceptable cho lợi ích lớn |

## Architecture

### Schema

```prisma
enum CredentialScope {
  SYSTEM       // 1 row per platform/provider, admin global
  WORKSPACE    // workspace-level, owner manage
}

model OAuthCredential {
  id           String          @id @default(cuid())
  scope        CredentialScope
  workspaceId  String?         // null nếu SYSTEM
  workspace    Workspace?      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  platform     AccountPlatform
  clientId     String
  clientSecret String           // AES-256-GCM encrypted
  redirectUri  String           // user copy paste vào platform dev console
  scopes       String[]         // override default scopes nếu cần
  isActive     Boolean         @default(true)
  notes        String?          // "Brand X agency app"
  createdBy    String           // userId audit
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([scope, workspaceId, platform])
  @@index([workspaceId])
  @@map("oauth_credentials")
}

enum AiProvider {
  OPENAI
  ANTHROPIC
  GOOGLE_GEMINI     // future
}

model AiCredential {
  id           String          @id @default(cuid())
  scope        CredentialScope
  workspaceId  String?
  workspace    Workspace?      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  provider     AiProvider
  apiKey       String           // AES-256-GCM encrypted
  baseUrl      String?          // optional custom proxy (vd Cloudflare AI gateway)
  model        String?          // default model override (vd "gpt-4o-mini")
  isActive     Boolean         @default(true)
  monthlyBudgetUsd Decimal?     // optional cap — disable when exceeded
  monthSpentUsd    Decimal      @default(0)
  notes        String?
  createdBy    String
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([scope, workspaceId, provider])
  @@index([workspaceId])
  @@map("ai_credentials")
}
```

### Resolver service

```ts
@Injectable()
export class OAuthCredentialResolver {
  async resolve(platform: AccountPlatform, workspaceId: string): Promise<OAuthClientConfig> {
    // 1. Workspace BYOK
    const ws = await this.repo.findActive('WORKSPACE', workspaceId, platform)
    if (ws) return decryptAndMap(ws)

    // 2. System default (admin UI)
    const sys = await this.repo.findActive('SYSTEM', null, platform)
    if (sys) return decryptAndMap(sys)

    // 3. .env fallback
    const envConfig = this.config.oauth[platform.toLowerCase()]
    if (envConfig.clientId) return envConfig

    throw new AppException(ResponseCode.OAuthCredentialNotConfigured, { platform })
  }
}
```

`AiCredentialResolver` parallel pattern.

### Connect flow

`POST /social-accounts/connect/init` body:
```ts
{
  platform: 'YOUTUBE' | 'FACEBOOK' | ...,
  mode: 'API' | 'AUTOMATION' | 'HYBRID',
  returnUrl?: string,
}
```

Logic:
- Nếu `mode === 'AUTOMATION'` → return `{ requiresAgent: true, pairCode: '...' }`
- Nếu `mode === 'API' | 'HYBRID'`:
  - `OAuthCredentialResolver.resolve(platform, workspaceId)` — throw nếu chưa config
  - Generate state + return OAuth init URL với resolved clientId

### AI BYOK integration

Modify `apps/ai` AI providers:
- `OpenAiProvider.generate(input, credential)` — accept credential từ caller
- `AnthropicProvider.generate(input, credential)` — tương tự
- `AiService.generateCaption` (apps/api) — resolve workspace credential trước khi call internal AI

Budget tracking: sau mỗi gen call, increment `AiCredential.monthSpentUsd`. Reset monthly via cron. Khi exceed budget → throw `AiBudgetExceeded`.

### UI structure

**Workspace Settings → 3 tabs**:

1. **Connections** — list `SocialAccount`, badge `[API]` / `[AUTOMATION]` / `[HYBRID]`
2. **OAuth Credentials** — table 4 platform, mỗi row:
   - Status badge: `Default (env)` / `System` / `Workspace custom` / `Not configured`
   - Button "Configure" → modal form
   - Button "Reset to default" (xóa workspace row)
   - "Verify" button: test config bằng OAuth init dry-run
3. **AI Credentials** — table 2-3 provider (OpenAI, Anthropic, Gemini future):
   - Status + masked key (sf_xxx...last4)
   - Monthly budget + spent
   - Reset button

**System Admin Panel** (mới — chỉ user role ADMIN):
- `/admin/credentials` — same UI nhưng scope SYSTEM
- Visible khi `user.role === 'ADMIN'`

### Connect wizard

`/dashboard/accounts/new`:

```
Step 1: Platform picker (4 cards với icon + recommended badge)
Step 2: Mode picker
  ┌─ API mode      [Recommended cho YT, FB, IG]
  ├─ Automation    [Recommended cho TT pre-review]
  └─ Hybrid        [Max reliability]
Step 3a (API/Hybrid):
  - Check OAuth credential
  - Nếu chưa config → "Configure OAuth app trước" + link tab BYOK
  - Có → OAuth flow → callback
Step 3b (Automation/Hybrid):
  - Check agent paired
  - Chưa → pair code flow
  - Đã → activate
Step 4: Confirm + success
```

Smart default mode per platform:
```ts
const RECOMMENDED_MODE: Record<AccountPlatform, PublishMode> = {
  YOUTUBE: 'API',         // free tier ~6 video/day
  TIKTOK: 'AUTOMATION',   // pre-review default
  FACEBOOK: 'HYBRID',
  INSTAGRAM: 'HYBRID',
}
```

## Consequences

### Positive

- **Unblock launch** without App Review (user BYOK workaround)
- **Agency multi-brand** workspace isolation
- **Self-host admin** không cần sửa env
- **AI cost transparency** per-workspace + budget cap
- **White-label feel** — OAuth consent hiển thị brand của user

### Negative

- **+3 ngày effort** (25h estimate)
- **Support burden** khi user mis-configure OAuth app
- **Storage**: thêm 2 table + AES encrypt 2 field/row
- **Security**: thêm secret cần rotate khi key compromise
- Tutorial guide phải maintain cho 4 platform + 3 AI provider

### Mitigation

- **Setup guide per-platform** trong `docs/runbooks/oauth-setup-{platform}.md`
- **Verify endpoint** dry-run OAuth init trước khi save → catch typos sớm
- **Health check** cron weekly test credential vẫn hoạt động
- **Fail-soft**: nếu credential invalid → fallback chain layer dưới + warn user
- **Audit log**: lưu mọi thay đổi credential vào log table (follow-up)

## References

- [docs/05-automation-extension.md](../05-automation-extension.md) — API vs Automation duality
- [.claude/rules/security.md](../../.claude/rules/security.md) — secret management
- [packages/common/src/crypto.ts](../../packages/common/src/crypto.ts) — AES-256-GCM helper
- [ADR-0005](0005-auth-flow.md) — OAuth flow pattern
- [ADR-0008](0008-launch-readiness.md) — F-714 App Review (BYOK là workaround)
