---
title: Facebook integration
description: OAuth, Page Graph API, publishing, automation
audience: [developer]
---

# Facebook

## OAuth setup

- **Developer console**: https://developers.facebook.com
- **App type**: Business
- **Products**: Facebook Login + Pages API

### Scopes

| Scope | Mục đích |
|---|---|
| `pages_show_list` | List Pages của user |
| `pages_manage_posts` | Đăng/sửa/xoá post |
| `pages_manage_engagement` | Reply comment |
| `pages_read_engagement` | Đọc post + comment metrics |
| `pages_messaging` (optional) | Messenger bot |
| `business_management` (optional) | Quản business assets |

### App review

Required nếu app dùng nhiều user. Submit:
- Screencast demo flow
- Business verification (cần Tax ID/giấy phép kinh doanh VN)
- Data deletion URL
- Privacy policy

Lead time: 1-3 tuần.

### Token

- User access token: 60 ngày (long-lived)
- Page access token: vô thời hạn (sau khi exchange từ user long-lived)
- Cần exchange user token → page token sau OAuth:

```ts
// Exchange short → long lived user token
GET https://graph.facebook.com/v18.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id={app_id}&
  client_secret={app_secret}&
  fb_exchange_token={short_token}

// Get page tokens
GET https://graph.facebook.com/v18.0/me/accounts?access_token={user_long_token}
// → returns [{ id, name, access_token, ... }] cho mỗi page
```

Lưu page token vào `SocialAccount.accessToken`, page ID vào `platformUid`.

## Publishing

Graph API endpoint base: `https://graph.facebook.com/v18.0`

### Text post

```
POST /{page-id}/feed
{
  message: "Hello world",
  access_token: {page_token}
}
→ { id: "{page_id}_{post_id}" }
```

### Photo

```
POST /{page-id}/photos
{
  url: "https://r2.../image.jpg",   // hoặc multipart upload
  caption: "...",
  published: true,
  access_token
}
```

### Video

```
POST /{page-id}/videos
{
  file_url: "https://r2.../video.mp4",
  description: "...",
  title: "...",
  access_token
}
```

**Lưu ý**: video lớn → dùng resumable upload qua `/{page-id}/video_reels` cho Reels hoặc chunked upload cho video thường.

### Link

```
POST /{page-id}/feed
{
  message: "...",
  link: "https://...",
  access_token
}
```

## Platform options

```ts
// platformOptions.FACEBOOK
{
  contentCategory: 'post' | 'reel',
  scheduledPublishTime?: number,   // Unix timestamp, future
  published?: boolean,             // false = draft
  targeting?: { countries: string[], age_min: number, ... },  // geo targeting
}
```

## Webhook

FB có webhook cho Page events:

```
POST /webhook/facebook
{
  object: 'page',
  entry: [{
    id: '{page-id}',
    time: 1234567890,
    changes: [{
      field: 'feed',
      value: {
        item: 'status' | 'comment' | 'reaction',
        post_id: '...',
        verb: 'add' | 'edit' | 'remove',
        ...
      }
    }]
  }]
}
```

Setup:
- Webhook URL: `https://api.sociflow.io/api/webhook/facebook`
- Verify token (echo lúc subscribe)
- Subscribe fields: `feed`, `mention`, `messages` (nếu Messenger)

## Update / delete

```ts
async updatePublished(record, account) {
  await axios.post(`https://graph.facebook.com/v18.0/${record.platformPostId}`, null, {
    params: {
      message: record.body,
      access_token: account.accessToken,
    },
  })
}

async delete(record, account) {
  await axios.delete(`https://graph.facebook.com/v18.0/${record.platformPostId}`, {
    params: { access_token: account.accessToken },
  })
}
```

## Engagement

### Fetch comments

```
GET /{post-id}/comments?fields=id,from,message,created_time,parent&access_token={token}
```

### Reply

```
POST /{comment-id}/comments
{ message: "Reply text", access_token }
```

## Constraints

| | Value |
|---|---|
| Post text max | 63,206 chars (đề xuất ≤ 500 cho engagement) |
| Photo max | 4 MB |
| Video max | 10 GB / 240 phút |
| Video formats | MP4, MOV |
| Reel duration | 3-90 giây |

## Quirks

- **`post_id` format**: `{page_id}_{numeric}` — lưu nguyên format
- **Scheduled publish** qua `scheduled_publish_time` (Unix), KHÔNG dùng `publishTime` của Sociflow → chuyển đổi
- **`is_published: false`** = lưu draft trong FB CMS, không lên feed
- **Pages vs Profile**: chỉ Pages publish được qua API. Personal profile cấm từ 2018.
- **Boost post** (paid promotion) — API riêng, không cùng publish flow
- **Targeting**: chỉ Pages có >100 follower mới enable

## Automation (extension fallback)

Khi user không pass app review:

URL: `https://www.facebook.com/{page-id}/posts`
Selectors:
- Composer: `[role="textbox"][data-text="true"]`
- Photo button: `[aria-label="Photo/video"]`
- Submit: `[aria-label="Post"]`

**Warning**: FB anti-bot rất mạnh. Tỉ lệ ban cao hơn TikTok. Khuyến cáo dùng API ngay khi qua được review.
