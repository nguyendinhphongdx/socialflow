import { Injectable } from '@nestjs/common'
import type {
  AiCredential,
  AiProvider,
  CredentialScope,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'

@Injectable()
export class AiCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<AiCredential | null> {
    return this.prisma.aiCredential.findUnique({ where: { id } })
  }

  async findActiveByScope(
    scope: CredentialScope,
    workspaceId: string | null,
    provider: AiProvider,
  ): Promise<AiCredential | null> {
    return this.prisma.aiCredential.findFirst({
      where: { scope, workspaceId, provider, isActive: true },
    })
  }

  async findByScope(
    scope: CredentialScope,
    workspaceId: string | null,
    provider: AiProvider,
  ): Promise<AiCredential | null> {
    return this.prisma.aiCredential.findFirst({
      where: { scope, workspaceId, provider },
    })
  }

  async listByWorkspaceId(workspaceId: string): Promise<AiCredential[]> {
    return this.prisma.aiCredential.findMany({
      where: { scope: 'WORKSPACE', workspaceId },
      orderBy: { provider: 'asc' },
    })
  }

  async listSystem(): Promise<AiCredential[]> {
    return this.prisma.aiCredential.findMany({
      where: { scope: 'SYSTEM' },
      orderBy: { provider: 'asc' },
    })
  }

  async create(data: Prisma.AiCredentialUncheckedCreateInput): Promise<AiCredential> {
    return this.prisma.aiCredential.create({ data })
  }

  async updateById(id: string, data: Prisma.AiCredentialUpdateInput): Promise<AiCredential> {
    return this.prisma.aiCredential.update({ where: { id }, data })
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.aiCredential.delete({ where: { id } })
  }

  /**
   * Atomic increment monthSpentUsd. Trả về row sau update để service so sánh
   * với budget cap.
   */
  async incrementSpent(id: string, amountUsd: number): Promise<AiCredential> {
    return this.prisma.aiCredential.update({
      where: { id },
      data: { monthSpentUsd: { increment: amountUsd } },
    })
  }

  /**
   * Reset month spent về 0. Gọi từ scheduler đầu tháng.
   */
  async resetAllMonthlySpent(now: Date): Promise<number> {
    const result = await this.prisma.aiCredential.updateMany({
      data: { monthSpentUsd: 0, monthResetAt: now },
    })
    return result.count
  }
}
