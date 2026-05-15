import { Injectable } from '@nestjs/common'
import type { PostInsight, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'

@Injectable()
export class PostInsightRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PostInsightCreateInput): Promise<PostInsight> {
    return this.prisma.postInsight.create({ data })
  }

  async listByPublishRecordId(publishRecordId: string, limit = 50): Promise<PostInsight[]> {
    return this.prisma.postInsight.findMany({
      where: { publishRecordId },
      orderBy: { snapshotAt: 'desc' },
      take: limit,
    })
  }

  async latestByPublishRecordId(publishRecordId: string): Promise<PostInsight | null> {
    return this.prisma.postInsight.findFirst({
      where: { publishRecordId },
      orderBy: { snapshotAt: 'desc' },
    })
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.postInsight.deleteMany({
      where: { snapshotAt: { lt: cutoff } },
    })
    return result.count
  }
}
