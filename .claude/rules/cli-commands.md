# CLI commands

Convention cho CLI runner trong `apps/api` và `apps/ai`. Pattern port từ nestjs-boilerplate.

## Mục đích

- **Seed** data dev/test
- **Ops scripts**: rotate API key, revoke session, backfill column, cleanup expired
- **One-off migration helper**: data transform khi schema change
- **Smoke test** infra: ping DB, Redis, mail

Tránh viết script `.ts` rời rạc trong `scripts/` đụng DB raw — không reuse DI, mock, config validation.

## Architecture

```
apps/<api|ai>/src/cli/
├── cli.ts                    # Entry — NestFactory.createApplicationContext
├── cli.module.ts             # Imports AppModule + register commands as providers
├── contracts/
│   └── cli-command.interface.ts
└── commands/
    ├── seed.command.ts
    ├── rotate-tokens.command.ts
    ├── cleanup-sessions.command.ts
    └── send-test-email.command.ts
```

## Contract

```ts
// cli/contracts/cli-command.interface.ts
export interface CliCommand {
  run(args: string[]): Promise<void>
}
```

## Entry

```ts
// cli/cli.ts
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { CliModule } from './cli.module'
import { CliCommand } from './contracts/cli-command.interface'
import { SeedCommand } from './commands/seed.command'
import { RotateTokensCommand } from './commands/rotate-tokens.command'
import { CleanupSessionsCommand } from './commands/cleanup-sessions.command'

const COMMANDS: Record<string, new (...args: any[]) => CliCommand> = {
  seed: SeedCommand,
  'rotate-tokens': RotateTokensCommand,
  'cleanup-sessions': CleanupSessionsCommand,
}

async function bootstrap() {
  const [, , commandName, ...args] = process.argv
  const Command = COMMANDS[commandName]
  if (!Command) {
    console.error(`Unknown command: ${commandName}`)
    console.error(`Available: ${Object.keys(COMMANDS).join(', ')}`)
    process.exit(1)
  }
  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn', 'log'],
  })
  try {
    const cmd = app.get(Command)
    await cmd.run(args)
  } finally {
    await app.close()
  }
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

## Module

```ts
// cli/cli.module.ts
import { Module } from '@nestjs/common'
import { AppModule } from '../app.module'
import { SeedCommand } from './commands/seed.command'
import { RotateTokensCommand } from './commands/rotate-tokens.command'
import { CleanupSessionsCommand } from './commands/cleanup-sessions.command'

@Module({
  imports: [AppModule],
  providers: [SeedCommand, RotateTokensCommand, CleanupSessionsCommand],
})
export class CliModule {}
```

## Command template

```ts
// cli/commands/seed.command.ts
import { Injectable, Logger } from '@nestjs/common'
import { UserService } from '@/core/user/user.service'
import { CliCommand } from '../contracts/cli-command.interface'

@Injectable()
export class SeedCommand implements CliCommand {
  private readonly logger = new Logger(SeedCommand.name)

  constructor(private readonly userService: UserService) {}

  async run(args: string[]): Promise<void> {
    const flag = args[0] ?? '--minimal'

    if (flag === '--minimal') {
      await this.userService.upsert({
        email: 'admin@sociflow.local',
        password: 'admin@1234',
        role: 'ADMIN',
      })
      this.logger.log('Seeded admin user')
      return
    }

    if (flag === '--full') {
      // bulk fixtures
      return
    }

    this.logger.error(`Unknown flag: ${flag}. Use --minimal or --full`)
    process.exit(1)
  }
}
```

## package.json script

```json
// apps/api/package.json
{
  "scripts": {
    "cli": "tsx src/cli/cli.ts",
    "cli:prod": "node dist/cli/cli.js"
  }
}
```

Usage:
```bash
pnpm --filter @sociflow/api cli seed --minimal
pnpm --filter @sociflow/api cli rotate-tokens
pnpm --filter @sociflow/api cli cleanup-sessions
```

## Rules

- ✅ Mọi command implement `CliCommand` interface
- ✅ Inject service qua DI — KHÔNG `new PrismaClient()` raw trong command
- ✅ `Logger` instance, KHÔNG `console.log`
- ✅ Exit code rõ ràng: 0 success, 1 error, 2 invalid args
- ✅ Idempotent khi có thể (rerun safe)
- ✅ Document command trong `apps/<app>/README.md`
- ❌ KHÔNG dùng `prompts` interactive — cmd phải scriptable (CI/cron)
- ❌ KHÔNG mutate prod data mà không có flag `--confirm` explicit
- ❌ KHÔNG đặt secret trong args (`--password=xyz`) — đọc qua env hoặc config

## Common commands plan

| Command | Mục đích | Tần suất |
|---|---|---|
| `seed --minimal` | Tạo admin user + sample data dev | One-off dev |
| `seed --full` | Bulk fixtures cho test/demo | Manual |
| `rotate-tokens` | Re-encrypt social account tokens với key mới | Khi rotate ENCRYPTION_KEY |
| `cleanup-sessions` | Xoá session expired >7 ngày | Cron daily |
| `cleanup-soft-deleted` | Hard delete row `deletedAt` >30 ngày | Cron weekly |
| `backfill-<col>` | One-off migration data transform | One-off per migration |
| `revoke-user-sessions <userId>` | Force logout user (incident response) | Manual |
| `send-test-email <to>` | Test SMTP config | Manual debug |

## Testing CLI

```ts
// cli/commands/seed.command.spec.ts
describe('SeedCommand', () => {
  it('seeds admin user with --minimal', async () => {
    const mockUserService = { upsert: vi.fn() }
    const cmd = new SeedCommand(mockUserService as any)
    await cmd.run(['--minimal'])
    expect(mockUserService.upsert).toHaveBeenCalledWith(expect.objectContaining({ role: 'ADMIN' }))
  })
})
```

## References

- nestjs-boilerplate `src/cli/` — reference implementation
