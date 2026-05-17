import { Injectable } from '@nestjs/common'
import type { NotificationLog, NotificationType, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

export interface CreateNotificationLogInput {
  userId: string
  type: NotificationType
  channel: string
  recipient: string
  subject?: string | null
  templateName: string
  metadata?: Prisma.InputJsonValue
}

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationLogInput): Promise<NotificationLog> {
    return this.prisma.notificationLog.create({
      data: {
        user: { connect: { id: input.userId } },
        type: input.type,
        channel: input.channel,
        recipient: input.recipient,
        subject: input.subject ?? null,
        templateName: input.templateName,
        status: 'QUEUED',
        ...(input.metadata !== undefined && { metadata: input.metadata }),
      },
    })
  }

  async getById(id: string): Promise<NotificationLog | null> {
    return this.prisma.notificationLog.findUnique({ where: { id } })
  }

  async markSent(id: string, metadata?: Prisma.InputJsonValue): Promise<NotificationLog> {
    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        ...(metadata !== undefined && { metadata }),
      },
    })
  }

  async markFailed(id: string, errorMessage: string): Promise<NotificationLog> {
    return this.prisma.notificationLog.update({
      where: { id },
      data: { status: 'FAILED', errorMessage },
    })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
  ): Promise<Paginated<NotificationLog>> {
    const where: Prisma.NotificationLogWhereInput = { userId }
    const [list, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationLog.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }
}
