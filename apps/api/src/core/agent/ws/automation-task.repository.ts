import { Injectable } from '@nestjs/common'
import type { AutomationTask, AutomationTaskStatus, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'

@Injectable()
export class AutomationTaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<AutomationTask | null> {
    return this.prisma.automationTask.findUnique({ where: { id } })
  }

  async getByIdAndAgentId(id: string, agentId: string): Promise<AutomationTask | null> {
    return this.prisma.automationTask.findFirst({ where: { id, agentId } })
  }

  async getByPublishRecordId(publishRecordId: string): Promise<AutomationTask | null> {
    return this.prisma.automationTask.findFirst({
      where: { publishRecordId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async listByStatus(status: AutomationTaskStatus, limit = 100): Promise<AutomationTask[]> {
    return this.prisma.automationTask.findMany({
      where: { status },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })
  }

  async listTimedOut(now: Date, limit = 100): Promise<AutomationTask[]> {
    return this.prisma.automationTask.findMany({
      where: {
        status: { in: ['DISPATCHED', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
        timeoutAt: { lte: now },
      },
      take: limit,
      orderBy: { timeoutAt: 'asc' },
    })
  }

  async create(data: Prisma.AutomationTaskCreateInput): Promise<AutomationTask> {
    return this.prisma.automationTask.create({ data })
  }

  async updateById(id: string, data: Prisma.AutomationTaskUpdateInput): Promise<AutomationTask> {
    return this.prisma.automationTask.update({ where: { id }, data })
  }

  /**
   * Atomic transition: chỉ thay đổi status khi đúng status hiện tại expected.
   * Tránh race: gateway nhận `complete` rồi `failed` cùng task → chỉ 1 thắng.
   */
  async markStatusAtomic(
    id: string,
    expected: AutomationTaskStatus,
    next: AutomationTaskStatus,
    extra?: Prisma.AutomationTaskUpdateInput,
  ): Promise<boolean> {
    const result = await this.prisma.automationTask.updateMany({
      where: { id, status: expected },
      data: { status: next, ...extra },
    })
    return result.count === 1
  }

  async countActiveByAgent(agentId: string): Promise<number> {
    return this.prisma.automationTask.count({
      where: {
        agentId,
        status: { in: ['PENDING', 'DISPATCHED', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      },
    })
  }
}
