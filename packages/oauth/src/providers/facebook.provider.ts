import axios from 'axios'
import { AppException, ResponseCode } from '@sociflow/common'
import type { OAuthProviderConfig, PlatformChannelInfo } from '../types'

interface FacebookProviderEnv {
  clientId: string
  clientSecret: string
}

/**
 * Facebook OAuth — page-managing scopes.
 *
 * Scopes:
 * - `pages_show_list` — liệt kê pages user manage
 * - `pages_manage_posts` — post content lên page
 * - `pages_read_engagement` — read comments/reactions
 * - `pages_manage_engagement` — reply comments
 * - `public_profile` — basic profile info
 *
 * NOTE: Phải request `pages_*` qua App Review process (Meta yêu cầu).
 * Trong dev mode, chỉ test user của App được grant.
 */
export function createFacebookProviderConfig(env: FacebookProviderEnv): OAuthProviderConfig {
  return {
    id: 'facebook',
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    scopes: [
      'public_profile',
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_manage_engagement',
    ],
    usePkce: false,
    extraAuthorizeParams: {
      response_type: 'code',
    },
  }
}

interface FbMeResponse {
  id: string
  name?: string
}

interface FbPagesResponse {
  data: Array<{
    id: string
    name: string
    access_token: string         // long-lived page token
    category?: string
    picture?: { data?: { url?: string } }
    fan_count?: number
    tasks?: string[]             // ['CREATE_CONTENT', 'MANAGE', ...]
  }>
  paging?: { cursors?: { after?: string } }
}

/**
 * Đổi user short-lived access token → long-lived (60 days).
 */
export async function exchangeForLongLivedUserToken(
  shortLivedToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string, expiresIn: number }> {
  const response = await axios.get<{ access_token: string, expires_in?: number }>(
    'https://graph.facebook.com/v21.0/oauth/access_token',
    {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: shortLivedToken,
      },
    },
  ).catch((err) => {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'facebook',
      reason: 'long_lived_exchange_failed',
      details: err.response?.data,
    })
  })

  return {
    accessToken: response.data.access_token,
    expiresIn: response.data.expires_in ?? 60 * 24 * 60 * 60,    // default 60 days
  }
}

/**
 * Liệt kê pages user manage. Mỗi page có long-lived page token riêng — đây là
 * cái Sociflow lưu vào SocialAccount.accessToken (không phải user token).
 */
export async function fetchFacebookPages(longLivedUserToken: string): Promise<Array<PlatformChannelInfo & { pageAccessToken: string }>> {
  const me = await axios.get<FbMeResponse>('https://graph.facebook.com/v21.0/me', {
    params: { access_token: longLivedUserToken, fields: 'id,name' },
  }).catch((err) => {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'facebook',
      reason: 'me_fetch_failed',
      details: err.response?.data,
    })
  })

  const pagesResp = await axios.get<FbPagesResponse>(`https://graph.facebook.com/v21.0/${me.data.id}/accounts`, {
    params: {
      access_token: longLivedUserToken,
      fields: 'id,name,access_token,category,picture,fan_count,tasks',
      limit: 100,
    },
  }).catch((err) => {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'facebook',
      reason: 'pages_list_failed',
      details: err.response?.data,
    })
  })

  return pagesResp.data.data.map(page => ({
    platformUid: page.id,
    displayName: page.name,
    avatarUrl: page.picture?.data?.url,
    pageAccessToken: page.access_token,
    metadata: {
      category: page.category,
      fanCount: page.fan_count,
      tasks: page.tasks,
    },
  }))
}
