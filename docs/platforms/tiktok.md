---
title: TikTok integration
description: TikTok For Developers, Content Posting API, automation fallback
audience: [developer]
---

# TikTok

## OAuth setup

- **Developer console**: https://developers.tiktok.com
- **API**: Content Posting API (cần app review)
- **Login Kit**: TikTok Login

### Scopes

| Scope | Mục đích |
|---|---|
| `user.info.basic` | Display name, avatar |
| `user.info.profile` | Full profile + privacy level |
| `user.info.stats` | Follower count |
| `video.publish` | Upload video direct publish |
| `video.upload` | Upload to inbox (user xác nhận trong app) |
| `video.list` | List user's videos |

### App review

**Khó nhất trong 4 platform**. TT yêu cầu:
- Business verification
- Đóng phí $0 nhưng nhiều form
- Screencast demo flow
- Privacy policy chi tiết
- Tax info

Lead time: **2-6 tuần**. Reject rate cao.

→ Plan B: dùng `video.upload` (không cần review nặng) → upload vào TT inbox, user mở TT app confirm publish. UX kém hơn nhưng có thể launch sớm.

→ Plan C: Automation extension (Phase 5).

### Token

- Access token: 24 giờ
- Refresh token: 365 ngày (1 năm)
- Refresh trước khi expire

## Publishing — Content Posting API

### Init upload

```
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Authorization: Bearer {access_token}
{
  post_info: {
    title: "Caption with #hashtag",
    privacy_level: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY",
    disable_duet: false,
    disable_comment: false,
    disable_stitch: false,
    video_cover_timestamp_ms: 1000,
    brand_content_toggle: false,
    brand_organic_toggle: false,
  },
  source_info: {
    source: "FILE_UPLOAD",
    video_size: 12345678,
    chunk_size: 10000000,
    total_chunk_count: 2,
  }
}
→ {
  publish_id: "...",
  upload_url: "https://..."
}
```

### Upload chunks

```
PUT {upload_url}
Content-Range: bytes 0-9999999/12345678
Content-Type: video/mp4
{binary chunk}
```

### Check status

```
POST /v2/post/publish/status/fetch/
{ publish_id }
→ {
  status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "PUBLISH_COMPLETE" | "FAILED",
  publicaly_available_post_id?: "tiktok-post-id",
  fail_reason?: "..."
}
```

Poll mỗi 5-10s cho tới khi `PUBLISH_COMPLETE`.

### URL `PULL_FROM_URL` (đơn giản hơn)

Thay vì chunk upload, TT có thể pull từ URL:

```
POST /v2/post/publish/video/init/
{
  post_info: {...},
  source_info: {
    source: "PULL_FROM_URL",
    video_url: "https://cdn.sociflow.io/video.mp4"
  }
}
```

→ TT download, không cần upload chunks. **Khuyến cáo dùng cách này** với R2 public URL.

## Provider implementation

```ts
async publish(record, account): Promise<PublishResult> {
  const media = await this.mediaRepo.getById(record.mediaIds[0])
  const opts = record.platformOptions?.TIKTOK ?? {}

  const initRes = await axios.post('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    post_info: {
      title: this.buildTitle(record),
      privacy_level: opts.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
      disable_comment: opts.disableComment ?? false,
      disable_duet: opts.disableDuet ?? false,
      disable_stitch: opts.disableStitch ?? false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: media.r2Url,
    },
  }, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
  })

  const publishId = initRes.data.data.publish_id

  // Poll status
  const result = await this.pollPublishStatus(publishId, account.accessToken)
  if (result.status === 'FAILED') {
    throw new AppException(ResponseCode.PublishRejectedByPlatform, { reason: result.fail_reason })
  }

  return {
    platformPostId: result.publicaly_available_post_id!,
    workLink: `https://www.tiktok.com/@${account.metadata?.username}/video/${result.publicaly_available_post_id}`,
  }
}
```

## Constraints

| | Value |
|---|---|
| Title max | 2,200 chars (đề xuất 150 đầu hiển thị) |
| Video duration | 3 sec - 10 min |
| Video max size | 4 GB |
| Video formats | MP4, MOV, WebM |
| Aspect ratio đề xuất | 9:16 (vertical) |
| Privacy levels | `PUBLIC_TO_EVERYONE` / `MUTUAL_FOLLOW_FRIENDS` / `SELF_ONLY` |
| Hashtag | Inline trong title `#tag` |
| Quota | Theo app tier, base 1000/day |

## Webhook

```
POST /webhook/tiktok
{
  client_key: "...",
  event: "post.publish.complete" | "post.publish.failed",
  create_time: 123,
  data: {
    publish_id: "...",
    publicaly_available_post_id: "..."
  }
}
```

Verify signature:

```ts
function verifyTiktokWebhook(headers: { 'x-tt-signature': string }, body: any, secret: string) {
  const timestamp = headers['x-tiktok-timestamp']
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(timestamp + JSON.stringify(body))
    .digest('hex')
  return headers['x-tt-signature'] === expectedSig
}
```

## Engagement

**TT engagement API rất hạn chế**:
- Comment fetch: **chỉ comment trên video CỦA MÌNH** (Display API)
- Reply comment: **không có endpoint public** (chỉ qua TikTok Business Solution / partner)

→ Engage trên TT chủ yếu qua automation extension.

## Quirks

- **App review pain**: chuẩn bị business doc + screencast kỹ
- **PULL_FROM_URL** cần R2 public — đảm bảo `https://cdn.sociflow.io` public access
- **Video review by TT**: sau publish, TT review 1-30 phút trước khi public. Status = `REVIEW_PENDING` trong Sociflow.
- **Reject reason**: content policy, music copyright, watermark... lưu vào `errorMessage`
- **Watermark**: nếu video có watermark từ platform khác → reject
- **Aspect ratio 16:9**: vẫn upload được nhưng letterbox + reach thấp
- **Brand content toggle**: bắt buộc bật nếu video là sponsored → ảnh hưởng đến reach algo

## Automation (Phase 5 priority)

Vì App Review khó, đa số user sẽ dùng automation.

URL: `https://www.tiktok.com/upload?lang=en`

Selectors (cần verify trước khi code):
- File input: `input[type=file][accept*=video]`
- Caption editor: `[contenteditable="true"][data-text]`  (rich text editor)
- Cover thumbnail: trong `[class*=cover]`
- Privacy dropdown: `[class*=privacy-selector]`
- Post button: `button[data-e2e="post_button"]`

Anti-detection cần:
- Random delay 1-3s giữa actions
- Type with delay 50-150ms/char (caption editor reject paste content nguyên block)
- Không dùng `chrome.debugger`
- Mouse move trước click (optional, `ghost-cursor`)

Khả năng bị TT detect khá cao. Có thể fail rate 20-40% tuần đầu. Lifecycle:

1. Upload → có thể bị "Login expired" giả → user re-login → retry
2. Submit → có thể bị captcha → user solve → retry

→ UI cần "Resume task" để user xử lý.

## Tài liệu liên quan

- [decisions/0003-chrome-extension-only.md](../decisions/0003-chrome-extension-only.md) — vì sao chọn extension
- [05-automation-extension.md](../05-automation-extension.md) — chi tiết automation
