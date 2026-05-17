export const BRAND_SENTIMENT_JOB_NAME = 'classify-sentiment'

export interface BrandSentimentJob {
  mentionId: string
  text: string
  languageCode?: string
}

export const BRAND_MENTION_DETECTED_EVENT = 'brand.mention.detected'

export interface BrandMentionDetectedEvent {
  mentionId: string
  monitorId: string
  userId: string
  text: string
  platform: string
}
