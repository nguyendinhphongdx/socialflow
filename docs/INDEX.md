---
title: Sociflow Docs Index
description: Master index của toàn bộ documentation. Đọc file này TRƯỚC khi tìm docs khác.
audience: [ai-agent, developer]
last_updated: 2026-05-17
revision: 4 — runbooks Phase 2-6 + launch-checklist added
---

# Sociflow Documentation Index

> **Đây là file LOAD ĐẦU TIÊN khi agent cần tra cứu docs.** Mỗi entry có path, mô tả ngắn, keywords để search. Không đọc tuần tự — jump tới entry liên quan.

## Cấu trúc thư mục

```
sociflow/
├── README.md                       # Entry point dự án
├── CLAUDE.md                       # Hướng dẫn agent — đọc trước khi code
├── .mcp.json                       # MCP server config
├── docs/
│   ├── INDEX.md                    # File này
│   ├── mcp-setup.md                # Cách dùng MCP server tra docs
│   ├── 00-overview.md              # Vision, problem, target user
│   ├── 01-features.md              # Feature list MVP + Future
│   ├── 02-architecture.md          # System architecture, 2-service split
│   ├── 03-data-model.md            # Prisma schema, entities, relations
│   ├── 04-publish-flow.md          # Publish flow end-to-end (API path)
│   ├── 05-automation-extension.md  # Browser extension + WS protocol
│   ├── 06-ai-services.md           # AI multi-provider, content gen
│   ├── 07-engagement.md            # Comment, reply, brand monitor
│   ├── 08-api-conventions.md       # REST conventions, DTO/VO, errors
│   ├── 09-tech-stack.md            # Library choices + rationale
│   ├── 10-deployment.md            # Docker, R2, VPS, monitoring
│   ├── 11-roadmap.md               # 7.5 month plan
│   ├── 12-glossary.md              # Domain terms
│   ├── definition-of-done.md       # 3 mức done (code / feature / phase) — gate trước khi tick ✅
│   ├── platforms/                  # Platform-specific specs
│   │   ├── youtube.md
│   │   ├── facebook.md
│   │   ├── instagram.md
│   │   └── tiktok.md
│   └── decisions/                  # ADRs (architecture decision records)
│       ├── _template.md
│       └── 0001-*.md
│   └── runbooks/                  # Operational runbooks + smoke tests
│       ├── smoke-test-phase1.md   # YT publish E2E
│       ├── smoke-test-phase2.md   # FB + IG publish
│       ├── smoke-test-phase3.md   # Calendar + draft + scheduled
│       ├── smoke-test-phase4.md   # AI gen + credits
│       ├── smoke-test-phase5.md   # Extension automation
│       ├── smoke-test-phase6.md   # Engagement + analytics
│       ├── app-review-submission.md  # Meta + TikTok review
│       └── launch-checklist.md    # Go-live gate
└── .claude/
    ├── settings.json
    ├── rules/                      # Hard coding rules
    │   ├── project-standards.md
    │   ├── coding-style.md
    │   ├── api-design.md
    │   ├── frontend-architecture.md  # apps/web/ patterns (feature folder, providers, axios, AuthGuard)
    │   ├── cli-commands.md           # CLI runner convention
    │   ├── git-workflow.md
    │   ├── security.md
    │   ├── testing.md
    │   └── error-handling.md
    ├── agents/                     # Custom subagent definitions
    │   ├── planner.md
    │   ├── code-reviewer.md
    │   ├── security-reviewer.md
    │   ├── api-builder.md
    │   ├── prisma-migrator.md
    │   ├── platform-integrator.md
    │   ├── tdd-guide.md
    │   └── ext-developer.md
    └── skills/                     # Reusable skill packs
        ├── init-project/
        ├── add-platform/
        ├── add-api-module/
        ├── add-fe-feature/         # apps/web feature folder
        ├── setup-mcp-docs/         # MCP docs-server (port từ nextjs-boilerplate)
        └── sync-docs/
```

## Lookup theo intent

### "Tôi muốn hiểu sản phẩm là gì"
→ [00-overview.md](00-overview.md) → [01-features.md](01-features.md)

