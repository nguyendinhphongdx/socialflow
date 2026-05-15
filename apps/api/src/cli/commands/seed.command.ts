import { Injectable, Logger } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import { UserRepository } from '../../core/user/user.repository'
import type { CliCommand } from '../contracts/cli-command.interface'

@Injectable()
export class SeedCommand implements CliCommand {
  private readonly logger = new Logger(SeedCommand.name)

  constructor(private readonly users: UserRepository) {}

  async run(args: string[]): Promise<void> {
    const flag = args[0] ?? '--minimal'
    if (flag === '--minimal') return this.seedMinimal()
    this.logger.error(`Unknown flag: ${flag}. Use --minimal`)
    process.exit(1)
  }

  private async seedMinimal(): Promise<void> {
    const email = 'admin@sociflow.local'
    const password = 'admin@1234'
    const exists = await this.users.existsByEmail(email)
    if (exists) {
      this.logger.warn(`Admin ${email} đã tồn tại — skip`)
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await this.users.create({
      email,
      passwordHash,
      emailVerified: true,
      role: 'ADMIN',
      name: 'Sociflow Admin',
    })
    this.logger.log(`✓ Admin created: ${user.email} / password: ${password}`)
  }
}
