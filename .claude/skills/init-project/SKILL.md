---
name: init-project
description: Khởi tạo skeleton repo lần đầu — Turborepo + pnpm workspaces + NestJS api/ai + Next.js web + extension MV3 + Prisma. Use khi user yêu cầu "/init-project" hoặc "tạo skeleton".
---

# Skill: init-project

Khởi tạo Sociflow repo lần đầu. Chỉ chạy 1 lần — sau đó skill này deprecated.

## Pre-requisites

- Node 22.x installed
- pnpm 10.x installed (`npm i -g pnpm@10`)
- Docker Desktop running

## Phase 0 — Foundation

### 1. Root package.json + pnpm workspace

```bash
cd sociflow/

# Khởi tạo
pnpm init
```

Edit `package.json`:

```json
{
  "name": "@sociflow/source",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=22.0.0", "pnpm": ">=10.0.0" },
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.9.0",
    "@antfu/eslint-config": "^7.2.0",
    "eslint": "^9.39.0",
    "prettier": "^3.8.0",
    "simple-git-hooks": "^2.13.0",
    "lint-staged": "^16.0.0",
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0"
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged",
    "commit-msg": "pnpm commitlint --edit $1"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": "eslint --fix",
    "*.{json,md,yml,yaml}": "prettier --write"
  },
  "pnpm": {
    "overrides": {
      "zod": "^4.0.0",
      "@prisma/client": "^5.0.0",
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    }
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "lint": {},
    "test": { "dependsOn": ["^build"] },
    "type-check": { "dependsOn": ["^build"] },
    "clean": { "cache": false }
  }
}
```

### 2. ESLint + Prettier config

`eslint.config.mjs`:

```js
import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'app',
  typescript: true,
  formatters: true,
  ignores: ['**/dist/**', '**/.next/**', '**/.turbo/**', '**/node_modules/**', '**/.prisma/**'],
})
```

`.prettierrc`:
```json
{ "semi": false, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

`commitlint.config.cjs`:
```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci', 'style']],
  },
}
```

### 3. TypeScript base config

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

`tsconfig.json` (root):
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": []
}
```

### 4. .gitignore

```gitignore
node_modules/
.pnpm-store/
dist/
build/
.next/
.turbo/
.env
.env.*
!.env.example
.vscode/
.idea/
.DS_Store
coverage/
playwright-report/
*.log
*.db
apps/extension/dist/
apps/extension/*.zip
```

### 5. packages/prisma

```bash
mkdir -p packages/prisma/{src,migrations,seed}
cd packages/prisma
pnpm init
```

