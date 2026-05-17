export type AccountPlatform = 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'

export type CredentialScope = 'SYSTEM' | 'WORKSPACE'

export type CredentialSource = 'ENV' | 'SYSTEM' | 'WORKSPACE' | 'NONE'

export type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE_GEMINI'

export interface OAuthCredential {
  id: string
  scope: CredentialScope
  workspaceId: string | null
  platform: AccountPlatform
  clientId: string
  clientSecretLast4: string
  redirectUri: string
  scopes: string[]
  isActive: boolean
  notes: string | null
  lastVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformStatus {
  platform: AccountPlatform
  source: CredentialSource
  isActive: boolean
  lastVerifiedAt: string | null
  clientSecretLast4: string | null
  credentialId: string | null
}

export interface OAuthCredentialInput {
  platform: AccountPlatform
  clientId: string
  clientSecret: string
  scopes?: string[]
  notes?: string
}

export interface AiCredential {
  id: string
  scope: CredentialScope
  workspaceId: string | null
  provider: AiProvider
  apiKeyLast4: string
  baseUrl: string | null
  model: string | null
  isActive: boolean
  monthlyBudgetUsd: number | null
  monthSpentUsd: number
  notes: string | null
  lastVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AiProviderStatus {
  provider: AiProvider
  source: CredentialSource
  isActive: boolean
  apiKeyLast4: string | null
  monthlyBudgetUsd: number | null
  monthSpentUsd: number
  model: string | null
  credentialId: string | null
  lastVerifiedAt: string | null
}

export interface AiCredentialInput {
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  model?: string
  monthlyBudgetUsd?: number | null
  notes?: string
}

export interface VerifyResult {
  ok: boolean
  error?: string
}
