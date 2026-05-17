import { Injectable } from '@nestjs/common'
import { AiClientService, type AiCredentialPayload, type GenerateCaptionInput, type GenerateCaptionOutput } from '@sociflow/internal-client'
import { RequestContextService } from '@sociflow/auth'
import { CreditsService } from '../credits/credits.service'
import { AiCredentialResolver } from '../credential/ai-credential-resolver'
import { AiCredentialService } from '../credential/ai-credential.service'
import { estimateCostUsd } from '../credential/credential.constants'

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
    private readonly aiCredentialResolver: AiCredentialResolver,
    private readonly aiCredentialService: AiCredentialService,
  ) {}

  async generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionResult> {
    const userId = this.ctx.requireUserId()
    const workspaceId = this.ctx.requireWorkspaceId()

    // BYOK — resolve workspace AI credential. Provider mapping: providerId
    // (input override) → AiProvider enum. Default OPENAI cho text caption.
    const aiProvider = this.mapProviderId(input.providerId) ?? 'OPENAI'
    const resolved = await this.aiCredentialResolver.resolve(aiProvider, workspaceId)
    const credential: AiCredentialPayload = {
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      model: resolved.model,
    }

    // Pre-flight credit check — chống race.
    await this.credits.assertBalance(userId, CAPTION_CREDIT_COST)

    const result = await this.aiClient.generateCaption({ ...input, credential })

    // Tracker budget: nếu workspace BYOK, increment monthSpentUsd.
    if (resolved.credentialId) {
      const inputTokens = result.inputTokens ?? Math.floor((result.tokensUsed ?? 0) / 2)
      const outputTokens = result.outputTokens ?? Math.ceil((result.tokensUsed ?? 0) / 2)
      const cost = estimateCostUsd(result.model, inputTokens, outputTokens)
      await this.aiCredentialService.incrementSpent(resolved.credentialId, cost)
    }

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

  private mapProviderId(id?: 'openai' | 'anthropic'): 'OPENAI' | 'ANTHROPIC' | null {
    if (id === 'openai') return 'OPENAI'
    if (id === 'anthropic') return 'ANTHROPIC'
    return null
  }
}
