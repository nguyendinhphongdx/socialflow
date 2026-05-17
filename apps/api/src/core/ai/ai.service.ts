import { Injectable } from '@nestjs/common'
import { AiClientService, type GenerateCaptionInput, type GenerateCaptionOutput } from '@sociflow/internal-client'
import { RequestContextService } from '@sociflow/auth'
import { CreditsService } from '../credits/credits.service'

const CAPTION_CREDIT_COST = 1

export interface GenerateCaptionResult extends GenerateCaptionOutput {
  creditsRemaining: number
}

@Injectable()
export class AiService {
  constructor(
    private readonly aiClient: AiClientService,
    private readonly credits: CreditsService,
    private readonly ctx: RequestContextService,
  ) {}

  async generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionResult> {
    const userId = this.ctx.requireUserId()

    // Pre-flight check — chống race. AiClientService tự throw AppException khi
    // envelope code != 0 (xem internal-client.ts) — KHÔNG bao try-catch ở đây.
    await this.credits.assertBalance(userId, CAPTION_CREDIT_COST)

    const result = await this.aiClient.generateCaption(input)

    // Atomic decrement + insert CreditTransaction (ledger) — auto-emit credit.low
    const { user } = await this.credits.consume({
      userId,
      amount: CAPTION_CREDIT_COST,
      reason: 'ai_caption',
    })

    return {
      ...result,
      creditsRemaining: user.aiCredits,
    }
  }
}
