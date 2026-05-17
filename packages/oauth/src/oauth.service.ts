import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import type { OAuthIntent } from '@sociflow/prisma'
import { AppException, ResponseCode } from '@sociflow/common'
import { OAuthStateRepository } from './oauth-state.repository'
import { generateOAuthState, generatePkce } from './pkce'
import type { OAuthProviderConfig, OAuthTokenResponse } from './types'

interface BuildAuthUrlOptions {
  provider: OAuthProviderConfig
  intent: OAuthIntent
  userId?: string | null
  redirectUri: string
  metadata?: Record<string, unknown>
}

interface ExchangeCodeOptions {
  provider: OAuthProviderConfig
  state: string
  code: string
}

const STATE_TTL_MS = 10 * 60 * 1000     // 10 phút

/**
 * Generic OAuth 2.0 client.
 *
 * Flow:
 * 1. `buildAuthorizeUrl()` → tạo state + (optional) PKCE → lưu DB → trả URL
 * 2. User redirect tới provider → consent → callback với `code` + `state`
 * 3. `exchangeCode()` → verify state (CSRF), exchange code → token
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name)

  constructor(private readonly stateRepo: OAuthStateRepository) {}

  async buildAuthorizeUrl(opts: BuildAuthUrlOptions): Promise<string> {
    const state = generateOAuthState()
    const pkce = opts.provider.usePkce ? generatePkce() : undefined

    await this.stateRepo.create({
      state,
      provider: opts.provider.id,
      intent: opts.intent,
      userId: opts.userId,
      codeVerifier: pkce?.codeVerifier,
      redirectUri: opts.redirectUri,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
      metadata: opts.metadata,
    })

    const params = new URLSearchParams({
      client_id: opts.provider.clientId,
      redirect_uri: opts.redirectUri,
      response_type: 'code',
      scope: opts.provider.scopes.join(' '),
      state,
      ...(pkce && { code_challenge: pkce.codeChallenge, code_challenge_method: 'S256' }),
      ...opts.provider.extraAuthorizeParams,
    })

    return `${opts.provider.authorizeUrl}?${params.toString()}`
  }

  async exchangeCode(opts: ExchangeCodeOptions): Promise<{ tokens: OAuthTokenResponse, intent: OAuthIntent, userId: string | null, metadata: Record<string, unknown> | null }> {
    const stateRow = await this.stateRepo.getByState(opts.state)
    if (!stateRow) throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'state_not_found' })
    if (stateRow.consumedAt) throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'state_already_consumed' })
    if (stateRow.expiresAt < new Date()) throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'state_expired' })
    if (stateRow.provider !== opts.provider.id) throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'provider_mismatch' })

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: opts.code,
      redirect_uri: stateRow.redirectUri,
      client_id: opts.provider.clientId,
      client_secret: opts.provider.clientSecret,
      ...(stateRow.codeVerifier && { code_verifier: stateRow.codeVerifier }),
    })

    const response = await axios.post<Record<string, unknown>>(
      opts.provider.tokenUrl,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    ).catch((err) => {
      // Log details server-side (full provider response giúp debug) nhưng
      // KHÔNG trả về client — tránh leak nội bộ provider (vd hint user enumeration,
      // misconfig client id, scope sai...).
      this.logger.error(
        `OAuth token exchange failed [provider=${opts.provider.id}] status=${err.response?.status ?? 'n/a'} data=${JSON.stringify(err.response?.data ?? null)}`,
      )
      throw new AppException(ResponseCode.OAuthProviderError, {
        reason: 'token_exchange_failed',
        provider: opts.provider.id,
      })
    })

    await this.stateRepo.consume(stateRow.id)

    const tokens = this.parseTokenResponse(response.data)
    return {
      tokens,
      intent: stateRow.intent,
      userId: stateRow.userId,
      metadata: stateRow.metadata as Record<string, unknown> | null,
    }
  }

  async refreshAccessToken(provider: OAuthProviderConfig, refreshToken: string): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
    })

    const response = await axios.post<Record<string, unknown>>(
      provider.tokenUrl,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    ).catch((err) => {
      this.logger.error(
        `OAuth token refresh failed [provider=${provider.id}] status=${err.response?.status ?? 'n/a'} data=${JSON.stringify(err.response?.data ?? null)}`,
      )
      throw new AppException(ResponseCode.AccountTokenExpired, {
        reason: 'refresh_failed',
        provider: provider.id,
      })
    })

    return this.parseTokenResponse(response.data)
  }

  private parseTokenResponse(raw: Record<string, unknown>): OAuthTokenResponse {
    return {
      accessToken: String(raw.access_token),
      refreshToken: raw.refresh_token ? String(raw.refresh_token) : undefined,
      expiresIn: typeof raw.expires_in === 'number' ? raw.expires_in : undefined,
      tokenType: String(raw.token_type ?? 'Bearer'),
      scope: raw.scope ? String(raw.scope) : undefined,
      idToken: raw.id_token ? String(raw.id_token) : undefined,
      raw,
    }
  }
}
