import type { AccountPlatform, AiProvider } from '@prisma/client'

/**
 * Hằng số cho BYOK credentials (ADR-0010).
 *
 * SUPPORTED_OAUTH_PLATFORMS / SUPPORTED_AI_PROVIDERS là source-of-truth
 * dùng cho status endpoint + UI tạo "row trống" khi chưa configure.
 */
export const SUPPORTED_OAUTH_PLATFORMS: AccountPlatform[] = [
  'YOUTUBE',
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
]

export const SUPPORTED_AI_PROVIDERS: AiProvider[] = [
  'OPENAI',
  'ANTHROPIC',
  'GOOGLE_GEMINI',
]

/**
 * Pricing table USD per 1K tokens (input/output). Source: provider pricing pages.
 * Rough estimate — chỉ dùng cho budget tracking, không thay billing thật của provider.
 */
export const AI_PRICING_PER_1K_TOKENS: Record<string, { input: number, output: number }> = {
  // OpenAI
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'dall-e-3': { input: 0.04, output: 0 },          // flat per image $0.04 standard 1024
  // Anthropic
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  // Gemini
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
}

export const AI_DEFAULT_PRICING = { input: 0.001, output: 0.003 }

/**
 * Rough cost estimate cho 1 lần generate. Pricing không exact (provider có rate
 * mới, model alias) — chỉ dùng làm budget hint.
 */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = AI_PRICING_PER_1K_TOKENS[model] ?? AI_DEFAULT_PRICING
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
}

/**
 * Mask secret cho VO — chỉ show prefix(4) + suffix(4), rest = '*'.
 * Input min 8 chars → "sf_t****ast4". Shorter → '***'.
 */
export function maskSecret(raw: string): string {
  if (!raw || raw.length < 8) return '***'
  return `${raw.slice(0, 4)}${'*'.repeat(Math.max(4, raw.length - 8))}${raw.slice(-4)}`
}
