import { z } from 'zod'

export const AgentPlatformSchema = z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'])
export type AgentPlatform = z.infer<typeof AgentPlatformSchema>

export const AgentCapabilitySchema = z.enum([
  'tiktok',
  'facebook',
  'instagram',
  'youtube',
  'ffmpeg',
])
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>

/** Protocol version — bump major khi breaking change. */
export const WS_PROTOCOL_VERSION = '1.0.0'
