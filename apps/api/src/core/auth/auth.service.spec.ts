import { beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import type { User } from '@prisma/client'
import { ResponseCode } from '@sociflow/common'
import { AuthService } from './auth.service'

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date()
  return {
    id: 'user_1',
    email: 'a@b.com',
    passwordHash: '$2a$12$existinghashplaceholderxxxxxxxxxxxxxxxxxxxxxxx',
    name: 'A',
    role: 'USER',
    emailVerified: false,
    avatarUrl: null,
    planTier: 'FREE',
    aiCredits: 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as User
}

const appConfig = {
  auth: {
    jwtAccessSecret: 'access-secret-at-least-32-characters-long!!',
    jwtRefreshSecret: 'refresh-secret-at-least-32-characters-long!!',
    jwtAccessExpiration: '15m',
    jwtRefreshExpiration: '7d',
  },
  web: {
    appUrl: 'http://localhost:3000',
  },
}

describe('AuthService', () => {
  let service: AuthService
  let userRepo: {
    getByEmail: ReturnType<typeof vi.fn>
    existsByEmail: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  let sessionRepo: {
    create: ReturnType<typeof vi.fn>
    rotate: ReturnType<typeof vi.fn>
    revokeAllByUserId: ReturnType<typeof vi.fn>
    revokeBySessionId: ReturnType<typeof vi.fn>
  }
  let jwt: { signAsync: ReturnType<typeof vi.fn>, verifyAsync: ReturnType<typeof vi.fn> }
  let ctx: {
    requireUserId: ReturnType<typeof vi.fn>
    userAgent: string | undefined
    ip: string | undefined
  }
  let workspaceService: {
    ensurePersonalWorkspace: ReturnType<typeof vi.fn>
    resolvePersonalWorkspaceId: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    userRepo = {
      getByEmail: vi.fn(),
      existsByEmail: vi.fn(),
      create: vi.fn(),
    }
    sessionRepo = {
      create: vi.fn().mockResolvedValue({ id: 'sess_1' }),
      rotate: vi.fn(),
      revokeAllByUserId: vi.fn().mockResolvedValue(2),
      revokeBySessionId: vi.fn().mockResolvedValue(undefined),
    }
    jwt = {
      signAsync: vi.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: vi.fn(),
    }
    ctx = {
      requireUserId: vi.fn().mockReturnValue('user_1'),
      userAgent: 'jest',
      ip: '127.0.0.1',
    }
    workspaceService = {
      ensurePersonalWorkspace: vi.fn().mockResolvedValue({ id: 'wks_1', name: 'Personal', isPersonal: true }),
      resolvePersonalWorkspaceId: vi.fn().mockResolvedValue('wks_1'),
    }

    service = new AuthService(
      userRepo as never,
      sessionRepo as never,
      jwt as never,
      ctx as never,
      { emit: vi.fn() } as never,  // EventEmitter2 mock
      workspaceService as never,
      appConfig as never,
    )
  })

  describe('register', () => {
    it('creates new user + issues tokens when email is free', async () => {
      userRepo.existsByEmail.mockResolvedValue(false)
      const created = makeUser({ id: 'user_new' })
      userRepo.create.mockResolvedValue(created)

      const result = await service.register({
        email: 'new@x.com',
        password: 'password123',
        name: 'New',
      })

      expect(result.user.id).toBe('user_new')
      expect(result.tokens.accessToken).toBe('signed.jwt.token')
      expect(result.tokens.refreshToken).toBe('signed.jwt.token')
      expect(result.tokens.expiresIn).toBe(900) // 15m
      expect(userRepo.create).toHaveBeenCalled()
      expect(sessionRepo.create).toHaveBeenCalled()
    })

    it('throws EmailAlreadyExists when email taken', async () => {
      userRepo.existsByEmail.mockResolvedValue(true)
      await expect(
        service.register({ email: 'dup@x.com', password: 'password123' }),
      ).rejects.toMatchObject({ code: ResponseCode.EmailAlreadyExists })
      expect(userRepo.create).not.toHaveBeenCalled()
    })

    it('creates personal workspace + includes workspaceId in token (F-716)', async () => {
      userRepo.existsByEmail.mockResolvedValue(false)
      const created = makeUser({ id: 'user_new', name: 'Alice' })
      userRepo.create.mockResolvedValue(created)

      await service.register({ email: 'new@x.com', password: 'password123', name: 'Alice' })

      expect(workspaceService.ensurePersonalWorkspace).toHaveBeenCalledWith('user_new', 'Alice')
      // Verify workspaceId được set vào access/refresh JWT payload
      const accessCall = jwt.signAsync.mock.calls.find(c => c[1].secret === appConfig.auth.jwtAccessSecret)
      expect(accessCall![0]).toMatchObject({ sub: 'user_new', workspaceId: 'wks_1' })
    })
  })

  describe('login', () => {
    it('returns user + tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('correct-pass', 4)
      const user = makeUser({ passwordHash: hash })
      userRepo.getByEmail.mockResolvedValue(user)

      const result = await service.login({ email: 'a@b.com', password: 'correct-pass' })

      expect(result.user.id).toBe('user_1')
      expect(result.tokens.accessToken).toBe('signed.jwt.token')
      expect(sessionRepo.create).toHaveBeenCalledTimes(1)
    })

    it('throws InvalidCredentials when password wrong', async () => {
      const hash = await bcrypt.hash('correct-pass', 4)
      userRepo.getByEmail.mockResolvedValue(makeUser({ passwordHash: hash }))
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong-pass' }),
      ).rejects.toMatchObject({ code: ResponseCode.InvalidCredentials })
    })

    it('throws InvalidCredentials when user does not exist (and still runs bcrypt)', async () => {
      const compareSpy = vi.spyOn(bcrypt, 'compare')
      userRepo.getByEmail.mockResolvedValue(null)
      await expect(
        service.login({ email: 'missing@x.com', password: 'whatever' }),
      ).rejects.toMatchObject({ code: ResponseCode.InvalidCredentials })
      // Critical: dummy bcrypt called for timing-constant response
      expect(compareSpy).toHaveBeenCalledTimes(1)
      compareSpy.mockRestore()
    })
  })

  describe('refresh', () => {
    it('rotates session single-use and returns new tokens', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user_1',
        email: 'a@b.com',
        role: 'USER',
        sessionId: 'sess_old',
      })
      sessionRepo.rotate.mockResolvedValue({
        kind: 'ok',
        oldSession: { id: 'sess_old' },
        newSession: { id: 'sess_new' },
      })

      const result = await service.refresh('old-refresh-jwt')

      expect(sessionRepo.rotate).toHaveBeenCalledWith(
        'old-refresh-jwt',
        expect.objectContaining({ userId: 'user_1' }),
      )
      expect(sessionRepo.revokeAllByUserId).not.toHaveBeenCalled()
      expect(result.tokens.accessToken).toBe('signed.jwt.token')
      expect(result.tokens.refreshToken).toBe('signed.jwt.token')
    })

    it('detects replay: revokes ALL user sessions and throws RefreshTokenReused', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user_42',
        email: 'a@b.com',
        role: 'USER',
        sessionId: 'sess_x',
      })
      sessionRepo.rotate.mockResolvedValue({ kind: 'replay', userId: 'user_42' })

      await expect(service.refresh('replayed-refresh')).rejects.toMatchObject({
        code: ResponseCode.RefreshTokenReused,
      })
      expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith('user_42')
    })

    it('throws RefreshTokenInvalid when JWT verify fails', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('invalid sig'))
      await expect(service.refresh('bogus')).rejects.toMatchObject({
        code: ResponseCode.RefreshTokenInvalid,
      })
      expect(sessionRepo.rotate).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('revokes session by id (Wave 1 critical fix)', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user_1',
        email: 'a@b.com',
        role: 'USER',
        sessionId: 'sess_logout',
      })
      await service.logout('valid-refresh')
      expect(sessionRepo.revokeBySessionId).toHaveBeenCalledWith('sess_logout')
    })

    it('is a no-op when refresh token is undefined', async () => {
      await service.logout(undefined)
      expect(jwt.verifyAsync).not.toHaveBeenCalled()
      expect(sessionRepo.revokeBySessionId).not.toHaveBeenCalled()
    })

    it('swallows invalid token errors (idempotent)', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'))
      await expect(service.logout('garbage')).resolves.toBeUndefined()
      expect(sessionRepo.revokeBySessionId).not.toHaveBeenCalled()
    })

    it('does nothing when payload missing sessionId', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user_1', email: 'a@b.com', role: 'USER' })
      await service.logout('no-session-id-jwt')
      expect(sessionRepo.revokeBySessionId).not.toHaveBeenCalled()
    })
  })
})