### "Tôi cần biết kiến trúc tổng thể"
→ [02-architecture.md](02-architecture.md) → [09-tech-stack.md](09-tech-stack.md)

### "Tôi cần schema database / data model"
→ [03-data-model.md](03-data-model.md)

### "Tôi cần implement đăng bài cho platform mới"
→ [04-publish-flow.md](04-publish-flow.md) → [platforms/](platforms/) (file platform tương ứng) → [.claude/skills/add-platform/](../.claude/skills/add-platform/)

### "Tôi cần build browser extension / automation"
→ [05-automation-extension.md](05-automation-extension.md)

### "Tôi cần làm AI content gen / video gen"
→ [06-ai-services.md](06-ai-services.md)

### "Tôi cần làm engage (comment, reply)"
→ [07-engagement.md](07-engagement.md)

### "Tôi cần viết API endpoint mới"
→ [08-api-conventions.md](08-api-conventions.md) → [.claude/rules/api-design.md](../.claude/rules/api-design.md) → skill `/add-api-module`

### "Tôi cần build trang/feature FE"
→ [.claude/rules/frontend-architecture.md](../.claude/rules/frontend-architecture.md) → [.claude/rules/coding-style.md](../.claude/rules/coding-style.md) → skill `/add-fe-feature`

### "Tôi cần wire auth flow"
→ [decisions/0005-auth-flow.md](decisions/0005-auth-flow.md) → [.claude/rules/security.md](../.claude/rules/security.md) → [.claude/rules/api-design.md](../.claude/rules/api-design.md) "Auth decorators + guards"

### "Tôi cần truy cập DB / viết Repository"
→ [decisions/0006-repository-layer.md](decisions/0006-repository-layer.md) → [.claude/rules/project-standards.md](../.claude/rules/project-standards.md) "Repository layer"

### "Tôi cần lấy userId trong service"
→ [decisions/0007-cls-context.md](decisions/0007-cls-context.md) → [.claude/rules/project-standards.md](../.claude/rules/project-standards.md) "Request context (CLS)"

