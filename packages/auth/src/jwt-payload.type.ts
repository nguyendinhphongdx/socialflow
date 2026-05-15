export interface JwtPayload {
  sub: string         // userId
  email: string
  role: 'USER' | 'ADMIN'
  sessionId: string
  iat?: number
  exp?: number
}
