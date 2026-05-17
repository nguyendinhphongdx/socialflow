import { Injectable } from '@nestjs/common'
import type {
  CreditTransaction,
  CreditTransactionType,
  User,
} from '@prisma/client'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

/**
 * Input cho `applyTransaction()` — atomic mutate user.aiCredits + insert ledger row.
 *
 * - amount: positive = grant, negative = consume/revoke.
 * - stripeEventId: nếu set → unique constraint serve idempotency.
 */
export interface ApplyTransactionInput {
  userId: string
  amount: number
  type: CreditTransactionType
  reason?: string | null
  stripeEventId?: string | null
  stripeInvoiceId?: string | null
  metadata?: Prisma.InputJsonValue | null
}

@Injectable()
export class CreditsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomic ledger transaction:
   * 1. UPDATE User: aiCredits +/- amount (single SQL, no read-modify-write race).
   * 2. INSERT CreditTransaction với balanceAfter snapshot từ UPDATE return.
   *
   * Mọi step trong 1 `prisma.$transaction` → A+I (atomic + isolated).
   * Idempotency qua `stripeEventId` unique: P2002 → caller catch + skip.
   */
  async applyTransaction(input: ApplyTransactionInput): Promise<{ tx: CreditTransaction, user: User }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: input.userId },
        data: { aiCredits: { increment: input.amount } },
      })
      const ledger = await tx.creditTransaction.create({
        data: {
          userId: input.userId,
          amount: input.amount,
          type: input.type,
          reason: input.reason ?? null,
          stripeEventId: input.stripeEventId ?? null,
          stripeInvoiceId: input.stripeInvoiceId ?? null,
          metadata: input.metadata ?? Prisma.JsonNull,
          balanceAfter: user.aiCredits,
        },
      })
      return { tx: ledger, user }
    })
  }

  async getByStripeEventId(stripeEventId: string): Promise<CreditTransaction | null> {
    return this.prisma.creditTransaction.findUnique({ where: { stripeEventId } })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
  ): Promise<Paginated<CreditTransaction>> {
    const where: Prisma.CreditTransactionWhereInput = { userId }
    const [list, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.creditTransaction.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }
}
