import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResponseCode } from '@sociflow/common'
import { decrypt, encrypt } from '@sociflow/common/crypto'
import { OAuthCredentialService } from './oauth-credential.service'

const TEST_KEY = Buffer.alloc(32, 13).toString('base64')

describe('OAuthCredentialService', () => {
  let service: OAuthCredentialService
  let mockRepo: any
  let mockResolver: any
  let mockCtx: any

  beforeEach(() => {
    mockRepo = {
      getById: vi.fn(),
      findByScope: vi.fn(),
      listByWorkspaceId: vi.fn(),
      listSystem: vi.fn(),
      create: vi.fn(),
      updateById: vi.fn(),
      deleteById: vi.fn(),
    }
    mockResolver = { describe: vi.fn() }
    mockCtx = {
      requireUserId: vi.fn().mockReturnValue('user-1'),
      requireWorkspaceId: vi.fn().mockReturnValue('ws-1'),
    }
    service = new OAuthCredentialService(
      mockRepo,
      mockResolver,
      mockCtx,
      { encryption: { key: TEST_KEY } } as never,
    )
  })

  describe('createOrUpsert', () => {
    it('creates new credential khi chưa tồn tại + encrypts secret', async () => {
      mockRepo.findByScope.mockResolvedValue(null)
      mockRepo.create.mockImplementation(async (data: any) => ({ id: 'new', ...data }))

      const result = await service.createOrUpsert({
        platform: 'YOUTUBE',
        clientId: 'client-id',
        clientSecret: 'plain-secret',
        redirectUri: 'http://x/cb',
        scopes: ['s1'],
        isActive: true,
        notes: 'test',
      })

      expect(mockRepo.create).toHaveBeenCalled()
      const call = mockRepo.create.mock.calls[0][0]
      expect(call.scope).toBe('WORKSPACE')
      expect(call.workspaceId).toBe('ws-1')
      expect(call.createdBy).toBe('user-1')
      // Secret was encrypted
      expect(call.clientSecret).not.toBe('plain-secret')
      expect(decrypt(call.clientSecret, TEST_KEY)).toBe('plain-secret')
      expect(result.id).toBe('new')
    })

    it('overwrites existing credential khi đã tồn tại', async () => {
      mockRepo.findByScope.mockResolvedValue({ id: 'existing', platform: 'YOUTUBE' })
      mockRepo.updateById.mockImplementation(async (id: string, data: any) => ({ id, ...data }))

      await service.createOrUpsert({
        platform: 'YOUTUBE',
        clientId: 'new-client',
        clientSecret: 'new-secret',
        redirectUri: 'http://x/cb',
        isActive: true,
      })

      expect(mockRepo.create).not.toHaveBeenCalled()
      expect(mockRepo.updateById).toHaveBeenCalledWith('existing', expect.objectContaining({
        clientId: 'new-client',
      }))
    })
  })

  describe('getById permission', () => {
    it('throws CredentialAccessDenied khi credential thuộc workspace khác', async () => {
      mockRepo.getById.mockResolvedValue({
        id: 'cred', scope: 'WORKSPACE', workspaceId: 'other-ws',
      })
      await expect(service.getById('cred'))
        .rejects.toMatchObject({ code: ResponseCode.CredentialAccessDenied })
    })

    it('throws CredentialAccessDenied khi credential là SYSTEM scope', async () => {
      mockRepo.getById.mockResolvedValue({
        id: 'cred', scope: 'SYSTEM', workspaceId: null,
      })
      await expect(service.getById('cred'))
        .rejects.toMatchObject({ code: ResponseCode.CredentialAccessDenied })
    })

    it('throws OAuthCredentialNotFound khi không tồn tại', async () => {
      mockRepo.getById.mockResolvedValue(null)
      await expect(service.getById('xxx'))
        .rejects.toMatchObject({ code: ResponseCode.OAuthCredentialNotFound })
    })

    it('returns entity khi workspace match', async () => {
      const entity = { id: 'cred', scope: 'WORKSPACE', workspaceId: 'ws-1' }
      mockRepo.getById.mockResolvedValue(entity)
      const result = await service.getById('cred')
      expect(result).toBe(entity)
    })
  })

  describe('verify', () => {
    it('returns ok=true khi decrypt thành công + redirectUri hợp lệ', async () => {
      const encrypted = encrypt('decryptable-secret', TEST_KEY)
      mockRepo.getById.mockResolvedValue({
        id: 'cred', scope: 'WORKSPACE', workspaceId: 'ws-1',
        clientSecret: encrypted,
        redirectUri: 'https://valid.com/cb',
      })
      const result = await service.verify('cred')
      expect(result.ok).toBe(true)
    })

    it('returns ok=false khi decrypt fail', async () => {
      mockRepo.getById.mockResolvedValue({
        id: 'cred', scope: 'WORKSPACE', workspaceId: 'ws-1',
        clientSecret: 'invalid-encrypted',
        redirectUri: 'https://valid.com/cb',
      })
      const result = await service.verify('cred')
      expect(result.ok).toBe(false)
    })
  })

  describe('decryptAndMask', () => {
    it('masks secret consistently', () => {
      const encrypted = encrypt('sk-1234567890abc', TEST_KEY)
      const masked = service.decryptAndMask({ clientSecret: encrypted } as never)
      expect(masked).toMatch(/^sk-1.*0abc$/)
    })
  })
})
