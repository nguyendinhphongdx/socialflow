export interface JwtPayload {
  sub: string         // userId
  email: string
  role: 'USER' | 'ADMIN'
  sessionId: string
  /**
   * Primary/current workspace của user — set lúc login/register/refresh. Token
   * có thể được override qua `X-Workspace-Id` header (verify membership ở guard).
   * Optional cho backward compat: token cũ trước F-716 chưa có field này — guard
   * sẽ resolve personal workspace từ membership lúc runtime.
   */
  workspaceId?: string
  /**
   * Token kind discriminator. User tokens không set field này (legacy default = user).
   * Agent tokens set `type: 'agent'` và phải ký bằng `jwtAgentSecret` riêng — JwtStrategy
   * (user auth) reject mọi token có `type !== undefined` để chống cross-secret abuse.
   * `verify-email` token dùng cho email verification flow.
   */
  type?: 'agent' | 'verify-email'
  iat?: number
  exp?: number
}
