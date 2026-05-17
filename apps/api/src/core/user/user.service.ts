import { Injectable } from '@nestjs/common'
import type { PlanTier, User } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { UserRepository } from './user.repository'

@Injectable()
export class UserService {
  constructor(
    private readonly repo: UserRepository,
    private readonly ctx: RequestContextService,
  ) {}

  async getById(id: string) {
    const user = await this.repo.getById(id)
    if (!user) throw new AppException(ResponseCode.UserNotFound)
    return user
  }

  async getCurrent() {
    const userId = this.ctx.requireUserId()
    return this.getById(userId)
  }

  async assertAiCredits(amount: number) {
    const userId = this.ctx.requireUserId()
    const user = await this.getById(userId)
    if (user.aiCredits < amount) {
      throw new AppException(ResponseCode.AiCreditInsufficient, { required: amount, available: user.aiCredits })
    }
    return user
  }

  async decrementAiCredits(amount: number) {
    const userId = this.ctx.requireUserId()
    return this.repo.decrementAiCreditsById(userId, amount)
  }

  /**
   * Update plan tier — gọi từ Stripe webhook handler khi subscription thay đổi
   * (renew, upgrade, downgrade, cancel = về FREE).
   */
  async updatePlan(userId: string, planTier: PlanTier): Promise<User> {
    return this.repo.updateById(userId, { planTier })
  }
}
