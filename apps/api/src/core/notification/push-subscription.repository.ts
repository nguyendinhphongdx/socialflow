import { Injectable } from '@nestjs/common'
import type { Prisma, PushSubscription } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'

export interface CreatePushSubscriptionInput {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  deviceTag?: string | null
}

/**
 * PushSubscriptionRepository — data access cho Web Push subscription.
 *
 * Unique theo `endpoint` — re-subscribe cùng device → upsert (giữ id cũ).
 */
@Injectable()
export class PushSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByEndpoint(input: CreatePushSubscriptionInput): Promise<PushSubscription> {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        user: { connect: { id: input.userId } },
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        deviceTag: input.deviceTag ?? null,
      },
      update: {
        // Refresh keys nếu browser xoay vòng VAPID
        p256dh: input.p256dh,
        auth: input.auth,
        deviceTag: input.deviceTag ?? null,
        user: { connect: { id: input.userId } },
      },
    })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<PushSubscription | null> {
    return this.prisma.pushSubscription.findFirst({ where: { id, userId } })
  }

  async listByUserId(userId: string): Promise<PushSubscription[]> {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async deleteById(id: string): Promise<PushSubscription> {
    return this.prisma.pushSubscription.delete({ where: { id } })
  }

  async deleteByEndpoint(endpoint: string): Promise<number> {
    const result = await this.prisma.pushSubscription.deleteMany({ where: { endpoint } })
    return result.count
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.pushSubscription.update({
      where: { id },
      data: { lastUsed: new Date() },
    }).catch(() => undefined) // tolerated — best-effort
  }

  async create(data: Prisma.PushSubscriptionCreateInput): Promise<PushSubscription> {
    return this.prisma.pushSubscription.create({ data })
  }
}
