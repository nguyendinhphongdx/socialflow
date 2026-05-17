import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppException, ResponseCode } from '@sociflow/common'
import { encrypt } from '@sociflow/common/crypto'
import { OAuthCredentialResolver } from './oauth-credential-resolver'

// Random 32-byte key, base64.
const TEST_KEY = Buffer.alloc(32, 7).toString('base64')

describe('OAuthCredentialResolver', () => {
  let resolver: OAuthCredentialResolver
  let mockRepo: { findActiveByScope: ReturnType<typeof vi.fn>, findByScope: ReturnType<typeof vi.fn> }
  let mockConfig: any

  beforeEach(() => {
    mockRepo = {
      findActiveByScope: vi.fn(),
      findByScope: vi.fn(),
    }
    mockConfig = {
      encryption: { key: TEST_KEY },
      oauth: {
        youtube: { clientId: 'dev-youtube-client-id', clientSecret: 'dev', redirectUri: 'http://localhost/cb' },
        facebook: { clientId: 'real-fb-id', clientSecret: 'real-secret', redirectUri: 'http://localhost/fb-cb' },
        instagram: { clientId: 'dev-ig-client-id', clientSecret: '', redirectUri: 'http://localhost/ig-cb' },
        tiktok: { clientKey: 'dev-tt-client-key', clientSecret: '', redirectUri: 'http://localhost/tt-cb' },
      },
    }
    resolver = new OAuthCredentialResolver(mockRepo as never, mockConfig)
  })

  describe('resolve — fallback chain', () => {
    it('returns WORKSPACE credential khi active workspace row tồn tại', async () => {
      const encryptedSecret = encrypt('plain-secret', TEST_KEY)
      mockRepo.findActiveByScope.mockImplementation(async (scope: string) => {
        if (scope === 'WORKSPACE') {
          return {
            id: 'cred1',
            scope: 'WORKSPACE',
            workspaceId: 'ws1',
            platform: 'YOUTUBE',
            clientId: 'ws-client',
            clientSecret: encryptedSecret,
            redirectUri: 'https://app/cb',
            scopes: ['scope1'],
            isActive: true,
          }
        }
        return null
      })

      const result = await resolver.resolve('YOUTUBE', 'ws1')
      expect(result.source).toBe('WORKSPACE')
      expect(result.clientId).toBe('ws-client')
      expect(result.clientSecret).toBe('plain-secret')
      expect(result.credentialId).toBe('cred1')
    })

    it('falls back to SYSTEM khi không có WORKSPACE row', async () => {
      const encryptedSecret = encrypt('sys-secret', TEST_KEY)
      mockRepo.findActiveByScope.mockImplementation(async (scope: string) => {
        if (scope === 'SYSTEM') {
          return {
            id: 'sys1',
            scope: 'SYSTEM',
            workspaceId: null,
            platform: 'YOUTUBE',
            clientId: 'sys-client',
            clientSecret: encryptedSecret,
            redirectUri: 'https://sys/cb',
            scopes: [],
            isActive: true,
          }
        }
        return null
      })

      const result = await resolver.resolve('YOUTUBE', 'ws1')
      expect(result.source).toBe('SYSTEM')
      expect(result.clientId).toBe('sys-client')
      expect(result.clientSecret).toBe('sys-secret')
    })

    it('falls back to ENV cho platform có env config real', async () => {
      mockRepo.findActiveByScope.mockResolvedValue(null)
      const result = await resolver.resolve('FACEBOOK', 'ws1')
      expect(result.source).toBe('ENV')
      expect(result.clientId).toBe('real-fb-id')
      expect(result.credentialId).toBeNull()
    })

    it('throws OAuthCredentialNotConfigured khi env là dev placeholder', async () => {
      mockRepo.findActiveByScope.mockResolvedValue(null)
      await expect(resolver.resolve('YOUTUBE', 'ws1'))
        .rejects.toMatchObject({ code: ResponseCode.OAuthCredentialNotConfigured })
    })

    it('throws OAuthCredentialInvalid khi decrypt fail', async () => {
      mockRepo.findActiveByScope.mockImplementation(async (scope: string) => {
        if (scope === 'WORKSPACE') {
          return {
            id: 'bad',
            scope: 'WORKSPACE',
            workspaceId: 'ws1',
            platform: 'YOUTUBE',
            clientId: 'c',
            clientSecret: 'invalid-base64-payload',
            redirectUri: 'http://x',
            scopes: [],
            isActive: true,
          }
        }
        return null
      })
      await expect(resolver.resolve('YOUTUBE', 'ws1'))
        .rejects.toBeInstanceOf(AppException)
    })
  })

  describe('describe', () => {
    it('returns NONE source khi không có row + env là placeholder', async () => {
      mockRepo.findByScope.mockResolvedValue(null)
      const result = await resolver.describe('YOUTUBE', 'ws1')
      expect(result.source).toBe('NONE')
      expect(result.credentialId).toBeNull()
    })

    it('returns ENV source cho platform có real env', async () => {
      mockRepo.findByScope.mockResolvedValue(null)
      const result = await resolver.describe('FACEBOOK', 'ws1')
      expect(result.source).toBe('ENV')
      expect(result.clientId).toBe('real-fb-id')
    })

    it('returns WORKSPACE source khi workspace credential tồn tại', async () => {
      mockRepo.findByScope.mockImplementation(async (scope: string) => {
        if (scope === 'WORKSPACE') {
          return {
            id: 'wsc',
            scope: 'WORKSPACE',
            workspaceId: 'ws1',
            platform: 'TIKTOK',
            clientId: 'tt-key',
            clientSecret: '...',
            redirectUri: 'http://x',
            scopes: [],
            isActive: true,
            notes: null,
            updatedAt: new Date(),
          }
        }
        return null
      })
      const result = await resolver.describe('TIKTOK', 'ws1')
      expect(result.source).toBe('WORKSPACE')
      expect(result.credentialId).toBe('wsc')
    })
  })
})
