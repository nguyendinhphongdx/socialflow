import axios from 'axios'
import { AppException, ResponseCode } from '@sociflow/common'
import type { OAuthProviderConfig, PlatformChannelInfo } from '../types'

interface TikTokProviderEnv {
  clientId: string                  // = TikTok Client Key
  clientSecret: string
}

/**
 * TikTok OAuth (v2 — Content Posting API).
 *
 * App phải đăng ký <https://developers.tiktok.com> và pass review để có scope `video.publish`.
 * Trong sandbox, chỉ test users của app được publish.
 *
 * Scopes:
 * - `user.info.basic` — read user info
 * - `user.info.profile` — read profile (display name, avatar)
 * - `user.info.stats` — followers, video counts
 * - `video.list` — list user's videos
 * - `video.upload` — upload video (legacy, deprecated for direct post)
 * - `video.publish` — direct post / draft video
 */
export function createTikTokProviderConfig(env: TikTokProviderEnv): OAuthProviderConfig {
  return {
    id: 'tiktok',
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    revokeUrl: 'https://open.tiktokapis.com/v2/oauth/revoke/',
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    scopes: [
      'user.info.basic',
      'user.info.profile',
      'user.info.stats',
      'video.list',
      'video.publish',
    ],
    usePkce: true,
    extraAuthorizeParams: {
      response_type: 'code',
      // TikTok yêu cầu `client_key` thay `client_id` ở authorize URL.
      // OAuthService dùng tên chuẩn `client_id` — TikTok lấy được vì alias.
    },
  }
}

interface TikTokUserInfo {
  data?: {
    user?: {
      open_id?: string
      union_id?: string
      avatar_url?: string
      avatar_url_100?: string
      display_name?: string
      bio_description?: string
      profile_deep_link?: string
      is_verified?: boolean
      follower_count?: number
      following_count?: number
      likes_count?: number
      video_count?: number
    }
  }
  error?: { code?: string, message?: string }
}

/**
 * Fetch TikTok user profile sau khi exchange access token.
 *
 * Endpoint: GET /v2/user/info/ với `fields` query param.
 */
export async function fetchTikTokUser(accessToken: string): Promise<PlatformChannelInfo> {
  const fields = [
    'open_id', 'union_id', 'avatar_url', 'avatar_url_100',
    'display_name', 'bio_description', 'profile_deep_link', 'is_verified',
    'follower_count', 'following_count', 'likes_count', 'video_count',
  ].join(',')

  const response = await axios.get<TikTokUserInfo>(
    'https://open.tiktokapis.com/v2/user/info/',
    {
      params: { fields },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  ).catch((err) => {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'tiktok',
      reason: 'user_info_fetch_failed',
      details: err.response?.data,
    })
  })

  const user = response.data.data?.user
  if (!user?.open_id) {
    throw new AppException(ResponseCode.AccountOAuthFailed, {
      provider: 'tiktok',
      reason: 'invalid_user_info_response',
      details: response.data,
    })
  }

  return {
    platformUid: user.open_id,
    displayName: user.display_name ?? `tiktok_${user.open_id.slice(0, 8)}`,
    avatarUrl: user.avatar_url_100 ?? user.avatar_url,
    metadata: {
      unionId: user.union_id,
      bioDescription: user.bio_description,
      profileDeepLink: user.profile_deep_link,
      isVerified: user.is_verified,
      followerCount: user.follower_count,
      followingCount: user.following_count,
      likesCount: user.likes_count,
      videoCount: user.video_count,
    },
  }
}
