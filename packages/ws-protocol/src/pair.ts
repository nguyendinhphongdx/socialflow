import { z } from 'zod'

/**
 * Pair flow:
 * 1. User trên web: POST /agents/pair/init → server tạo PairRequest với 6-digit code (TTL 5 phút)
 * 2. Extension popup: user nhập code → POST /agents/pair/claim → server verify code chưa expire,
 *    tạo AutomationAgent + agentToken (JWT long-lived 1 năm) → trả về cho extension
 * 3. Extension lưu agentToken vào chrome.storage.local, connect WS với token này
 */

export const PairCodeSchema = z.string().regex(/^\d{6}$/, 'Pair code phải là 6 chữ số')

export const PairInitResponseSchema = z.object({
  pairCode: PairCodeSchema,
  expiresAt: z.string().datetime(),      // ISO
  agentPublicId: z.string(),             // hiển thị để user verify
})

export const PairClaimRequestSchema = z.object({
  pairCode: PairCodeSchema,
  deviceInfo: z.object({
    os: z.string().max(50),
    browserName: z.string().max(50),
    extensionVersion: z.string().max(20),
    capabilities: z.array(z.string()).max(10),
  }),
})

export const PairClaimResponseSchema = z.object({
  agentId: z.string(),
  agentPublicId: z.string(),
  agentToken: z.string(),                // JWT long-lived
  wsUrl: z.string().url(),               // WS endpoint cho extension connect
  userId: z.string(),
})

export type PairInitResponse = z.infer<typeof PairInitResponseSchema>
export type PairClaimRequest = z.infer<typeof PairClaimRequestSchema>
export type PairClaimResponse = z.infer<typeof PairClaimResponseSchema>