`packages/prisma/package.json`:
```json
{
  "name": "@sociflow/prisma",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "seed": "tsx seed/index.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

`packages/prisma/schema.prisma`: copy từ `docs/03-data-model.md` (User, Session, ApiKey để bắt đầu).

### 6. packages/common

```bash
mkdir -p packages/common/src
cd packages/common
pnpm init
```

`packages/common/package.json`:
```json
{
  "name": "@sociflow/common",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^4.0.0"
  }
}
```

Files:
- `src/index.ts`
- `src/response-code.ts`
- `src/app-exception.ts`
- `src/zod-helpers.ts` (createZodDto, createPaginationVo, ResponseEnvelope)
- `src/crypto.ts` (encrypt/decrypt AES-256-GCM)
- `src/pagination.ts` (Pagination, Paginated<T>)
- `src/auth-decorators.ts` (`@Public()`, `@CurrentUser()`, `AuthUser` type)
- `src/transform-interceptor.ts` (response envelope `{ data, code, message, timestamp }`)
- `src/app-exception.filter.ts` (catch AppException + ZodError → envelope, HTTP 200)
- `src/zod-validation.pipe.ts` (parse DTO qua zod, throw ZodError → ValidationFailed)

### 7. apps/api (NestJS)

```bash
cd ../..   # back to root
pnpm dlx @nestjs/cli new apps/api --skip-git --package-manager pnpm
```

Edit `apps/api/package.json` add deps:

```json
{
  "name": "@sociflow/api",
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/swagger": "^11.0.0",
    "@nestjs/schedule": "^4.0.0",
    "@nestjs/event-emitter": "^2.0.0",
    "@nestjs/passport": "^11.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@sociflow/common": "workspace:*",
    "@sociflow/prisma": "workspace:*",
    "@sociflow/auth": "workspace:*",
    "@sociflow/queue": "workspace:*",
    "bcryptjs": "^2.4.3",
    "bullmq": "^5.0.0",
    "@nestjs/bullmq": "^11.0.0",
    "cookie-parser": "^1.4.0",
    "jose": "^5.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.0",
    "nestjs-cls": "^4.0.0",
    "uuid": "^11.0.0",
    "pino": "^9.0.0",
    "nestjs-pino": "^4.0.0",
    "nodemailer": "^6.9.0",
    "axios": "^1.0.0",
    "helmet": "^7.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.0.0",
    "zod": "^4.0.0"
  }
}
```

### 7.1. main.ts wire-up (BẮT BUỘC)

```ts
// apps/api/src/main.ts
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger as PinoLogger } from 'nestjs-pino'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AppExceptionFilter, TransformInterceptor, ZodValidationPipe } from '@sociflow/common'
import { config } from './config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.useLogger(app.get(PinoLogger))
  app.use(cookieParser())
  app.use(helmet())
  app.enableCors({
    origin: config.app.corsOrigins,
    credentials: true,                 // gửi cookie cross-origin web → api
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })
  app.setGlobalPrefix('api/v1')
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalInterceptors(new TransformInterceptor())
  app.useGlobalFilters(new AppExceptionFilter())

  if (config.app.env !== 'production') {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger')
    const swaggerCfg = new DocumentBuilder()
      .setTitle('Sociflow API')
      .addCookieAuth('sf_access')
      .addBearerAuth()
      .build()
    SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, swaggerCfg))
  }

  await app.listen(config.app.port)
}
bootstrap()
```

### 7.2. ContextModule (nestjs-cls)

```ts
// apps/api/src/common/context/context.module.ts
import { Global, Module } from '@nestjs/common'
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

Import `ContextModule` đầu tiên trong `AppModule.imports`. Xem [.claude/rules/project-standards.md](../../rules/project-standards.md) "Request context (CLS)" và [ADR-0007](../../../docs/decisions/0007-cls-context.md).

### 7.3. Auth module skeleton

Tham khảo [ADR-0005](../../../docs/decisions/0005-auth-flow.md). Files cần có:

```
apps/api/src/core/auth/
├── auth.module.ts
├── auth.controller.ts         # /register, /login, /refresh, /logout, /me
├── auth.service.ts
├── auth.cookies.ts            # setAuthCookies, clearAuthCookies helpers
├── strategies/
│   └── jwt.strategy.ts        # cookieOrBearerExtractor (dual)
└── dto/                       # zod schemas

packages/auth/src/
├── guards/
│   ├── jwt-auth.guard.ts      # populate CLS context
│   └── optional-auth.guard.ts
├── session.repository.ts      # create, rotateByRefreshHash, revokeBySha256
└── index.ts
```

### 8. apps/ai (NestJS)

Same pattern as api, separate folder. Add deps:

```json
"openai": "^4.0.0",
"@anthropic-ai/sdk": "^0.30.0",
"@google/generative-ai": "^0.21.0",
"replicate": "^1.0.0"
```

### 9. apps/web (Next.js)

```bash
pnpm dlx create-next-app@latest apps/web \
  --typescript --tailwind --app --src-dir --import-alias "@/*"
```

Add deps:
```json
"@sociflow/common": "workspace:*",
"@sociflow/api-contracts": "workspace:*",
"@tanstack/react-query": "^5.0.0",
"@tanstack/react-query-devtools": "^5.0.0",
"@ts-rest/core": "^3.50.0",
"@ts-rest/react-query": "^3.50.0",
"axios": "^1.0.0",
"zustand": "^5.0.0",
"react-hook-form": "^7.0.0",
"zod": "^4.0.0",
"@hookform/resolvers": "^5.0.0",
"next-themes": "^0.4.0",
"shadcn": "...",
"lucide-react": "...",
"sonner": "^2.0.0",
"dayjs": "^1.0.0"
```

Folder structure (xem [.claude/rules/frontend-architecture.md](../../rules/frontend-architecture.md)):

