import axios from 'axios'
import { AppException, ResponseCode } from '@sociflow/common'
import type { NormalizedProfile, OAuthProviderConfig } from '../types'

interface GoogleProviderEnv {
  clientId: string
  clientSecret: string
}

/**
 * Google OAuth (cho web login).
 *
 * Scope tối thiểu: openid + email + profile.
 */
export function createGoogleProviderConfig(env: GoogleProviderEnv): OAuthProviderConfig {
  return {
    id: 'google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    scopes: ['openid', 'email', 'profile'],
    extraAuthorizeParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
    usePkce: true,
  }
}

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  locale?: string
}

export async function fetchGoogleProfile(accessToken: string): Promise<NormalizedProfile> {
  const response = await axios.get<GoogleUserInfo>(
    'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch((err) => {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'google',
      reason: 'userinfo_fetch_failed',
      details: err.response?.data,
    })
  })

  const data = response.data
  return {
    providerUserId: data.sub,
    email: data.email,
    emailVerified: data.email_verified,
    name: data.name,
    avatarUrl: data.picture,
    locale: data.locale,
    raw: data as unknown as Record<string, unknown>,
  }
}
