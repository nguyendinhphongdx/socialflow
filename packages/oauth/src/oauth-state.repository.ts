import { Injectable } from '@nestjs/common'
import { PrismaService, type OAuthIntent, type OAuthState } from '@sociflow/prisma'

interface CreateOAuthStateInput {
  state: string
  provider: string
  intent: OAuthIntent
  userId?: string | null
  codeVerifier?: string
  redirectUri: string
  expiresAt: Date
  metadata?: Record<string, unknown>
}

@Injectable()
export class OAuthStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOAuthStateInput): Promise<OAuthState> {
    return this.prisma.oAuthState.create({
      data: {
        state: input.state,
        provider: input.provider,
        intent: input.intent,
        userId: input.userId ?? null,
        codeVerifier: input.codeVerifier,
        redirectUri: input.redirectUri,
        expiresAt: input.expiresAt,
        metadata: input.metadata as object | undefined,
      },
    })
  }

  async getByState(state: string): Promise<OAuthState | null> {
    return this.prisma.oAuthState.findUnique({ where: { state } })
  }

  async consume(id: string): Promise<void> {
    await this.prisma.oAuthState.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date() },
    })
  }

  /** Cleanup expired states — cron daily. */
  async deleteExpired(olderThan: Date): Promise<number> {
    const result = await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: olderThan } },
    })
    return result.count
  }
}
