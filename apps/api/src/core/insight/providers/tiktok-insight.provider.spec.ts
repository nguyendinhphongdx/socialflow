import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import type { SocialAccount } from '@prisma/client'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import { TikTokInsightProvider } from './tiktok-insight.provider'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

function makeAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
  const now = new Date()
  return {
    id: 'acc_tt_1',
    userId: 'user_1',
    platform: 'TIKTOK',
    accountType: 'USER',
    platformUid: 'tt_user_x',
    displayName: 'TT Account',
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

describe('TikTokInsightProvider', () => {
  let provider: TikTokInsightProvider

  beforeEach(() => {
    provider = new TikTokInsightProvider()
    vi.clearAllMocks()
  })

  describe('fetchPostMetrics', () => {
    it('parses Research API response', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            videos: [{
              video_id: 'v1',
              view_count: 9999,
              like_count: 800,
              comment_count: 42,
              share_count: 15,
            }],
          },
        },
      })

      const m = await provider.fetchPostMetrics(makeAccount(), 'token', 'v1')

      expect(m.views).toBe(9999)
      expect(m.likes).toBe(800)
      expect(m.comments).toBe(42)
      expect(m.shares).toBe(15)
      expect(m.saves).toBe(0)
    })

    it('posts query body with video_id filter and required fields', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { data: { videos: [] } } })
      await provider.fetchPostMetrics(makeAccount(), 'token', 'video_777')

      const [url, body, opts] = mockedAxios.post.mock.calls[0] ?? []
      expect(url).toContain('open.tiktokapis.com')
      expect(url).toContain('/research/video/query/')
      expect((opts as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer token')

      const typed = body as { query: { and: Array<{ field_values: string[] }> }, fields: string[] }
      expect(typed.query.and[0].field_values).toEqual(['video_777'])
      expect(typed.fields).toContain('view_count')
      expect(typed.fields).toContain('like_count')
    })

    it('returns empty metrics gracefully on 403 (no Research scope)', async () => {
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 403, data: { error: 'scope' } } })

      const m = await provider.fetchPostMetrics(makeAccount(), 'token', 'v1')

      expect(m.views).toBe(0)
      expect(m.likes).toBe(0)
      expect(m.raw).toEqual({ fallback: 'tt_research_unavailable' })
    })

    it('returns empty metrics gracefully on 400', async () => {
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 400 } })
      const m = await provider.fetchPostMetrics(makeAccount(), 'token', 'v1')
      expect(m.views).toBe(0)
    })

    it('throws AccountTokenExpired on 401', async () => {
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 401 } })
      await expect(provider.fetchPostMetrics(makeAccount(), 'token', 'v1'))
        .rejects.toMatchObject({ code: ResponseCode.AccountTokenExpired })
    })

    it('throws RetryableError on 429', async () => {
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 429 } })
      await expect(provider.fetchPostMetrics(makeAccount(), 'token', 'v1'))
        .rejects.toBeInstanceOf(RetryableError)
    })

    it('throws RetryableError on 5xx', async () => {
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 502 } })
      await expect(provider.fetchPostMetrics(makeAccount(), 'token', 'v1'))
        .rejects.toBeInstanceOf(RetryableError)
    })

    it('returns empty metrics when video not in response', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { data: { videos: [] } } })
      const m = await provider.fetchPostMetrics(makeAccount(), 'token', 'v1')
      expect(m.views).toBe(0)
      expect(m.raw).toEqual({ fallback: 'tt_research_unavailable' })
    })
  })

  describe('fetchAccountFollowers', () => {
    it('returns follower_count from user info', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { data: { user: { follower_count: 12345 } } } })
      const c = await provider.fetchAccountFollowers(makeAccount(), 'token-y')
      expect(c).toBe(12345)
    })

    it('calls user/info with bearer header', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { data: { user: { follower_count: 1 } } } })
      await provider.fetchAccountFollowers(makeAccount(), 'tk')

      const [url, opts] = mockedAxios.get.mock.calls[0] ?? []
      expect(url).toContain('/user/info/')
      expect(url).toContain('fields=follower_count')
      expect((opts as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer tk')
    })

    it('returns 0 when user/follower_count missing', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: {} })
      const c = await provider.fetchAccountFollowers(makeAccount(), 'tk')
      expect(c).toBe(0)
    })

    it('throws AccountTokenExpired on 401', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } })
      await expect(provider.fetchAccountFollowers(makeAccount(), 'tk'))
        .rejects.toMatchObject({ code: ResponseCode.AccountTokenExpired })
    })

    it('throws AccountTokenExpired on 403', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 403 } })
      await expect(provider.fetchAccountFollowers(makeAccount(), 'tk'))
        .rejects.toMatchObject({ code: ResponseCode.AccountTokenExpired })
    })

    it('throws InsightFetchFailed on other 4xx', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 404, data: {} } })
      await expect(provider.fetchAccountFollowers(makeAccount(), 'tk'))
        .rejects.toBeInstanceOf(AppException)
    })
  })
})
