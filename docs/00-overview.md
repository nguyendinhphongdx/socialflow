---
title: Product overview
description: Vision, problem, target user, value proposition của Sociflow
audience: [pm, developer, ai-agent]
---

# Product overview

## 1-sentence pitch

> Sociflow là **content & social marketing platform** giúp creator và agency tại Việt Nam **tạo nội dung bằng AI, đăng đồng thời lên FB/IG/TikTok/YouTube, tự động tương tác, theo dõi doanh thu** — qua web + browser extension.

## Vấn đề

Creator và agency VN đang đối mặt:

1. **Quản lý đa nền tảng phân mảnh**: mỗi platform 1 dashboard, mỗi account 1 lần login, không có view tổng.
2. **Tạo nội dung tốn thời gian**: viết caption, gen ảnh, gen video — làm thủ công cho 4 nền tảng × N account = mất ngày/post.
3. **Đăng bài lặp lại**: cùng nội dung phải re-upload, re-fill metadata cho từng nền tảng, manual schedule.
4. **Engagement scale không nổi**: 100 comment/ngày trả lời tay không kịp, mất khách.
5. **Không track được doanh thu thực**: brand deal, affiliate, ads revenue từ mỗi nền tảng nằm rời rạc.
6. **Tài khoản mới không có OAuth API access**: TikTok content posting API yêu cầu app review 2-4 tuần, FB/IG cần business verification — barrier cho creator nhỏ.

## Giải pháp

Một platform thống nhất 4 năng lực:

| Năng lực | Mô tả |
|---|---|
| **Create** | AI gen caption, ảnh, video. Adapt nội dung tự động theo style từng platform (length, hashtag, tone). |
| **Publish** | One-click đăng đa nền tảng. Lịch schedule trên calendar. Hai cơ chế: **API** (OAuth chính thức) hoặc **Automation** (browser extension trên máy user). |
| **Engage** | AI auto-reply comment theo tone của brand. Brand mention monitoring. Comment mining tìm intent mua hàng. |
| **Track** | Dashboard analytics + thu chi (ads, brand deal, affiliate) tổng hợp. |

## Target user

### Persona 1: Solo creator (60% TAM)
- 1 người làm content cho 2-4 nền tảng
- 10K-500K follower
- Đăng 1-5 post/ngày
- Đau: thời gian, tools rời rạc
- WTP: 200-500K VND/tháng

### Persona 2: Small agency / MCN (30% TAM)
- 2-10 staff, quản 10-50 client account
- Đăng 50-500 post/ngày
- Đau: scale, audit, report client
- WTP: 5-20M VND/tháng (per-seat hoặc volume)

### Persona 3: SMB brand (10% TAM)
- 1-3 marketer in-house
- Đăng 5-20 post/ngày, focus engagement + ads
- Đau: ROI tracking, brand mention
- WTP: 1-5M VND/tháng

## Value proposition theo persona

| Persona | Hook chính |
|---|---|
| Solo creator | "Tiết kiệm 20h/tuần làm content" |
| Agency | "Quản 50 account 1 dashboard, audit từng post" |
| SMB | "Theo dõi mention + auto reply 24/7" |

## Khác biệt vs đối thủ

| | Buffer / Hootsuite | Later | AiToEarn (TQ) | **Sociflow** |
|---|---|---|---|---|
| Đăng đa nền tảng | ✅ | ✅ | ✅ | ✅ |
| AI gen content | ⚠️ basic | ⚠️ basic | ✅ | ✅ |
| AI gen video | ❌ | ❌ | ✅ | ✅ (qua API provider) |
| Browser automation | ❌ | ❌ | ✅ (extension TQ) | ✅ |
| Hỗ trợ TikTok publish | ⚠️ giới hạn | ⚠️ | ✅ | ✅ |
| Tiếng Việt + UX VN | ❌ | ❌ | ❌ | ✅ |
| Hỗ trợ Zalo OA *(future)* | ❌ | ❌ | ❌ | 🟡 phase 4+ |
| Pricing VN-friendly | ❌ (USD) | ❌ | ⚠️ | ✅ (VND) |

**Moat của Sociflow**: VN-first localization (UX, pricing, support, integration Zalo/momo billing) + extension automation cho user không qua được OAuth review.

## Non-goals

Để tránh scope creep, **những thứ Sociflow KHÔNG làm** (ít nhất Phase 1-3):

- ❌ Nền tảng Trung Quốc (Douyin, Xiaohongshu, Kuaishou, B站, WeChat) — không phải VN market
- ❌ Marketplace creator ↔ brand task (CPS/CPE/CPM như AiToEarn) — quá lớn cho solo, làm sau khi có team
- ❌ MCP server expose ra ngoài — nice-to-have, làm khi có time
- ❌ Electron desktop app — extension đủ cho 95% use case
- ❌ Live streaming tools — out of scope
- ❌ E-commerce integration (Shopee/Lazada) — phase 4+

## Success metrics (MVP launch, tháng 6)

| Metric | Target 3 tháng sau launch |
|---|---|
| Active users (đăng bài 7 ngày gần nhất) | 100 |
| Posts published qua platform | 5,000 |
| Paid conversion | 5% |
| MRR | 10M VND |
| Churn tháng | < 15% |

## Tài liệu liên quan

- [01-features.md](01-features.md) — Feature list chi tiết
- [02-architecture.md](02-architecture.md) — Cách build
- [11-roadmap.md](11-roadmap.md) — Khi nào ship cái gì
