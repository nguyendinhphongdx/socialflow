import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { ApiKey, User } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import type { AppConfig } from '../../config'
import { ApiKeyScope } from './api-key.constants'
import { ApiKeyService } from './api-key.service'

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date()
  return {
    id: 'user_1',
    email: 'a@b.com',
    emailVerified: true,
    passwordHash: 'hash',
    name: 'Alice',
    avatarUrl: null,
    locale: 'vi',
    role: 'USER',
    planTier: 'FREE',
    planExpiry: null,
    aiCredits: 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as User
}

function makeApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  const now = new Date()
  return {
    id: 'key_1',
    userId: 'user_1',
    keyHash: 'placeholder',
    prefix: 'sf_test_abcdefgh',
    name: 'Test key',
    scopes: [ApiKeyScope.PUBLISH_READ, ApiKeyScope.PUBLISH_WRITE],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ApiKey
}

// 32 bytes base64 -> 44 chars
const PEPPER = Buffer.alloc(32, 7).toString('base64')

function makeConfig(): AppConfig {
  return {
    app: { env: 'test' },
    encryption: { key: PEPPER },
  } as unknown as AppConfig
}

describe('ApiKeyService', () => {
  let service: ApiKeyService
  let repo: {
    create: ReturnType<typeof vi.fn>
    getById: ReturnType<typeof vi.fn>
    getByIdAndUserId: ReturnType<typeof vi.fn>
    getActiveByPrefix: ReturnType<typeof vi.fn>
    listByUserIdWithPagination: ReturnType<typeof vi.fn>
    updateLastUsedAt: ReturnType<typeof vi.fn>
    revokeById: ReturnType<typeof vi.fn>
  }
  let ctx: { requireUserId: ReturnType<typeof vi.fn> }
  let events: EventEmitter2
  let userService: { getById: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = {
      create: vi.fn(),
      getById: vi.fn(),
      getByIdAndUserId: vi.fn(),
      getActiveByPrefix: vi.fn(),
      listByUserIdWithPagination: vi.fn(),
      updateLastUsedAt: vi.fn().mockResolvedValue(undefined),
      revokeById: vi.fn(),
    }
    ctx = { requireUserId: vi.fn().mockReturnValue('user_1') }
    events = new EventEmitter2()
    userService = { getById: vi.fn() }
    service = new ApiKeyService(
      repo as never,
      ctx as never,
      events,
      userService as never,
      makeConfig(),
    )
  })

  describe('create', () => {
    it('returns raw key with proper format and stores only hash', async () => {
      let stored: { keyHash: string, prefix: string } | undefined
      repo.create.mockImplementation(async (data) => {
        stored = { keyHash: data.keyHash, prefix: data.prefix }
        return makeApiKey({ keyHash: data.keyHash, prefix: data.prefix, scopes: data.scopes })
      })

      const { rawKey, entity } = await service.create({
        name: 'Test',
        scopes: [ApiKeyScope.PUBLISH_WRITE],
      })

      expect(rawKey).toMatch(/^sf_test_[A-Za-z0-9_-]{8}[A-Za-z0-9_-]+$/)
      expect(rawKey.length).toBeGreaterThan(40)
      expect(stored).toBeDefined()
      expect(stored!.keyHash).not.toContain(rawKey)             // never store raw
      expect(rawKey.startsWith(stored!.prefix)).toBe(true)        // prefix is leading slice
      // Hash matches sha256(rawKey + pepper)
      const expectedHash = createHash('sha256').update(rawKey).update(PEPPER).digest('hex')
      expect(stored!.keyHash).toBe(expectedHash)
      expect(entity.scopes).toEqual([ApiKeyScope.PUBLISH_WRITE])
    })

    it('rejects invalid scope', async () => {
      await expect(
        service.create({ name: 'Bad', scopes: ['not:a:scope'] }),
      ).rejects.toMatchObject({ code: ResponseCode.ValidationFailed })
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('emits api-key.created event on success', async () => {
      repo.create.mockImplementation(async (data) =>
        makeApiKey({ scopes: data.scopes, prefix: data.prefix, keyHash: data.keyHash }),
      )
      const spy = vi.fn()
      events.on('api-key.created', spy)

      await service.create({ name: 'k', scopes: [ApiKeyScope.AI_GENERATE] })

      expect(spy).toHaveBeenCalledOnce()
      expect(spy.mock.calls[0]?.[0]).toMatchObject({
        userId: 'user_1',
        scopes: [ApiKeyScope.AI_GENERATE],
      })
    })
  })

  describe('validate', () => {
    it('returns user + scopes for valid key (happy path)', async () => {
      // Setup: create a key, then call validate with raw key
      let savedKey: ApiKey | undefined
      repo.create.mockImplementation(async (data) => {
        savedKey = makeApiKey({
          keyHash: data.keyHash,
          prefix: data.prefix,
          scopes: data.scopes,
        })
        return savedKey
      })
      const { rawKey } = await service.create({
        name: 'k',
        scopes: [ApiKeyScope.PUBLISH_READ],
      })

      repo.getActiveByPrefix.mockResolvedValue(savedKey!)
      userService.getById.mockResolvedValue(makeUser())

      const result = await service.validate(rawKey)
      expect(result).not.toBeNull()
      expect(result!.user.id).toBe('user_1')
      expect(result!.scopes).toEqual([ApiKeyScope.PUBLISH_READ])
      expect(repo.updateLastUsedAt).toHaveBeenCalledWith(savedKey!.id)
    })

    it('returns null when raw key format invalid', async () => {
      const r = await service.validate('garbage-not-a-key')
      expect(r).toBeNull()
      expect(repo.getActiveByPrefix).not.toHaveBeenCalled()
    })

    it('returns null when prefix not found in DB', async () => {
      repo.getActiveByPrefix.mockResolvedValue(null)
      const r = await service.validate('sf_test_aaaaaaaaZZZZZZZZZZZZZZZZ')
      expect(r).toBeNull()
    })

    it('returns null when hash mismatch (wrong key with right prefix)', async () => {
      let savedKey: ApiKey | undefined
      repo.create.mockImplementation(async (data) => {
        savedKey = makeApiKey({
          keyHash: data.keyHash,
          prefix: data.prefix,
          scopes: data.scopes,
        })
        return savedKey
      })
      const { rawKey } = await service.create({
        name: 'k',
        scopes: [ApiKeyScope.PUBLISH_READ],
      })

      repo.getActiveByPrefix.mockResolvedValue(savedKey!)
      // Tamper rawKey suffix (keep prefix)
      const tampered = `${savedKey!.prefix}TAMPERED_SUFFIX_ZZZZZZZZZZZZZZZZ`
      const r = await service.validate(tampered)
      expect(r).toBeNull()
    })

    it('throws ApiKeyExpired when key past expiresAt', async () => {
      let savedKey: ApiKey | undefined
      repo.create.mockImplementation(async (data) => {
        savedKey = makeApiKey({
          keyHash: data.keyHash,
          prefix: data.prefix,
          scopes: data.scopes,
          expiresAt: new Date(Date.now() - 1000),
        })
        return savedKey
      })
      const { rawKey } = await service.create({
        name: 'k',
        scopes: [ApiKeyScope.PUBLISH_READ],
        expiresAt: new Date(Date.now() - 1000),
      })

      repo.getActiveByPrefix.mockResolvedValue(savedKey!)
      await expect(service.validate(rawKey))
        .rejects.toMatchObject({ code: ResponseCode.ApiKeyExpired })
    })

    it('returns null when key revoked (filter excludes revoked)', async () => {
      // Repository.getActiveByPrefix lọc revokedAt:null sẵn → trả null
      repo.getActiveByPrefix.mockResolvedValue(null)
      const r = await service.validate('sf_test_aaaaaaaaZZZZZZZZZZZZ')
      expect(r).toBeNull()
    })
  })

  describe('revoke', () => {
    it('revokes own key and emits event', async () => {
      const existing = makeApiKey()
      repo.getByIdAndUserId.mockResolvedValue(existing)
      repo.revokeById.mockResolvedValue({ ...existing, revokedAt: new Date() })
      const spy = vi.fn()
      events.on('api-key.revoked', spy)

      await service.revoke(existing.id)

      expect(repo.revokeById).toHaveBeenCalledWith(existing.id)
      expect(spy).toHaveBeenCalledOnce()
    })

    it('throws ApiKeyNotFound when key belongs to another user', async () => {
      repo.getByIdAndUserId.mockResolvedValue(null)
      await expect(service.revoke('key_other'))
        .rejects.toMatchObject({ code: ResponseCode.ApiKeyNotFound })
    })
  })

  describe('getByCurrentUserAndId', () => {
    it('throws ApiKeyNotFound when not exists', async () => {
      repo.getByIdAndUserId.mockResolvedValue(null)
      await expect(service.getByCurrentUserAndId('missing'))
        .rejects.toBeInstanceOf(AppException)
    })
  })
})
