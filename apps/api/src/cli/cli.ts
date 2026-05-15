import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { Type } from '@nestjs/common'
import { CliModule } from './cli.module'
import { SeedCommand } from './commands/seed.command'
import type { CliCommand } from './contracts/cli-command.interface'

const COMMANDS: Record<string, Type<CliCommand>> = {
  seed: SeedCommand,
}

async function bootstrap() {
  const [, , commandName, ...args] = process.argv
  if (!commandName) {
    console.error('Usage: pnpm cli <command> [...args]')
    console.error(`Available: ${Object.keys(COMMANDS).join(', ')}`)
    process.exit(1)
  }
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
  }
  finally {
    await app.close()
  }
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
