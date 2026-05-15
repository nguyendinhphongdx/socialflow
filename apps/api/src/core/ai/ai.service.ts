import { Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import { AiClientService, type GenerateCaptionInput, type GenerateCaptionOutput } from '@sociflow/internal-client'
import { UserService } from '../user/user.service'

const CAPTION_CREDIT_COST = 1

export interface GenerateCaptionResult extends GenerateCaptionOutput {
  creditsRemaining: number
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(
    private readonly aiClient: AiClientService,
    private readonly userService: UserService,
  ) {}

  async generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionResult> {
    // Trừ credit trước để chống race (decrement atomic).
    // Nếu AI fail sau đó, log warning — credit đã bị mất (acceptable tradeoff đơn giản).
    await this.userService.assertAiCredits(CAPTION_CREDIT_COST)

    let result: GenerateCaptionOutput
    try {
      result = await this.aiClient.generateCaption(input)
    }
    catch (err) {
      this.logger.error('AI caption generation failed', err as Error)
      throw new AppException(ResponseCode.AiGenerationFailed, { topic: input.topic })
    }

    const updated = await this.userService.decrementAiCredits(CAPTION_CREDIT_COST)

    return {
      ...result,
      creditsRemaining: updated.aiCredits,
    }
  }
}