```
apps/web/src/
├── app/{(auth),(dashboard),api,layout.tsx,providers.tsx,error.tsx,...}
├── features/<domain>/{components,hooks,services,types,views,index.ts}
├── components/{ui,layout,providers,shared}
├── hooks/
├── lib/{api,seo,types,utils.ts}
├── stores/
└── middleware.ts
```

Setup:
- `app/providers.tsx`: QueryClient via `useState`, ThemeProvider, TooltipProvider, Toaster — xem `coding-style.md` "Provider tree"
- `lib/api/client.ts`: axios `withCredentials: true` + single-flight 401 refresh interceptor — xem `frontend-architecture.md`
- `middleware.ts`: edge cookie gate cho `/dashboard/*`, `/compose/*`, `/settings/*`
- `lib/seo/{site.ts,metadata.ts,jsonld.ts}`: SEO helpers
- `components/layout/AuthGuard.tsx`: client-side guard (secondary check)

### 10. apps/extension (Chrome MV3)

```bash
mkdir -p apps/extension/{src/{background,content-scripts,popup,offscreen},public/icons}
cd apps/extension
pnpm init
```

`package.json`:
```json
{
  "name": "@sociflow/extension",
  "private": true,
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "build:prod": "NODE_ENV=production tsup"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "@types/chrome": "^0.0.260",
    "@sociflow/ws-protocol": "workspace:*"
  },
  "dependencies": {
    "socket.io-client": "^4.0.0"
  }
}
```

`manifest.json`: xem template ở `docs/05-automation-extension.md`.

### 11. Docker compose local

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: sociflow
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: sociflow_dev
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "sociflow"]
      interval: 5s
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]   # SMTP + UI
  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]   # API + Console
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio12345
    command: server /data --console-address ":9001"
volumes:
  postgres_data:
```

Chi tiết: [docs/10-deployment.md](../../../docs/10-deployment.md).

### 11.1. CLI runner (apps/api + apps/ai)

Setup CLI command framework theo [.claude/rules/cli-commands.md](../../rules/cli-commands.md):

```
apps/api/src/cli/
├── cli.ts                    # entry
├── cli.module.ts             # imports AppModule
├── contracts/cli-command.interface.ts
└── commands/seed.command.ts  # initial seed admin user
```

Add `apps/api/package.json` script:
```json
{ "scripts": { "cli": "tsx src/cli/cli.ts" } }
```

Test: `pnpm --filter @sociflow/api cli seed --minimal`.

### 11.2. MCP docs-server (optional Phase 0)

Port từ nextjs-boilerplate `mcp/docs-server/` để agent đọc docs nhanh hơn. Skill riêng: `/setup-mcp-docs`.

### 12. Initial commit

```bash
git init
git add .
git commit -m "chore: initialize sociflow monorepo"
```

### 13. Install + verify

```bash
pnpm install
pnpm prisma migrate dev   # tạo DB initial
docker compose -f docker-compose.dev.yml up -d
pnpm dev   # all services chạy
```

Verify:
- `http://localhost:3000/health` (api) → `{ ok: true }`
- `http://localhost:3001/health` (ai) → `{ ok: true }`
- `http://localhost:3010` (web) → Next.js home

## Phase 1 first task

Sau init xong, task tiếp theo: implement Auth module theo `docs/11-roadmap.md` Phase 0 Week 2.

→ Gọi agent `api-builder` với input "build auth module".

## Notes

- Sau init, **xoá file boilerplate Next.js default** (page.tsx welcome) — thay bằng dashboard skeleton
- Setup VS Code extension recommendations: `.vscode/extensions.json`
- Setup `.vscode/settings.json` ESLint + Prettier on save
- Add `LICENSE` (MIT) nếu plan open-source

## Verify checklist

- [ ] `pnpm install` không error
- [ ] `pnpm type-check` pass
- [ ] `pnpm lint` pass (sẽ có vài warning từ template Next.js, fix dần)
- [ ] `pnpm prisma generate` thành công
- [ ] `pnpm prisma migrate dev` tạo DB
- [ ] Docker compose lên: postgres, redis, minio
- [ ] api respond `/health` 200
- [ ] ai respond `/health` 200
- [ ] web load homepage
- [ ] Pre-commit hook trigger được (test bằng commit thử)
