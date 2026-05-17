import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResponseCode } from '@sociflow/common'
import { WebhookService } from './webhook.service'
import {
  FacebookWebhookPayloadSchema,
  InstagramWebhookPayloadSchema,
  TikTokWebhookPayloadSchema,
} from './dto'

const APP_SECRET = 'fb-app-secret-fixture'
const VERIFY_TOKEN = 'fb-verify-token-fixture-min-16-chars'

function sign(rawBody: Buffer, secret = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
}

describe('WebhookService', () => {
  let service: WebhookService
  let accountService: { findByPlatformUid: ReturnType<typeof vi.fn> }
  let commentService: { ingestPlatformComment: ReturnType<typeof vi.fn> }
  const config = {
    oauth: { facebook: { clientSecret: APP_SECRET } },
    webhook: { facebookVerifyToken: VERIFY_TOKEN },
  } as never

  beforeEach(() => {
    accountService = { findByPlatformUid: vi.fn() }
    commentService = { ingestPlatformComment: vi.fn().mockResolvedValue(undefined) }
    service = new WebhookService(
      accountService as never,
      commentService as never,
      config,
    )
  })

  describe('verifyMetaSignature', () => {
    it('accepts valid signature', () => {
      const body = Buffer.from('{"hello":"world"}')
      expect(() => service.verifyMetaSignature(sign(body), body)).not.toThrow()
    })

    it('rejects tampered body (different sig)', () => {
      const body = Buffer.from('{"hello":"world"}')
      const tampered = Buffer.from('{"hello":"evil"}')
      expect(() => service.verifyMetaSignature(sign(body), tampered))
        .toThrow(expect.objectContaining({ code: ResponseCode.AccessDenied }))
    })

    it('rejects when signature header missing', () => {
      expect(() => service.verifyMetaSignature(undefined, Buffer.from('{}')))
        .toThrow(expect.objectContaining({ code: ResponseCode.AccessDenied }))
    })

    it('rejects when rawBody not available', () => {
      expect(() => service.verifyMetaSignature(sign(Buffer.from('{}')), undefined))
        .toThrow(expect.objectContaining({ code: ResponseCode.InternalError }))
    })

    it('rejects signature signed with wrong secret', () => {
      const body = Buffer.from('{"hello":"world"}')
      expect(() => service.verifyMetaSignature(sign(body, 'wrong-secret'), body))
        .toThrow(expect.objectContaining({ code: ResponseCode.AccessDenied }))
    })
  })

  describe('verifyMetaSubscribe', () => {
    it('returns challenge when mode=subscribe and token matches', () => {
      expect(service.verifyMetaSubscribe('subscribe', VERIFY_TOKEN, 'chal_123')).toBe('chal_123')
    })

    it('rejects when token mismatches', () => {
      expect(() => service.verifyMetaSubscribe('subscribe', 'wrong-token', 'chal'))
        .toThrow(expect.objectContaining({ code: ResponseCode.AccessDenied }))
    })

    it('rejects when mode is not subscribe', () => {
      expect(() => service.verifyMetaSubscribe('unsubscribe', VERIFY_TOKEN, 'chal'))
        .toThrow(expect.objectContaining({ code: ResponseCode.AccessDenied }))
    })
  })

  describe('handleFacebook', () => {
    it('dispatches comment ingest for FB page with valid account', async () => {
      accountService.findByPlatformUid.mockResolvedValue({ id: 'acc_1', userId: 'user_1' })
      const payload = FacebookWebhookPayloadSchema.parse({
        object: 'page',
        entry: [{
          id: 'page_123',
          time: 1700000000,
          changes: [{
            field: 'feed',
            value: {
              item: 'comment',
              verb: 'add',
              comment_id: 'cmt_1',
              message: 'Hello',
              from: { id: 'usr_x', name: 'Visitor' },
              created_time: 1700000010,
            },
          }],
        }],
      })

      await service.handleFacebook(payload)

      expect(accountService.findByPlatformUid).toHaveBeenCalledWith('FACEBOOK', 'page_123')
      expect(commentService.ingestPlatformComment).toHaveBeenCalledTimes(1)
      const arg = commentService.ingestPlatformComment.mock.calls[0]![0]
      expect(arg).toMatchObject({
        platform: 'FACEBOOK',
        platformCommentId: 'cmt_1',
        text: 'Hello',
        accountId: 'acc_1',
        userId: 'user_1',
      })
    })

    it('routes to INSTAGRAM platform when object=instagram', async () => {
      accountService.findByPlatformUid.mockResolvedValue({ id: 'acc_ig', userId: 'user_1' })
      const payload = FacebookWebhookPayloadSchema.parse({
        object: 'instagram',
        entry: [{
          id: 'ig_456',
          changes: [{
            field: 'comments',
            value: {
              verb: 'add',
              comment_id: 'ig_cmt_1',
              message: 'Nice',
            },
          }],
        }],
      })

      await service.handleFacebook(payload)
      expect(accountService.findByPlatformUid).toHaveBeenCalledWith('INSTAGRAM', 'ig_456')
      expect(commentService.ingestPlatformComment.mock.calls[0]![0]).toMatchObject({
        platform: 'INSTAGRAM',
        platformCommentId: 'ig_cmt_1',
      })
    })

    it('skips entries when account not found', async () => {
      accountService.findByPlatformUid.mockResolvedValue(null)
      const payload = FacebookWebhookPayloadSchema.parse({
        object: 'page',
        entry: [{ id: 'unknown_page', changes: [] }],
      })
      await service.handleFacebook(payload)
      expect(commentService.ingestPlatformComment).not.toHaveBeenCalled()
    })

    it('skips comment with verb != add', async () => {
      accountService.findByPlatformUid.mockResolvedValue({ id: 'acc_1', userId: 'user_1' })
      const payload = FacebookWebhookPayloadSchema.parse({
        object: 'page',
        entry: [{
          id: 'p',
          changes: [{
            field: 'feed',
            value: { item: 'comment', verb: 'remove', comment_id: 'c1', message: 'x' },
          }],
        }],
      })
      await service.handleFacebook(payload)
      expect(commentService.ingestPlatformComment).not.toHaveBeenCalled()
    })
  })

  describe('handleInstagram', () => {
    it('dispatches like handleFacebook with INSTAGRAM platform', async () => {
      accountService.findByPlatformUid.mockResolvedValue({ id: 'acc_ig', userId: 'user_1' })
      const payload = InstagramWebhookPayloadSchema.parse({
        object: 'instagram',
        entry: [{
          id: 'ig_1',
          changes: [{ field: 'comments', value: { verb: 'add', comment_id: 'c2', message: 'hi' } }],
        }],
      })
      await service.handleInstagram(payload)
      expect(commentService.ingestPlatformComment).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleTikTok', () => {
    it('parses and acks tiktok payload without throwing', async () => {
      const payload = TikTokWebhookPayloadSchema.parse({
        event: 'post.publish.complete',
        client_key: 'ck',
        user_openid: 'open_1',
        create_time: 1700000000,
        content: { publish_id: 'pub_1' },
      })
      await expect(service.handleTikTok(payload)).resolves.toBeUndefined()
    })
  })

  describe('DTO schemas', () => {
    it('FacebookWebhookPayloadSchema parses valid page payload', () => {
      const r = FacebookWebhookPayloadSchema.parse({
        object: 'page',
        entry: [],
      })
      expect(r.object).toBe('page')
    })

    it('FacebookWebhookPayloadSchema passthrough preserves unknown field', () => {
      const r = FacebookWebhookPayloadSchema.parse({
        object: 'page',
        entry: [],
        future_meta_field: 'whatever',
      }) as { future_meta_field?: string }
      expect(r.future_meta_field).toBe('whatever')
    })

    it('TikTokWebhookPayloadSchema parses valid payload', () => {
      const r = TikTokWebhookPayloadSchema.parse({
        event: 'post.publish.complete',
        client_key: 'c',
        user_openid: 'u',
        create_time: 1700000000,
      })
      expect(r.event).toBe('post.publish.complete')
    })
  })
})
