import axios from 'axios'
import { AppException, ResponseCode } from '@sociflow/common'
import type { OAuthProviderConfig, PlatformChannelInfo } from '../types'

interface InstagramProviderEnv {
  clientId: string
  clientSecret: string
}

/**
 * Instagram OAuth — qua **Meta Login for Business** (cùng app với Facebook).
 *
 * IG Business / Creator account phải link với FB page → access qua Graph API path
 * `/{pageId}?fields=instagram_business_account`.
 *
 * Scopes:
 * - `pages_show_list` — list FB pages user manage
 * - `instagram_basic` — read IG profile/posts
 * - `instagram_content_publish` — publish content lên IG Business
 * - `business_management` — manage business assets
 */
export function createInstagramProviderConfig(env: InstagramProviderEnv): OAuthProviderConfig {
  return {
    id: 'instagram',
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    scopes: [
      'public_profile',
      'pages_show_list',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ],
    usePkce: false,
    extraAuthorizeParams: { response_type: 'code' },
  }
}

interface FbPageWithIg {
  id: string
  name: string
  access_token: string
  instagram_business_account?: { id: string }
}

interface IgAccountInfo {
  id: string
  username: string
  name?: string
  profile_picture_url?: string
  followers_count?: number
  media_count?: number
}

/**
 * Fetch tất cả IG Business account user manage (qua FB pages có IG linked).
 *
 * Mỗi IG account có:
 * - `platformUid` = ig_business_account.id
 * - access token = page_access_token của FB page chứa nó
 */
export async function fetchInstagramAccounts(
  longLivedUserToken: string,
): Promise<Array<PlatformChannelInfo & { pageAccessToken: string }>> {
  const meResp = await axios.get<{ id: string }>('https://graph.facebook.com/v21.0/me', {
    params: { access_token: longLivedUserToken, fields: 'id' },
  }).catch((err) => {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'instagram',
      reason: 'me_fetch_failed',
      details: err.response?.data,
    })
  })

  const pagesResp = await axios.get<{ data: FbPageWithIg[] }>(`https://graph.facebook.com/v21.0/${meResp.data.id}/accounts`, {
    params: {
      access_token: longLivedUserToken,
      fields: 'id,name,access_token,instagram_business_account',
      limit: 100,
    },
  }).catch((err) => {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'instagram',
      reason: 'pages_list_failed',
      details: err.response?.data,
    })
  })

  const pagesWithIg = pagesResp.data.data.filter(p => p.instagram_business_account?.id)
  if (pagesWithIg.length === 0) {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'instagram',
      reason: 'no_ig_business_account_linked',
      hint: 'IG account phải Business/Creator + link với FB page',
    })
  }

  const accounts: Array<PlatformChannelInfo & { pageAccessToken: string }> = []
  for (const page of pagesWithIg) {
    const igId = page.instagram_business_account!.id
    const info = await axios.get<IgAccountInfo>(`https://graph.facebook.com/v21.0/${igId}`, {
      params: {
        access_token: page.access_token,
        fields: 'id,username,name,profile_picture_url,followers_count,media_count',
      },
    }).catch(() => null)
    accounts.push({
      platformUid: igId,
      displayName: info?.data.username ?? `@${igId}`,
      avatarUrl: info?.data.profile_picture_url,
      pageAccessToken: page.access_token,
      metadata: {
        username: info?.data.username,
        name: info?.data.name,
        followersCount: info?.data.followers_count,
        mediaCount: info?.data.media_count,
        linkedFbPageId: page.id,
        linkedFbPageName: page.name,
      },
    })
  }
  return accounts
}
