---
title: YouTube integration
description: OAuth, API endpoints, quirks, automation selectors
audience: [developer]
---

# YouTube

## OAuth setup

- **Developer console**: https://console.cloud.google.com
- **API**: YouTube Data API v3 (enable in console)
- **OAuth scopes** cần xin:
  - `https://www.googleapis.com/auth/youtube.upload` — upload video
  - `https://www.googleapis.com/auth/youtube.readonly` — analytics
  - `https://www.googleapis.com/auth/youtube.force-ssl` — update, delete

### Verification

YouTube yêu cầu **OAuth verification** trước khi distribute app cho user > 100. Submit:
- Privacy policy URL
- Terms of service URL
- App homepage
- Demo video flow đăng bài

Lead time: 2-4 tuần.

### Token

- Access token: 1 giờ
- Refresh token: vô thời hạn (trừ khi user revoke)
- Lưu encrypted

## API endpoints

| Action | Endpoint | Notes |
|---|---|---|
| Upload video | `videos.insert` | Resumable upload, multipart |
| Update video | `videos.update` | Title, desc, tags, privacy |
| Delete | `videos.delete` | - |
| Channel info | `channels.list?part=snippet,statistics&mine=true` | - |
| List comments | `commentThreads.list?part=snippet,replies&videoId=XXX` | Pagination via `pageToken` |
| Reply comment | `comments.insert` | - |
| Analytics | `youtubeAnalytics.reports.query` | Khác API, separate scope |

SDK: `googleapis` npm package.

## Quota

- Free tier: **10,000 units/day**
- Cost (units/call):
  - `videos.insert` upload: **1,600**
  - `videos.update`: 50
  - `commentThreads.list`: 1
  - `comments.insert`: 50
  - Search: 100

→ Default = ~6 upload/day. **Cần xin nâng quota** (form Google) cho production.

## Publish flow

```ts
// apps/api/src/core/publish/providers/youtube.provider.ts
@Injectable()
export class YoutubeProvider implements PublishProvider {
  readonly platform = AccountPlatform.YOUTUBE

  async validate(dto: CreatePublishDto, account: SocialAccount): Promise<ValidationResult> {
    if (!dto.mediaIds.length) return { success: false, errors: { mediaIds: 'YT cần ít nhất 1 video' } }
    const media = await this.mediaRepo.getById(dto.mediaIds[0])
    if (media.type !== 'VIDEO') return { success: false, errors: { mediaIds: 'YT chỉ accept video' } }
    if ((dto.title?.length ?? 0) > 100) return { success: false, errors: { title: 'max 100 chars' } }
    return { success: true }
  }

  async publish(record: PublishRecord, account: SocialAccount): Promise<PublishResult> {
    const youtube = google.youtube({ version: 'v3', auth: await this.getAuth(account) })
    const media = await this.mediaRepo.getById(record.mediaIds[0])
    const stream = await this.storage.streamFromR2(media.r2Key)

    const opts = record.platformOptions?.YOUTUBE ?? {}
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: record.title ?? 'Untitled',
          description: record.body ?? '',
          tags: opts.tags ?? [],
          categoryId: opts.categoryId ?? '22',
        },
        status: {
          privacyStatus: opts.privacyStatus ?? 'public',
          selfDeclaredMadeForKids: opts.selfDeclaredMadeForKids ?? false,
        },
      },
      media: { body: stream },
    }, {
      onUploadProgress: (e) => this.reportProgress(record.id, (e.bytesRead / media.sizeBytes) * 100),
    })

    const videoId = response.data.id!
    return {
      platformPostId: videoId,
      workLink: `https://youtu.be/${videoId}`,
    }
  }
}
```

## Constraints

| | Value |
|---|---|
| Video max size | 256 GB / 12 hours |
| Video formats | MOV, MPEG-4, MP4, AVI, WMV, FLV, 3GPP, WebM |
| Title max | 100 chars |
| Description max | 5000 chars |
| Tags max total | 500 chars |
| Categories | Fixed list (vd 22 = People & Blogs) |
| Privacy | `public` / `private` / `unlisted` |

## Webhook

YouTube **không có** webhook cho upload status. Sau khi `videos.insert` thành công, video có thể vẫn đang processing. Để check:

- `videos.list?id=XXX&part=processingDetails`
- Poll mỗi 30s tới khi `processingStatus === 'succeeded'`

## Update/delete

```ts
async updatePublished(record, account) {
  const youtube = google.youtube({ version: 'v3', auth })
  await youtube.videos.update({
    part: ['snippet', 'status'],
    requestBody: {
      id: record.platformPostId,
      snippet: { title: record.title, description: record.body },
      status: { privacyStatus: opts.privacyStatus },
    },
  })
}
```

## Automation (fallback)

Khi user không pass OAuth verification. Content-script target:

- URL: `https://studio.youtube.com/channel/UCxxx/videos`
- Click "Create" → "Upload videos"
- File input: `input[type=file][accept^=video]`
- Title: `[aria-label="Add a title that describes your video"]`
- Description: `[aria-label="Tell viewers about your video"]`
- Publish button: `tp-yt-paper-button#done-button`

**Note**: YT Studio dùng Polymer + shadow DOM nhiều → selector phức tạp hơn. Cần `document.querySelector('ytcp-uploads-dialog').shadowRoot.querySelector(...)`.

## Engagement

### Fetch comments

```ts
async fetchComments(post: PublishRecord, opts: { since: Date }) {
  const youtube = google.youtube({ version: 'v3', auth })
  const res = await youtube.commentThreads.list({
    part: ['snippet', 'replies'],
    videoId: post.platformPostId!,
    maxResults: 100,
    order: 'time',
  })
  return res.data.items?.map(this.mapToRawComment).filter(c => c.publishedAt > opts.since) ?? []
}
```

### Reply

```ts
async postReply(account, comment, body) {
  const youtube = google.youtube({ version: 'v3', auth })
  const res = await youtube.comments.insert({
    part: ['snippet'],
    requestBody: {
      snippet: { parentId: comment.platformCommentId, textOriginal: body },
    },
  })
  return { platformReplyId: res.data.id! }
}
```

## Quirks & gotchas

- **OAuth verification chậm** — submit sớm
- **Quota** rất tight — cache analytics, batch comments fetch
- **Video processing** mất 1-30 phút sau upload → status PUBLISHED chỉ khi processing done
- **Shorts** đẩy lên = video < 60s vertical → tự động vào Shorts feed, không cần flag
- **Made for kids** flag bắt buộc khai báo
- **Category** không thay đổi sau publish (workaround: re-upload)
- **Title không nên có emoji** ở đầu (cản search ranking) — UX hint cho user
