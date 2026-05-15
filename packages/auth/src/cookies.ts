import type { Response } from 'express'

export interface AuthCookieConfig {
  accessName: string         // default: 'sf_access'
  refreshName: string        // default: 'sf_refresh'
  domain?: string
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  accessMaxAgeMs: number     // 15 * 60 * 1000
  refreshMaxAgeMs: number    // 7 * 24 * 60 * 60 * 1000
  refreshPath: string        // '/api/v1/auth/refresh' — path-scoped
}

interface Tokens { accessToken: string, refreshToken: string }

export function setAuthCookies(res: Response, tokens: Tokens, cfg: AuthCookieConfig): void {
  res.cookie(cfg.accessName, tokens.accessToken, {
    httpOnly: true,
    secure: cfg.secure,
    sameSite: cfg.sameSite,
    maxAge: cfg.accessMaxAgeMs,
    domain: cfg.domain,
    path: '/',
  })
  res.cookie(cfg.refreshName, tokens.refreshToken, {
    httpOnly: true,
    secure: cfg.secure,
    sameSite: cfg.sameSite,
    maxAge: cfg.refreshMaxAgeMs,
    domain: cfg.domain,
    path: cfg.refreshPath,
  })
}

export function clearAuthCookies(res: Response, cfg: AuthCookieConfig): void {
  res.clearCookie(cfg.accessName, { path: '/', domain: cfg.domain })
  res.clearCookie(cfg.refreshName, { path: cfg.refreshPath, domain: cfg.domain })
}
