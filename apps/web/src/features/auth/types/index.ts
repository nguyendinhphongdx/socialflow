export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: 'USER' | 'ADMIN'
  emailVerified: boolean
  locale: string
  planTier: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'
  aiCredits: number
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthResult {
  user: AuthUser
  tokens: AuthTokens
}

export interface LoginInput { email: string, password: string }
export interface RegisterInput { email: string, password: string, name?: string }
