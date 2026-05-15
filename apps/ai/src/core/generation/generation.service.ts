import { Injectable, Logger } from '@nestjs/common'
import { ProviderRegistry } from '../providers/provider-registry'
import type {
  GenerateCaptionDto,
  GenerateImageDto,
} from './generation.dto'

interface CaptionResult {
  caption: string
  hashtags: string[]
  model: string
  tokensUsed?: number
}

interface ImageResult {
  imageUrl: string
  revisedPrompt?: string
  model: string
}

/**
 * Service AI generation — orchestrate prompt + provider selection.
 *
 * KHÔNG đụng DB (apps/ai is stateless). Credit / quota check ở apps/api side.
 */
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name)

  constructor(private readonly registry: ProviderRegistry) {}

  async generateCaption(dto: GenerateCaptionDto): Promise<CaptionResult> {
    const provider = this.registry.getForText(dto.providerId)
    const systemPrompt = this.buildCaptionSystemPrompt(dto)
    const userPrompt = this.buildCaptionUserPrompt(dto)

    const result = await provider.generateText({
      prompt: userPrompt,
      systemPrompt,
      maxTokens: this.estimateMaxTokens(dto.maxLength),
      temperature: 0.7,
    })

    const { caption, hashtags } = this.parseCaptionOutput(result.text, dto.includeHashtags)
    return {
      caption,
      hashtags,
      model: result.model,
      tokensUsed: result.tokensUsed,
    }
  }

  async generateImage(dto: GenerateImageDto): Promise<ImageResult> {
    const provider = this.registry.getForImage(dto.providerId)
    // generateImage tồn tại vì registry.getForImage đã check
    const result = await provider.generateImage!({
      prompt: dto.prompt,
      size: dto.size,
      quality: dto.quality,
      style: dto.style,
    })
    return result
  }

  private buildCaptionSystemPrompt(dto: GenerateCaptionDto): string {
    const platformHints: Record<string, string> = {
      YOUTUBE: 'YouTube — caption dài, giàu keyword SEO, có thể có CTA subscribe.',
      FACEBOOK: 'Facebook — caption tự nhiên, kể chuyện, dài vừa, dễ engage.',
      INSTAGRAM: 'Instagram — caption ngắn-trung, lifestyle, hashtag cộng đồng cuối bài.',
      TIKTOK: 'TikTok — caption rất ngắn, viral hook đầu dòng, hashtag trending.',
    }
    const toneHints: Record<string, string> = {
      professional: 'Tone chuyên nghiệp, mạch lạc, không slang.',
      casual: 'Tone gần gũi, thân thiện, conversational.',
      funny: 'Tone hài hước, có chút meme, light-hearted.',
    }
    const hashtagRule = dto.includeHashtags
      ? 'Cuối caption, thêm dòng "Hashtags:" rồi liệt kê 3-8 hashtag (mỗi cái bắt đầu bằng #), cách nhau bởi khoảng trắng.'
      : 'KHÔNG kèm hashtag.'

    return [
      `Bạn là content writer chuyên về social media. Viết caption bằng ngôn ngữ có mã "${dto.languageCode}".`,
      platformHints[dto.platform],
      toneHints[dto.tone],
      `Giới hạn nội dung caption (không tính hashtag): ${dto.maxLength} ký tự.`,
      hashtagRule,
      'KHÔNG bao gồm meta-comment, KHÔNG giải thích, chỉ output caption cuối cùng.',
    ].join('\n')
  }

  private buildCaptionUserPrompt(dto: GenerateCaptionDto): string {
    return `Viết caption cho chủ đề sau:\n\n${dto.topic}`
  }

  private parseCaptionOutput(raw: string, includeHashtags: boolean): { caption: string, hashtags: string[] } {
    const hashtags: string[] = []
    let caption = raw.trim()

    if (includeHashtags) {
      // Tách block "Hashtags:" nếu có
      const splitMatch = caption.match(/^(.*?)(?:\n\s*Hashtags?\s*:\s*)(.+)$/is)
      if (splitMatch) {
        caption = splitMatch[1].trim()
        const tagBlock = splitMatch[2]
        hashtags.push(...this.extractHashtags(tagBlock))
      }
      else {
        // Fallback: lấy hashtag scattered từ caption
        hashtags.push(...this.extractHashtags(caption))
      }
    }

    return {
      caption,
      hashtags: Array.from(new Set(hashtags)),
    }
  }

  private extractHashtags(text: string): string[] {
    const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? []
    return matches.map(t => t.trim())
  }

  private estimateMaxTokens(maxChars: number): number {
    // ~4 chars per token + buffer cho hashtags + safety margin
    return Math.min(Math.ceil(maxChars / 3) + 200, 2048)
  }
}
