import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@prisma/client'
import { ResponseCode } from '@sociflow/common'
import { sha256 } from '@sociflow/common/crypto'
import { SessionRepository } from './session.repository'

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date()
  return {
    id: 'sess_1',
    userId: 'user_1',
    refreshTokenSha256: sha256('raw-refresh-token'),
    userAgent: 'jest-test',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(now.getTime() + 7 * 86_400_000),
    revokedAt: null,
    replacedBySessionId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('SessionRepository', () => {
  let repo: SessionRepository
  let prisma: {
    session: {
      findUnique: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
      updateMany: ReturnType<typeof vi.fn>
      deleteMany: ReturnType<typeof vi.fn>
    }
    $transaction: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    prisma = {
      session: {
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      // Run callback with `tx` = the session helpers (same instance)
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
    }
    repo = new SessionRepository(prisma as never)
  })

  describe('rotate (single-use refresh)', () => {
    it('rotates successfully: creates new + revokes old', async () => {
      const oldRaw = 'old-token'
      const newRaw = 'new-token'
      const oldSession = makeSession({
        id: 'sess_old',
        refreshTokenSha256: sha256(oldRaw),
      })
      const newSession = makeSession({
        id: 'sess_new',
        refreshTokenSha256: sha256(newRaw),
      })

      prisma.session.findUnique.mockResolvedValue(oldSession)
      prisma.session.create.mockResolvedValue(newSession)
      prisma.session.updateMany.mockResolvedValue({ count: 1 })

      const result = await repo.rotate(oldRaw, {
        userId: 'user_1',
        refreshToken: newRaw,
        expiresAt: new Date(Date.now() + 86_400_000),
      })

      expect(result.kind).toBe('ok')
      if (result.kind === 'ok') {
        expect(result.oldSession.id).toBe('sess_old')
        expect(result.newSession.id).toBe('sess_new')
      }
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'sess_old', revokedAt: null },
        data: expect.objectContaining({ replacedBySessionId: 'sess_new' }),
      })
    })

    it('returns replay branch when refresh token already revoked', async () => {
      const oldRaw = 'replayed-token'
      const revoked = makeSession({
        id: 'sess_revoked',
        userId: 'user_42',
        refreshTokenSha256: sha256(oldRaw),
        revokedAt: new Date(),
      })
      prisma.session.findUnique.mockResolvedValue(revoked)

      const result = await repo.rotate(oldRaw, {
        userId: 'user_42',
        refreshToken: 'new-tok',
        expiresAt: new Date(Date.now() + 86_400_000),
      })

      expect(result).toEqual({ kind: 'replay', userId: 'user_42' })
      expect(prisma.session.create).not.toHaveBeenCalled()
      expect(prisma.session.updateMany).not.toHaveBeenCalled()
    })

    it('throws RefreshTokenInvalid when token not found', async () => {
      prisma.session.findUnique.mockResolvedValue(null)
      await expect(
        repo.rotate('unknown', {
          userId: 'user_1',
          refreshToken: 'x',
          expiresAt: new Date(Date.now() + 86_400_000),
        }),
      ).rejects.toMatchObject({ code: ResponseCode.RefreshTokenInvalid })
    })

    it('throws SessionExpired when expiresAt passed', async () => {
      const expired = makeSession({ expiresAt: new Date(Date.now() - 1000) })
      prisma.session.findUnique.mockResolvedValue(expired)
      await expect(
        repo.rotate('x', {
          userId: 'user_1',
          refreshToken: 'y',
          expiresAt: new Date(Date.now() + 86_400_000),
        }),
      ).rejects.toMatchObject({ code: ResponseCode.SessionExpired })
    })

    it('throws RefreshTokenInvalid on race (updateMany count=0)', async () => {
      const oldSession = makeSession()
      prisma.session.findUnique.mockResolvedValue(oldSession)
      prisma.session.create.mockResolvedValue(makeSession({ id: 'sess_new' }))
      prisma.session.updateMany.mockResolvedValue({ count: 0 })

      await expect(
        repo.rotate('raw-refresh-token', {
          userId: 'user_1',
          refreshToken: 'new',
          expiresAt: new Date(Date.now() + 86_400_000),
        }),
      ).rejects.toMatchObject({ code: ResponseCode.RefreshTokenInvalid })
    })
  })

  describe('revokeBySessionId', () => {
    it('revokes session by id (Wave 1 logout fix)', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 })
      await repo.revokeBySessionId('sess_xyz')
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'sess_xyz', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    })

    it('is idempotent when session already revoked (count=0 ok)', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 0 })
      await expect(repo.revokeBySessionId('sess_xyz')).resolves.toBeUndefined()
    })
  })

  describe('revokeByRefreshTokenHash', () => {
    it('revokes session by refresh token hash', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 })
      const hash = sha256('some-raw-token')
      await repo.revokeByRefreshTokenHash(hash)
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { refreshTokenSha256: hash, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    })
  })

  describe('revokeAllByUserId', () => {
    it('returns count of revoked sessions', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 3 })
      const count = await repo.revokeAllByUserId('user_1')
      expect(count).toBe(3)
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    })
  })

  describe('create', () => {
    it('hashes refresh token before persisting', async () => {
      const raw = 'plain-refresh'
      prisma.session.create.mockResolvedValue(makeSession())
      await repo.create({
        userId: 'user_1',
        refreshToken: raw,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      const call = prisma.session.create.mock.calls[0]![0]
      expect(call.data.refreshTokenSha256).toBe(sha256(raw))
      expect(call.data.refreshTokenSha256).not.toBe(raw)
    })
  })
})
