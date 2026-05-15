# CLAUDE.md — Sociflow project

> **Project root** for an AI agent working in this folder. Đọc file này TRƯỚC khi làm việc.

## Bạn đang ở đâu

Bạn đang trong folder `sociflow/` — một product mới được thiết kế tham khảo AiToEarn (`../`) nhưng implement lại theo cách riêng.

- **Không chỉnh sửa code ngoài folder `sociflow/`** — AiToEarn ở repo cha là reference đọc-only.
- Khi cần ý tưởng implementation, copy pattern từ AiToEarn nhưng **viết lại** bằng convention của Sociflow (Postgres/Prisma thay vì MongoDB/Mongoose).

## Workflow bắt buộc

1. **Đọc `docs/` trước khi code** — đặc biệt là [docs/02-architecture.md](docs/02-architecture.md), [docs/03-data-model.md](docs/03-data-model.md), [docs/08-api-conventions.md](docs/08-api-conventions.md).
2. **Tuân thủ `.claude/rules/`** — tất cả file trong đó là rule cứng, không phải suggestion.
3. **Plan trước code** — task >3 bước thì dùng TodoWrite hoặc tạo plan trong `docs/decisions/`.
4. **Test trước feature** — TDD bắt buộc cho service/business logic.
5. **Commit conventional** — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. Xem [.claude/rules/git-workflow.md](.claude/rules/git-workflow.md).

## Stack & tools

- **Runtime**: Node 22, pnpm 10
- **Monorepo**: Turborepo
- **Backend**: NestJS 11, Prisma 5, BullMQ 5, Postgres 16, Redis 7
- **Frontend**: Next.js 14 (App Router), shadcn/ui, Tailwind v4, zustand
- **Storage**: Cloudflare R2 (S3-compatible)
- **Extension**: Chrome Manifest V3, TypeScript, esbuild
- **Test**: Vitest (unit), Playwright (e2e)
- **Lint**: ESLint flat config (`@antfu/eslint-config`)
- **Type-check**: `tsc --noEmit` (không dùng `pnpm build` để type-check)

## Conventions checklist (HARD)

Bắt buộc trước khi nói "done":

- [ ] Code không có `console.log` (dùng `Logger` instance hoặc `pino`)
- [ ] Không có `as any` (fix type tại nguồn)
- [ ] Không có `try-catch` bao business logic (dùng `AppException + ResponseCode`)
- [ ] Không có `throw new Error('...')` (luôn dùng `AppException`)
- [ ] Controller chỉ routing, không có logic
- [ ] Repository chỉ truy cập data, không permission check
- [ ] DTO sinh từ zod `createZodDto`, VO sinh từ `createVo`
- [ ] Mọi `@Controller` có `@ApiTags`, mọi method có `@ApiDoc`
- [ ] File ≤ 400 line (max 800)
- [ ] Function ≤ 50 line
- [ ] Type-check pass + ESLint pass

## Khi không chắc

- **Architecture decision** → tạo file `docs/decisions/NNNN-title.md` (ADR template ở [docs/decisions/_template.md](docs/decisions/_template.md))
- **Feature unclear** → hỏi user, không tự đoán
- **Pattern không có trong docs** → check AiToEarn reference, đề xuất pattern mới qua ADR

## Repository structure (planned)

```
sociflow/
├── apps/
│   ├── api/          # NestJS — business logic, OAuth, publish orchestration
│   ├── ai/           # NestJS — AI gen, agent runtime (split for resource isolation)
│   ├── web/          # Next.js — SaaS UI
│   └── extension/    # Chrome MV3 — browser automation agent
├── packages/
│   ├── common/       # Shared zod schemas, AppException, ResponseCode
│   ├── prisma/       # Prisma schema + migrations + generated client
│   ├── api-contracts/# ts-rest contracts (FE/BE type sync)
│   ├── queue/        # BullMQ wrapper
│   ├── auth/         # JWT + OAuth helpers
│   ├── storage/      # R2 client
│   └── ws-protocol/  # WebSocket protocol shared with extension
├── docs/
├── .claude/
└── (top-level configs)
```

Chi tiết: [docs/02-architecture.md](docs/02-architecture.md).

## Tham khảo AiToEarn

Reference patterns có thể đọc:

| Cần học | File AiToEarn |
|---|---|
| Repository naming | `../project/aitoearn-backend/.claude/rules/project-standards.md` |
| Publish orchestration | `../project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publishing/publishing.service.ts` |
| Provider strategy | `../project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publishing/providers/` |
| Media streaming | `../project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publishing/media-staging.service.ts` |
| Queue wrapper | `../project/aitoearn-backend/libs/aitoearn-queue/` |
| AppException + ResponseCode | `../project/aitoearn-backend/libs/common/` |

**KHÔNG** copy nguyên file. Đọc → hiểu pattern → viết lại cho Sociflow.

## Ngôn ngữ

- **Comment + doc**: tiếng Việt cho business logic, tiếng Anh cho technical interfaces
- **Commit message**: tiếng Anh
- **Variable/function name**: tiếng Anh (PascalCase / camelCase / UPPER_SNAKE_CASE)
- **i18n key**: tiếng Anh (kebab.case)
- **README + docs/**: tiếng Việt là chính, tiếng Anh khi cần share
