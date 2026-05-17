import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishRecord, SocialAccount } from '@prisma/client'
import { ResponseCode } from '@sociflow/common'
import { PublishService } from './publish.service'

function makeAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
  const now = new Date()
  return {
    id: 'acc_1',
    userId: 'user_1',
    workspaceId: 'wks_1',
    platform: 'FACEBOOK',
    accountType: 'PAGE',
    platformAccountId: 'fb_123',
    displayName: 'Page A',
    avatarUrl: null,
    status: 'ACTIVE',
    accessTokenEnc: 'enc',
    refreshTokenEnc: null,
    accessTokenExpiresAt: null,
    scopes: [],
    publishMode: 'API',
    agentId: null,
    metadata: {},
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as SocialAccount
}

function makeRecord(overrides: Partial<PublishRecord> = {}): PublishRecord {
  const now = new Date()
  return {
    id: 'rec_1',
    userId: 'user_1',
    workspaceId: 'wks_1',
    accountId: 'acc_1',
    flowId: 'flow_1',
    publishMode: 'API',
    title: null,
    body: null,
    mediaIds: [],
    platformOptions: null,
    publishTime: now,
    status: 'PENDING',
    stage: null,
    retryCount: 0,
    errorMessage: null,
    platformPostId: null,
    workLink: null,
    publishedAt: null,
    idempotencyKey: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as PublishRecord
}

describe('PublishService', () => {
  let service: PublishService
  let repo: {
    getById: ReturnType<typeof vi.fn>
    getByIdAndUserId: ReturnType<typeof vi.fn>
    getByIdAndWorkspaceId: ReturnType<typeof vi.fn>
    getByIdempotencyKey: ReturnType<typeof vi.fn>
    getByWorkspaceIdAndIdempotencyKey: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    listByUserWithPagination: ReturnType<typeof vi.fn>
    listByWorkspaceWithPagination: ReturnType<typeof vi.fn>
    updateById: ReturnType<typeof vi.fn>
  }
  let accountService: { getByIdForCurrentUser: ReturnType<typeof vi.fn> }
  let mediaService: { listForPublish: ReturnType<typeof vi.fn> }
  let queue: { addBulk: ReturnType<typeof vi.fn> }
  let ctx: { requireUserId: ReturnType<typeof vi.fn>, requireWorkspaceId: ReturnType<typeof vi.fn> }
  let redlock: { withLock: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = {
      getById: vi.fn(),
      getByIdAndUserId: vi.fn(),
      getByIdAndWorkspaceId: vi.fn(),
      getByIdempotencyKey: vi.fn().mockResolvedValue(null),
      getByWorkspaceIdAndIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      listByUserWithPagination: vi.fn(),
      listByWorkspaceWithPagination: vi.fn(),
      updateById: vi.fn(),
    }
    accountService = { getByIdForCurrentUser: vi.fn() }
    mediaService = { listForPublish: vi.fn().mockResolvedValue([]) }
    queue = { addBulk: vi.fn().mockResolvedValue(undefined) }
    ctx = {
      requireUserId: vi.fn().mockReturnValue('user_1'),
      requireWorkspaceId: vi.fn().mockReturnValue('wks_1'),
    }
    // Pass-through lock — verify được gọi với key đúng nhưng không thực sự khoá
    redlock = {
      withLock: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    }

    service = new PublishService(
      repo as never,
      accountService as never,
      mediaService as never,
      ctx as never,
      queue as never,
      redlock as never,
    )
  })

  describe('createBundle', () => {
    it('creates N records for N ACTIVE accounts and enqueues immediate jobs', async () => {
      const accountA = makeAccount({ id: 'acc_a' })
      const accountB = makeAccount({ id: 'acc_b' })
      accountService.getByIdForCurrentUser
        .mockResolvedValueOnce(accountA)
        .mockResolvedValueOnce(accountB)
      repo.create
        .mockResolvedValueOnce(makeRecord({ id: 'rec_a', accountId: 'acc_a' }))
        .mockResolvedValueOnce(makeRecord({ id: 'rec_b', accountId: 'acc_b' }))

      const result = await service.createBundle({
        accountIds: ['acc_a', 'acc_b'],
        title: 'Hi',
        body: 'World',
        mediaIds: [],
        publishTime: new Date(Date.now() - 1000), // immediate
      })

      expect(result).toHaveLength(2)
      expect(repo.create).toHaveBeenCalledTimes(2)
      expect(queue.addBulk).toHaveBeenCalledTimes(1)
      const enqueued = queue.addBulk.mock.calls[0]![0]
      expect(enqueued).toHaveLength(2)
      expect(enqueued[0].data).toEqual({ recordId: 'rec_a' })
    })

    it('schedules (no enqueue) when publishTime in future', async () => {
      accountService.getByIdForCurrentUser.mockResolvedValue(makeAccount())
      repo.create.mockResolvedValue(makeRecord({ status: 'SCHEDULED' }))

      const future = new Date(Date.now() + 60_000)
      const result = await service.createBundle({
        accountIds: ['acc_1'],
        mediaIds: [],
        publishTime: future,
      })

      expect(result).toHaveLength(1)
      expect(queue.addBulk).not.toHaveBeenCalled()
      expect(repo.create.mock.calls[0]![0].status).toBe('SCHEDULED')
    })

    it('rejects when any account is not ACTIVE', async () => {
      accountService.getByIdForCurrentUser
        .mockResolvedValueOnce(makeAccount({ id: 'acc_a' }))
        .mockResolvedValueOnce(makeAccount({ id: 'acc_b', status: 'EXPIRED' }))

      await expect(
        service.createBundle({
          accountIds: ['acc_a', 'acc_b'],
          mediaIds: [],
          publishTime: new Date(),
        }),
      ).rejects.toMatchObject({ code: ResponseCode.AccountNotFound })
      expect(repo.create).not.toHaveBeenCalled()
      expect(queue.addBulk).not.toHaveBeenCalled()
    })

    it('rejects when account not owned by current workspace (null returned)', async () => {
      accountService.getByIdForCurrentUser.mockResolvedValue(null)
      await expect(
        service.createBundle({
          accountIds: ['acc_x'],
          mediaIds: [],
          publishTime: new Date(),
        }),
      ).rejects.toMatchObject({ code: ResponseCode.AccountNotFound })
    })

    it('acquires distributed lock scoped by workspaceId when idempotencyKey provided', async () => {
      accountService.getByIdForCurrentUser.mockResolvedValue(makeAccount())
      repo.create.mockResolvedValue(makeRecord())

      await service.createBundle({
        accountIds: ['acc_1'],
        mediaIds: [],
        publishTime: new Date(Date.now() - 1000),
        idempotencyKey: 'key_lock_1',
      })

      expect(redlock.withLock).toHaveBeenCalledTimes(1)
      const [lockKey] = redlock.withLock.mock.calls[0]!
      expect(lockKey).toBe('publish:bundle:wks_1:key_lock_1')
    })

    it('skips lock acquire when no idempotencyKey', async () => {
      accountService.getByIdForCurrentUser.mockResolvedValue(makeAccount())
      repo.create.mockResolvedValue(makeRecord())

      await service.createBundle({
        accountIds: ['acc_1'],
        mediaIds: [],
        publishTime: new Date(Date.now() - 1000),
      })

      expect(redlock.withLock).not.toHaveBeenCalled()
    })

    it('returns existing bundle when idempotencyKey already used (workspace-scoped)', async () => {
      const existing = makeRecord({ id: 'rec_old', flowId: 'flow_old' })
      repo.getByWorkspaceIdAndIdempotencyKey.mockResolvedValue(existing)
      repo.listByWorkspaceWithPagination.mockResolvedValue({
        list: [existing],
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      })

      const result = await service.createBundle({
        accountIds: ['acc_a'],
        mediaIds: [],
        idempotencyKey: 'key_xyz',
      })

      expect(result).toEqual([existing])
      expect(accountService.getByIdForCurrentUser).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
    })
  })

  describe('listByCurrentWorkspace', () => {
    it('returns pagination shape from repo for current workspace', async () => {
      const expected = {
        list: [makeRecord()],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      }
      repo.listByWorkspaceWithPagination.mockResolvedValue(expected)

      const result = await service.listByCurrentWorkspace({ page: 1, pageSize: 20 })

      expect(result).toEqual(expected)
      expect(repo.listByWorkspaceWithPagination).toHaveBeenCalledWith(
        'wks_1',
        { page: 1, pageSize: 20 },
        undefined,
      )
    })

    it('forwards status filter to repo', async () => {
      repo.listByWorkspaceWithPagination.mockResolvedValue({
        list: [], page: 1, pageSize: 10, total: 0, totalPages: 0,
      })
      await service.listByCurrentWorkspace({ page: 1, pageSize: 10 }, { status: 'PUBLISHED' })
      expect(repo.listByWorkspaceWithPagination).toHaveBeenCalledWith(
        'wks_1',
        { page: 1, pageSize: 10 },
        { status: 'PUBLISHED' },
      )
    })
  })

  describe('listBundleByFlowId', () => {
    it('filters by flowId for current workspace', async () => {
      repo.listByWorkspaceWithPagination.mockResolvedValue({
        list: [], page: 1, pageSize: 50, total: 0, totalPages: 0,
      })
      await service.listBundleByFlowId('flow_xyz')
      expect(repo.listByWorkspaceWithPagination).toHaveBeenCalledWith(
        'wks_1',
        { page: 1, pageSize: 50 },
        { flowId: 'flow_xyz' },
      )
    })
  })

  describe('getByCurrentWorkspaceAndId', () => {
    it('returns record when owned by workspace', async () => {
      const record = makeRecord()
      repo.getByIdAndWorkspaceId.mockResolvedValue(record)
      const result = await service.getByCurrentWorkspaceAndId('rec_1')
      expect(result).toBe(record)
    })

    it('throws PublishTaskNotFound when not exists', async () => {
      repo.getByIdAndWorkspaceId.mockResolvedValue(null)
      await expect(service.getByCurrentWorkspaceAndId('rec_x'))
        .rejects.toMatchObject({ code: ResponseCode.PublishTaskNotFound })
    })
  })
})