### "Tôi cần biết roadmap launch (8 tuần)"
→ [decisions/0008-launch-readiness.md](decisions/0008-launch-readiness.md) → [01-features.md](01-features.md#phase-7--polish--launch-8-tuần--xem-adr-0008) (F-701..F-723)

### "Tôi cần viết CLI command"
→ [.claude/rules/cli-commands.md](../.claude/rules/cli-commands.md)

### "Tôi cần deploy hoặc setup infra"
→ [10-deployment.md](10-deployment.md)

### "Tôi cần biết kế hoạch phát triển"
→ [11-roadmap.md](11-roadmap.md)

### "Khi nào feature được coi là done?"
→ [definition-of-done.md](definition-of-done.md) → [01-features.md](01-features.md) (AC) → [11-roadmap.md](11-roadmap.md) (DoD per task)

### "Có thuật ngữ tôi chưa biết"
→ [12-glossary.md](12-glossary.md)

### "Tôi muốn đưa quyết định kiến trúc"
→ Đọc [decisions/](decisions/) trước, tạo ADR mới theo [decisions/_template.md](decisions/_template.md)

### "Tôi cần smoke test 1 phase / chuẩn bị go-live"
→ [runbooks/smoke-test-phase1.md](runbooks/smoke-test-phase1.md) (YT)
→ [runbooks/smoke-test-phase2.md](runbooks/smoke-test-phase2.md) (FB+IG)
→ [runbooks/smoke-test-phase3.md](runbooks/smoke-test-phase3.md) (Calendar+Draft)
→ [runbooks/smoke-test-phase4.md](runbooks/smoke-test-phase4.md) (AI gen)
→ [runbooks/smoke-test-phase5.md](runbooks/smoke-test-phase5.md) (Extension)
→ [runbooks/smoke-test-phase6.md](runbooks/smoke-test-phase6.md) (Engagement+Analytics)
→ [runbooks/launch-checklist.md](runbooks/launch-checklist.md) (Final gate)
→ [runbooks/app-review-submission.md](runbooks/app-review-submission.md) (Meta + TikTok review)

## Lookup theo file pattern

| Pattern | Mô tả | Path |
|---|---|---|
| `00-*` đến `12-*` | Numbered docs theo thứ tự đọc khuyến nghị | `docs/` |
| `platforms/*.md` | 1 file/platform: OAuth, API endpoints, automation selectors, quirks | `docs/platforms/` |
| `decisions/NNNN-*.md` | ADR — quyết định lớn (DB choice, queue, automation strategy...) | `docs/decisions/` |
| `.claude/rules/*.md` | Hard coding rule, đọc trước khi code | `.claude/rules/` |
| `.claude/agents/*.md` | Subagent definition cho Claude Code | `.claude/agents/` |
| `.claude/skills/*/SKILL.md` | Workflow skill có thể invoke qua `/skill-name` | `.claude/skills/` |
| `runbooks/*.md` | Operational runbooks: smoke test phase + launch checklist + App Review | `docs/runbooks/` |

## Keywords → docs map

Dùng để grep nhanh khi MCP server scan filesystem:

| Keyword | Liên quan đến |
|---|---|
| `publish`, `posting`, `đăng bài` | [04-publish-flow.md](04-publish-flow.md), [platforms/](platforms/) |
| `oauth`, `authentication`, `token` | [platforms/](platforms/), [.claude/rules/security.md](../.claude/rules/security.md) |
| `extension`, `automation`, `browser`, `playwright`, `puppeteer` | [05-automation-extension.md](05-automation-extension.md) |
| `websocket`, `ws`, `realtime`, `dispatcher` | [05-automation-extension.md](05-automation-extension.md) |
| `ai`, `gpt`, `claude`, `gemini`, `video gen`, `image gen` | [06-ai-services.md](06-ai-services.md) |
| `engagement`, `comment`, `reply`, `like` | [07-engagement.md](07-engagement.md) |
| `prisma`, `postgres`, `schema`, `migration`, `data model` | [03-data-model.md](03-data-model.md) |
| `dto`, `vo`, `zod`, `validation` | [08-api-conventions.md](08-api-conventions.md), [.claude/rules/api-design.md](../.claude/rules/api-design.md) |
| `exception`, `error code`, `responsecode` | [.claude/rules/error-handling.md](../.claude/rules/error-handling.md), [08-api-conventions.md](08-api-conventions.md) |
| `bullmq`, `queue`, `worker`, `consumer` | [02-architecture.md](02-architecture.md), [04-publish-flow.md](04-publish-flow.md) |
| `r2`, `s3`, `storage`, `upload`, `media` | [02-architecture.md](02-architecture.md), [10-deployment.md](10-deployment.md) |
| `repository`, `service`, `controller`, `module` | [.claude/rules/project-standards.md](../.claude/rules/project-standards.md), [08-api-conventions.md](08-api-conventions.md) |
| `commit`, `branch`, `pr`, `merge` | [.claude/rules/git-workflow.md](../.claude/rules/git-workflow.md) |
| `test`, `vitest`, `playwright`, `tdd` | [.claude/rules/testing.md](../.claude/rules/testing.md) |
| `done`, `dod`, `acceptance criteria`, `ac`, `ship checklist` | [definition-of-done.md](definition-of-done.md) |
| `smoke test`, `runbook`, `go-live`, `launch checklist` | [runbooks/launch-checklist.md](runbooks/launch-checklist.md), [runbooks/smoke-test-phase1.md](runbooks/smoke-test-phase1.md)..6 |
| `app review`, `meta review`, `tiktok review` | [runbooks/app-review-submission.md](runbooks/app-review-submission.md) |

## Maintenance

- Khi thêm file mới trong `docs/` hoặc `.claude/`, **update INDEX.md ngay**.
- Khi rename/move file, search-replace path ở INDEX trước, sau đó các file khác.
- Last-updated date cần refresh khi có thay đổi lớn.
- ADR mới phải được link vào section "Lookup theo intent" nếu thay đổi quy ước hiện hành.
