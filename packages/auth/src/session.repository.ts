import { Injectable } from '@nestjs/common'
import { PrismaService } from '@sociflow/prisma'
import { AppException, ResponseCode } from '@sociflow/common'
import { sha256 } from '@sociflow/common/crypto'
import type { Session } from '@sociflow/prisma'

interface CreateSessionInput {
  userId: string
  refreshToken: string         // raw — sẽ hash trước khi lưu
  expiresAt: Date
  userAgent?: string
  ipAddress?: string
}

/**
 * Kết quả rotate session.
 *
 * - `ok` — normal flow: old revoke, new created
 * - `replay` — refresh token đã revoke được gửi lại (suspicious). Caller (auth service) phải
 *   `revokeAllByUserId(result.userId)` + log incident.
 *
 * Hard errors throw `AppException`:
 * - Token không tồn tại → `RefreshTokenInvalid`
 * - Session expired → `SessionExpired`
 * - Concurrent rotate (race) → `RefreshTokenInvalid`
 */
export type RotateResult =
  | { kind: 'ok', oldSession: Session, newSession: Session }
  | { kind: 'replay', userId: string }

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo session mới với refresh token đã hash.
   */
  async create(input: CreateSessionInput): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId: input.userId,
        refreshTokenSha256: sha256(input.refreshToken),
        expiresAt: input.expiresAt,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      },
    })
  }

  async getByRefreshTokenHash(hash: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { refreshTokenSha256: hash } })
  }

  /**
   * Rotate session — revoke old, create new (single-use refresh).
   *
   * Atomic via `$transaction` + `updateMany` với guard `revokedAt: null`
   * → race-safe khi 2 tab refresh đồng thời (chỉ 1 win).
   */
  async rotate(oldRefreshToken: string, newInput: CreateSessionInput): Promise<RotateResult> {
    const oldHash = sha256(oldRefreshToken)
    const session = await this.prisma.session.findUnique({ where: { refreshTokenSha256: oldHash } })

    if (!session) {
      throw new AppException(ResponseCode.RefreshTokenInvalid)
    }
    if (session.expiresAt < new Date()) {
      throw new AppException(ResponseCode.SessionExpired)
    }

    // Replay detection: đã revoke → suspicious, caller phải revoke-all
    if (session.revokedAt) {
      return { kind: 'replay', userId: session.userId }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const newSession = await tx.session.create({
          data: {
            userId: newInput.userId,
            refreshTokenSha256: sha256(newInput.refreshToken),
            expiresAt: newInput.expiresAt,
            userAgent: newInput.userAgent,
            ipAddress: newInput.ipAddress,
          },
        })
        const updated = await tx.session.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: new Date(), replacedBySessionId: newSession.id },
        })
        if (updated.count === 0) {
          // Race: session bị revoke giữa chừng → rollback toàn bộ transaction
          throw new AppException(ResponseCode.RefreshTokenInvalid)
        }
        return { kind: 'ok' as const, oldSession: session, newSession }
      })
    }
    catch (err) {
      if (err instanceof AppException) throw err
      throw new AppException(ResponseCode.RefreshTokenInvalid)
    }
  }

  async revokeByRefreshTokenHash(hash: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenSha256: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  /** Revoke session theo sessionId (lấy từ JWT payload). */
  async revokeBySessionId(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  /** Revoke tất cả session của user — incident response, replay detected. */
  async revokeAllByUserId(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return result.count
  }

  /** Cleanup expired sessions — gọi từ cron. */
  async deleteExpired(olderThan: Date): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: olderThan } },
    })
    return result.count
  }
}
