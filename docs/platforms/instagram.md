---
title: Instagram integration
description: Instagram Graph API (Business/Creator account), publishing, reels
audience: [developer]
---

# Instagram

Instagram dùng **Meta Graph API**, chỉ support **Business hoặc Creator account** liên kết với Facebook Page.

## OAuth setup

- Dùng cùng app FB Developer
- Scopes:
  - `instagram_basic` — read profile
  - `instagram_content_publish` — publish post + reel
  - `instagram_manage_comments` — reply comment
  - `instagram_manage_insights` — analytics
  - `pages_show_list` + `pages_read_engagement` (FB Pages prerequisite)

### Flow

1. User authorize FB app (giống Facebook flow)
2. Lấy page tokens: `GET /me/accounts`
3. Tìm IG Business Account ID liên kết với từng FB Page:
   ```
   GET /{page-id}?fields=instagram_business_account&access_token={page_token}
   → { instagram_business_account: { id: "{ig-business-id}" } }
   ```
4. Lưu vào `SocialAccount`:
   - `platform = INSTAGRAM`
   - `platformUid = ig-business-id`
   - `accessToken = page_token` (dùng chung với FB Page)
   - `metadata.fbPageId = page-id`

### Token

Giống FB Page token — vô thời hạn nếu đã exchange long-lived.

## Publishing

IG Graph API publish là **2-step**:

### Step 1: Create container

```
POST /{ig-business-id}/media
{
  media_type: 'IMAGE' | 'VIDEO' | 'REELS' | 'CAROUSEL',
  image_url: 'https://r2.../img.jpg',     // cho IMAGE
  video_url: 'https://r2.../video.mp4',   // cho VIDEO / REELS
  caption: '...',
  thumb_offset: 0,                        // ms cho video thumbnail
  cover_url: 'https://r2.../cover.jpg',   // cover Reel
  access_token
}
→ { id: '{container-id}' }
```

### Step 2: Publish container

```
POST /{ig-business-id}/media_publish
{ creation_id: '{container-id}', access_token }
→ { id: '{ig-media-id}' }
```

### Status polling

Container có thể chưa ready (đang upload/process):

```
GET /{container-id}?fields=status_code&access_token
→ { status_code: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' }
```

Đợi `FINISHED` rồi mới publish container.

## Provider implementation

```ts
async publish(record, account): Promise<PublishResult> {
  const media = await this.mediaRepo.getById(record.mediaIds[0])
  const opts = record.platformOptions?.INSTAGRAM ?? {}

  const mediaType = opts.contentCategory === 'reel' ? 'REELS' :
    media.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'

  // Step 1: create container
  const containerRes = await axios.post(`https://graph.facebook.com/v18.0/${account.platformUid}/media`, null, {
    params: {
      media_type: mediaType,
      ...(media.type === 'IMAGE' ? { image_url: media.r2Url } : { video_url: media.r2Url }),
      caption: this.buildCaption(record),
      access_token: account.accessToken,
    },
  })
  const containerId = containerRes.data.id

  // Step 2: poll
  await this.pollContainerReady(containerId, account.accessToken)

  // Step 3: publish
  const publishRes = await axios.post(`https://graph.facebook.com/v18.0/${account.platformUid}/media_publish`, null, {
    params: { creation_id: containerId, access_token: account.accessToken },
  })

  const mediaId = publishRes.data.id
  return {
    platformPostId: mediaId,
    workLink: await this.getMediaUrl(mediaId, account.accessToken),
  }
}

private async pollContainerReady(containerId: string, token: string, maxWaitMs = 5 * 60_000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await axios.get(`https://graph.facebook.com/v18.0/${containerId}`, {
      params: { fields: 'status_code', access_token: token },
    })
    if (res.data.status_code === 'FINISHED') return
    if (res.data.status_code === 'ERROR') throw new Error('IG container error')
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('IG container timeout')
}
```

## Carousel (multi-image)

3-step:
1. Tạo container cho mỗi child item (mỗi ảnh)
2. Tạo container CAROUSEL với `children: [child_id_1, child_id_2, ...]`
3. Publish container CAROUSEL

```
POST /{ig-business-id}/media
{
  media_type: 'CAROUSEL',
  children: ['18001...', '18002...'],
  caption: '...',
  access_token
}
```

## Constraints

| | Value |
|---|---|
| Caption max | 2,200 chars |
| Hashtag max | 30 |
| @mention max | 20 |
| Image: aspect ratio | 4:5 → 1.91:1 |
| Image max | 8 MB |
| Video duration (post) | 3-60 sec |
| Video duration (reel) | 3-90 sec |
| Video max | 4 GB / 1080p / MP4 |
| Carousel | 2-10 items |
| Publish quota | 50 posts/24h per account |

## Webhook

```
POST /webhook/instagram
{
  object: 'instagram',
  entry: [{
    id: '{ig-business-id}',
    time: 123,
    changes: [{
      field: 'comments' | 'mentions',
      value: {
        id: '{comment-id}',
        text: '...',
        from: { id, username }
      }
    }]
  }]
}
```

## Engagement

### Fetch comments

```
GET /{media-id}/comments?fields=id,from,text,timestamp,replies&access_token
```

### Reply

```
POST /{media-id}/comments
{ message: 'Reply text', access_token }

# Hoặc reply nested comment:
POST /{comment-id}/replies
```

## Quirks

- **Media URL phải public + HTTPS** — Sociflow R2 custom domain `https://cdn.sociflow.io` OK
- **2-step publish** mất extra latency — UI cần hiển thị progress
- **Carousel video**: chỉ accept tất cả video cùng resolution
- **Reel cover** tự generate nếu không cung cấp
- **Tagging users** trong caption: `@username` nhưng IG strip `@` nếu user không tồn tại
- **Mention notification** chỉ gửi cho IG Business/Creator account, không gửi cho personal
- **Hashtag duy nhất 30/post** — nhiều hơn → reject silent (không error)
- **Edit caption** sau publish: chỉ trong 24h, qua `POST /{media-id}?caption=NEW_TEXT`
- **Delete media**: KHÔNG có endpoint API (limit của Meta). Phải qua app UI hoặc automation.

## Automation (extension)

URL: `https://www.instagram.com/`
Pattern: click "Create" button → dialog wizard

Khá phức tạp do IG dùng React + nested modal. Khuyến cáo: chỉ dùng cho user không pass Meta App Review.

Selectors:
- Create button: `[aria-label="New post"]`
- File input: `input[type=file][accept^=image]` hoặc `accept^=video`
- Caption: `[aria-label="Write a caption..."]`
- Share button: `button:has-text("Share")`

## Tài liệu liên quan

- [facebook.md](facebook.md) — IG dùng chung token với FB Page
