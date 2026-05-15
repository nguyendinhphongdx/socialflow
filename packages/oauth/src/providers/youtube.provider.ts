import axios from 'axios'
import { AppException, ResponseCode } from '@sociflow/common'
import type { OAuthProviderConfig, PlatformChannelInfo } from '../types'

interface YouTubeProviderEnv {
  clientId: string
  clientSecret: string
}

/**
 * YouTube OAuth (cho connect account, upload video).
 *
 * Scopes:
 * - `youtube.upload` — upload video (write)
 * - `youtube.readonly` — list channel info
 * - `youtube.force-ssl` — manage comments
 */
export function createYouTubeProviderConfig(env: YouTubeProviderEnv): OAuthProviderConfig {
  return {
    id: 'youtube',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ],
    extraAuthorizeParams: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
    usePkce: true,
  }
}

interface YouTubeChannelListResponse {
  items: Array<{
    id: string
    snippet: {
      title: string
      thumbnails?: { default?: { url?: string }, high?: { url?: string } }
    }
    statistics?: {
      subscriberCount?: string
      videoCount?: string
      viewCount?: string
    }
  }>
}

export async function fetchYouTubeChannel(accessToken: string): Promise<PlatformChannelInfo> {
  const response = await axios.get<YouTubeChannelListResponse>(
    'https://www.googleapis.com/youtube/v3/channels',
    {
      params: { part: 'snippet,statistics', mine: 'true' },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  ).catch((err) => {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'youtube',
      reason: 'channel_fetch_failed',
      details: err.response?.data,
    })
  })

  const channel = response.data.items?.[0]
  if (!channel) {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'youtube',
      reason: 'no_channel_found',
    })
  }

  const thumb = channel.snippet.thumbnails?.high?.url ?? channel.snippet.thumbnails?.default?.url
  return {
    platformUid: channel.id,
    displayName: channel.snippet.title,
    avatarUrl: thumb,
    metadata: {
      subscriberCount: channel.statistics?.subscriberCount,
      videoCount: channel.statistics?.videoCount,
      viewCount: channel.statistics?.viewCount,
    },
  }
}
