import { Injectable } from '@nestjs/common'
import type { AccountInsight, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'

export interface UpsertAccountInsightInput {
  followers: number
  followersDelta: number
  totalPosts: number
  totalEngagement: number
  reach: number
  raw?: Prisma.InputJsonValue
}

@Injectable()
export class AccountInsightRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByAccountAndDate(
    accountId: string,
    date: Date,
    data: UpsertAccountInsightInput,
  ): Promise<AccountInsight> {
    return this.prisma.accountInsight.upsert({
      where: { accountId_date: { accountId, date } },
      create: {
        account: { connect: { id: accountId } },
        date,
        followers: data.followers,
        followersDelta: data.followersDelta,
        totalPosts: data.totalPosts,
        totalEngagement: data.totalEngagement,
        reach: data.reach,
        ...(data.raw !== undefined && { raw: data.raw }),
      },
      update: {
        followers: data.followers,
        followersDelta: data.followersDelta,
        totalPosts: data.totalPosts,
        totalEngagement: data.totalEngagement,
        reach: data.reach,
        ...(data.raw !== undefined && { raw: data.raw }),
      },
    })
  }

  async listByAccountIdInRange(accountId: string, fromDate: Date, toDate: Date): Promise<AccountInsight[]> {
    return this.prisma.accountInsight.findMany({
      where: { accountId, date: { gte: fromDate, lte: toDate } },
      orderBy: { date: 'asc' },
    })
  }

  async getLatestByAccountId(accountId: string): Promise<AccountInsight | null> {
    return this.prisma.accountInsight.findFirst({
      where: { accountId },
      orderBy: { date: 'desc' },
    })
  }
}
