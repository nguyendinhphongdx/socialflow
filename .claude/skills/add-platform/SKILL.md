---
name: add-platform
description: Tích hợp 1 platform mới (publish + engagement) đầy đủ. Use khi user yêu cầu "/add-platform xxx" hoặc "thêm platform". Tạo tất cả file: OAuth, provider, webhook, content-script, docs, test.
---

# Skill: add-platform

Workflow tích hợp 1 platform mới end-to-end. Sử dụng kết hợp với agent `platform-integrator`.

## Inputs

Hỏi user nếu thiếu:

1. **Platform name** (lowercase, vd: `linkedin`)
2. **API doc URL**
3. **OAuth scopes** cần thiết
4. **Có app review không?** Lead time bao lâu?
5. **Cần automation fallback?** (Y/N)
6. **Webhook support?** (Y/N — và URL setup)
7. **Engagement (comment/reply) qua API?** (Y/N)

## Output checklist

Sau khi run skill, các file/change này phải có:

### Schema & enum
- [ ] `packages/prisma/schema.prisma`: add value vào enum `AccountPlatform`
- [ ] Migration: `prisma migrate dev --name add-<platform>`

### Config
- [ ] `apps/api/src/config.ts`: add OAuth client ID/secret zod field
- [ ] `.env.example`: add `<PLATFORM>_CLIENT_ID`, `<PLATFORM>_CLIENT_SECRET`

### Auth/OAuth
- [ ] `apps/api/src/core/account/oauth/<platform>.oauth.ts`: getAuthorizeUrl + handleCallback
- [ ] `apps/api/src/core/account/oauth/<platform>.oauth.spec.ts`

### Publish provider
- [ ] `apps/api/src/core/publish/providers/<platform>.provider.ts`: implement PublishProvider
- [ ] `apps/api/src/core/publish/providers/<platform>.provider.spec.ts`
- [ ] Register vào `publish.module.ts` PUBLISH_PROVIDERS factory

### Engagement provider (nếu có API)
- [ ] `apps/api/src/core/engagement/providers/<platform>.provider.ts`
- [ ] Register vào `engagement.module.ts`

### Webhook (nếu có)
- [ ] `apps/api/src/core/webhook/<platform>.webhook.dto.ts`
- [ ] Handler trong `webhook.controller.ts`
- [ ] Signature verify

### ResponseCode
- [ ] Add module-specific codes vào `packages/common/src/response-code.ts`

### Extension content-script (nếu cần automation)
- [ ] `apps/extension/src/content-scripts/<platform>.ts`
- [ ] Update `manifest.json` content_scripts + host_permissions
- [ ] Default selectors seed: `packages/prisma/seed/automation-selectors.ts`

### Web UI
- [ ] Add platform icon: `apps/web/src/assets/platforms/<platform>.svg`
- [ ] Connect button: `apps/web/src/app/[lng]/accounts/components/ConnectButtons.tsx`
- [ ] Platform config: `apps/web/src/app/config/platConfig.ts` add row

### Documentation
- [ ] `docs/platforms/<platform>.md`: OAuth, API, constraints, automation, quirks
- [ ] Update `docs/INDEX.md`: link tới file mới
- [ ] Update `docs/01-features.md`: mark feature shipped

### Test
- [ ] Unit test cho provider (mock SDK)
- [ ] Integration test cho OAuth callback (nếu khả thi)
- [ ] Manual test checklist

## Step-by-step

### Step 1: Schema

```prisma
// packages/prisma/schema.prisma
enum AccountPlatform {
  YOUTUBE
  FACEBOOK
  INSTAGRAM
  TIKTOK
  XXX           // NEW
}
```

```bash
pnpm prisma migrate dev --name add-xxx-platform
```

### Step 2: Config

```ts
// apps/api/src/config.ts
export const ConfigSchema = z.object({
  // ...
  xxx: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string().url(),
  }),
})
```

```bash
# .env.example
XXX_CLIENT_ID=
XXX_CLIENT_SECRET=
XXX_REDIRECT_URI=https://api.sociflow.io/api/v1/auth/oauth/xxx/callback
```

### Step 3: OAuth service

Tạo `<platform>.oauth.ts` theo template `platform-integrator` agent.

### Step 4: Publish provider

Tạo `<platform>.provider.ts` theo template.

### Step 5: Register provider

```ts
// apps/api/src/core/publish/publish.module.ts
{
  provide: 'PUBLISH_PROVIDERS',
  useFactory: (yt, fb, ig, tt, xxx, auto) => ({
    YOUTUBE: yt, FACEBOOK: fb, INSTAGRAM: ig, TIKTOK: tt,
    XXX: xxx,   // NEW
    AUTOMATION: auto,
  }),
  inject: [..., XxxProvider, AutomationProvider],
}
```

### Step 6: Add ResponseCode

```ts
// packages/common/src/response-code.ts
export enum ResponseCode {
  // ... existing
  XxxAuthFailed = 14100,   // pick từ unused range
  XxxRateLimited = 14101,
}

export const ResponseMessage = {
  // ...
  [ResponseCode.XxxAuthFailed]: 'XXX authentication failed',
}
```

### Step 7: Docs

Tạo `docs/platforms/<platform>.md` theo template từ `docs/platforms/youtube.md`.

Update `docs/INDEX.md`:
```
| `platforms/xxx.md` | XXX integration | docs/platforms/xxx.md |
```

### Step 8: Web UI

```ts
// apps/web/src/app/config/platConfig.ts
export enum PlatType { ..., XXX = 'xxx' }

export const AccountPlatInfoMap = new Map<PlatType, IAccountPlatInfo>([
  // ... existing
  [PlatType.XXX, {
    themeColor: '#xxx',
    icon: '/assets/platforms/xxx.svg',
    name: directTrans('XXX'),
    url: 'https://xxx.com',
    pubTypes: new Set([PubType.VIDEO, PubType.ARTICLE]),
    commonPubParamsConfig: { titleMax: 200, desMax: 5000, imagesMax: 10 },
  }],
])
```

### Step 9: Extension (nếu cần)

Tạo `apps/extension/src/content-scripts/<platform>.ts` theo template từ `ext-developer` agent.

Update manifest:
```json
{
  "host_permissions": [..., "https://*.xxx.com/*"],
  "content_scripts": [
    ...,
    { "matches": ["https://*.xxx.com/upload*"], "js": ["content-scripts/xxx.js"] }
  ]
}
```

### Step 10: Verify

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm --filter @sociflow/api build
pnpm --filter @sociflow/extension build
```

Manual test (nếu test app available):
1. Click "Connect XXX" trên web → OAuth flow → connected
2. Compose post + chọn account XXX → publish → record PUBLISHED
3. Check `workLink` mở được post thật
4. (Nếu automation) Pair extension → publish via automation → success

## Notes

- App review: nhiều platform yêu cầu review 1-6 tuần. Submit sớm trong Phase 0 hoặc Phase 1.
- Sandbox/dev mode: thường có để test mà chưa cần review. Setup ngay.
- Rate limit: ghi rõ trong `docs/platforms/<platform>.md` để team biết.
