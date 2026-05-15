export interface Agent {
  id: string
  publicId: string
  type: 'EXTENSION' | 'DESKTOP'
  os: string | null
  browserName: string | null
  extensionVersion: string | null
  capabilities: string[]
  online: boolean
  lastSeenAt: string | null
  lastConnectedAt: string | null
  createdAt: string
  revokedAt: string | null
}

export interface PairInitResponse {
  pairCode: string
  expiresAt: string
  agentPublicId: string
}

export interface ListAgentsQuery {
  page?: number
  pageSize?: number
  online?: boolean
}

export interface AgentListResponse {
  list: Agent[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
