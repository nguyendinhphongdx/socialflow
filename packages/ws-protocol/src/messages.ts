import { z } from 'zod'
import { AgentPlatformSchema } from './platforms'

/**
 * WS message types — bidirectional giữa server (apps/api) và extension agent.
 *
 * Naming:
 * - `s2a:*` — server-to-agent (command)
 * - `a2s:*` — agent-to-server (ack, status update, result, event)
 */

// ============================================
// Server → Agent (commands)
// ============================================

export const PublishCommandSchema = z.object({
  type: z.literal('s2a:publish'),
  taskId: z.string(),
  platform: AgentPlatformSchema,
  accountUid: z.string(),                  // platform-specific (TT username, FB page id)
  content: z.object({
    title: z.string().nullable(),
    body: z.string().nullable(),
    mediaUrls: z.array(z.object({
      url: z.string().url(),
      type: z.enum(['IMAGE', 'VIDEO', 'AUDIO']),
      mimeType: z.string(),
      sizeBytes: z.number().int().positive(),
    })),
    platformOptions: z.record(z.string(), z.unknown()).optional(),
  }),
  timeout: z.number().int().positive().default(15 * 60 * 1000),     // 15 phút
})

export const CancelTaskCommandSchema = z.object({
  type: z.literal('s2a:cancel'),
  taskId: z.string(),
})

export const PingCommandSchema = z.object({
  type: z.literal('s2a:ping'),
  ts: z.number().int(),
})

export const ServerToAgentMessageSchema = z.discriminatedUnion('type', [
  PublishCommandSchema,
  CancelTaskCommandSchema,
  PingCommandSchema,
])

// ============================================
// Agent → Server (status, result, event)
// ============================================

export const AckMessageSchema = z.object({
  type: z.literal('a2s:ack'),
  taskId: z.string(),
})

export const TaskStatusMessageSchema = z.object({
  type: z.literal('a2s:status'),
  taskId: z.string(),
  stage: z.string(),                       // 'downloading' | 'opening_browser' | 'uploading' | 'submitting'
  progress: z.number().int().min(0).max(100),
})

export const TaskCompleteMessageSchema = z.object({
  type: z.literal('a2s:complete'),
  taskId: z.string(),
  platformPostId: z.string(),
  workLink: z.string().url(),
})

export const TaskFailedMessageSchema = z.object({
  type: z.literal('a2s:failed'),
  taskId: z.string(),
  reason: z.string(),
  recoverable: z.boolean(),
  screenshotUrl: z.string().url().nullable().optional(),
})

export const PongMessageSchema = z.object({
  type: z.literal('a2s:pong'),
  ts: z.number().int(),
  capabilities: z.array(z.string()),
})

export const AgentHeartbeatSchema = z.object({
  type: z.literal('a2s:heartbeat'),
  ts: z.number().int(),
  activeTabsCount: z.number().int().nonnegative(),
  memoryMb: z.number().nonnegative().optional(),
})

export const AgentToServerMessageSchema = z.discriminatedUnion('type', [
  AckMessageSchema,
  TaskStatusMessageSchema,
  TaskCompleteMessageSchema,
  TaskFailedMessageSchema,
  PongMessageSchema,
  AgentHeartbeatSchema,
])

// ============================================
// Exported types
// ============================================

export type PublishCommand = z.infer<typeof PublishCommandSchema>
export type CancelTaskCommand = z.infer<typeof CancelTaskCommandSchema>
export type PingCommand = z.infer<typeof PingCommandSchema>
export type ServerToAgentMessage = z.infer<typeof ServerToAgentMessageSchema>

export type AckMessage = z.infer<typeof AckMessageSchema>
export type TaskStatusMessage = z.infer<typeof TaskStatusMessageSchema>
export type TaskCompleteMessage = z.infer<typeof TaskCompleteMessageSchema>
export type TaskFailedMessage = z.infer<typeof TaskFailedMessageSchema>
export type PongMessage = z.infer<typeof PongMessageSchema>
export type AgentHeartbeat = z.infer<typeof AgentHeartbeatSchema>
export type AgentToServerMessage = z.infer<typeof AgentToServerMessageSchema>
