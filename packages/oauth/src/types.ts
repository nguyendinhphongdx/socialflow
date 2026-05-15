/**
 * Shape chung cho mọi OAuth provider.
 *
 * Mỗi provider (Google login, YouTube connect, FB connect, ...) là 1 instance
 * của `OAuthProviderConfig` + 1 method để fetch user/channel info sau khi exchange.
 */

export type OAuthProviderId = 'google' | 'youtube' | 'facebook' | 'instagram' | 'tiktok'

export interface OAuthProviderConfig {
  id: OAuthProviderId
  authorizeUrl: string                      // https://accounts.google.com/o/oauth2/v2/auth
  tokenUrl: string                          // https://oauth2.googleapis.com/token
  revokeUrl?: string                        // optional — revoke token endpoint
  clientId: string
  clientSecret: string
  scopes: string[]                          // OAuth scope list
  extraAuthorizeParams?: Record<string, string>      // access_type=offline, prompt=consent, ...
  usePkce: boolean                          // PKCE flow (recommended for public clients)
}

export interface OAuthTokenResponse {
  accessToken: string
  refreshToken?: string                     // không phải provider nào cũng trả
  expiresIn?: number                        // seconds
  tokenType: string                         // 'Bearer'
  scope?: string                            // space-separated
  idToken?: string                          // OIDC providers (Google)
  raw: Record<string, unknown>              // raw provider response để debug
}

/**
 * Profile chuẩn hoá sau khi exchange code + fetch /userinfo.
 * Mỗi provider có method `fetchProfile(accessToken) → NormalizedProfile`.
 */
export interface NormalizedProfile {
  providerUserId: string                    // unique id trên provider
  email?: string
  emailVerified?: boolean
  name?: string
  avatarUrl?: string
  locale?: string
  raw: Record<string, unknown>
}

/**
 * Profile cho platform connect (YouTube channel, FB page, ...).
 */
export interface PlatformChannelInfo {
  platformUid: string                       // channel ID, page ID
  displayName: string
  avatarUrl?: string
  metadata?: Record<string, unknown>        // subscriber count, category, ...
}
