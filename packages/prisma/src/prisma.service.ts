import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log('Prisma connected')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }

  /**
   * Truncate toàn bộ table (trừ `_prisma_migrations`).
   *
   * CHỈ DÙNG TRONG TEST. Guard `NODE_ENV !== 'test'` để chống xoá nhầm prod.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() chỉ chạy trong test environment (NODE_ENV=test)')
    }
    const tables = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `
    for (const { tablename } of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`)
    }
  }
}
