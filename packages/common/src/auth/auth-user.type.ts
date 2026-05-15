/**
 * Authenticated user injected qua `@CurrentUser()` decorator.
 * Shape match với JWT payload + 1 vài field thường dùng.
 */
export interface AuthUser {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
  sessionId: string
  isVerified?: boolean
}
