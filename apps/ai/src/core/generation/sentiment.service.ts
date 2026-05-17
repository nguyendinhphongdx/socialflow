import { Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import { ProviderRegistry } from '../providers/provider-registry'
import type { ClassifySentimentDto, SentimentLabelType } from './sentiment.dto'

interface SentimentResult {
  sentiment: SentimentLabelType
  score: number
  model: string
}

const VALID_LABELS: SentimentLabelType[] = ['POSITIVE', 'NEGATIVE', 'NEUTRAL']

/**
 * Sentiment classification — wrap text provider với prompt zero-shot.
 *
 * Strategy:
 *  - Force JSON output schema: `{ sentiment, score }`
 *  - Validate label in whitelist; clamp score to [0, 1]
 *  - Fallback NEUTRAL nếu parse fail (không throw — analytics ok với neutral)
 */
@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name)

  constructor(private readonly registry: ProviderRegistry) {}

  async classify(dto: ClassifySentimentDto): Promise<SentimentResult> {
    const provider = this.registry.getForText(dto.providerId)
    const systemPrompt = this.buildSystemPrompt(dto.languageCode)
    const userPrompt = this.buildUserPrompt(dto.text)

    const raw = await provider.generateText({
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 80,
      temperature: 0,
    })

    const parsed = this.parseResponse(raw.text)
    if (!parsed) {
      this.logger.warn(`Sentiment parse failed — fallback NEUTRAL. raw=${raw.text.slice(0, 100)}`)
      throw new AppException(ResponseCode.BrandSentimentClassifyFailed, {
        reason: 'parse_failed',
        rawSample: raw.text.slice(0, 100),
      })
    }

    return {
      sentiment: parsed.sentiment,
      score: parsed.score,
      model: raw.model,
    }
  }

  private buildSystemPrompt(languageCode: string): string {
    return [
      `You are a sentiment classifier for ${languageCode} text (Vietnamese / English supported).`,
      'Classify the input as one of: POSITIVE, NEGATIVE, NEUTRAL.',
      'Return ONLY valid JSON in this exact shape (no markdown, no commentary):',
      '{"sentiment":"POSITIVE|NEGATIVE|NEUTRAL","score":0.0-1.0}',
      'score = your confidence (0 = unsure, 1 = certain).',
    ].join('\n')
  }

  private buildUserPrompt(text: string): string {
    return `Text to classify:\n"""${text}"""`
  }

  private parseResponse(raw: string): { sentiment: SentimentLabelType, score: number } | null {
    const stripped = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let obj: unknown
    try {
      obj = JSON.parse(stripped)
    }
    catch {
      // Có thể model trả nguyên label "POSITIVE" → fallback dò regex
      const match = stripped.match(/POSITIVE|NEGATIVE|NEUTRAL/i)
      if (!match) return null
      return { sentiment: match[0].toUpperCase() as SentimentLabelType, score: 0.5 }
    }

    if (!obj || typeof obj !== 'object') return null
    const candidate = obj as { sentiment?: unknown, score?: unknown }
    if (typeof candidate.sentiment !== 'string') return null

    const label = candidate.sentiment.toUpperCase() as SentimentLabelType
    if (!VALID_LABELS.includes(label)) return null

    const scoreNum = typeof candidate.score === 'number' ? candidate.score : 0.5
    const clamped = Math.max(0, Math.min(1, scoreNum))
    return { sentiment: label, score: clamped }
  }
}
