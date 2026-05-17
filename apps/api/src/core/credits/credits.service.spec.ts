import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import type { CreditTransaction, User } from '@prisma/client'
import { ResponseCode } from '@sociflow/common'
import { CreditsService } from './credits.service'
import { CREDIT_LOW_EVENT, PLAN_MONTHLY_CREDITS } from './credits.constants'

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date()
  return {
    id: 'user_1',
    email: 'a@b.com',
    emailVerified: true,
    passwordHash: null,
    name: 'Tester',
    avatarUrl: null,
    locale: 'vi',
    role: 'USER',
    planTier: 'PRO',
    planExpiry: null,
    aiCredits: 5000,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as User
}

function makeTx(overrides: Partial<CreditTransaction> = {}): CreditTransaction {
  const now = new Date()
  return {
    id: 'tx_1',
    userId: 'user_1',
    amount: 100,
    type: 'PURCHASE',
    reason: 'stripe_purchase',
    stripeEventId: null,
    stripeInvoiceId: null,
    metadata: null,
    balanceAfter: 5100,
    createdAt: now,
    ...overrides,
  } as CreditTransaction
}

describe('CreditsService', () => {
  let service: CreditsService
  let repo: {
    applyTransaction: ReturnType<typeof vi.fn>
    getByStripeEventId: ReturnType<typeof vi.fn>
    listByUserWithPagination: ReturnType<typeof vi.fn>
  }
  let ctx: { requireUserId: ReturnType<typeof vi.fn> }
  let userService: { getById: ReturnType<typeof vi.fn> }
  let events: { emit: ReturnType<typeof vi.fn> }
  let purchaseQueue: { add: ReturnType<typeof vi.fn> }
  let refundQueue: { add: ReturnType<typeof vi.fn> }
  let config: { stripe: Record<string, unknown> }

  beforeEach(() => {
    repo = {
      applyTransaction: vi.fn(),
      getByStripeEventId: vi.fn(),
      listByUserWithPagination: vi.fn(),
    }
    ctx = { requireUserId: vi.fn().mockReturnValue('user_1') }
    userService = { getById: vi.fn() }
    events = { emit: vi.fn() }
    purchaseQueue = { add: vi.fn() }
    refundQueue = { add: vi.fn() }
    config = { stripe: {} }

    service = new CreditsService(
      repo as never,
      ctx as never,
      userService as never,
      events as never,
      config as never,
      purchaseQueue as never,
      refundQueue as never,
    )
  })

  describe('grant', () => {
    it('grants credit và lưu ledger row', async () => {
      const user = makeUser({ aiCredits: 5100 })
      const tx = makeTx()
      repo.applyTransaction.mockResolvedValue({ tx, user })

      const result = await service.grant({
        userId: 'user_1',
        amount: 100,
        type: 'PURCHASE',
        reason: 'stripe_purchase',
        stripeEventId: 'evt_123',
      })

      expect(result?.id).toBe('tx_1')
      expect(repo.applyTransaction).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user_1',
        amount: 100,
        type: 'PURCHASE',
        stripeEventId: 'evt_123',
      }))
    })

    it('idempotent — returns null khi Stripe event đã xử lý (P2002)', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      })
      repo.applyTransaction.mockRejectedValue(err)

      const result = await service.grant({
        userId: 'user_1',
        amount: 100,
        type: 'PURCHASE',
        stripeEventId: 'evt_duplicate',
      })

      expect(result).toBeNull()
    })

    it('throws nếu amount <= 0', async () => {
      await expect(service.grant({ userId: 'user_1', amount: 0, type: 'PURCHASE' }))
        .rejects.toMatchObject({ code: ResponseCode.ValidationFailed })
    })
  })

  describe('consume', () => {
    it('trừ credit atomic + lưu ledger', async () => {
      const user = makeUser({ aiCredits: 5000 })
      const updated = makeUser({ aiCredits: 4990 })
      const tx = makeTx({ amount: -10, type: 'CONSUME', reason: 'ai_caption', balanceAfter: 4990 })
      userService.getById.mockResolvedValue(user)
      repo.applyTransaction.mockResolvedValue({ tx, user: updated })

      const result = await service.consume({ userId: 'user_1', amount: 10, reason: 'ai_caption' })

      expect(result.tx.amount).toBe(-10)
      expect(result.user.aiCredits).toBe(4990)
      expect(repo.applyTransaction).toHaveBeenCalledWith(expect.objectContaining({
        amount: -10,
        type: 'CONSUME',
        reason: 'ai_caption',
      }))
    })

    it('throws InsufficientCredits khi balance < amount', async () => {
      userService.getById.mockResolvedValue(makeUser({ aiCredits: 5 }))

      await expect(service.consume({ userId: 'user_1', amount: 10, reason: 'ai_caption' }))
        .rejects.toMatchObject({ code: ResponseCode.InsufficientCredits })
      expect(repo.applyTransaction).not.toHaveBeenCalled()
    })

    it('emit credit.low event khi balance sau consume dưới ngưỡng 20%', async () => {
      const proAllowance = PLAN_MONTHLY_CREDITS.PRO  // 5000
      const lowBalance = Math.floor(proAllowance * 0.1)   // 500, dưới 20%
      userService.getById.mockResolvedValue(makeUser({ aiCredits: lowBalance + 10 }))
      const after = makeUser({ aiCredits: lowBalance, planTier: 'PRO' })
      repo.applyTransaction.mockResolvedValue({ tx: makeTx(), user: after })

      await service.consume({ userId: 'user_1', amount: 10, reason: 'ai_caption' })

      expect(events.emit).toHaveBeenCalledWith(CREDIT_LOW_EVENT, expect.objectContaining({
        userId: 'user_1',
        remainingCredits: lowBalance,
        planTier: 'PRO',
      }))
    })

    it('không emit credit.low khi balance vẫn trên ngưỡng', async () => {
      userService.getById.mockResolvedValue(makeUser({ aiCredits: 5000 }))
      repo.applyTransaction.mockResolvedValue({ tx: makeTx(), user: makeUser({ aiCredits: 4990 }) })

      await service.consume({ userId: 'user_1', amount: 10, reason: 'ai_caption' })

      expect(events.emit).not.toHaveBeenCalled()
    })

    it('throws nếu amount <= 0', async () => {
      await expect(service.consume({ userId: 'user_1', amount: 0, reason: 'x' }))
        .rejects.toMatchObject({ code: ResponseCode.ValidationFailed })
    })
  })

  describe('refund', () => {
    it('revoke credit (negative amount) + lưu ledger', async () => {
      const user = makeUser({ aiCredits: 4900 })
      const tx = makeTx({ amount: -100, type: 'REFUND', balanceAfter: 4900 })
      repo.applyTransaction.mockResolvedValue({ tx, user })

      const result = await service.refund({
        userId: 'user_1',
        amount: 100,
        reason: 'stripe_refund',
        stripeEventId: 'evt_refund_1',
      })

      expect(result?.amount).toBe(-100)
      expect(repo.applyTransaction).toHaveBeenCalledWith(expect.objectContaining({
        amount: -100,
        type: 'REFUND',
        stripeEventId: 'evt_refund_1',
      }))
    })

    it('idempotent — returns null khi event duplicate', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      })
      repo.applyTransaction.mockRejectedValue(err)

      const result = await service.refund({
        userId: 'user_1',
        amount: 100,
        reason: 'stripe_refund',
        stripeEventId: 'evt_dup',
      })

      expect(result).toBeNull()
    })
  })

  describe('dispatchStripeEvent', () => {
    it('enqueue purchase job cho checkout.session.completed', async () => {
      await service.dispatchStripeEvent({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            metadata: { userId: 'user_1', credits: '500' },
            invoice: 'in_123',
          },
        },
      })

      expect(purchaseQueue.add).toHaveBeenCalledWith(
        'purchase',
        expect.objectContaining({
          stripeEventId: 'evt_1',
          stripeInvoiceId: 'in_123',
          userId: 'user_1',
          amount: 500,
          reason: 'stripe_checkout',
        }),
        expect.objectContaining({ jobId: 'evt_1' }),
      )
    })

    it('enqueue refund job cho charge.refunded', async () => {
      await service.dispatchStripeEvent({
        id: 'evt_refund',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_1',
            metadata: { userId: 'user_1', credits: '100' },
          },
        },
      })

      expect(refundQueue.add).toHaveBeenCalledWith(
        'refund',
        expect.objectContaining({
          stripeEventId: 'evt_refund',
          stripeChargeId: 'ch_1',
          userId: 'user_1',
          amount: 100,
        }),
        expect.objectContaining({ jobId: 'evt_refund' }),
      )
    })

    it('skip khi metadata thiếu userId hoặc credits', async () => {
      await service.dispatchStripeEvent({
        id: 'evt_bad',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_x', metadata: {} } },
      })

      expect(purchaseQueue.add).not.toHaveBeenCalled()
    })

    it('bỏ qua event type không xử lý', async () => {
      await service.dispatchStripeEvent({
        id: 'evt_unknown',
        type: 'product.created',
        data: { object: {} },
      })

      expect(purchaseQueue.add).not.toHaveBeenCalled()
      expect(refundQueue.add).not.toHaveBeenCalled()
    })
  })
})
