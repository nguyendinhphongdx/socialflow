import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import type { SocialAccount } from '@prisma/client'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import { InstagramInsightProvider } from './instagram-insight.provider'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

function makeAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
  const now = new Date()
  return {
    id: 'acc_ig_1',
    userId: 'user_1',
    platform: 'INSTAGRAM',
    accountType: 'BUSINESS',
    platformUid: 'ig_user_123',
    displayName: 'IG Account',
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
  } as unknown as SocialAccount
}

describe('InstagramInsightProvider', () => {
  let provider: InstagramInsightProvider

  beforeEach(() => {
    provider = new InstagramInsightProvider()
    vi.clearAllMocks()
  })

  describe('fetchPostMetrics', () => {
    it('parses IG insights response correctly', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            { name: 'impressions', values: [{ value: 1000 }] },
            { name: 'reach', values: [{ value: 800 }] },
            { name: 'likes', values: [{ value: 120 }] },
            { name: 'comments', values: [{ value: 15 }] },
            { name: 'saved', values: [{ value: 8 }] },
            { name: 'shares', values: [{ value: 3 }] },
          ],
        },
      })

      const metrics = await provider.fetchPostMetrics(makeAccount(), 'token-x', 'media_123')

      expect(metrics.views).toBe(1000)
      expect(metrics.reachUnique).toBe(800)
      expect(metrics.likes).toBe(120)
      expect(metrics.comments).toBe(15)
      expect(metrics.saves).toBe(8)
      expect(metrics.shares).toBe(3)
    })

    it('calls graph.facebook.com with metric csv and post id', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } })
      await provider.fetchPostMetrics(makeAccount(), 'token-x', 'media_999')

      const calledUrl = mockedAxios.get.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('graph.facebook.com')
      expect(calledUrl).toContain('/media_999/insights')
      expect(calledUrl).toContain('metric=impressions,reach,likes,comments,saved,shares')
    })

    it('returns 0 for missing metrics', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } })
      const metrics = await provider.fetchPostMetrics(makeAccount(), 'token', 'media_1')
      expect(metrics.views).toBe(0)
      expect(metrics.likes).toBe(0)
    })

    it('throws AccountTokenExpired on 401', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 401, data: { error: 'oauth' } } })
      await expect(provider.fetchPostMetrics(makeAccount(), 't', 'm'))
        .rejects.toMatchObject({ code: ResponseCode.AccountTokenExpired })
    })

    it('throws RetryableError on 429 rate limit', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 429 } })
      await expect(provider.fetchPostMetrics(makeAccount(), 't', 'm'))
        .rejects.toBeInstanceOf(RetryableError)
    })

    it('throws RetryableError on 5xx', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 503 } })
      await expect(provider.fetchPostMetrics(makeAccount(), 't', 'm'))
        .rejects.toBeInstanceOf(RetryableError)
    })

    it('throws InsightFetchFailed on 400', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 400, data: { msg: 'invalid' } } })
      await expect(provider.fetchPostMetrics(makeAccount(), 't', 'm'))
        .rejects.toBeInstanceOf(AppException)
    })
  })

  describe('fetchAccountFollowers', () => {
    it('returns followers_count', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { followers_count: 5432 } })
      const count = await provider.fetchAccountFollowers(makeAccount(), 'token-x')
      expect(count).toBe(5432)
    })

    it('uses platformUid in URL', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { followers_count: 0 } })
      await provider.fetchAccountFollowers(makeAccount({ platformUid: 'ig_special_id' } as Partial<SocialAccount>), 't')
      const url = mockedAxios.get.mock.calls[0]?.[0] as string
      expect(url).toContain('/ig_special_id')
      expect(url).toContain('fields=followers_count')
    })

    it('returns 0 when followers_count missing', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: {} })
      const count = await provider.fetchAccountFollowers(makeAccount(), 't')
      expect(count).toBe(0)
    })

    it('throws AccountTokenExpired on 403', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 403 } })
      await expect(provider.fetchAccountFollowers(makeAccount(), 't'))
        .rejects.toMatchObject({ code: ResponseCode.AccountTokenExpired })
    })
  })
})
