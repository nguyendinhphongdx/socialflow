import { randomInt } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { AutomationAgent } from '@prisma/client'
import { AppException, ResponseCode, sha256, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { AgentRepository } from './agent.repository'
import type { PairClaimDto } from './agent.dto'

const PAIR_CODE_MAX_RETRY = 5

interface AgentTokenPayload {
  sub: string         // agentId
  userId: string
  type: 'agent'
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name)

  constructor(
    private readonly repo: AgentRepository,
    private readonly ctx: RequestContextService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Web: user click "Pair new device" → tạo AutomationAgent row chưa-claim
   * với 6-digit code + TTL.
   */
  async initPair(): Promise<{ pairCode: string, expiresAt: Date, agentPublicId: string }> {
    const userId = this.ctx.requireUserId()
    const pairCode = await this.generateUniquePairCode()
    const expiresAt = new Date(Date.now() + this.config.agent.pairCodeTtlSec * 1000)

    const agent = await this.repo.create({
      user: { connect: { id: userId } },
      type: 'EXTENSION',
      pairCode,
      pairCodeExpiresAt: expiresAt,
      capabilities: [],
    })

    this.logger.log(`User ${userId} initiated pair, agent ${agent.id}, code expires ${expiresAt.toISOString()}`)
    return { pairCode, expiresAt, agentPublicId: agent.publicId }
  }

  /**
   * Extension: user nhập code → verify → issue long-lived JWT.
   * Atomic claim chống race khi nhiều extension nhập cùng code.
   */
  async claim(dto: PairClaimDto): Promise<{
    agentId: string
    agentPublicId: string
    agentToken: string
    wsUrl: string
    userId: string
  }> {
    const existing = await this.repo.getByPairCode(dto.pairCode)
    if (!existing || existing.revokedAt) {
      throw new AppException(ResponseCode.AgentPairingInvalid, { pairCode: dto.pairCode })
    }
    if (existing.agentTokenSha256) {
      throw new AppException(ResponseCode.AgentAlreadyClaimed, { pairCode: dto.pairCode })
    }
    if (!existing.pairCodeExpiresAt || existing.pairCodeExpiresAt.getTime() <= Date.now()) {
      throw new AppException(ResponseCode.AgentPairCodeExpired, { pairCode: dto.pairCode })
    }

    const payload: AgentTokenPayload = {
      sub: existing.id,
      userId: existing.userId,
      type: 'agent',
    }
    const agentToken = await this.jwt.signAsync(payload, {
      secret: this.config.auth.jwtAgentSecret,
      expiresIn: this.config.agent.tokenExpiration as unknown as number,
    })
    const tokenHash = sha256(agentToken)

    const claimed = await this.repo.claimByPairCode({
      pairCode: dto.pairCode,
      agentTokenSha256: tokenHash,
      deviceInfo: dto.deviceInfo,
    })
    if (!claimed) {
      // Race lost: ai đó đã claim/expire giữa check và update
      throw new AppException(ResponseCode.AgentPairingInvalid, { pairCode: dto.pairCode })
    }

    this.logger.log(`Agent ${claimed.id} claimed by ${dto.deviceInfo.browserName} ${dto.deviceInfo.os}`)
    return {
      agentId: claimed.id,
      agentPublicId: claimed.publicId,
      agentToken,
      wsUrl: this.config.agent.wsUrl,
      userId: claimed.userId,
    }
  }

  async listByCurrentUser(
    pagination: PaginationDto,
    filter?: { online?: boolean, includeRevoked?: boolean },
  ) {
    const userId = this.ctx.requireUserId()
    return this.repo.listByUserWithPagination(userId, pagination, filter)
  }

  async getByCurrentUserAndId(id: string): Promise<AutomationAgent> {
    const userId = this.ctx.requireUserId()
    const agent = await this.repo.getByIdAndUserId(id, userId)
    if (!agent) throw new AppException(ResponseCode.AgentNotFound, { agentId: id })
    return agent
  }

  async revoke(id: string): Promise<AutomationAgent> {
    const agent = await this.getByCurrentUserAndId(id)
    if (agent.revokedAt) return agent
    const revoked = await this.repo.revokeById(agent.id)
    this.logger.log(`Agent ${agent.id} revoked by user ${agent.userId}`)
    return revoked
  }

  /**
   * Dùng cho WS Gateway: nhận raw JWT từ extension → verify signature với
   * `jwtAgentSecret` → hash → lookup row → trả agent.
   *
   * Hai layer:
   * 1. JWT verify (signature + expiry + agent `type` claim) — chống token forgery
   * 2. sha256 hash lookup — chống replay sau khi agent đã revoke (DB là source of truth)
   */
  async getByAgentToken(rawToken: string): Promise<AutomationAgent | null> {
    if (!rawToken) return null
    let payload: AgentTokenPayload
    try {
      payload = await this.jwt.verifyAsync<AgentTokenPayload>(rawToken, {
        secret: this.config.auth.jwtAgentSecret,
      })
    }
    catch {
      return null
    }
    if (payload.type !== 'agent') return null
    const hash = sha256(rawToken)
    const agent = await this.repo.getByAgentTokenSha256(hash)
    if (!agent || agent.revokedAt) return null
    // Defense-in-depth: payload.sub phải match agentId trong DB
    if (agent.id !== payload.sub) return null
    return agent
  }

  private async generateUniquePairCode(): Promise<string> {
    for (let i = 0; i < PAIR_CODE_MAX_RETRY; i++) {
      const code = randomInt(100000, 1000000).toString()
      const exists = await this.repo.existsByPairCode(code)
      if (!exists) return code
    }
    throw new AppException(ResponseCode.InternalError, { reason: 'pair_code_collision' })
  }
}
