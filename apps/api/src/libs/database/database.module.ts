import { Global, Module } from '@nestjs/common'
import { PrismaService } from '@sociflow/prisma'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
