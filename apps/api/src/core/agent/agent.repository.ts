import { Injectable } from '@nestjs/common'
import type { AutomationAgent, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

interface DeviceInfo {
  os: string
  browserName: string
  extensionVersion: string
  capabilities: string[]
}

@Injectable()
export class AgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<AutomationAgent | null> {
    return this.prisma.automationAgent.findUnique({ where: { id } })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<AutomationAgent | null> {
    return this.prisma.automationAgent.findFirst({ where: { id, userId } })
  }

  async getByPairCode(pairCode: string): Promise<AutomationAgent | null> {
    return this.prisma.automationAgent.findUnique({ where: { pairCode } })
  }

  async getByAgentTokenSha256(hash: string): Promise<AutomationAgent | null> {
    return this.prisma.automationAgent.findUnique({ where: { agentTokenSha256: hash } })
  }

  async existsByPairCode(pairCode: string): Promise<boolean> {
    const count = await this.prisma.automationAgent.count({ where: { pairCode } })
    return count > 0
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: { online?: boolean, includeRevoked?: boolean },
  ): Promise<Paginated<AutomationAgent>> {
    const where: Prisma.AutomationAgentWhereInput = {
      userId,
      ...(filter?.online !== undefined && { online: filter.online }),
      ...(!filter?.includeRevoked && { revokedAt: null }),
    }
    const [list, total] = await Promise.all([
      this.prisma.automationAgent.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.automationAgent.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async create(data: Prisma.AutomationAgentCreateInput): Promise<AutomationAgent> {
    return this.prisma.automationAgent.create({ data })
  }

  async updateById(id: string, data: Prisma.AutomationAgentUpdateInput): Promise<AutomationAgent> {
    return this.prisma.automationAgent.update({ where: { id }, data })
  }

  /**
   * Soft-revoke: set `revokedAt` + xoá `agentTokenSha256` để token cũ vô hiệu hoá.
   */
  async revokeById(id: string): Promise<AutomationAgent> {
    return this.prisma.automationAgent.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        agentTokenSha256: null,
        online: false,
      },
    })
  }

  /**
   * Claim atomic — chỉ thành công nếu:
   * - pairCode đúng
   * - pairCodeExpiresAt > now
   * - agentTokenSha256 IS NULL (chưa claim)
   * - revokedAt IS NULL
   *
   * Trả về `null` nếu condition không match (caller phân biệt expired vs already-claimed
   * qua getByPairCode trước đó).
   */
  async claimByPairCode(input: {
    pairCode: string
    agentTokenSha256: string
    deviceInfo: DeviceInfo
  }): Promise<AutomationAgent | null> {
    const now = new Date()
    const result = await this.prisma.automationAgent.updateMany({
      where: {
        pairCode: input.pairCode,
        pairCodeExpiresAt: { gt: now },
        agentTokenSha256: null,
        revokedAt: null,
      },
      data: {
        agentTokenSha256: input.agentTokenSha256,
        pairCode: null,
        pairCodeExpiresAt: null,
        os: input.deviceInfo.os,
        browserName: input.deviceInfo.browserName,
        extensionVersion: input.deviceInfo.extensionVersion,
        capabilities: input.deviceInfo.capabilities,
      },
    })
    if (result.count !== 1) return null
    return this.prisma.automationAgent.findUnique({
      where: { agentTokenSha256: input.agentTokenSha256 },
    })
  }

  async markOnline(id: string, ts: Date): Promise<void> {
    await this.prisma.automationAgent.update({
      where: { id },
      data: { online: true, lastSeenAt: ts, lastConnectedAt: ts },
    })
  }

  async markOffline(id: string, ts: Date): Promise<void> {
    await this.prisma.automationAgent.update({
      where: { id },
      data: { online: false, lastSeenAt: ts },
    })
  }
}
