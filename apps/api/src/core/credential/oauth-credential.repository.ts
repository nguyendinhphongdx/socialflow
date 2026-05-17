import { Injectable } from '@nestjs/common'
import type {
  AccountPlatform,
  CredentialScope,
  OAuthCredential,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'

@Injectable()
export class OAuthCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<OAuthCredential | null> {
    return this.prisma.oAuthCredential.findUnique({ where: { id } })
  }

  /**
   * Lookup credential active theo (scope, workspaceId, platform).
   * Trả null nếu không tồn tại HOẶC isActive=false.
   */
  async findActiveByScope(
    scope: CredentialScope,
    workspaceId: string | null,
    platform: AccountPlatform,
  ): Promise<OAuthCredential | null> {
    return this.prisma.oAuthCredential.findFirst({
      where: { scope, workspaceId, platform, isActive: true },
    })
  }

  async findByScope(
    scope: CredentialScope,
    workspaceId: string | null,
    platform: AccountPlatform,
  ): Promise<OAuthCredential | null> {
    return this.prisma.oAuthCredential.findFirst({
      where: { scope, workspaceId, platform },
    })
  }

  async listByWorkspaceId(workspaceId: string): Promise<OAuthCredential[]> {
    return this.prisma.oAuthCredential.findMany({
      where: { scope: 'WORKSPACE', workspaceId },
      orderBy: { platform: 'asc' },
    })
  }

  async listSystem(): Promise<OAuthCredential[]> {
    return this.prisma.oAuthCredential.findMany({
      where: { scope: 'SYSTEM' },
      orderBy: { platform: 'asc' },
    })
  }

  async create(data: Prisma.OAuthCredentialUncheckedCreateInput): Promise<OAuthCredential> {
    return this.prisma.oAuthCredential.create({ data })
  }

  async updateById(id: string, data: Prisma.OAuthCredentialUpdateInput): Promise<OAuthCredential> {
    return this.prisma.oAuthCredential.update({ where: { id }, data })
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.oAuthCredential.delete({ where: { id } })
  }
}
